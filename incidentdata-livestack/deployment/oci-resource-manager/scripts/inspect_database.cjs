'use strict';
// Source-only, read-only audit. Uses the existing guarded FU40 connection.
const fs=require('node:fs'),path=require('node:path');
const {connect,rows}=require('../../../scripts/evidence-intelligence/connection.cjs');
(async()=>{
 const output=process.argv[2];if(!output)throw Error('Supply an output JSON path');
 const c=await connect(),result={readOnly:true,sourceSchema:'CRIME_DATA',sourceDatabase:'fu40'};
 async function capture(name,sql,binds={}){try{result[name]=await rows(c,sql,binds);}catch(e){result[name]={errorCode:e.errorNum||null,message:String(e.message).split('\n')[0]};}}
 try{
  await c.execute('SET TRANSACTION READ ONLY');
  await capture('databaseVersion','SELECT banner_full FROM v$version');
  await capture('objectCounts','SELECT object_type,status,COUNT(*) object_count FROM user_objects GROUP BY object_type,status ORDER BY object_type,status');
  await capture('invalidObjects',"SELECT object_name,object_type FROM user_objects WHERE status<>'VALID' ORDER BY object_type,object_name");
  await capture('storage',"SELECT ROUND(SUM(bytes)/1024/1024) allocated_mb FROM user_segments");
  await capture('apexRelease','SELECT version_no FROM apex_release');
  await capture('apexApplications','SELECT workspace,application_id,application_name,alias,owner FROM apex_applications ORDER BY application_id');
  await capture('apexWorkspaces','SELECT workspace,workspace_id FROM apex_workspaces');
  await capture('apexAuthColumns',"SELECT column_name FROM all_tab_columns WHERE table_name='APEX_APPLICATION_AUTH' ORDER BY column_id");
  await capture('apexAuthentication','SELECT application_id,authentication_scheme_name,scheme_type FROM apex_application_auth ORDER BY application_id');
  await capture('activeProfile','SELECT a.dataset_profile_id,p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1');
  const {FOUNDATION_PROFILES}=await import('../../../frontend/src/foundation-profiles.mjs');
  const profiles=await rows(c,'SELECT dataset_profile_id,profile_code FROM z_base_dataset_profiles');result.cities=[];
  for(const expected of FOUNDATION_PROFILES){
   const p=profiles.find(p=>p.PROFILE_CODE===expected.code);if(!p)throw Error('Missing city '+expected.code);
   const counts=(await rows(c,`SELECT (SELECT COUNT(*) FROM z_base_crime_incidents WHERE dataset_profile_id=:pid) incidents,
    (SELECT COUNT(*) FROM z_base_persons WHERE dataset_profile_id=:pid) persons,
    (SELECT COUNT(*) FROM z_base_watched_crime_patterns WHERE dataset_profile_id=:pid AND active=1 AND activate_ui='Y') active_watch_patterns,
    (SELECT COUNT(*) FROM poi_identifiers WHERE dataset_profile_id=:pid) identifiers FROM dual`,{pid:p.DATASET_PROFILE_ID}))[0];
   result.cities.push({code:expected.code,city:expected.city,...counts});
  }
  await capture('dataRoom',`SELECT (SELECT COUNT(*) FROM cdr_batches) batches,(SELECT COUNT(*) FROM cdr_items) items FROM dual`);
  await capture('dataRoomStorageColumns',"SELECT table_name,column_name,data_type FROM user_tab_columns WHERE table_name LIKE 'CDR_%' AND data_type IN ('BLOB','CLOB') ORDER BY table_name,column_name");
  await capture('cloudAiViews',"SELECT DISTINCT table_name FROM all_tab_columns WHERE table_name LIKE 'USER_CLOUD_AI%' ORDER BY table_name");
  await capture('aiProfiles','SELECT profile_name,status FROM user_cloud_ai_profiles ORDER BY profile_name');
  await capture('aiProfileAttributes',"SELECT profile_name,attribute_name,CASE WHEN LOWER(attribute_name) IN ('provider','model','region','oci_region') THEN DBMS_LOB.SUBSTR(attribute_value,4000,1) ELSE '[redacted]' END attribute_value FROM user_cloud_ai_profile_attributes ORDER BY profile_name,attribute_name");
  await capture('aiAgentViews',"SELECT DISTINCT table_name FROM all_tab_columns WHERE table_name LIKE 'USER%AI%AGENT%' OR table_name LIKE 'USER%AI%TEAM%' OR table_name LIKE 'USER%AI%TASK%' ORDER BY table_name");
  await capture('graphs',"SELECT object_name,status FROM user_objects WHERE object_type='PROPERTY GRAPH' ORDER BY object_name");
  await capture('outboundLinks','SELECT db_link,username FROM user_db_links');
  fs.writeFileSync(path.resolve(output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({output,cities:result.cities.length,apexApplications:result.apexApplications,storage:result.storage}));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
