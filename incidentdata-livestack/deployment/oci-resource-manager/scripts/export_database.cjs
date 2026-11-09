'use strict';
// Full-schema export from guarded FU40. No application rows are modified.
// Only the export job and uniquely prefixed DATA_PUMP_DIR files are created.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises'),{createWriteStream}=require('node:fs');
const {connect,rows,oracle:o}=require('../../../scripts/evidence-intelligence/connection.cjs');
const ROOT=path.resolve(__dirname,'../artifacts/database');
const PRIVATE_DATA=new Set(['AI_OPS_EVENTS','AI_OPS_IMPORT_STATE','ANALYST_ACTIONS','Z_BASE_ANALYST_ACTIONS','DBTOOLS$MCP_LOG','DTAI_USER_ACCESS','CDR_CHAT_THREADS','CDR_EXPERT_ASSISTANT_RUNS','CDR_EXPERT_BOARDS','CDR_EXPERT_NOTES','CDR_EXPERT_THEORIES','CDR_AGENT_TOOL_EVENTS','CDR_MONEY_AI_EVENTS','EI_REVIEW_EVENTS','EI_REVIEW_RUNS']);
const EXCLUDED_OBJECT_PATHS=['USER','PASSWORD_HISTORY','PROCOBJ','PROCOBJ_GRANT','PROCOBJ_AUDIT','PROCACT_SCHEMA'];
function privateData(name){return PRIVATE_DATA.has(name)||/^R0920_\d+$/.test(name);}
async function save(value){await fs.writeFile(path.join(ROOT,'manifest.json'),JSON.stringify(value,null,2)+'\n',{mode:0o600});}
async function downloadFile(c,file,output){
 if(!/^ID_RELEASE_[A-Z0-9_]+\.(dmp|log|sql)$/.test(file))throw Error('Unexpected export filename');
 const result=await c.execute(`DECLARE src BFILE; data BLOB; BEGIN
  src:=BFILENAME('DATA_PUMP_DIR',:name); DBMS_LOB.FILEOPEN(src,DBMS_LOB.FILE_READONLY);
  DBMS_LOB.CREATETEMPORARY(data,FALSE); DBMS_LOB.LOADFROMFILE(data,src,DBMS_LOB.GETLENGTH(src));
  DBMS_LOB.FILECLOSE(src); :data:=data;
 EXCEPTION WHEN OTHERS THEN IF DBMS_LOB.FILEISOPEN(src)=1 THEN DBMS_LOB.FILECLOSE(src); END IF; RAISE; END;`,{name:file,data:{dir:o.BIND_OUT,type:o.BLOB}});
 result.outBinds.data.pieceSize=8*1024*1024;
 const target=path.join(output,file),temp=target+'.partial';
 await pipeline(result.outBinds.data,createWriteStream(temp,{mode:0o600,flags:'wx'}));
 const handle=await fs.open(temp,'r'),hash=crypto.createHash('sha256');
 try{for await(const chunk of handle.createReadStream())hash.update(chunk);}finally{await handle.close();}
 const stat=await fs.stat(temp);await fs.rename(temp,target);return {file,bytes:stat.size,sha256:hash.digest('hex')};
}
async function run(mode){
 await fs.mkdir(ROOT,{recursive:true,mode:0o700});
 const c=await connect();c.callTimeout=180000;
 try{
  if(mode==='--plan'||mode==='--export'||['--restart-encrypted','--exclude-scheduler'].includes(mode)){
   const tables=await rows(c,'SELECT table_name FROM user_tables ORDER BY table_name');
   const excludedTableData=tables.filter(t=>privateData(t.TABLE_NAME)).map(t=>t.TABLE_NAME);
   const unsafe=await rows(c,"SELECT COUNT(*) n FROM cdr_batches WHERE NVL(synthetic_only,'N')<>'Y'");if(unsafe[0].N)throw Error('Non-synthetic batch found; explicit seed selection required');
   if((await rows(c,"SELECT COUNT(*) n FROM cdr_ai_runs WHERE status IN ('QUEUED','IN_PROGRESS')"))[0].N)throw Error('Description processing is active; export later');
   const disk=await fs.statfs(ROOT);if(disk.bavail*disk.bsize<15*1024**3)throw Error('Need at least 15 GiB local free space for export staging');
   const scn=(await rows(c,"SELECT TIMESTAMP_TO_SCN(SYSTIMESTAMP-INTERVAL '10' SECOND) scn FROM dual"))[0].SCN;
   const plan={schema:'CRIME_DATA',sourceDatabase:'FU40',tables:tables.length,excludedTableData,excludedObjectPaths:EXCLUDED_OBJECT_PATHS,excludedInternalTables:['SCHEDULER$_JOB_ARG','SCHEDULER$_PROGRAM_ARG'],flashbackScn:scn,parallelism:1,partLimitBytes:268435456,sourceApplicationRowsChanged:false};
   if(mode==='--plan'){console.log(JSON.stringify(plan,null,2));return;}
   if(['--restart-encrypted','--exclude-scheduler'].includes(mode)){
    const old=JSON.parse(await fs.readFile(path.join(ROOT,'manifest.json'),'utf8'));
    if(mode==='--restart-encrypted'&&(old.state!=='export_errors'||old.encryption))throw Error('Restart is limited to the rejected unencrypted first export');
    if(mode==='--exclude-scheduler'){if(old.state!=='downloaded_not_restore_tested')throw Error('Previous export not downloaded');const ddl=await fs.readFile(path.join(ROOT,old.prefix+'_META.sql'),'utf8');if(!/SCHEDULER\$_(?:JOB|PROGRAM)_ARG/.test(ddl))throw Error('No scheduler helper exclusion correction is needed');await fs.rename(path.join(ROOT,'export-password.secret'),path.join(ROOT,'discarded-key-'+old.job+'.secret'));}
    if((await rows(c,'SELECT state FROM user_datapump_jobs WHERE job_name=:job',{job:old.job})).length)throw Error('Prior export job is not fully detached');
    await fs.rename(path.join(ROOT,'manifest.json'),path.join(ROOT,'discarded-'+old.job+'.json'));
   }
   try{await fs.access(path.join(ROOT,'manifest.json'));throw Error('An export manifest already exists; resume it instead of overwriting');}catch(e){if(e.code!=='ENOENT')throw e;}
   const token=Date.now().toString(36).toUpperCase(),prefix='ID_RELEASE_'+token,job='ID_REL_'+token;
   const encryptionPassword=crypto.randomBytes(24).toString('hex');
   await fs.writeFile(path.join(ROOT,'export-password.secret'),encryptionPassword,{mode:0o600,flag:'wx'});
   const manifest={version:1,...plan,job,prefix,encryption:'AES256/password',state:'preparing',files:[],createdAt:new Date().toISOString()};await save(manifest);
   const tableFilters=excludedTableData.map(name=>`DBMS_DATAPUMP.DATA_FILTER(h,'SUBQUERY','WHERE 1=0','${name}','CRIME_DATA');`).join('\n');
   const excludedPaths="IN ("+EXCLUDED_OBJECT_PATHS.map(x=>"'"+x+"'").join(',')+")";
   await c.execute(`DECLARE h NUMBER; BEGIN
    h:=DBMS_DATAPUMP.OPEN('EXPORT','SCHEMA',NULL,:job,'LATEST');
    DBMS_DATAPUMP.ADD_FILE(h,:dump,'DATA_PUMP_DIR',268435456,DBMS_DATAPUMP.KU$_FILE_TYPE_DUMP_FILE);
    DBMS_DATAPUMP.ADD_FILE(h,:log,'DATA_PUMP_DIR',NULL,DBMS_DATAPUMP.KU$_FILE_TYPE_LOG_FILE);
    DBMS_DATAPUMP.METADATA_FILTER(h,'SCHEMA_EXPR','IN (''CRIME_DATA'')');
    DBMS_DATAPUMP.METADATA_FILTER(h,'EXCLUDE_PATH_EXPR',:excluded);
    DBMS_DATAPUMP.METADATA_FILTER(h,'NAME_EXPR','NOT IN (''SCHEDULER$_JOB_ARG'',''SCHEDULER$_PROGRAM_ARG'')','TABLE');
    DBMS_DATAPUMP.SET_PARAMETER(h,'FLASHBACK_SCN',:scn);
    DBMS_DATAPUMP.SET_PARAMETER(h,'ENCRYPTION','ALL');
    DBMS_DATAPUMP.SET_PARAMETER(h,'ENCRYPTION_MODE','PASSWORD');
    DBMS_DATAPUMP.SET_PARAMETER(h,'ENCRYPTION_ALGORITHM','AES256');
    DBMS_DATAPUMP.SET_PARAMETER(h,'ENCRYPTION_PASSWORD',:encryptionPassword);
    DBMS_DATAPUMP.SET_PARALLEL(h,1);
    ${tableFilters}
    DBMS_DATAPUMP.START_JOB(h); DBMS_DATAPUMP.DETACH(h);
   EXCEPTION WHEN OTHERS THEN BEGIN DBMS_DATAPUMP.STOP_JOB(h,1,0); EXCEPTION WHEN OTHERS THEN NULL; END; RAISE; END;`,{job,dump:prefix+'_%U.dmp',log:prefix+'.log',excluded:excludedPaths,scn,encryptionPassword});
   manifest.state='exporting';await save(manifest);console.log(JSON.stringify({job,prefix,state:manifest.state}));return;
  }
  const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'manifest.json'),'utf8'));
  if(!/^ID_REL_[A-Z0-9]+$/.test(manifest.job)||!/^ID_RELEASE_[A-Z0-9]+$/.test(manifest.prefix))throw Error('Invalid saved export identity');
  const jobs=await rows(c,'SELECT state FROM user_datapump_jobs WHERE job_name=:job',{job:manifest.job});
  const files=await rows(c,"SELECT object_name,bytes FROM TABLE(DBMS_CLOUD.LIST_FILES('DATA_PUMP_DIR')) WHERE object_name LIKE :prefix ORDER BY object_name",{prefix:manifest.prefix+'%'});
  if(jobs.some(j=>j.STATE==='EXECUTING'||j.STATE==='DEFINING')){console.log(JSON.stringify({job:manifest.job,state:jobs[0].STATE,files:files.length,bytes:files.reduce((n,f)=>n+f.BYTES,0)}));return;}
  if(mode==='--status'){console.log(JSON.stringify({job:manifest.job,jobs,files:files.map(f=>({name:f.OBJECT_NAME,bytes:f.BYTES})),state:manifest.state}));return;}
  if(mode==='--download'){
   const logName=manifest.prefix+'.log';
   if(!manifest.files.some(f=>f.file===logName)){manifest.files.push(await downloadFile(c,logName,ROOT));await save(manifest);}
   const log=await fs.readFile(path.join(ROOT,logName),'utf8');
   if(!/successfully completed/.test(log)||/ORA-\d{5}/.test(log)){manifest.state='export_errors';await save(manifest);throw Error('Export did not complete cleanly; inspect the protected local log before publishing');}
   const dumps=files.filter(f=>f.OBJECT_NAME.endsWith('.dmp'));if(!dumps.length)throw Error('No dump parts found');
   manifest.state='downloading';await save(manifest);
   for(const file of dumps){
    if(manifest.files.some(f=>f.file===file.OBJECT_NAME&&f.bytes===file.BYTES))continue;
    const receipt=await downloadFile(c,file.OBJECT_NAME,ROOT);if(receipt.bytes!==file.BYTES)throw Error('Export file size changed');manifest.files.push(receipt);await save(manifest);console.log(JSON.stringify({downloaded:receipt.file,bytes:receipt.bytes}));
   }
   manifest.state='downloaded_not_restore_tested';manifest.completedAt=new Date().toISOString();await save(manifest);console.log(JSON.stringify({state:manifest.state,files:manifest.files.length,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0)}));
  }
 }finally{await c.close();}
}
if(require.main===module){const mode=process.argv[2]||'--plan';if(!['--plan','--export','--restart-encrypted','--exclude-scheduler','--status','--download'].includes(mode)){console.error('Use --plan, --export, --status or --download');process.exitCode=1;}else run(mode).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={privateData,EXCLUDED_OBJECT_PATHS,PRIVATE_DATA};
