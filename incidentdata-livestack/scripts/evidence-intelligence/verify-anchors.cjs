'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../../testdata/evidence-intelligence/v1');
const anchors=JSON.parse(fs.readFileSync(path.join(ROOT,'anchors.json')));
async function get(route,user='statewide_admin') {
  const r=await fetch('http://127.0.0.1:8706'+route,{headers:{'X-Demo-User':user},signal:AbortSignal.timeout(30000)});
  assert(r.ok,route+' HTTP '+r.status);return r.json();
}
async function main(){
  const profile=await get('/api/profile-context');assert.equal(profile.profileCode,anchors.profile.profileCode);
  for(const old of anchors.incidents){
    const current=await get('/api/incidents/'+old.INCIDENT_REF);
    for(const key of ['INCIDENT_REF','OCCURRED_AT','SUBURB','REPORT_SUMMARY','REPORT_TEXT','LATITUDE','LONGITUDE','INCIDENT_STATUS'])assert.deepEqual(current.incident[key],old[key],old.INCIDENT_REF+' '+key);
    const previousLinks=anchors.links.filter(l=>l.INCIDENT_REF===old.INCIDENT_REF).map(({INCIDENT_REF,...l})=>l);
    assert.deepEqual(current.people,previousLinks);
    const previousEvidence=anchors.evidence.filter(e=>e.INCIDENT_REF===old.INCIDENT_REF).map(({INCIDENT_REF,...e})=>e);
    assert.deepEqual(current.evidence,previousEvidence);
  }
  assert.deepEqual(await get('/api/persons'),anchors.people);
  assert.equal((await get('/api/health')).status,'healthy');
  const result={verifiedAt:new Date().toISOString(),profile:profile.profileCode,incidentDetailsUnchanged:12,personCatalogueUnchanged:true,
    existingIncidentEvidenceUnchanged:true,existingPersonLinksUnchanged:true,health:'healthy',databaseWritesPerformed:false,
    limitation:'HTTP comparisons of selected anchor details, evidence summaries and POI catalogue; not a complete protected-table database fingerprint.'};
  fs.writeFileSync(path.join(ROOT,'live-anchor-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
