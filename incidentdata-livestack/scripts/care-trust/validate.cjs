'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DIR,OUT,PROFILE,PACK,CASE,KNOWLEDGE,canonical,sha256,read,save}=require('./common.cjs');
function validate(pack,anchors,readAsset){
  assert.equal(pack.profileCode,PROFILE);assert.equal(pack.packageCode,PACK);assert.equal(pack.knowledgeSetId,KNOWLEDGE);assert.equal(pack.items.length,16);assert.equal(pack.people.length,2);assert.equal(pack.newLinks.length,3);
  assert.equal(pack.anchorSnapshotSha256,sha256(canonical(anchors)));
  assert.equal(new Set(pack.items.map(e=>e.evidenceRef)).size,16);assert.equal(new Set(pack.items.map(e=>e.title)).size,16);assert.equal(new Set(pack.items.map(e=>e.description)).size,16);
  assert.equal(new Set(pack.items.map(e=>e.incidentRef)).size,5);
  for(const e of pack.items){
    const i=anchors.incidents.find(i=>i.INCIDENT_REF===e.incidentRef);assert(i,e.evidenceRef);assert.equal(e.caseRef,CASE);assert.equal(e.syntheticRecord,true);
    assert.match(e.evidenceRef,/^EV-AMS-H\d{2}$/);assert.equal(e.profileCode,PROFILE);assert.equal(e.knowledgeSetId,KNOWLEDGE);
    assert(e.title.length>=25&&e.title.length<=140);assert(e.description.length>=160&&e.description.length<=700,e.evidenceRef);
    assert.equal(e.incidentContext.occurredAt,i.OCCURRED_AT);assert.equal(e.incidentContext.latitude,i.LATITUDE);assert.equal(e.incidentContext.longitude,i.LONGITUDE);assert.equal(e.incidentContext.suburb,i.SUBURB);assert.equal(e.attributes.incidentStatus,i.INCIDENT_STATUS);
    assert.equal(e.capturedAt,null);assert.equal(e.captureLocation,null);assert(Date.parse(e.simulatedRecordedAt)>=Date.parse(i.INCIDENT_ATTRIBUTES.reported_timestamp));
    assert.equal(e.provenance.anchorSnapshotSha256,pack.anchorSnapshotSha256);assert.equal(e.provenance.origin,'authored_synthetic_fixture');
    assert.equal(e.indexText,[e.title,e.description,e.sourceText].join('\n'));assert.equal(e.indexTextSha256,sha256(e.indexText));assert(!/expectedRank|groundTruth|negativeControl|forbiddenConclusions/.test(e.indexText));
    assert.equal(e.asset.path,`assets/documents/${e.evidenceRef}.txt`);assert.equal(e.asset.mimeType,'text/plain');if(readAsset){const bytes=readAsset(e.asset.path);assert.equal(sha256(bytes),e.asset.sha256);assert.equal(bytes.toString(),e.sourceText+'\n');}
    for(const m of e.markers){assert(m.namespace&&m.value);assert(e.sourceText.includes(m.sourceQuote));assert.equal(m.value,m.sourceQuote);}
    for(const l of e.personLinks){
      assert(['existing_incident_context','authored_incident_context','literal_name_mention'].includes(l.basis));
      assert(anchors.links.some(p=>p.INCIDENT_REF===e.incidentRef&&p.PERSON_REF===l.personRef)||pack.newLinks.some(p=>p.incidentRef===e.incidentRef&&p.personRef===l.personRef));
      if(l.basis==='literal_name_mention')assert.equal(e.sourceText.slice(l.startCharacter,l.endCharacter),l.quote);
      if(l.basis==='authored_incident_context')for(const ref of l.supportingEvidenceRefs){const source=pack.items.find(s=>s.evidenceRef===ref);assert(source);assert(source.sourceText.includes(pack.people.find(p=>p.personRef===l.personRef).displayName));}
    }
  }
  assert(pack.items.find(e=>e.evidenceRef==='EV-AMS-H13').sourceText.includes('incident remains resolved'));
  assert.equal(pack.items.find(e=>e.evidenceRef==='EV-AMS-H16').attributes.contentTrust,'untrusted_source_text');
  return {valid:true,items:pack.items.length,people:pack.people.length,links:pack.newLinks.length};
}
if(require.main===module){const result=validate(read(DIR,'pack.json'),read(DIR,'anchors.json'),p=>fs.readFileSync(path.join(DIR,p)));save(OUT,'fixture-validation.json',result);console.log(JSON.stringify(result));}
module.exports={validate};
