'use strict';
// Read-only vector coverage inventory. No embeddings, restores or dataset writes.
const {execFileSync}=require('node:child_process');
const code=String.raw`
const o=require('oracledb');o.outFormat=o.OUT_FORMAT_OBJECT;
(async()=>{
 const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
 try{
  c.callTimeout=30000;await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");await c.execute('SET TRANSACTION READ ONLY');
  const model=require('./backend/pattern-embeddings').PATTERN_EMBEDDING_MODEL;
  const result={readOnly:true,model,dimensions:require('./backend/pattern-embeddings').PATTERN_EMBEDDING_DIMENSIONS};
  for(const [name,sql] of Object.entries({
   target:"SELECT user schema_name,sys_context('USERENV','DB_NAME') database_name,p.profile_code,p.dataset_profile_id,a.activated_at FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE control_id=1",
   snapshots:"SELECT p.dataset_profile_id,p.profile_code,p.captured_at,(SELECT COUNT(*) FROM z_base_crime_incidents i WHERE i.dataset_profile_id=p.dataset_profile_id) incidents,(SELECT COUNT(*) FROM z_base_incident_narrative_vec n WHERE n.dataset_profile_id=p.dataset_profile_id) narrative_vectors,(SELECT COUNT(*) FROM z_base_watched_pattern_vec w WHERE w.dataset_profile_id=p.dataset_profile_id) watch_vectors FROM z_base_dataset_profiles p ORDER BY p.profile_code",
   liveNarratives:"SELECT profile_code,embedding_model,COUNT(*) vector_count,MIN(created_at) oldest,MAX(created_at) newest FROM incident_narrative_embeddings_v4 GROUP BY profile_code,embedding_model ORDER BY profile_code,embedding_model",
   liveWatches:"SELECT embedding_model,COUNT(*) vector_count FROM watched_pattern_embeddings GROUP BY embedding_model",
   watchCoverage:"SELECT w.pattern_code,w.pattern_name,w.active,w.activate_ui,e.embedding_model,e.source_sha256 FROM watched_crime_patterns w LEFT JOIN watched_pattern_embeddings e ON e.pattern_code=w.pattern_code ORDER BY w.pattern_code",
   savedNarrativeModels:"SELECT p.profile_code,n.embedding_model,COUNT(*) vector_count FROM z_base_incident_narrative_vec n JOIN z_base_dataset_profiles p ON p.dataset_profile_id=n.dataset_profile_id GROUP BY p.profile_code,n.embedding_model ORDER BY p.profile_code",
   savedWatchModels:"SELECT p.profile_code,w.embedding_model,COUNT(*) vector_count FROM z_base_watched_pattern_vec w JOIN z_base_dataset_profiles p ON p.dataset_profile_id=w.dataset_profile_id GROUP BY p.profile_code,w.embedding_model ORDER BY p.profile_code",
   vectorObjects:"SELECT object_name,created,last_ddl_time FROM user_objects WHERE object_type='TABLE' AND object_name IN ('INCIDENT_NARRATIVE_EMBEDDINGS_V4','WATCHED_PATTERN_EMBEDDINGS','Z_BASE_INCIDENT_NARRATIVE_VEC','Z_BASE_WATCHED_PATTERN_VEC') ORDER BY object_name",
   recoveryTables:"SELECT table_name FROM user_tables WHERE table_name LIKE 'R0920%' OR table_name LIKE '%NARRATIVE%VEC%' OR table_name LIKE '%WATCH%VEC%' ORDER BY table_name"
  })){
   try{result[name]=(await c.execute(sql)).rows;}catch(e){result[name]={error:e.message};}
  }
  try{
   result.recoveryNarratives=(await c.execute('SELECT profile_code,embedding_model,COUNT(*) vector_count FROM r0920_24 GROUP BY profile_code,embedding_model')).rows;
  }catch(e){result.recoveryNarratives={error:e.message};}
  try{
   const {patternEmbeddingText,textHash}=require('./backend/pattern-embeddings');
   const definitions=(await c.execute('SELECT pattern_code,pattern_name,pattern_summary,why_watch FROM watched_crime_patterns WHERE active=1 ORDER BY pattern_code')).rows;
   const saved=(await c.execute('SELECT pattern_code,embedding_model,source_sha256,COUNT(*) copies FROM z_base_watched_pattern_vec GROUP BY pattern_code,embedding_model,source_sha256')).rows;
   result.reusableWatchSources=definitions.map(w=>({patternCode:w.PATTERN_CODE,sourceHash:textHash(patternEmbeddingText(w)),matchingSavedCopies:saved.filter(s=>s.PATTERN_CODE===w.PATTERN_CODE&&s.EMBEDDING_MODEL===model&&s.SOURCE_SHA256===textHash(patternEmbeddingText(w))).reduce((n,s)=>n+Number(s.COPIES),0)}));
  }catch(e){result.reusableWatchSources={error:e.message};}
  console.log(JSON.stringify(result,null,2));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
process.stdout.write(execFileSync('podman',['exec',process.argv[2]||'policeadelaide_app-fu40_1','node','-e',code],{encoding:'utf8',timeout:180000}));
