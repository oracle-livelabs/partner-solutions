'use strict';
// Run from /app in the existing FU40 container. Repairs vectors only; never switches a city.
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const o=require('oracledb');o.outFormat=o.OUT_FORMAT_OBJECT;o.fetchAsString=[o.CLOB];
const embedding=require(path.join(process.cwd(),'backend/pattern-embeddings'));
const {PATTERN_EMBEDDING_MODEL:model,embedPatternTexts,patternEmbeddingText,textHash,vectorLiteral}=embedding;
const PROFILE='ADELAIDE_DATA_V2',EXPECTED_REPORTS=21532;
const documentFor=r=>[`Incident category: ${r.CATEGORY_NAME}`,`Location context: ${r.LOCATION_TYPE||'unspecified'} in ${r.SUBURB}`,`Report summary: ${r.REPORT_SUMMARY}`,`Report narrative: ${String(r.REPORT_TEXT||'').slice(0,1800)}`,'Synthetic demonstration record. Semantic relevance requires analyst review and is not evidence of a connection.'].join('\n');
const fingerprint=rows=>crypto.createHash('sha256').update(JSON.stringify(rows.map(r=>[r.INCIDENT_REF,textHash(documentFor(r))]))).digest('hex');
const log=x=>console.log(JSON.stringify({...x,at:new Date().toISOString()}));
(async()=>{
 const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
 c.callTimeout=30000;
 try{
  const target=(await c.execute("SELECT user usr,sys_context('USERENV','DB_NAME') db FROM dual")).rows[0];
  if(target.USR!=='CRIME_DATA'||target.DB!=='GE1C42BF10AE843_FU40'||model!=='cohere.embed-v4.0'||embedding.PATTERN_EMBEDDING_DIMENSIONS!==1536)throw Error('Unexpected repair database or embedding configuration');
  await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");
  const active=async lock=>(await c.execute('SELECT p.profile_code,a.dataset_profile_id FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1'+(lock?' FOR UPDATE OF a.dataset_profile_id NOWAIT':''))).rows[0];
  const initial=await active(false);if(initial.PROFILE_CODE!==PROFILE)throw Error('Adelaide V2 must remain active');const pid=initial.DATASET_PROFILE_ID;
  const guard=async()=>{const a=await active(true);if(a.PROFILE_CODE!==PROFILE||a.DATASET_PROFILE_ID!==pid)throw Error('Active dataset changed; repair stopped');};
  const liveReports=async()=>(await c.execute('SELECT i.incident_ref,cat.category_name,i.location_type,i.suburb,r.report_summary,DBMS_LOB.SUBSTR(r.report_text,1800,1) report_text FROM crime_incidents i JOIN incident_categories cat ON cat.category_id=i.category_id JOIN incident_reports r ON r.incident_id=i.incident_id ORDER BY i.incident_ref')).rows;
  const savedReports=async()=>(await c.execute('SELECT /*+ LEADING(i) USE_HASH(cat r) */ i.incident_ref,cat.category_name,i.location_type,i.suburb,r.report_summary,DBMS_LOB.SUBSTR(r.report_text,1800,1) report_text FROM z_base_crime_incidents i JOIN z_base_incident_categories cat ON cat.dataset_profile_id=i.dataset_profile_id AND cat.category_id=i.category_id JOIN z_base_incident_reports r ON r.dataset_profile_id=i.dataset_profile_id AND r.incident_id=i.incident_id WHERE i.dataset_profile_id=:pid ORDER BY i.incident_ref',{pid})).rows;
  const reports=await liveReports(),saved=await savedReports();
  if(reports.length!==EXPECTED_REPORTS||saved.length!==reports.length||fingerprint(reports)!==fingerprint(saved))throw Error('Live/saved report source differs; reconcile source before creating vectors');
  const sourceFingerprint=fingerprint(reports);
  const watches=(await c.execute('SELECT pattern_code,pattern_name,pattern_summary,why_watch FROM watched_crime_patterns WHERE active=1 ORDER BY pattern_code')).rows;
  const savedWatches=(await c.execute('SELECT pattern_code,pattern_name,pattern_summary,why_watch FROM z_base_watched_crime_patterns WHERE dataset_profile_id=:pid AND active=1 ORDER BY pattern_code',{pid})).rows;
  if(watches.length!==21||JSON.stringify(watches.map(w=>[w.PATTERN_CODE,textHash(patternEmbeddingText(w))]))!==JSON.stringify(savedWatches.map(w=>[w.PATTERN_CODE,textHash(patternEmbeddingText(w))])))throw Error('Live/saved watch source differs');
  log({phase:'validated_sources',profile:PROFILE,pid,reports:reports.length,watches:watches.length,sourceFingerprint});
  for(const w of watches){
   await guard();const binds={code:w.PATTERN_CODE,model,hash:textHash(patternEmbeddingText(w))};
   const source=(await c.execute('SELECT dataset_profile_id FROM z_base_watched_pattern_vec WHERE pattern_code=:code AND embedding_model=:model AND source_sha256=:hash AND embedding IS NOT NULL ORDER BY dataset_profile_id FETCH FIRST 1 ROW ONLY',binds)).rows[0];
   if(!source)throw Error('No exact saved vector for '+w.PATTERN_CODE);
   await c.execute('DELETE FROM watched_pattern_embeddings WHERE pattern_code=:code',{code:binds.code});
   await c.execute('INSERT INTO watched_pattern_embeddings(pattern_code,embedding_model,source_sha256,embedding,created_at) SELECT pattern_code,embedding_model,source_sha256,embedding,created_at FROM z_base_watched_pattern_vec WHERE dataset_profile_id=:sourcePid AND pattern_code=:code AND embedding_model=:model AND source_sha256=:hash',{...binds,sourcePid:source.DATASET_PROFILE_ID});
   await c.execute('DELETE FROM z_base_watched_pattern_vec WHERE dataset_profile_id=:pid AND pattern_code=:code',{pid,code:binds.code});
   await c.execute('INSERT INTO z_base_watched_pattern_vec(dataset_profile_id,pattern_code,embedding_model,source_sha256,embedding,created_at) SELECT :pid,pattern_code,embedding_model,source_sha256,embedding,created_at FROM watched_pattern_embeddings WHERE pattern_code=:code',{pid,code:binds.code});
   await c.commit();
  }
  log({phase:'watches_repaired',reused:21,newEmbeddingCalls:0});
  const existing=(await c.execute('SELECT n.incident_ref,n.source_sha256 FROM incident_narrative_embeddings_v4 n JOIN z_base_incident_narrative_vec s ON s.dataset_profile_id=:pid AND s.incident_ref=n.incident_ref AND s.source_sha256=n.source_sha256 AND s.embedding_model=n.embedding_model WHERE n.profile_code=:profile AND n.embedding_model=:model AND n.embedding IS NOT NULL AND s.embedding IS NOT NULL',{pid,profile:PROFILE,model})).rows;
  const hashes=new Map(existing.map(r=>[r.INCIDENT_REF,r.SOURCE_SHA256]));
  const pending=reports.filter(r=>hashes.get(r.INCIDENT_REF)!==textHash(documentFor(r)));
  log({phase:'reports_prepared',total:reports.length,pending:pending.length,alreadyCurrent:reports.length-pending.length});
  for(let offset=0;offset<pending.length;offset+=64){
   const batch=pending.slice(offset,offset+64),vectors=await embedPatternTexts(batch.map(documentFor),'SEARCH_DOCUMENT');
   await guard();
   const rows=batch.map((r,i)=>({profile:PROFILE,ref:r.INCIDENT_REF,model,hash:textHash(documentFor(r)),vector:vectorLiteral(vectors[i])}));
   await c.executeMany('MERGE INTO incident_narrative_embeddings_v4 e USING (SELECT :profile profile_code,:ref incident_ref FROM dual) s ON (e.profile_code=s.profile_code AND e.incident_ref=s.incident_ref) WHEN MATCHED THEN UPDATE SET e.embedding_model=:model,e.source_sha256=:hash,e.embedding=TO_VECTOR(:vector),e.created_at=SYSTIMESTAMP WHEN NOT MATCHED THEN INSERT(profile_code,incident_ref,embedding_model,source_sha256,embedding,created_at) VALUES(:profile,:ref,:model,:hash,TO_VECTOR(:vector),SYSTIMESTAMP)',rows);
   await c.executeMany('DELETE FROM z_base_incident_narrative_vec WHERE dataset_profile_id=:pid AND incident_ref=:ref',batch.map(r=>({pid,ref:r.INCIDENT_REF})));
   await c.executeMany('INSERT INTO z_base_incident_narrative_vec(dataset_profile_id,incident_ref,embedding_model,source_sha256,embedding,created_at) SELECT :pid,incident_ref,embedding_model,source_sha256,embedding,created_at FROM incident_narrative_embeddings_v4 WHERE profile_code=:profile AND incident_ref=:ref',batch.map(r=>({pid,profile:PROFILE,ref:r.INCIDENT_REF})));
   await c.commit();
   if(offset%256===0||offset+batch.length===pending.length)log({phase:'reports_embedded',completed:offset+batch.length,pending:pending.length});
  }
  await guard();
  if(fingerprint(await liveReports())!==sourceFingerprint||fingerprint(await savedReports())!==sourceFingerprint)throw Error('Source narratives changed during repair');
  const counts=(await c.execute('SELECT (SELECT COUNT(*) FROM incident_narrative_embeddings_v4 WHERE profile_code=:profile AND embedding_model=:model) live_reports,(SELECT COUNT(*) FROM z_base_incident_narrative_vec WHERE dataset_profile_id=:pid AND embedding_model=:model) saved_reports,(SELECT COUNT(*) FROM watched_pattern_embeddings WHERE embedding_model=:model) live_watches,(SELECT COUNT(*) FROM z_base_watched_pattern_vec WHERE dataset_profile_id=:pid AND embedding_model=:model) saved_watches FROM dual',{profile:PROFILE,model,pid})).rows[0];
  if(counts.LIVE_REPORTS!==EXPECTED_REPORTS||counts.SAVED_REPORTS!==EXPECTED_REPORTS||counts.LIVE_WATCHES!==21||counts.SAVED_WATCHES!==21)throw Error('Final vector counts differ');
  await c.rollback();log({phase:'complete',profile:PROFILE,sourceFingerprint,...counts});
 }catch(e){await c.rollback();throw e;}finally{await c.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
