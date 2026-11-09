'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {validate,rank,visibleItems,markerMatches,distanceKm,sha256,canonical}=require('../scripts/evidence-intelligence/contract.cjs');
const ROOT=path.resolve(__dirname,'../testdata/evidence-intelligence/v1');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n)));
const pack=read('pack.json'),anchors=read('anchors.json'),embedded=read('embeddings.json'),expected=read('expected.json');
const copy=x=>JSON.parse(JSON.stringify(x));
test('32 distinct evidence records resolve to the captured incidents, cases and POIs',()=>{
  const r=validate(pack,anchors,p=>fs.readFileSync(path.join(ROOT,p)));
  assert.deepEqual(r,{valid:true,errors:[],items:32,incidents:12,people:6});
  assert.equal(embedded.packSha256,sha256(canonical(pack)));
});
test('orphan incidents and unsupported person associations are rejected',()=>{
  const p=copy(pack);p.items[0].incidentRef='SYN-MISSING';
  assert(validate(p,anchors).errors.some(e=>e.includes('Unknown incident')));
  const q=copy(pack);q.items[0].personLinks[0].personRef='POI-NBNW-EVE';
  assert(validate(q,anchors).errors.some(e=>e.includes('Invented baseline POI link')));
});
test('changed quotes, checksums, duplicate identities and capture assertions fail validation',()=>{
  const p=copy(pack),note=p.items.find(e=>e.evidenceRef==='EV-AMS-N01');
  note.personLinks.find(l=>l.basis==='literal_name_mention').startCharacter++;
  p.items[2].evidenceRef=p.items[0].evidenceRef;
  p.items[0].capturedAt='2026-05-01T00:00:00Z';
  const r=validate(p,anchors,()=>Buffer.from('tampered'));
  for(const phrase of ['Invalid quote offsets','Duplicate reference','Invented capture','Asset hash mismatch'])assert(r.errors.some(e=>e.includes(phrase)),phrase);
});
test('source and image creation times remain separate from incident occurrence',()=>{
  for(const e of pack.items) {
    assert.equal(e.provenance.authoredAt,'2026-09-24');assert.equal(e.capturedAt,null);assert.equal(e.captureLocation,null);
    assert(Date.parse(e.simulatedRecordedAt)>=Date.parse(e.incidentContext.occurredAt));
  }
  assert.equal(pack.items.find(e=>e.evidenceRef==='EV-AMS-P05').attributes.currency,null);
});
test('security filters run before top K so an invisible nearest neighbour cannot displace visible matches',()=>{
  const q=embedded.queries[0],visible=visibleItems(pack,{profileCode:pack.profileCode,
    incidentRefs:['SYN-AMS-2026-03505'],personRefs:['POI-NBNW-PHILIP']});
  const results=rank(visible,embedded.vectors,q.values,{model:q.model,dimensions:q.dimensions,modality:'text',topK:1});
  assert.equal(results[0].evidenceRef,'EV-AMS-P02');
  assert(!results.some(r=>r.evidenceRef==='EV-AMS-P01'));
});
test('no scope, a different profile and a hidden person never yield bound POI records',()=>{
  assert.deepEqual(visibleItems(pack,{profileCode:pack.profileCode,incidentRefs:[],personRefs:[]}),[]);
  assert.deepEqual(visibleItems(pack,{profileCode:'ADELAIDE_DATA',incidentRefs:anchors.incidents.map(i=>i.INCIDENT_REF),personRefs:anchors.people.map(p=>p.PERSON_REF)}),[]);
  const rows=visibleItems(pack,{profileCode:pack.profileCode,incidentRefs:['SYN-AMS-2026-05667'],personRefs:[]});
  assert(rows.length>0);assert(rows.every(e=>e.personLinks.length===0));
  // The authorised document can still contain a literal name; it cannot expose the hidden POI binding.
  assert(rows.some(e=>e.sourceText.includes('Philip Vandamm')));
});
test('the same short code in three namespaces does not create a shared-marker relationship',()=>{
  for(const probe of expected.markerProbes)assert.deepEqual(markerMatches(pack.items,probe.namespace,probe.value).map(e=>e.evidenceRef).sort(),[...probe.expectedRefs].sort());
});
test('narrative and image models cannot be mixed and stale vectors fail closed',()=>{
  const v=embedded.vectors.find(v=>v.modality==='image');
  assert.throws(()=>rank(pack.items,embedded.vectors,v.values,{model:v.model,modality:'text',dimensions:384}),/dimensions/);
  const stale=copy(embedded.vectors);stale[0].sourceSha256='wrong';
  const q=embedded.queries[0];
  assert.throws(()=>rank(pack.items,stale,q.values,{model:q.model,dimensions:384,modality:'text'}),/Stale embedding/);
  assert.deepEqual(rank(pack.items,embedded.vectors,q.values,{model:'different-model',dimensions:384,modality:'text'}),[]);
});
test('image comparator outranks the visually related orange organiser without equating object identities',()=>{
  const v=embedded.vectors.find(v=>v.evidenceRef==='EV-AMS-V01'&&v.modality==='image');
  const r=rank(pack.items,embedded.vectors,v.values,{model:v.model,dimensions:512,modality:'image',excludeRef:v.evidenceRef});
  assert.equal(r[0].evidenceRef,'EV-AMS-V02');assert(r.findIndex(r=>r.evidenceRef==='EV-AMS-V03')>0);
  assert(pack.items.filter(e=>e.kind==='generated_object_image').every(e=>e.personLinks.length===0));
});
test('distance reference handles identical and widely separated points',()=>{
  assert.equal(distanceKm({latitude:52,longitude:4},{latitude:52,longitude:4}),0);
  assert(distanceKm({latitude:0,longitude:0},{latitude:0,longitude:180})>20000);
});
test('designed hostile source is labelled as source data; answer key is separate from indexed text',()=>{
  const e=pack.items.find(e=>e.evidenceRef==='EV-AMS-C04');
  assert.equal(e.attributes.contentTrust,'untrusted_source_text');assert(e.sourceText.includes('Ignore prior instructions'));
  for(const item of pack.items)assert(!Object.hasOwn(item,'mustInclude')&&!Object.hasOwn(item,'expectedFirstOther'));
  // This verifies fixture representation only. A real agent execution is a separate release gate.
});
