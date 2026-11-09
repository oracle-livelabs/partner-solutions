'use strict';
// Read-only inspection: never activates a city or executes the restore package.
const {execFileSync}=require('node:child_process');
const code=String.raw`
const o=require('oracledb');o.outFormat=o.OUT_FORMAT_OBJECT;o.fetchAsString=[o.CLOB];
(async()=>{
 const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
 try{
  c.callTimeout=30000;await c.execute('SET TRANSACTION READ ONLY');
  const result={readOnly:true};
  for(const [key,sql] of Object.entries({
   identity:"SELECT user schema_name,sys_context('USERENV','DB_NAME') database_name FROM dual",
   active:"SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE control_id=1",
   packageSource:"SELECT text FROM user_source WHERE name='Z_BASE_DATASET_ADMIN' AND type='PACKAGE BODY' ORDER BY line",
   indexes:"SELECT i.table_name,i.index_name,i.status,c.column_name,c.column_position FROM user_indexes i JOIN user_ind_columns c ON c.index_name=i.index_name WHERE i.table_name LIKE 'Z_BASE_%' OR i.table_name IN ('CRIME_INCIDENTS','INCIDENT_REPORTS','EVIDENCE_ITEMS','PERSONS_OF_INTEREST','PERSON_INCIDENT_LINKS','CASE_FILES','CASE_INCIDENT_LINKS','SEMANTIC_MATCHES') ORDER BY i.table_name,i.index_name,c.column_position",
   foreignKeys:"SELECT c.table_name,c.constraint_name,c.r_constraint_name,cc.column_name,cc.position FROM user_constraints c JOIN user_cons_columns cc ON cc.constraint_name=c.constraint_name WHERE c.constraint_type='R' ORDER BY c.table_name,c.constraint_name,cc.position",
   statistics:"SELECT table_name,num_rows,last_analyzed FROM user_tables WHERE table_name LIKE 'Z_BASE_%' OR table_name IN ('CRIME_INCIDENTS','INCIDENT_REPORTS','EVIDENCE_ITEMS') ORDER BY table_name",
   recentRestoreSql:"SELECT sql_id,executions,ROUND(elapsed_time/1000000,3) elapsed_seconds,ROUND(cpu_time/1000000,3) cpu_seconds,buffer_gets,disk_reads,rows_processed,SUBSTR(sql_text,1,1000) sql_text FROM v$sql WHERE parsing_schema_name=USER AND (UPPER(sql_text) LIKE 'INSERT INTO %Z_BASE_%' OR UPPER(sql_text) LIKE 'DELETE FROM CRIME_INCIDENTS%' OR UPPER(sql_text) LIKE 'DELETE FROM INCIDENT_REPORTS%' OR UPPER(sql_text) LIKE 'BEGIN Z_BASE_DATASET_ADMIN.RESTORE_PROFILE%') ORDER BY elapsed_time DESC FETCH FIRST 20 ROWS ONLY"
  })){
   try{result[key]=(await c.execute(sql)).rows;}catch(e){result[key]={unavailable:true,error:e.message};}
  }
  result.readTimings=[];
  for(const [name,sql] of Object.entries({
   catalogue:"SELECT p.profile_code,(SELECT COUNT(*) FROM z_base_crime_incidents i WHERE i.dataset_profile_id=p.dataset_profile_id) incident_count,(SELECT COUNT(DISTINCT suburb) FROM z_base_crime_incidents i WHERE i.dataset_profile_id=p.dataset_profile_id) suburb_count FROM z_base_dataset_profiles p ORDER BY p.profile_code",
   reportIdentityMapping:"SELECT COUNT(*) row_count,SUM(i.incident_id) mapped_id_sum FROM z_base_incident_reports b JOIN z_base_crime_incidents source_i ON source_i.dataset_profile_id=b.dataset_profile_id AND source_i.incident_id=b.incident_id JOIN crime_incidents i ON i.incident_ref=source_i.incident_ref WHERE b.dataset_profile_id=(SELECT dataset_profile_id FROM z_base_active_dataset_profile WHERE control_id=1)",
   evidenceIdentityMapping:"SELECT COUNT(*) row_count,SUM(i.incident_id) mapped_id_sum FROM z_base_evidence_items b JOIN z_base_crime_incidents source_i ON source_i.dataset_profile_id=b.dataset_profile_id AND source_i.incident_id=b.incident_id JOIN crime_incidents i ON i.incident_ref=source_i.incident_ref WHERE b.dataset_profile_id=(SELECT dataset_profile_id FROM z_base_active_dataset_profile WHERE control_id=1)",
   reportHashMapping:"SELECT /*+ LEADING(b) USE_HASH(source_i i) */ COUNT(*) row_count,SUM(i.incident_id) mapped_id_sum FROM z_base_incident_reports b JOIN z_base_crime_incidents source_i ON source_i.dataset_profile_id=b.dataset_profile_id AND source_i.incident_id=b.incident_id JOIN crime_incidents i ON i.incident_ref=source_i.incident_ref WHERE b.dataset_profile_id=(SELECT dataset_profile_id FROM z_base_active_dataset_profile WHERE control_id=1)",
   evidenceHashMapping:"SELECT /*+ LEADING(b) USE_HASH(source_i i) */ COUNT(*) row_count,SUM(i.incident_id) mapped_id_sum FROM z_base_evidence_items b JOIN z_base_crime_incidents source_i ON source_i.dataset_profile_id=b.dataset_profile_id AND source_i.incident_id=b.incident_id JOIN crime_incidents i ON i.incident_ref=source_i.incident_ref WHERE b.dataset_profile_id=(SELECT dataset_profile_id FROM z_base_active_dataset_profile WHERE control_id=1)"
  })){
   const started=performance.now();
   try{const rows=(await c.execute(sql)).rows;result.readTimings.push({name,elapsedMs:Math.round(performance.now()-started),rows});}
   catch(e){result.readTimings.push({name,elapsedMs:Math.round(performance.now()-started),error:e.message});}
  }
  console.log(JSON.stringify(result,null,2));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
process.stdout.write(execFileSync('podman',['exec',process.argv[2]||'policeadelaide_app-fu40_1','node','-e',code],{encoding:'utf8',timeout:180000}));
