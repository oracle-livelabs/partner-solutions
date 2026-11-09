'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {connect,rows,oracle:o}=require('../../../scripts/evidence-intelligence/connection.cjs');
const {PRIVATE_DATA,privateData}=require('./export_database.cjs');
(async()=>{
 const root=path.resolve(__dirname,'../artifacts/database'),manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
 if(manifest.state!=='downloaded_not_restore_tested'||manifest.encryption!=='AES256/password')throw Error('Encrypted export is not staged');
 const c=await connect();c.callTimeout=180000;
 try{
  const log=await fs.readFile(path.join(root,manifest.prefix+'.log'),'utf8');
  const exported=new Map([...log.matchAll(/\. \. exported\s+"CRIME_DATA"\."([^"]+)"[\s\S]*?\s(\d+) rows/g)].map(m=>[m[1],Number(m[2])]));
  for(const name of manifest.excludedTableData)if(exported.get(name)!==0)throw Error('Private table exclusion not proven: '+name);
  const job='ID_AUDIT_'+Date.now().toString(36).toUpperCase(),filename=manifest.prefix+'_META.sql';
  const files=manifest.files.filter(f=>f.file.endsWith('.dmp')).map(f=>f.file);
  const secret=(await fs.readFile(path.join(root,'export-password.secret'),'utf8')).trim();
  await c.execute(`DECLARE h NUMBER; f JSON_ARRAY_T:=JSON_ARRAY_T.parse(:files); BEGIN
   h:=DBMS_DATAPUMP.OPEN('SQL_FILE','SCHEMA',NULL,:job,'LATEST');
   FOR i IN 0..f.GET_SIZE-1 LOOP DBMS_DATAPUMP.ADD_FILE(h,f.GET_STRING(i),'DATA_PUMP_DIR',NULL,DBMS_DATAPUMP.KU$_FILE_TYPE_DUMP_FILE); END LOOP;
   DBMS_DATAPUMP.ADD_FILE(h,:outname,'DATA_PUMP_DIR',NULL,DBMS_DATAPUMP.KU$_FILE_TYPE_SQL_FILE);
   DBMS_DATAPUMP.SET_PARAMETER(h,'ENCRYPTION_PASSWORD',:key);DBMS_DATAPUMP.START_JOB(h);DBMS_DATAPUMP.DETACH(h);
  END;`,{files:JSON.stringify(files),job,outname:filename,key:secret});
  for(let i=0;i<120;i++){const r=await rows(c,'SELECT state FROM user_datapump_jobs WHERE job_name=:n',{n:job});if(!r.length)break;if(!['EXECUTING','COMPLETING'].includes(r[0].STATE))throw Error('Metadata audit did not complete');await new Promise(r=>setTimeout(r,2000));}
  const r=await c.execute(`DECLARE f BFILE; b BLOB; BEGIN f:=BFILENAME('DATA_PUMP_DIR',:n);DBMS_LOB.FILEOPEN(f,DBMS_LOB.FILE_READONLY);IF DBMS_LOB.GETLENGTH(f)>16777216 THEN raise_application_error(-20001,'Unexpected metadata size');END IF;DBMS_LOB.CREATETEMPORARY(b,FALSE);DBMS_LOB.LOADFROMFILE(b,f,DBMS_LOB.GETLENGTH(f));DBMS_LOB.FILECLOSE(f);:b:=b;END;`,{n:filename,b:{dir:o.BIND_OUT,type:o.BLOB}});
  const bytes=await r.outBinds.b.getData();await r.outBinds.b.close();await fs.writeFile(path.join(root,filename),bytes,{mode:0o600});
  const ddl=bytes.toString('utf8');
  const forbidden=[['credential creation',/DBMS_(?:CLOUD|CREDENTIAL)\.CREATE_CREDENTIAL/i],['private key',/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/],['source user password',/IDENTIFIED BY VALUES/i],['scheduler objects',/DBMS_SCHEDULER\.CREATE_(?:JOB|PROGRAM)|SCHEDULER\$_(?:JOB|PROGRAM)_ARG/i]];
  for(const [label,pattern]of forbidden)if(pattern.test(ddl))throw Error('Metadata audit found '+label+'; do not publish');
  const receipt={status:'passed',exportPrefix:manifest.prefix,encrypted:true,encryptedDumpCanBeRead:true,privateTablesEmpty:manifest.excludedTableData.length,credentialCreationAbsent:true,sourcePasswordHashesAbsent:true,schedulerObjectsAbsent:true,metadataBytes:bytes.length,exportedTables:exported.size,propertyGraphMetadataPresent:/PROPERTY\s+GRAPH/i.test(ddl),restoreTested:false};
  await fs.writeFile(path.resolve(__dirname,'../inventory/database-export-audit.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }finally{await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
