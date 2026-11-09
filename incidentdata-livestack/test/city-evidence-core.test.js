'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PACK,THEMES,sha,canonical,validate}=require('../scripts/evidence-intelligence/city-core/contract.cjs');
const {cityEvidenceStories}=require('../backend/city-evidence-stories');
const {citationInstructions,validateAnswer}=require('../backend/evidence-intelligence');
const DIR=path.resolve(__dirname,'../testdata/evidence-intelligence/city-core-v1');
const pack=JSON.parse(fs.readFileSync(path.join(DIR,'pack.json'))),anchors=JSON.parse(fs.readFileSync(path.join(DIR,'anchors.json'))),vectors=JSON.parse(fs.readFileSync(path.join(DIR,'embeddings.json')));
const asset=p=>fs.readFileSync(path.join(DIR,p));
const copy=x=>structuredClone(x);
test('fixture hashes preserve the same timestamp representation before and after JSON serialization',()=>{
 const source={occurredAt:new Date('2026-05-01T12:00:00.000Z')};
 assert.equal(canonical(source),canonical(JSON.parse(JSON.stringify(source))));
});
test('nine cities have 24 checked sources, six stories, 12 local incident anchors and four images',()=>{
 assert.deepEqual(validate(pack,asset),{cities:9,items:216,textVectors:216,imageVectors:36});
 assert.equal(pack.anchorSnapshotSha256,sha(canonical(anchors)));
 for(const city of pack.cities){const local=anchors.cities.find(p=>p.profileCode===city.profileCode);
  for(const e of city.items){const a=local.anchors.find(a=>a.PATTERN_CODE===e.watchPatternCode&&a.INCIDENT_REF===e.incidentRef);assert(a);assert.equal(e.caseRef,a.CASE_REF||null);assert.equal(e.incidentContext.suburb,a.SUBURB);assert.equal(e.incidentContext.latitude,a.LATITUDE);assert.equal(e.incidentContext.longitude,a.LONGITUDE);assert.equal(e.incidentContext.occurredAt,a.OCCURRED_AT);for(const person of e.personLinks)assert(a.people.some(p=>p.PERSON_REF===person.personRef));}
  const vehicle=city.items.filter(e=>e.watchPatternCode==='VEHICLE_PARTS_HARVESTING');
  assert.equal(vehicle[3].markers[0].namespace,vehicle[0].markers[0].namespace);
 }
});
test('all source and image vectors use exact source hashes, correct models and separate dimensions',()=>{
 assert.equal(vectors.packSha256,sha(canonical(pack)));assert.equal(vectors.vectors.length,252);
 for(const v of vectors.vectors){const item=pack.cities.find(p=>p.profileCode===v.profileCode).items.find(e=>e.evidenceRef===v.evidenceRef);assert(item);const image=v.modality==='image';assert.equal(v.sourceSha256,image?item.asset.sha256:item.indexTextSha256);assert.equal(v.model,image?vectors.imageModel:vectors.textModel);assert.equal(v.values.length,image?512:384);assert(v.values.every(Number.isFinite));assert(Math.abs(v.values.reduce((s,n)=>s+n*n,0)-1)<0.001);}
});
test('a changed document, missing asset or cross-city duplicate fails fixture validation',()=>{
 const p=copy(pack);p.cities[0].items[0].indexText+=' modified';assert.throws(()=>validate(p,asset));
 const q=copy(pack);q.cities[1].items[0].evidenceRef=q.cities[0].items[0].evidenceRef;assert.throws(()=>validate(q,asset));
 assert.throws(()=>validate(pack,()=>Buffer.from('tampered')));
});
test('walkthroughs are derived only from scoped sources; incomplete stories expose no hidden references',()=>{
 for(const city of pack.cities){const records=city.items.map(item=>({PACK_CODE:PACK,DOCUMENT:JSON.stringify(item)}));
  const stories=cityEvidenceStories(records);assert.equal(stories.length,6);assert.deepEqual(stories.map(s=>s.patternCode),THEMES.map(t=>t.code));assert(stories.every(s=>s.evidenceRefs.length===4));
  const partial=cityEvidenceStories(records.slice(1));assert.equal(partial.length,5);assert(!partial.some(s=>s.patternCode===THEMES[0].code));
  assert.deepEqual(cityEvidenceStories(records.map(r=>({...r,PACK_CODE:'UNRELATED'}))),[]);
 }
 assert.deepEqual(cityEvidenceStories([]),[]);
});
test('all city evidence references work with source citations and reject foreign references',()=>{
 for(const city of pack.cities){const refs=city.items.slice(0,4).map(e=>e.evidenceRef);assert(citationInstructions(refs).includes('['+refs[0]+']'));assert.deepEqual(validateAnswer('Observation ['+refs[0]+']',refs),[refs[0]]);assert.throws(()=>validateAnswer('Observation [EV-AMS-P01]',refs));}
});
