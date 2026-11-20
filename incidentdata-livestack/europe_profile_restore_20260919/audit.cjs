'use strict';
const {fs,path,assert,connect,audit,rows,tableRows}=require('../common_watch_catalog_20260917/common.cjs');
const mode=process.argv[2];assert(['before','after'].includes(mode));
(async()=>{const c=await connect();try{
  await c.execute('SET TRANSACTION READ ONLY');
  const identity={database:await rows(c,"SELECT user username,sys_context('USERENV','DB_NAME') db_name FROM dual"),active:await tableRows(c,'Z_BASE_ACTIVE_DATASET_PROFILE'),profiles:await tableRows(c,'Z_BASE_DATASET_PROFILES')};
  assert.equal(identity.database[0].USERNAME,'CRIME_DATA');assert.equal(identity.active[0].DATASET_PROFILE_ID,50);
  const data=await audit(c);await c.rollback();const result={identity,data};
  if(mode==='after')assert.deepEqual(result,JSON.parse(fs.readFileSync(path.join(__dirname,'database_before.json'),'utf8')));
  fs.writeFileSync(path.join(__dirname,'database_'+mode+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(mode==='after'?'Saved/live dataset fingerprints unchanged; Dublin remains active.':'Read-only dataset fingerprints saved; Dublin is active.');
}finally{await c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
