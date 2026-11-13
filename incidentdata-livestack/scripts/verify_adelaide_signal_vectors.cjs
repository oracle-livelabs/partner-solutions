'use strict';
const {execFileSync}=require('node:child_process');
const code=String.raw`
const o=require('oracledb');o.outFormat=o.OUT_FORMAT_OBJECT;
(async()=>{
 const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
 try{
  c.callTimeout=30000;await c.execute('SET TRANSACTION READ ONLY');
  const target=(await c.execute('SELECT p.profile_code,a.dataset_profile_id FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1')).rows[0];
  if(target.PROFILE_CODE!=='ADELAIDE_DATA_V2')throw Error('Wrong active profile');const pid=target.DATASET_PROFILE_ID;
  const reports=(await c.execute("SELECT COUNT(*) compared,SUM(CASE WHEN l.source_sha256<>s.source_sha256 OR l.embedding_model<>s.embedding_model OR VECTOR_DISTANCE(l.embedding,s.embedding,EUCLIDEAN)>0.000001 THEN 1 ELSE 0 END) mismatches FROM incident_narrative_embeddings_v4 l JOIN z_base_incident_narrative_vec s ON s.incident_ref=l.incident_ref AND s.dataset_profile_id=:pid WHERE l.profile_code='ADELAIDE_DATA_V2'",{pid})).rows[0];
  const watches=(await c.execute('SELECT COUNT(*) compared,SUM(CASE WHEN l.source_sha256<>s.source_sha256 OR l.embedding_model<>s.embedding_model OR VECTOR_DISTANCE(l.embedding,s.embedding,EUCLIDEAN)>0.000001 THEN 1 ELSE 0 END) mismatches FROM watched_pattern_embeddings l JOIN z_base_watched_pattern_vec s ON s.pattern_code=l.pattern_code AND s.dataset_profile_id=:pid',{pid})).rows[0];
  if(reports.COMPARED!==21532||reports.MISMATCHES!==0||watches.COMPARED!==21||watches.MISMATCHES!==0)throw Error('Saved/live vectors differ');
  console.log(JSON.stringify({readOnly:true,target,reports,watches,persistenceVerified:true}));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
process.stdout.write(execFileSync('podman',['exec','policeadelaide_app-fu40_1','node','-e',code],{encoding:'utf8',timeout:60000}));
