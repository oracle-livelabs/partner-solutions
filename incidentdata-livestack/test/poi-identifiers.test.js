'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {prepare,normalize,match}=require('../backend/poi-identifiers');
const input={personRef:'POI-NBNW-PHILIP',type:'alias',value:'Pippy',sourceRef:'fictional-source-1',sourceNote:'Scenario owner declaration',recordedBy:'Scenario owner'};
test('renamed register sources preserve pre-migration IDs and accept either source spelling',()=>{
 const {createHash}=require('node:crypto');
 for(const original of ['synthetic:city-poi-identifiers:v1:2026-10-20','synthetic:poi-profile-quality:v1:2026-10-29']){
  const current=original.replace(/^synthetic:/,'register:');
  const historicalId=createHash('sha256').update(JSON.stringify([1,input.personRef,'alias','general','pippy',original])).digest('hex');
  for(const sourceRef of [original,current]){
   const p=prepare({...input,sourceRef},1);assert.equal(p.id,historicalId);assert.equal(p.sourceRef,current);
  }
 }
 const unrelated='synthetic:unrelated-source:v1';
 assert.equal(prepare({...input,sourceRef:unrelated},1).sourceRef,unrelated);
 assert.notEqual(prepare({...input,sourceRef:unrelated},1).id,prepare({...input,sourceRef:unrelated.replace(/^synthetic:/,'register:')},1).id);
});
test('stable identifier keys isolate people, city profiles, platforms and sources',()=>{
 const first=prepare(input,1);
 assert.equal(first.id,prepare({...input,value:'pippy'},1).id);
 for(const [change,pid] of [[{personRef:'OTHER'},1],[{},2],[{sourceRef:'another-source'},1],[{type:'username',namespace:'telegram'},1]])assert.notEqual(first.id,prepare({...input,...change},pid).id);
 assert.equal(first.status,'proposed');
});
test('normalization preserves distinctions needed for accounts and contacts',()=>{
 assert.equal(normalize('alias','PIPPY','general'),'pippy');
 assert.equal(normalize('username','Pippy','unspecified'),'Pippy');
 assert.equal(normalize('username','Pippy','telegram'),'pippy');
 assert.equal(normalize('email','Pippy@Example.TEST','email'),'Pippy@example.test');
 assert.notEqual(normalize('email','pippy@example.test','email'),normalize('email','Pippy@example.test','email'));
 assert.equal(normalize('phone','+61 (400) 000-000;ext=12','e164'),'+61400000000;ext=12');
 assert.throws(()=>normalize('phone','0400 000 000','e164'),/country code/);
 assert.throws(()=>normalize('email','not an email','email'),/email/);
});
test('review attribution and validity are explicit; invalid records fail before database writes',()=>{
 assert.throws(()=>prepare({...input,status:'confirmed'},1),/reviewer/);
 assert.throws(()=>prepare({...input,namespace:'telegram'},1),/namespace/);
 assert.throws(()=>prepare({...input,status:'accepted'},1),/status/);
 assert.throws(()=>prepare({...input,validFrom:'2026-10-20'},1),/UTC date/);
 assert.throws(()=>prepare({...input,validFrom:'2026-10-21T00:00:00Z',validTo:'2026-10-20T00:00:00Z'},1),/interval/);
 assert.equal(prepare({...input,status:'confirmed',reviewedBy:'Reviewer',reviewedAt:'2026-10-20T00:00:00Z'},1).status,'confirmed');
});
test('lookup uses scoped view and validity/status predicates; shared values remain ambiguous',async()=>{
 let called=false;
 const c={execute:async(sql,binds)=>{
  called=true;assert.match(sql,/FROM secure_poi_identifiers_v/);
  assert.match(sql,/review_status IN \('declared','confirmed'\)/);
  assert.match(sql,/valid_from<=:at/);assert.match(sql,/valid_to>:at/);
  assert.equal(binds.normalized,'pippy');assert.equal(binds.namespace,'general');
  return {rows:[{PERSON_REF:'A'},{PERSON_REF:'B'}]};
 }};
 const r=await match(c,{type:'alias',value:'Pippy'});assert(called);assert(r.every(x=>x.ambiguous));assert(r.every(x=>x.basis.includes('not_identity_verification')));
});
test('seed keeps confirmed scenario handles declared and extra examples proposed, with no invented contact details',()=>{
 const seed=require('../testdata/poi-identifiers/fictional-scenario.json');
 assert.equal(seed.identifiers.filter(x=>x.status==='declared').length,4);
 assert.deepEqual(seed.identifiers.filter(x=>x.status==='proposed').map(x=>x.value),['pippy','pippster','vanders']);
 assert(seed.identifiers.every(x=>!['email','phone'].includes(x.type)));
});
