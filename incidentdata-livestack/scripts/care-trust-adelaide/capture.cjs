'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {connect,rows,runtime}=require('../evidence-intelligence/connection.cjs');
const {DIR,OUT,PROFILE,PID,PACK,PATTERN,CASE,canonical,sha256,save}=require('./common.cjs');
const {savedCounts}=require('../care-trust/capture.cjs');
const {manifest}=require('../care-trust/release.cjs');
const savedTables={CRIME_INCIDENTS:'incident_id',INCIDENT_REPORTS:'report_id',CASE_FILES:'case_id',CASE_INCIDENT_LINKS:'case_id,incident_id',PERSONS:'person_id',PERSON_INCIDENT_LINKS:'person_id,incident_id',EVIDENCE_ITEMS:'evidence_id',SOCIAL_MEDIA_SOURCES:'source_code',SOCIAL_MEDIA_POSTS:'post_ref',SOCIAL_POST_INCIDENT_LINKS:'post_ref,incident_ref',WATCHED_CRIME_PATTERNS:'pattern_code',WATCHED_PATTERN_INCIDENTS:'pattern_code,incident_ref',WATCHED_PATTERN_POSTS:'pattern_code,post_ref'};
function exclude(table){
  if(table==='EVIDENCE_ITEMS')return `AND NVL(JSON_VALUE(evidence_metadata,'$.pack_code'),'none')<>'${PACK}'`;
  if(table==='PERSONS')return "AND person_ref NOT LIKE 'POI-ADL-CARE-%'";
  if(table==='PERSON_INCIDENT_LINKS')return "AND person_id NOT IN (SELECT person_id FROM z_base_persons WHERE dataset_profile_id=6 AND person_ref LIKE 'POI-ADL-CARE-%')";
  if(['SOCIAL_MEDIA_POSTS','SOCIAL_POST_INCIDENT_LINKS','WATCHED_PATTERN_POSTS'].includes(table))return "AND post_ref NOT LIKE 'SYN-ADL-CARE-POST-%'";
  return '';
}
async function protectedState(c){
  const result={};
  async function add(name,sql){const a=await rows(c,sql);result[name]={count:a.length,sha256:sha256(canonical(a))};}
  // Original Adelaide and the target V2 are fingerprinted. Active rows are protected in full.
  for(const [t,order] of Object.entries(savedTables))for(const pid of [1,PID])await add(`saved_${pid}_${t}`,`SELECT * FROM z_base_${t} WHERE dataset_profile_id=${pid} ${pid===PID?exclude(t):''} ORDER BY ${order}`);
  for(const [t,order] of Object.entries(savedTables)){const live=t==='PERSONS'?'PERSONS_OF_INTEREST':t;await add('live_'+live,`SELECT * FROM ${live} ORDER BY ${order}`);}
  await add('active','SELECT * FROM z_base_active_dataset_profile ORDER BY control_id');
  await add('entitlements','SELECT * FROM security_user_geo_entitlements ORDER BY user_name,patrol_area_id');
  return result;
}
async function main(){const c=await connect();try{
  await c.execute('SET TRANSACTION READ ONLY');
  const profile=(await rows(c,'SELECT * FROM z_base_dataset_profiles WHERE dataset_profile_id=:p',{p:PID}))[0];assert.equal(profile.PROFILE_CODE,PROFILE);
  const incidents=await rows(c,`SELECT i.*,cat.category_name,r.report_summary,r.report_text,r.enrichments FROM z_base_crime_incidents i JOIN z_base_incident_reports r ON r.dataset_profile_id=i.dataset_profile_id AND r.incident_id=i.incident_id JOIN z_base_incident_categories cat ON cat.dataset_profile_id=i.dataset_profile_id AND cat.category_id=i.category_id JOIN z_base_watched_pattern_incidents w ON w.dataset_profile_id=i.dataset_profile_id AND w.incident_ref=i.incident_ref WHERE i.dataset_profile_id=:p AND w.pattern_code=:w ORDER BY i.incident_ref`,{p:PID,w:PATTERN});
  assert.equal(incidents.length,7);
  const scoped=(table,order)=>rows(c,`SELECT * FROM z_base_${table} WHERE dataset_profile_id=:p ORDER BY ${order}`,{p:PID});
  const anchors={at:new Date().toISOString(),profile,incidents,caseRef:CASE,
    posts:(await scoped('social_media_posts','post_ref')).filter(p=>p.TOPIC_CODE===PATTERN),
    postLinks:(await scoped('social_post_incident_links','post_ref,incident_ref')).filter(l=>incidents.some(i=>i.INCIDENT_REF===l.INCIDENT_REF)),
    evidence:(await scoped('evidence_items','evidence_id')).filter(e=>incidents.some(i=>i.INCIDENT_ID===e.INCIDENT_ID)),
    personLinks:(await scoped('person_incident_links','person_id,incident_id')).filter(e=>incidents.some(i=>i.INCIDENT_ID===e.INCIDENT_ID)),
    watch:(await scoped('watched_crime_patterns','pattern_code')).find(w=>w.PATTERN_CODE===PATTERN)};
  const r=runtime();
  const pre={at:anchors.at,targetProfile:PROFILE,active:await rows(c,'SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE control_id=1'),anchorsSha256:sha256(canonical(anchors)),protected:await protectedState(c),savedCounts:await savedCounts(c),view:(await rows(c,"SELECT text FROM user_views WHERE view_name='SECURE_EI_ITEMS_V'"))[0].TEXT,
    restoreSource:(await rows(c,"SELECT text FROM user_source WHERE name='Z_BASE_DATASET_ADMIN' AND type='PACKAGE BODY' ORDER BY line")).map(r=>r.TEXT).join(''),runtime:{image:r.ImageName,imageId:r.Image,containerId:r.Id,manifest:manifest()},composeSha256:sha256(fs.readFileSync('compose.fu40.yml'))};
  save(DIR,'anchors.json',anchors);save(OUT,'preflight.json',pre);save(OUT,'incident-narratives.json',incidents.map(i=>({report_summary:i.REPORT_SUMMARY,report_text:i.REPORT_TEXT})));
  console.log(JSON.stringify({target:PROFILE,active:pre.active,incidents:incidents.length,posts:anchors.posts.length,originalEvidence:anchors.evidence.length,originalPeopleLinks:anchors.personLinks.length,protectedSets:Object.keys(pre.protected).length}));
}finally{await c.rollback();await c.close();}}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={protectedState};
