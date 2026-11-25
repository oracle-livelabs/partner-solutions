'use strict';
// Destination-only schema restore. Never imports into FU40/FU30 or an arbitrary DB.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const o=require('oracledb');o.outFormat=o.OUT_FORMAT_OBJECT;o.fetchAsString=[o.CLOB];
function assertTarget(config,actual){
 if(!/^ID[0-9A-F]{6}$/.test(config.database_name||'')||!actual.toUpperCase().endsWith('_'+config.database_name)||/_FU(?:30|40)$/i.test(actual))throw Error('Destination database identity mismatch; no restore allowed');
}
function credentials(config,user){return {user,password:user==='ADMIN'?config.admin_password:config.schema_password,connectString:config.connect_string,configDir:config.wallet_dir,walletLocation:config.wallet_dir,walletPassword:config.wallet_password};}
async function guard(c,config){const row=(await c.execute("SELECT SYS_CONTEXT('USERENV','DB_NAME') name FROM dual")).rows[0];assertTarget(config,row.NAME);c.callTimeout=180000;}
function password(value){if(typeof value!=='string'||!/^[A-Za-z0-9]{20,64}$/.test(value))throw Error('Generated schema password is invalid');return value;}
// Explicit application grants, inventoried from FU40.CRIME_DATA. Managed
// DBMS_CLOUD package version names are replaced by their stable public names.
const runtimeRoles=['CONSOLE_DEVELOPER','DWROLE','GRAPH_DEVELOPER','OML_DEVELOPER'];
const runtimePrivileges=['ADMINISTER ANY DATA GRANT','CREATE DATA GRANT','CREATE DATA ROLE','CREATE PROCEDURE','CREATE PROPERTY GRAPH','CREATE SEQUENCE','CREATE SESSION','CREATE SYNONYM','CREATE TABLE','CREATE TRIGGER','CREATE TYPE','CREATE VIEW','SET USE DATA GRANTS ONLY','UNLIMITED TABLESPACE'];
const runtimeApis=['DBMS_CLOUD','DBMS_CLOUD_AI','DBMS_CLOUD_AI_AGENT','SYS.DBMS_RLS','SYS.DBMS_VECTOR','MDSYS.SDO_CS','MDSYS.SDO_GEOM','MDSYS.SDO_UTIL'];
async function provisionSchema(c,config){
 await guard(c,config);
 const exists=(await c.execute("SELECT COUNT(*) n FROM all_users WHERE username='CRIME_DATA'")).rows[0].N;
 if(!exists)await c.execute('CREATE USER CRIME_DATA IDENTIFIED BY "'+password(config.schema_password)+'" DEFAULT TABLESPACE DATA QUOTA UNLIMITED ON DATA');
 await c.execute('GRANT '+runtimeRoles.join(',')+' TO CRIME_DATA');
 await c.execute('GRANT '+runtimePrivileges.join(',')+' TO CRIME_DATA');
 for(const api of runtimeApis)await c.execute('GRANT EXECUTE ON '+api+' TO CRIME_DATA');
}
async function waitJob(c,job,owner){
 for(let i=0;i<360;i++){
  const r=await c.execute('SELECT state FROM dba_datapump_jobs WHERE job_name=:n AND owner_name=:u',{n:job,u:owner});
  if(!r.rows.length)return;
  if(!['EXECUTING','COMPLETING'].includes(r.rows[0].STATE))throw Error('Import job stopped before completion');
  await new Promise(r=>setTimeout(r,5000));
 }
 throw Error('Schema import deadline exceeded');
}
async function importSchema(config,root){
 const c=await o.getConnection(credentials(config,'ADMIN'));
 try{
  await guard(c,config);
  await provisionSchema(c,config);
  const app=await o.getConnection(credentials(config,'CRIME_DATA'));await guard(app,config);
  try{
   const tables=(await app.execute('SELECT table_name FROM user_tables')).rows.map(r=>r.TABLE_NAME);
   if(tables.length){
    if(tables.includes('ID_DEPLOYMENT_STATE')){
     const prior=(await app.execute("SELECT artifact_sha256 FROM id_deployment_state WHERE component='schema'")).rows[0];
     if(prior?.ARTIFACT_SHA256===config.schema_manifest_sha256)return;
    }
    throw Error('Destination CRIME_DATA is populated without a matching completed-release receipt; refusing destructive import');
   }
  }finally{await app.close();}
  const manifest=JSON.parse(await fs.readFile(path.join(root,'database/manifest.json'),'utf8'));
  if(manifest.encryption!=='AES256/password'||manifest.state!=='downloaded_not_restore_tested')throw Error('Encrypted schema export is incomplete');
  const digest=crypto.createHash('sha256').update(await fs.readFile(path.join(root,'database/manifest.json'))).digest('hex');
  if(digest!==config.schema_manifest_sha256)throw Error('Schema manifest checksum mismatch');
  await c.execute("BEGIN DBMS_CLOUD_ADMIN.ENABLE_RESOURCE_PRINCIPAL(username=>'ADMIN'); END;");
  for(const file of manifest.files.filter(f=>f.file.endsWith('.dmp'))){
   if(!/^ID_RELEASE_[A-Z0-9_]+\.dmp$/.test(file.file))throw Error('Invalid dump filename');
   const cached=(await c.execute("SELECT bytes FROM TABLE(DBMS_CLOUD.LIST_FILES('DATA_PUMP_DIR')) WHERE object_name=:n",{n:file.file})).rows[0];
   if(cached&&cached.BYTES!==file.bytes)throw Error('Cached encrypted dump size mismatch');
   if(!cached)await c.execute(`BEGIN DBMS_CLOUD.GET_OBJECT(credential_name=>'OCI$RESOURCE_PRINCIPAL',object_uri=>:uri,directory_name=>'DATA_PUMP_DIR',file_name=>:name); END;`,{uri:config.release_base_uri+'/database/'+file.file,name:file.file});
   const verified=await c.execute(`DECLARE f BFILE; b BLOB; BEGIN
    f:=BFILENAME('DATA_PUMP_DIR',:n);DBMS_LOB.FILEOPEN(f,DBMS_LOB.FILE_READONLY);
    IF DBMS_LOB.GETLENGTH(f)<>:bytes THEN raise_application_error(-20001,'Dump size mismatch'); END IF;
    DBMS_LOB.CREATETEMPORARY(b,FALSE);DBMS_LOB.LOADFROMFILE(b,f,DBMS_LOB.GETLENGTH(f));DBMS_LOB.FILECLOSE(f);
    :sha:=LOWER(RAWTOHEX(DBMS_CRYPTO.HASH(b,DBMS_CRYPTO.HASH_SH256)));DBMS_LOB.FREETEMPORARY(b);
   END;`,{n:file.file,bytes:file.bytes,sha:{dir:o.BIND_OUT,type:o.STRING,maxSize:64}});
   if(verified.outBinds.sha!==file.sha256)throw Error('Database dump SHA256 mismatch');
  }
  const job='ID_IMPORT_'+Date.now().toString(36).toUpperCase(),dumpNames=manifest.files.filter(f=>f.file.endsWith('.dmp')).map(f=>f.file);
  await c.execute(`DECLARE h NUMBER; names JSON_ARRAY_T:=JSON_ARRAY_T.parse(:names); BEGIN
   h:=DBMS_DATAPUMP.OPEN('IMPORT','SCHEMA',NULL,:job,'LATEST');
   FOR i IN 0..names.GET_SIZE-1 LOOP DBMS_DATAPUMP.ADD_FILE(h,names.GET_STRING(i),'DATA_PUMP_DIR',NULL,DBMS_DATAPUMP.KU$_FILE_TYPE_DUMP_FILE); END LOOP;
   DBMS_DATAPUMP.ADD_FILE(h,:log,'DATA_PUMP_DIR',NULL,DBMS_DATAPUMP.KU$_FILE_TYPE_LOG_FILE);
   DBMS_DATAPUMP.METADATA_FILTER(h,'SCHEMA_EXPR','IN (''CRIME_DATA'')');
   DBMS_DATAPUMP.METADATA_FILTER(h,'EXCLUDE_PATH_EXPR','IN (''USER'',''PASSWORD_HISTORY'',''GRANT'',''ROLE_GRANT'',''DEFAULT_ROLE'',''SYSTEM_GRANT'',''PROCOBJ'',''PROCOBJ_GRANT'',''PROCOBJ_AUDIT'',''PROCACT_SCHEMA'',''SQL_TRANSLATION_PROFILE'',''XS_SECURITY'')');
   DBMS_DATAPUMP.SET_PARAMETER(h,'ENCRYPTION_PASSWORD',:key);
   DBMS_DATAPUMP.METADATA_TRANSFORM(h,'SEGMENT_ATTRIBUTES',0);
   DBMS_DATAPUMP.SET_PARALLEL(h,1);DBMS_DATAPUMP.START_JOB(h);DBMS_DATAPUMP.DETACH(h);
  EXCEPTION WHEN OTHERS THEN BEGIN DBMS_DATAPUMP.STOP_JOB(h,1,0); EXCEPTION WHEN OTHERS THEN NULL; END; RAISE; END;`,{names:JSON.stringify(dumpNames),job,log:job+'.log',key:config.dump_password});
  await waitJob(c,job,'ADMIN');
  const loaded=await c.execute(`DECLARE f BFILE; b BLOB; n NUMBER; BEGIN
   f:=BFILENAME('DATA_PUMP_DIR',:name); DBMS_LOB.FILEOPEN(f,DBMS_LOB.FILE_READONLY);n:=DBMS_LOB.GETLENGTH(f);
   IF n>16777216 THEN raise_application_error(-20001,'Import log exceeds diagnostic limit'); END IF;
   DBMS_LOB.CREATETEMPORARY(b,FALSE);DBMS_LOB.LOADFROMFILE(b,f,n);DBMS_LOB.FILECLOSE(f);:data:=b;
  END;`,{name:job+'.log',data:{dir:o.BIND_OUT,type:o.BLOB}});
  const log=(await loaded.outBinds.data.getData()).toString('utf8');await loaded.outBinds.data.close();
  if(!log||!/successfully completed/.test(log)||/ORA-\d{5}/.test(log))throw Error('Schema import log did not pass validation');
  const restored=await o.getConnection(credentials(config,'CRIME_DATA'));
  try{
   await guard(restored,config);
   await restored.execute('CREATE TABLE id_deployment_state(component VARCHAR2(40) PRIMARY KEY,artifact_sha256 VARCHAR2(64) NOT NULL,completed_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)');
   await restored.execute("INSERT INTO id_deployment_state(component,artifact_sha256) VALUES('schema',:sha)",{sha:config.schema_manifest_sha256});await restored.commit();
  }finally{await restored.close();}
 }finally{await c.close();}
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value;}
function decode(value){try{return JSON.parse(value);}catch{return value;}}
function assertAttributes(expected,actual){for(const [key,value]of Object.entries(expected))if(JSON.stringify(canonical(value))!==JSON.stringify(canonical(actual[key])))throw Error('Existing AI configuration differs: '+key);}
async function currentAttributes(c,view,nameColumn,name){const r=await c.execute(`SELECT attribute_name,attribute_value FROM ${view} WHERE ${nameColumn}=:n`,{n:name});return Object.fromEntries(r.rows.map(row=>[row.ATTRIBUTE_NAME.toLowerCase(),decode(row.ATTRIBUTE_VALUE)]));}
async function restoreAi(config,root){
 const admin=await o.getConnection(credentials(config,'ADMIN'));
 try{await guard(admin,config);await admin.execute("BEGIN DBMS_CLOUD_ADMIN.ENABLE_RESOURCE_PRINCIPAL(username=>'CRIME_DATA'); END;");}finally{await admin.close();}
 const c=await o.getConnection(credentials(config,'CRIME_DATA'));
 try{
  await guard(c,config);const definition=JSON.parse(await fs.readFile(path.join(root,'ai/configuration.json'),'utf8'));
  const prior=(await c.execute("SELECT artifact_sha256 FROM id_deployment_state WHERE component='ai'")).rows[0];
  if(prior?.ARTIFACT_SHA256===config.release_sha256)return;
  for(const profile of definition.profiles){
   const attrs={...profile.attributes,credential_name:'OCI$RESOURCE_PRINCIPAL',oci_compartment_id:config.compartment_ocid,region:config.genai_region};
   const existing=(await c.execute('SELECT status FROM user_cloud_ai_profiles WHERE profile_name=:n',{n:profile.name})).rows[0];
   if(existing){if(existing.STATUS!==profile.status)throw Error('Existing AI profile status differs');assertAttributes(attrs,await currentAttributes(c,'USER_CLOUD_AI_PROFILE_ATTRIBUTES','PROFILE_NAME',profile.name));}
   else await c.execute('BEGIN DBMS_CLOUD_AI.CREATE_PROFILE(profile_name=>:n,attributes=>:a,status=>:s); END;',{n:profile.name,a:JSON.stringify(attrs),s:profile.status});
  }
  for(const [kind,key,view,attrView,column] of [
   ['TOOL','tools','USER_AI_AGENT_TOOLS','USER_AI_AGENT_TOOL_ATTRIBUTES','TOOL_NAME'],
   ['AGENT','agents','USER_AI_AGENTS','USER_AI_AGENT_ATTRIBUTES','AGENT_NAME'],
   ['TASK','tasks','USER_AI_AGENT_TASKS','USER_AI_AGENT_TASK_ATTRIBUTES','TASK_NAME'],
   ['TEAM','teams','USER_AI_AGENT_TEAMS','USER_AI_AGENT_TEAM_ATTRIBUTES','AGENT_TEAM_NAME']])for(const item of definition.nativeAgents[key]){
   if(!/^[A-Z0-9_]+$/.test(item.name))throw Error('Invalid native-AI object name');
   const exists=(await c.execute(`SELECT status FROM ${view} WHERE ${column}=:n`,{n:item.name})).rows[0];
   if(exists){if(exists.STATUS!==item.status)throw Error('Existing native-AI status differs');assertAttributes(item.attributes,await currentAttributes(c,attrView,column,item.name));}
   else await c.execute(`BEGIN DBMS_CLOUD_AI_AGENT.CREATE_${kind}(:n,:a,:s,:d); END;`,{n:item.name,a:JSON.stringify(item.attributes),s:item.status,d:item.description});
  }
  await c.execute("MERGE INTO id_deployment_state d USING (SELECT 'ai' component,:sha artifact_sha256 FROM dual) s ON(d.component=s.component) WHEN MATCHED THEN UPDATE SET d.artifact_sha256=s.artifact_sha256,d.completed_at=SYSTIMESTAMP WHEN NOT MATCHED THEN INSERT(component,artifact_sha256) VALUES(s.component,s.artifact_sha256)",{sha:config.release_sha256});await c.commit();
 }finally{await c.close();}
}
if(require.main===module)(async()=>{
 const [phase,configFile,root]=process.argv.slice(2);const config=JSON.parse(await fs.readFile(configFile,'utf8'));
 if(phase==='schema')await importSchema(config,root);else if(phase==='security')await require('./security.cjs').restoreSecurity(config,root);else if(phase==='ai')await restoreAi(config,root);else throw Error('Use schema, security or ai phase');
 console.log(JSON.stringify({phase,status:'complete'}));
})().catch(e=>{console.error(JSON.stringify({status:'failed',errorNum:e.errorNum||null,error:e.errorNum?'Database bootstrap failed; inspect controlled import diagnostics':e.message}));process.exitCode=1;});
module.exports={assertTarget,credentials,canonical,assertAttributes,importSchema,restoreAi,provisionSchema};
