'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {connect,rows,runtime,CONTAINER}=require('../evidence-intelligence/connection.cjs');
const {DIR,OUT,PROFILE,CASE,PACK,save,read,sha256,canonical}=require('./common.cjs');
async function protectedState(c){
  const hashes={};
  const queries={
    incidents:'SELECT * FROM crime_incidents ORDER BY incident_ref',
    reports:'SELECT * FROM incident_reports ORDER BY report_id',
    cases:'SELECT * FROM case_files ORDER BY case_id',
    caseLinks:'SELECT * FROM case_incident_links ORDER BY case_id,incident_id',
    people:"SELECT * FROM persons_of_interest WHERE person_ref NOT LIKE 'POI-AMS-CARE-%' ORDER BY person_ref",
    personLinks:"SELECT l.* FROM person_incident_links l JOIN persons_of_interest p ON p.person_id=l.person_id WHERE p.person_ref NOT LIKE 'POI-AMS-CARE-%' ORDER BY l.person_id,l.incident_id",
    evidence:`SELECT * FROM evidence_items WHERE NVL(JSON_VALUE(evidence_metadata,'$.pack_code'),'none')<>'${PACK}' ORDER BY evidence_id`,
    entitlements:'SELECT * FROM security_user_geo_entitlements ORDER BY user_name,patrol_area_id',
    watchPatterns:'SELECT * FROM watched_crime_patterns ORDER BY pattern_code',
    watchLinks:'SELECT * FROM watched_pattern_incidents ORDER BY pattern_code,incident_ref'
  };
  for(const [name,sql] of Object.entries(queries)){const records=await rows(c,sql);hashes[name]={count:records.length,sha256:sha256(canonical(records))};}
  return hashes;
}
async function savedCounts(c){return rows(c,`SELECT p.profile_code,
    (SELECT COUNT(*) FROM z_base_crime_incidents i WHERE i.dataset_profile_id=p.dataset_profile_id) incidents,
    (SELECT COUNT(*) FROM z_base_evidence_items e WHERE e.dataset_profile_id=p.dataset_profile_id) evidence,
    (SELECT COUNT(*) FROM z_base_persons s WHERE s.dataset_profile_id=p.dataset_profile_id) people,
    (SELECT COUNT(*) FROM z_base_person_incident_links l WHERE l.dataset_profile_id=p.dataset_profile_id) links
    FROM z_base_dataset_profiles p ORDER BY p.profile_code`);}
async function main(){const c=await connect();try{
  await c.execute('SET TRANSACTION READ ONLY');
  const profile=(await rows(c,`SELECT p.* FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`))[0];assert.equal(profile.PROFILE_CODE,PROFILE);
  const incidents=await rows(c,`SELECT i.*,cat.category_name,r.report_summary,DBMS_LOB.SUBSTR(r.report_text,4000,1) report_text FROM crime_incidents i JOIN incident_reports r ON r.incident_id=i.incident_id JOIN incident_categories cat ON cat.category_id=i.category_id JOIN case_incident_links l ON l.incident_id=i.incident_id JOIN case_files cf ON cf.case_id=l.case_id WHERE cf.case_ref=:r ORDER BY i.occurred_at`,{r:CASE});assert.equal(incidents.length,6);
  const links=await rows(c,`SELECT p.person_ref,p.display_name,l.connection_type,l.link_summary,i.incident_ref FROM person_incident_links l JOIN persons_of_interest p ON p.person_id=l.person_id JOIN crime_incidents i ON i.incident_id=l.incident_id JOIN case_incident_links cl ON cl.incident_id=i.incident_id JOIN case_files cf ON cf.case_id=cl.case_id WHERE cf.case_ref=:r ORDER BY i.incident_ref,p.person_ref`,{r:CASE});
  const savedIncidents=await rows(c,`SELECT i.* FROM z_base_crime_incidents i WHERE dataset_profile_id=:p AND incident_ref IN (SELECT i.incident_ref FROM crime_incidents i JOIN case_incident_links l ON l.incident_id=i.incident_id JOIN case_files cf ON cf.case_id=l.case_id WHERE cf.case_ref=:r) ORDER BY incident_ref`,{p:profile.DATASET_PROFILE_ID,r:CASE});
  const savedPeople=await rows(c,`SELECT person_ref,person_id FROM z_base_persons WHERE dataset_profile_id=:p ORDER BY person_ref`,{p:profile.DATASET_PROFILE_ID});
  const active=runtime();
  const script="const fs=require('fs'),crypto=require('crypto'),r={};for(const dir of ['backend','frontend/dist']){function walk(d){for(const n of fs.readdirSync(d)){const p=d+'/'+n;if(fs.statSync(p).isDirectory())walk(p);else r[p]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}walk(dir);}console.log(JSON.stringify(r));";
  const hashes=JSON.parse(execFileSync('podman',['exec',CONTAINER,'node','-e',script],{encoding:'utf8',maxBuffer:8*1024*1024}));
  const priorView=(await rows(c,"SELECT text FROM user_views WHERE view_name='SECURE_EI_ITEMS_V'"))[0].TEXT;
  const refresh=process.argv.includes('--refresh-timestamp-hashes');
  let snapshot={at:new Date().toISOString(),profile,caseRef:CASE,incidents,links,savedIncidents,savedPeople};
  if(refresh){
    assert(!fs.existsSync(OUT+'/load-committed.json'),'Cannot refresh a baseline after loading');
    const old=read(DIR,'anchors.json');for(const key of ['profile','incidents','links','savedIncidents','savedPeople'])assert.equal(canonical(old[key]),canonical(snapshot[key]),'Source changed: '+key);
    snapshot=old;save(OUT,'preflight-before-timestamp-normalisation.json',read(OUT,'preflight.json'),true);
  }else save(DIR,'anchors.json',snapshot,true);
  const pre={at:snapshot.at,profileCode:PROFILE,profileId:profile.DATASET_PROFILE_ID,anchorsSha256:sha256(canonical(snapshot)),protected:await protectedState(c),savedCounts:await savedCounts(c),priorView,
    runtime:{image:active.ImageName,imageId:active.Image,containerId:active.Id,hashes},composeSha256:sha256(fs.readFileSync('compose.fu40.yml'))};
  save(OUT,'preflight.json',pre,!refresh);if(!refresh)save(OUT,'incident-narratives.json',incidents.map(i=>({report_summary:i.REPORT_SUMMARY,report_text:i.REPORT_TEXT})),true);
  console.log(JSON.stringify({profile:PROFILE,incidents:incidents.length,existingLinks:links.length,protected:pre.protected,savedCounts:pre.savedCounts,image:pre.runtime.image}));
}finally{await c.rollback();await c.close();}}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={protectedState,savedCounts};
