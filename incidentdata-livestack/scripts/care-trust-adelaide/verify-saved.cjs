'use strict';
// Read-only saved-profile projection. No active-table writes, city switch, DDL or AI calls.
const assert=require('node:assert/strict');
const {connect,rows}=require('../evidence-intelligence/connection.cjs');
const {DIR,OUT,PID,PROFILE,PATTERN,PACK,read,save,canonical,sha256}=require('./common.cjs');
const {trail,linkedIncidents}=require('../../backend/investigation-trail');
const api=require('../../backend/evidence-intelligence');
async function projection(c){
  const tables={crime_incidents:'z_base_crime_incidents',incident_reports:'z_base_incident_reports',incident_categories:'z_base_incident_categories',patrol_areas:'z_base_patrol_areas',security_user_geo_entitlements:'z_base_security_entitlements',persons_of_interest:'z_base_persons',person_incident_links:'z_base_person_incident_links',case_files:'z_base_case_files',case_incident_links:'z_base_case_incident_links',evidence_items:'z_base_evidence_items',social_media_posts:'z_base_social_media_posts',social_post_incident_links:'z_base_social_post_incident_links',watched_crime_patterns:'z_base_watched_crime_patterns',watched_pattern_posts:'z_base_watched_pattern_posts',watched_pattern_incidents:'z_base_watched_pattern_incidents'};
  const ctes=Object.entries(tables).map(([a,b])=>`${a} AS (SELECT * FROM ${b} WHERE dataset_profile_id=:careSavedProfileId)`);
  ctes.push('z_base_active_dataset_profile AS (SELECT 1 control_id,:careSavedProfileId dataset_profile_id FROM dual)');
  for(const name of ['SECURE_CRIME_INCIDENTS_V','SECURE_INCIDENT_REPORTS_V','SECURE_PERSONS_OF_INTEREST_V','SECURE_SOCIAL_MEDIA_POSTS_V','SECURE_EI_ITEMS_V']){
    const d=await rows(c,'SELECT text FROM user_views WHERE view_name=:n',{n:name});assert.equal(d.length,1);ctes.push(name+' AS ('+d[0].TEXT+')');
  }
  return {execute(sql,binds={},opts={}){assert(/^\s*SELECT\b/i.test(sql),'Only SELECT is permitted in saved projection');assert(!/GRAPH_TABLE|DBMS_CLOUD|\bNEXTVAL\b|FOR UPDATE/i.test(sql),'Native active-graph, AI and mutation calls are not projected');return c.execute('WITH '+ctes.join(',\n')+'\n'+sql,{...binds,careSavedProfileId:PID},opts);}};
}
async function main(){const c=await connect();try{
  await c.execute('SET TRANSACTION READ ONLY');const projected=await projection(c),checks=[];const check=(n,v)=>{assert(v,n);checks.push(n);};
  const all=await api.list(projected),pack=read(DIR,'pack.json');check('saved projection returns 21 Adelaide sources and five source-supported questions',all.items.length===21&&all.story.steps.length===5&&all.profile.profileCode===PROFILE);
  const d=await trail(projected,{patternCode:PATTERN});check('native SQL trail resolves exactly seven reports and eleven posts',d.incidents.length===7&&d.posts.length===11&&d.evidence.length===21);
  const lead=await trail(projected,{patternCode:PATTERN,postRef:'SYN-ADL-CARE-POST-01'});check('explicit private-followup lead resolves only the Marion report',lead.incidents.length===1&&lead.incidents[0].INCIDENT_REF==='ACI-V2-2026-0001');
  const wrong=await trail(projected,{patternCode:PATTERN,postRef:'SYN-ADL-CARE-POST-01',incidentRef:'ACI-V2-2026-0002'});check('mismatched post and incident expose no sources or story',!wrong.incidents.length&&!wrong.evidence.length&&!wrong.story);
  const unlinked=await trail(projected,{patternCode:PATTERN,postRef:'SYN-ADL-CARE-POST-03'});check('unlinked awareness cannot acquire an evidence trail',!unlinked.incidents.length&&!unlinked.evidence.length&&!unlinked.story);
  check('exact linked incident API uses recorded seven memberships',(await linkedIncidents(projected,{patternCode:PATTERN})).length===7);
  const exact=await api.list(projected,{namespace:'worker',marker:'ADL-WORKER-07'});check('native JSON marker search returns only three source-supported worker mentions',exact.items.length===3&&exact.items.every(e=>['EV-ADL-H03','EV-ADL-H04','EV-ADL-H06'].includes(e.evidenceRef)));
  const vector=await api.search(projected,{evidenceRef:'EV-ADL-H19',topK:6});check('native backend vector route retrieves reconciliation in the saved profile',vector.items.some(e=>e.evidenceRef==='EV-ADL-H20')&&vector.items.every(e=>e.profileCode===PROFILE));
  const spatial=await api.nearby(projected,{evidenceRef:'EV-ADL-H01',km:2});check('native Oracle Spatial retains approximate Marion context',spatial.items.some(e=>e.evidenceRef==='EV-ADL-H01')&&spatial.items.every(e=>e.distanceKm<=2));
  const paths=await rows(projected,`SELECT p.person_ref,i.incident_ref,l.connection_type,l.link_summary FROM person_incident_links l JOIN secure_persons_of_interest_v p ON p.person_id=l.person_id JOIN secure_crime_incidents_v i ON i.incident_id=l.incident_id WHERE p.person_ref LIKE 'POI-ADL-CARE-%' ORDER BY p.person_ref,i.incident_ref`);check('four saved person-incident context edges resolve without asserting source authorship',paths.length===4&&paths.every(p=>p.CONNECTION_TYPE==='associate'));
  for(const user of ['statewide_admin','southern_analyst','central_analyst','northern_analyst','read_only_viewer']){
    await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});const visible=user==='statewide_admin'||user==='southern_analyst',a=await api.list(projected),t=await trail(projected,{patternCode:PATTERN,postRef:'SYN-ADL-CARE-POST-01'});
    check(user+' respects saved entitlements through the actual secure-view predicates',visible?a.items.length===21&&t.incidents.length===1&&t.story.steps.length===5:a.items.length===0&&!t.incidents.length&&!t.posts.length&&!t.story);
  }
  await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");
  const source=(await rows(c,"SELECT text FROM user_source WHERE name='Z_BASE_DATASET_ADMIN' AND type='PACKAGE BODY' ORDER BY line")).map(r=>r.TEXT).join('');
  check('restore implementation unchanged since capture',source===read(OUT,'preflight.json').restoreSource);
  for(const name of ['Z_BASE_EVIDENCE_ITEMS','Z_BASE_PERSONS','Z_BASE_PERSON_INCIDENT_LINKS','Z_BASE_SOCIAL_MEDIA_POSTS','Z_BASE_SOCIAL_POST_INCIDENT_LINKS','Z_BASE_WATCHED_PATTERN_POSTS'])assert(source.includes(name));
  check('restore maps include all story-bearing saved tables and remap references',source.includes('i.incident_ref=source_i.incident_ref')&&source.includes('p.person_ref=source_p.person_ref'));
  check('evidence vectors remain keyed independently of changing active numeric IDs',!/DELETE FROM ei_text_vectors|TRUNCATE TABLE ei_text_vectors/i.test(source));
  const originals=(await rows(c,`SELECT i.incident_ref,i.incident_status,r.report_summary,r.report_text FROM z_base_crime_incidents i JOIN z_base_incident_reports r ON r.dataset_profile_id=i.dataset_profile_id AND r.incident_id=i.incident_id JOIN z_base_watched_pattern_incidents w ON w.dataset_profile_id=i.dataset_profile_id AND w.incident_ref=i.incident_ref WHERE i.dataset_profile_id=6 AND w.pattern_code=:p ORDER BY i.incident_ref`,{p:PATTERN}));
  for(const i of originals){const a=read(DIR,'anchors.json').incidents.find(a=>a.INCIDENT_REF===i.INCIDENT_REF);assert.deepEqual(i,{INCIDENT_REF:a.INCIDENT_REF,INCIDENT_STATUS:a.INCIDENT_STATUS,REPORT_SUMMARY:a.REPORT_SUMMARY,REPORT_TEXT:a.REPORT_TEXT});}
  check('all original narratives and statuses unchanged',originals.length===7);
  check('committed global selection is still Amsterdam',(await rows(c,'SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE control_id=1'))[0].PROFILE_CODE==='AMSTERDAM_DATA_V1');
  const regression=await require('../care-trust-v2/database.cjs').verify(c);check('Amsterdam native trail, counterexamples, vector and restricted-persona regression passes',regression.checks.length>0);
  const graph=await api.graph(c,'EV-AMS-H06');check('existing native property graph remains functional',graph.paths.length>0&&graph.engine==='Oracle GRAPH_TABLE');
  const result={at:new Date().toISOString(),status:'passed',mode:'read-only saved-profile SQL projection using actual security-view predicates; no active-city restore',checks,paths,vector:vector.items.map(e=>({ref:e.evidenceRef,score:e.score})),spatial:spatial.items.map(e=>({ref:e.evidenceRef,km:e.distanceKm})),restoreSourceSha256:sha256(source),packSha256:sha256(canonical(pack)),pending:['Committed Adelaide city-switch round trip','Adelaide native GRAPH_TABLE against restored active rows','Adelaide Select AI/native-agent generation after activation']};
  save(OUT,'saved-native-verification.json',result);console.log(JSON.stringify({status:result.status,checks,pending:result.pending}));
}finally{await c.rollback();await c.close();}}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={projection};
