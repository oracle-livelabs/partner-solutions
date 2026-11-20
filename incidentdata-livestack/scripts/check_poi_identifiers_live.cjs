'use strict';
const assert=require('node:assert/strict');
const {connect,rows}=require('./evidence-intelligence/connection.cjs');
const {insert}=require('./setup_poi_identifiers.cjs');
const {match,list}=require('../backend/poi-identifiers');
(async()=>{
 const c=await connect();
 try{
  await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  const active=await rows(c,'SELECT dataset_profile_id FROM z_base_active_dataset_profile WHERE control_id=1 FOR UPDATE');
  const profileId=active[0].DATASET_PROFILE_ID;
  const countBefore=(await rows(c,'SELECT COUNT(*) n FROM poi_identifiers'))[0].N;
  const visibleBefore=await list(c);
  assert.equal(visibleBefore.length,(await rows(c,'SELECT COUNT(*) n FROM poi_identifiers WHERE dataset_profile_id=:pid',{pid:profileId}))[0].N);
  assert(visibleBefore.length>=7);
  const generated=visibleBefore.filter(r=>r.SOURCE_REF==='synthetic:city-poi-identifiers:v1:2026-10-20');
  for(const record of generated){
   const found=await match(c,{type:record.IDENTIFIER_TYPE,namespace:record.NAMESPACE,value:record.IDENTIFIER_VALUE});
   assert.equal(found.length,1);assert.equal(found[0].PERSON_REF,record.PERSON_REF);assert.equal(found[0].ambiguous,false);
  }
  const current=await match(c,{type:'username',value:'pipp68'});
  assert.equal(current.length,1);assert.equal(current[0].PERSON_REF,'POI-NBNW-PHILIP');assert.equal(current[0].ambiguous,false);
  assert.equal((await match(c,{type:'alias',value:'pippy'})).length,0,'Proposed examples must not match');
  const base={profileId,personRef:'POI-NBNW-PHILIP',sourceRef:'rollback-only:identifier-verification:20261020',sourceNote:'Temporary fictional verification; always rolled back',recordedBy:'automated verification',status:'declared'};
  for(const [type,namespace,value] of [['email','email','Pipp@Example.TEST'],['email','email','Philip@Example.TEST'],['username','telegram','PIPP_VERIFY'],['username','x','PIPP_VERIFY'],['phone','e164','+61 400 000 000'],['phone','e164','+61 400 000 001']])assert.equal(await insert(c,{...base,type,namespace,value}),1);
  assert.equal((await match(c,{type:'email',value:'Pipp@example.test'})).length,1);
  assert.equal((await match(c,{type:'email',value:'pipp@example.test'})).length,0,'Do not conflate email local parts');
  assert.equal((await match(c,{type:'username',namespace:'telegram',value:'pipp_verify'})).length,1);
  assert.equal((await match(c,{type:'username',namespace:'x',value:'pipp_verify'})).length,1);
  assert.equal((await match(c,{type:'username',namespace:'unspecified',value:'pipp_verify'})).length,0);
  assert.equal((await match(c,{type:'phone',value:'+61400000000'})).length,1);
  const shared={...base,type:'alias',value:'verification shared alias'};
  await insert(c,shared);await insert(c,{...shared,personRef:'POI-NBNW-GEORGE'});
  assert((await match(c,{type:'alias',value:shared.value})).every(x=>x.ambiguous));
  await insert(c,{...base,type:'alias',value:'verification rejected alias',status:'rejected'});
  assert.equal((await match(c,{type:'alias',value:'verification rejected alias'})).length,0);
  await insert(c,{...base,type:'alias',value:'verification expired alias',validTo:'2026-01-01T00:00:00Z'});
  assert.equal((await match(c,{type:'alias',value:'verification expired alias'})).length,0);
  await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('identifier_verification_no_access'); END;");
  assert.equal((await list(c)).length,0);assert.equal((await match(c,{type:'username',value:'pipp68'})).length,0);
  await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");
  await c.rollback();
  assert.equal((await rows(c,'SELECT COUNT(*) n FROM poi_identifiers'))[0].N,countBefore);
  assert.deepEqual(await rows(c,'SELECT dataset_profile_id FROM z_base_active_dataset_profile WHERE control_id=1'),active);
  console.log(JSON.stringify({passed:true,permanentAssertions:countBefore,activeProfileAssertions:visibleBefore.length,generatedIdentifiersMatched:generated.length,multipleEmailsAccountsAndPhones:true,platformIsolation:true,sharedIdentifiersFlagged:true,proposedRejectedExpiredExcluded:true,unauthorizedViewEmpty:true,temporaryAssertionsRolledBack:true,profileUnchanged:true},null,2));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
