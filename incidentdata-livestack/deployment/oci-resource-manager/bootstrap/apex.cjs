'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),crypto=require('node:crypto');
const o=require('oracledb');o.outFormat=o.OUT_FORMAT_OBJECT;
const {assertTarget,credentials}=require('./database.cjs');
async function connect(config,user){const c=await o.getConnection(credentials(config,user));assertTarget(config,(await c.execute("SELECT SYS_CONTEXT('USERENV','DB_NAME') n FROM dual")).rows[0].N);c.callTimeout=180000;return c;}
async function receipt(c,name,sha){
 const prior=(await c.execute('SELECT artifact_sha256 FROM id_deployment_state WHERE component=:n',{n:name})).rows[0];
 if(prior&&prior.ARTIFACT_SHA256!==sha)throw Error('Different APEX release already recorded');
 if(!prior){await c.execute('INSERT INTO id_deployment_state(component,artifact_sha256) VALUES(:n,:sha)',{n:name,sha});await c.commit();}return !!prior;
}
async function sqlcl(config,script,logFile){
 if(!/^ID[0-9A-F]{6}$/.test(config.database_name)||!/^[A-Za-z0-9]{20,64}$/.test(config.schema_password)||!/^[a-z0-9_]+$/.test(config.connect_string)||!/^\/[A-Za-z0-9_./-]+$/.test(config.wallet_zip))throw Error('Unsafe SQLcl connection configuration');
 const user=config.sqlcl_user||'CRIME_DATA';if(!['CRIME_DATA','ADMIN'].includes(user))throw Error('Invalid SQLcl deployment user');
 const loginPassword=user==='ADMIN'?config.admin_password:config.schema_password;
 if(!/^[A-Za-z0-9]{20,64}$/.test(loginPassword))throw Error('Invalid SQLcl deployment password');
 const input=`set echo off verify off feedback off define off\nwhenever sqlerror exit failure rollback\nwhenever oserror exit failure rollback\nset cloudconfig ${config.wallet_zip}\nconnect ${user}/"${loginPassword}"@${config.connect_string}\nBEGIN\n IF NOT REGEXP_LIKE(SYS_CONTEXT('USERENV','DB_NAME'),'_${config.database_name}$','i') THEN raise_application_error(-20001,'SQLcl target database mismatch'); END IF;\nEND;\n/\n${script}\nexit success\n`;
 let output='';const code=await new Promise((resolve,reject)=>{const child=spawn(config.sqlcl||'/opt/sqlcl/bin/sql',['-S','/nolog'],{stdio:['pipe','pipe','pipe']});child.stdout.on('data',b=>{output=(output+b).slice(-200000);});child.stderr.on('data',b=>{output=(output+b).slice(-200000);});child.on('error',reject);child.on('close',resolve);child.stdin.end(input);});
 for(const key of ['schema_password','admin_password','wallet_password','dump_password'])if(config[key])output=output.split(config[key]).join('[redacted]');
 await fs.writeFile(logFile,output,{mode:0o600});if(code!==0||/ORA-\d{5}|SP2-\d+/.test(output))throw Error('APEX SQLcl import failed; inspect its redacted private log');
}
async function install(config,root){
 const admin=await connect(config,'ADMIN'),app=await connect(config,'CRIME_DATA');
 try{
  const workspace=(await admin.execute("SELECT workspace_id FROM apex_workspaces WHERE workspace='CRIME_DATA'")).rows[0];
  if(!workspace){
   // Keep the new workspace identifier exact in JavaScript and browser tooling.
   const workspaceId=1000000000+Number.parseInt(config.database_name.slice(2),16);
   const occupied=(await admin.execute('SELECT COUNT(*) n FROM apex_workspaces WHERE workspace_id=:id',{id:workspaceId})).rows[0].N;
   if(occupied)throw Error('Deployment workspace identifier is already owned');
   await admin.execute("BEGIN APEX_INSTANCE_ADMIN.ADD_WORKSPACE(p_workspace_id=>:id,p_workspace=>'CRIME_DATA',p_primary_schema=>'CRIME_DATA'); END;",{id:workspaceId});
   await admin.commit();
  }
  const manifest=JSON.parse(await fs.readFile(path.join(root,'apex/manifest.json'),'utf8'));
  for(const item of manifest.applications){
   if(!Number.isInteger(item.APPLICATION_ID)||!/^f\d+\.sql$/.test(item.file)||!/^\/[A-Za-z0-9_./-]+$/.test(root))throw Error('Invalid APEX import artifact');
   const filename=path.join(root,'apex',item.file),bytes=await fs.readFile(filename),sha=crypto.createHash('sha256').update(bytes).digest('hex');if(sha!==item.sha256)throw Error('APEX checksum mismatch');
   const key='apex:'+item.APPLICATION_ID;
   const completed=(await app.execute('SELECT artifact_sha256 FROM id_deployment_state WHERE component=:n',{n:key})).rows[0];
   if(completed){if(completed.ARTIFACT_SHA256!==sha)throw Error('Existing APEX application belongs to another release');continue;}
   const started=(await app.execute('SELECT artifact_sha256 FROM id_deployment_state WHERE component=:n',{n:key+':started'})).rows[0];
   const exists=(await app.execute('SELECT COUNT(*) n FROM apex_applications WHERE application_id=:id',{id:item.APPLICATION_ID})).rows[0].N;
   if(exists&&!started)throw Error('Refusing to overwrite an unowned APEX application');
   await receipt(app,key+':started',sha);
   await sqlcl({...config,sqlcl_user:'ADMIN'},`BEGIN\n APEX_APPLICATION_INSTALL.SET_WORKSPACE('CRIME_DATA');\n APEX_UTIL.SET_SECURITY_GROUP_ID(APEX_APPLICATION_INSTALL.GET_WORKSPACE_ID);\n APEX_APPLICATION_INSTALL.SET_SCHEMA('CRIME_DATA');\n APEX_APPLICATION_INSTALL.SET_APPLICATION_ID(${item.APPLICATION_ID});\n APEX_APPLICATION_INSTALL.SET_AUTHENTICATION_SCHEME('Oracle APEX Accounts');\n APEX_APPLICATION_INSTALL.SET_AUTO_INSTALL_SUP_OBJ(FALSE);\nEND;\n/\n@${filename}`,path.join(root,'apex','import-'+item.APPLICATION_ID+'.log'));
   const imported=(await app.execute('SELECT owner,authentication_scheme_type FROM apex_applications WHERE application_id=:id',{id:item.APPLICATION_ID})).rows[0];
   if(!imported||imported.OWNER!=='CRIME_DATA'||imported.AUTHENTICATION_SCHEME_TYPE!=='Oracle APEX Accounts')throw Error('Imported APEX authentication/schema verification failed');
   await receipt(app,key,sha);
  }
  // Legacy OpenDoor apps have a fixed-identity entry page. Install the standard
  // exported secure login page while keeping the original app exports intact.
  for(const item of manifest.applications){
   const fields=(await admin.execute("SELECT COUNT(*) n FROM apex_application_page_items WHERE application_id=:id AND page_id=9999 AND item_name IN ('P9999_USERNAME','P9999_PASSWORD')",{id:item.APPLICATION_ID})).rows[0].N;
   if(fields===2)continue;
   const file=path.join(__dirname,'apex-login.sql'),sha=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
   await sqlcl({...config,sqlcl_user:'ADMIN'},`BEGIN\n APEX_APPLICATION_INSTALL.SET_WORKSPACE('CRIME_DATA');\n APEX_UTIL.SET_SECURITY_GROUP_ID(APEX_APPLICATION_INSTALL.GET_WORKSPACE_ID);\n APEX_APPLICATION_INSTALL.SET_SCHEMA('CRIME_DATA');\n APEX_APPLICATION_INSTALL.SET_APPLICATION_ID(${item.APPLICATION_ID});\n APEX_APPLICATION_INSTALL.GENERATE_OFFSET;\n APEX_APPLICATION_INSTALL.SET_AUTO_INSTALL_SUP_OBJ(FALSE);\nEND;\n/\n@${file}`,path.join(root,'apex','login-'+item.APPLICATION_ID+'.log'));
   const after=(await admin.execute("SELECT COUNT(*) n FROM apex_application_page_items WHERE application_id=:id AND page_id=9999 AND item_name IN ('P9999_USERNAME','P9999_PASSWORD')",{id:item.APPLICATION_ID})).rows[0].N;
   if(after!==2)throw Error('Secure participant login page was not installed');
   await receipt(app,'apex:'+item.APPLICATION_ID+':login',sha);
  }
  // Keep workspace IDs inside Oracle NUMBER precision, rather than JS Number.
  await admin.execute("BEGIN APEX_UTIL.SET_SECURITY_GROUP_ID(APEX_UTIL.FIND_SECURITY_GROUP_ID(p_workspace=>'CRIME_DATA')); END;");
  for(const account of config.participants){
   if(!/^[a-z][a-z0-9_.-]{1,63}$/.test(account.username)||!/^[A-Za-z0-9]{20,64}$/.test(account.password))throw Error('Invalid generated participant account');
   const username=account.username.toUpperCase();
   const exists=(await admin.execute('SELECT COUNT(*) n FROM apex_workspace_apex_users WHERE workspace_name=\'CRIME_DATA\' AND user_name=:n',{n:username})).rows[0].N;
   if(!exists)await admin.execute(`BEGIN APEX_UTIL.CREATE_USER(p_user_name=>:n,p_email_address=>:email,p_web_password=>:p,p_developer_privs=>:privs,p_change_password_on_first_use=>'N',p_account_locked=>'N'); END;`,{n:username,email:account.username+'@example.test',p:account.password,privs:account.operator?'ADMIN:CREATE:DATA_LOADER:EDIT:HELP:MONITOR:SQL':null});
   await app.execute(`MERGE INTO dtai_user_access d USING(SELECT :n apex_user,:scope scope_user FROM dual) s ON(d.apex_user=s.apex_user) WHEN MATCHED THEN UPDATE SET d.scope_user=s.scope_user,d.enabled='Y' WHEN NOT MATCHED THEN INSERT(apex_user,scope_user,enabled) VALUES(s.apex_user,s.scope_user,'Y')`,{n:username,scope:account.persona});
  }
  await admin.commit();
  const users=new Set((await admin.execute("SELECT user_name FROM apex_workspace_apex_users WHERE workspace_name='CRIME_DATA'")).rows.map(row=>row.USER_NAME));
  for(const account of config.participants)if(!users.has(account.username.toUpperCase()))throw Error('Participant APEX account was not persisted');
  await app.execute('BEGIN DBMS_UTILITY.COMPILE_SCHEMA(schema=>USER,compile_all=>FALSE); END;');
  await app.commit();console.log(JSON.stringify({phase:'apex',status:'complete',applications:manifest.applications.length}));
 }finally{await app.close();await admin.close();}
}
if(require.main===module)(async()=>{const [configFile,root]=process.argv.slice(2);await install(JSON.parse(await fs.readFile(configFile,'utf8')),root);})().catch(e=>{console.error(JSON.stringify({phase:'apex',status:'failed',errorNum:e.errorNum||null,error:e.errorNum?'APEX bootstrap failed':e.message}));process.exitCode=1;});
module.exports={install,sqlcl};
