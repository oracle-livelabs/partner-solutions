'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build}=require('../scripts/build_city_poi_identifiers.cjs');
const {validatePack}=require('../scripts/load_city_poi_identifiers.cjs');
const catalogue=require('../testdata/poi-identifiers/city-catalogue.json');
const pack=require('../testdata/poi-identifiers/city-standard-v1.json');
const {normalize}=require('../backend/poi-identifiers');
test('generated pack covers every city POI with 3–7 additional identifiers and identical shared-person sets',()=>{
 validatePack(pack,catalogue);
 assert.equal(catalogue.profiles.length,9);assert.equal(pack.people.length,19);
 let records=0,identifiers=0;
 for(const profile of catalogue.profiles)for(const person of profile.people){
  const found=pack.people.find(p=>p.personRef===person.personRef&&p.profileCodes.includes(profile.code));
  assert(found);assert.equal(found.displayName,person.displayName);
  assert(found.identifiers.length>=3&&found.identifiers.length<=7);records++;identifiers+=found.identifiers.length;
  assert.deepEqual(new Set(found.identifiers.map(r=>r.type)),new Set(['alias','username','email','phone']));
 }
 assert.equal(records,143);assert.equal(identifiers,812);
 assert.deepEqual(build(catalogue),pack);
});
test('synthetic contact details use explicit fiction ranges and domains with no accidental cross-person duplicates',()=>{
 const keys=new Set();
 for(const person of pack.people)for(const record of person.identifiers){
  const key=JSON.stringify([record.type,record.namespace,normalize(record.type,record.value,record.namespace)]);
  assert(!keys.has(key));keys.add(key);
  assert.equal(record.status,'declared');assert.match(record.sourceNote,/Generated fictional/);
  if(record.type==='email')assert.match(record.value,/@(?:mail\.)?example\.test$/);
  if(record.type==='phone')assert.match(record.value,/^\+447700900\d{3}$/);
  if(record.type==='username')assert(record.value.startsWith('demo_'));
 }
});
test('inconsistent shared POI names and tampered packs fail before insertion',()=>{
 const inconsistent=structuredClone(catalogue);const target=inconsistent.profiles[1].people.find(p=>p.personRef==='POI-NBNW-PHILIP');target.displayName='Another Person';
 assert.throws(()=>build(inconsistent),/names differ/);
 const tampered=structuredClone(pack);tampered.people[0].identifiers.pop();assert.throws(()=>validatePack(tampered,catalogue),/differs/);
});
