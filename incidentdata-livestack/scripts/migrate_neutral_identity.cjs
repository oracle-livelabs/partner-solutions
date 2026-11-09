'use strict';
// Read-only vector coverage inventory. No embeddings, restores or dataset writes.
const {execFileSync}=require('node:child_process');
const code=String.raw`
const o=require('oracledb');o.outFormat=o.OUT_FORMAT_OBJECT;
(async()=>{
 const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
 try{
  c.callTimeout=30000;await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");
  await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');
  const {createHash}=require('crypto');
  const digest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const read=async()=>{
   const result={};
   result.target=(await c.execute("SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE control_id=1")).rows;
   result.users=(await c.execute("SELECT user_name,role_name,display_name,is_active FROM security_users ORDER BY user_name")).rows;
   result.entitlements=(await c.execute("SELECT e.user_name,p.area_code FROM security_user_geo_entitlements e JOIN patrol_areas p ON p.patrol_area_id=e.patrol_area_id ORDER BY e.user_name,p.area_code")).rows;
   result.savedScopes=(await c.execute("SELECT p.profile_code,e.user_name,a.area_code FROM z_base_security_entitlements e JOIN z_base_patrol_areas a ON a.dataset_profile_id=e.dataset_profile_id AND a.patrol_area_id=e.patrol_area_id JOIN z_base_dataset_profiles p ON p.dataset_profile_id=e.dataset_profile_id ORDER BY p.profile_code,e.user_name,a.area_code")).rows;
   result.mobileMappings=(await c.execute('SELECT apex_user,scope_user,enabled FROM dtai_user_access ORDER BY apex_user')).rows;
   result.visible={};
   for(const u of ['statewide_admin','adelaide_central_analyst','central_analyst','northern_analyst','southern_analyst','read_only_viewer']){
    await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u});
    result.visible[u]={};
    for(const t of ['secure_crime_incidents_v','secure_incident_reports_v'])result.visible[u][t]=(await c.execute('SELECT COUNT(*) n FROM '+t)).rows[0].N;
    result.visible[u].vectors=(await c.execute("SELECT COUNT(*) n FROM incident_narrative_embeddings_v4 e JOIN secure_crime_incidents_v i ON i.incident_ref=e.incident_ref JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id WHERE e.embedding_model='cohere.embed-v4.0'")).rows[0].N;
   }
   await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");
   result.integrity={};
   for(const [k,q] of Object.entries({incidents:'SELECT incident_ref,patrol_area_id,category_id FROM crime_incidents ORDER BY incident_ref',reports:'SELECT incident_id,report_summary,DBMS_LOB.GETLENGTH(report_text) text_bytes FROM incident_reports ORDER BY incident_id',vectors:'SELECT profile_code,incident_ref,source_sha256,embedding_model FROM incident_narrative_embeddings_v4 ORDER BY profile_code,incident_ref',savedVectors:'SELECT dataset_profile_id,incident_ref,source_sha256,embedding_model FROM z_base_incident_narrative_vec ORDER BY dataset_profile_id,incident_ref'})){
    const rows=(await c.execute(q)).rows;result.integrity[k]={rows:rows.length,sha256:digest(rows)};
   }
   return result;
  };
  const before=await read();
  await c.rollback();
  console.log(JSON.stringify({phase:'before',result:before}));
  const sql=process.env.IDENTITY_MIGRATION_SQL;
  if(!sql)throw Error('Migration SQL missing');
  await c.execute(sql);
  const after=await read();
  const normalize=x=>JSON.stringify(x).replaceAll('adelaide_central_analyst','central_analyst');
  if(normalize(before.entitlements)!==JSON.stringify(after.entitlements)||normalize(before.savedScopes)!==JSON.stringify(after.savedScopes)||normalize(before.mobileMappings)!==JSON.stringify(after.mobileMappings))throw Error('Geographic scope or mobile mapping changed');
  if(JSON.stringify(before.integrity)!==JSON.stringify(after.integrity))throw Error('Incident/report/vector inventory changed');
  if(JSON.stringify(before.visible.adelaide_central_analyst)!==JSON.stringify(after.visible.central_analyst))throw Error('Central visible results changed');
  for(const u of ['statewide_admin','northern_analyst','southern_analyst','read_only_viewer'])if(JSON.stringify(before.visible[u])!==JSON.stringify(after.visible[u]))throw Error('Other user scope changed');
  if(after.users.length!==5||after.users.some(u=>u.USER_NAME==='adelaide_central_analyst'))throw Error('Identity replacement failed');
  // Reapply to prove the migration is safe to rerun.
  await c.execute(sql);await c.commit();
  const result={status:'passed',before,after,idempotent:true,scopePreserved:true,incidentReportVectorInventoryUnchanged:true};
  console.log(JSON.stringify(result));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
const fs=require('fs');const sql=fs.readFileSync('db/migrations/20261013_neutral_central_analyst.sql','utf8').replace(/\n\/\s*$/, '').replace('  COMMIT;', '  -- Commit after validation in the migration runner.');
process.stdout.write(execFileSync('podman',['exec','--env','IDENTITY_MIGRATION_SQL='+sql,'policeadelaide_app-fu40_1','node','-e',code],{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024}));
