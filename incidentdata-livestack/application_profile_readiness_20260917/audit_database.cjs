/* Read-only preservation proof for application work; all six profiles included. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {connect}=require('../synthetic_amsterdam_may_jun_2026_v1/db_connection.cjs');
const {fingerprint,hash,stable}=require('../synthetic_amsterdam_may_jun_2026_v1/database_fingerprint.cjs');
(async()=>{
 const phase=process.argv[2];if(!['before','after'].includes(phase))throw Error('Use before or after');
 const c=await connect();try{
  await c.execute('SET TRANSACTION READ ONLY');
  const ids=(await c.execute('select dataset_profile_id from z_base_dataset_profiles order by dataset_profile_id')).rows.map(r=>r.DATASET_PROFILE_ID);
  const result={profileIds:ids,tables:await fingerprint(c,{profileIds:ids})};
  for(const table of ['Z_BASE_PROFILE_CONFIG','WATCHED_CRIME_PATTERNS','WATCHED_PATTERN_INCIDENTS','WATCHED_PATTERN_POSTS','SOCIAL_MEDIA_POSTS','SOCIAL_POST_INCIDENT_LINKS']){
   const rows=(await c.execute(`select * from ${table}`)).rows;result.tables[table]={count:rows.length,sha256:hash(rows.map(r=>hash(stable(r))).sort().join('\n'))};
  }
  fs.writeFileSync(path.join(__dirname,'database_'+phase+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  if(phase==='after')assert.deepEqual(result,JSON.parse(fs.readFileSync(path.join(__dirname,'database_before.json'))));
  console.log(JSON.stringify({phase,profileIds:ids,preserved:phase==='after'?true:'baseline captured'}));
  await c.rollback();
 }finally{await c.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
