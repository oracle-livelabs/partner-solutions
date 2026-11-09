'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build,START,END}=require('../scripts/build_poi_identifier_history.cjs');
const spec=require('../testdata/poi-identifier-history/20261030-spec.json');
const snapshot={identifiers:spec.baseline.map(b=>({...spec.logicalAssertions[b.assertionIndex],IDENTIFIER_ID:b.identifierId,DATASET_PROFILE_ID:b.profileId,REVIEW_STATUS:b.reviewStatus}))};
test('history is repeatable, preserves input and agrees across saved city copies',()=>{
 const before=JSON.stringify(snapshot.identifiers),first=build(snapshot.identifiers);
 assert.deepEqual(first,build([...snapshot.identifiers].reverse()).reverse());
 assert.equal(JSON.stringify(snapshot.identifiers),before);
 const shared=new Map();
 for(const h of first){const value=[h.RECORDED_BY,h.REVIEWED_BY,h.REVIEWED_AT,h.VALID_FROM,h.VALID_TO,h.CREATED_AT];if(shared.has(h.logicalAssertion))assert.deepEqual(value,shared.get(h.logicalAssertion));else shared.set(h.logicalAssertion,value);}
 assert.equal(shared.size,150);
});
test('capture, review, validity and supersession obey the requested historical window',()=>{
 const first=build(snapshot.identifiers),byId=new Map(snapshot.identifiers.map(p=>[p.IDENTIFIER_ID,p]));
 assert.equal(first.filter(p=>p.VALID_TO).length,141);
 assert.equal(new Set(first.map(p=>p.RECORDED_BY)).size,spec.recorderCodes.length);
 for(const h of first){
  for(const key of ['CREATED_AT','REVIEWED_AT','VALID_FROM','VALID_TO'])if(h[key])assert(Date.parse(h[key])>=START&&Date.parse(h[key])<END);
  if(byId.get(h.identifierId).REVIEW_STATUS==='proposed'){assert.equal(h.REVIEWED_AT,null);assert.equal(h.REVIEWED_BY,null);}
  if(h.REVIEWED_AT)assert(Date.parse(h.REVIEWED_AT)>=Date.parse(h.CREATED_AT));
  if(h.VALID_TO)assert(Date.parse(h.VALID_TO)>Date.parse(h.CREATED_AT));
 }
 assert.equal(new Set(first.map(p=>new Intl.DateTimeFormat('en-CA',{timeZone:spec.timezone,year:'numeric',month:'2-digit'}).format(new Date(p.CREATED_AT)))).size,12);
});
