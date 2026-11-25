'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {profileConfig,requestedProfile,profileSelectionGuard,createProfileSetup}=require('../backend/setup-profile-selection');
const europe=['AMSTERDAM_DATA_V1','BRUSSELS_DATA_V1','DUBLIN_CITY_DATA_V1'];
test('all sixteen saved identifiers resolve exactly; unknown values never fall back',()=>{
  assert.equal(Object.keys(profileConfig).length,16);
  for(const code of Object.keys(profileConfig))assert.equal(requestedProfile(code),code);
  for(const code of [undefined,null,'','TYPO','amsterdam_data_v1','constructor','__proto__',['ADELAIDE_DATA'],{}])assert.throws(()=>requestedProfile(code),{status:400});
});
function guard(method,path,profileCode,user='statewide_admin'){let status=200,next=false;profileSelectionGuard({method,path,demoUser:user,query:{profileCode},body:{profileCode}},{status(n){status=n;return this;},json(){}},()=>next=true);return {status,next};}
test('European profiles allow standard restore only, never capture/delete/NRT',()=>{
  for(const code of europe){assert.deepEqual(guard('POST','/load',code),{status:200,next:true});for(const action of ['load-nrt','backup','delete'])assert.deepEqual(guard('POST','/'+action,code),{status:400,next:false});}
});
test('USA profiles allow standard restore only, never capture/delete/NRT',()=>{
  for(const code of ['BOSTON_CITY_DATA_V1','CHICAGO_CITY_DATA_V2','LAS_VEGAS_URBAN_DATA_V1']){assert.deepEqual(guard('POST','/load',code),{status:200,next:true});for(const action of ['load-nrt','backup','delete'])assert.deepEqual(guard('POST','/'+action,code),{status:400,next:false});}
});
test('Perth V2 enables standard restore without changing the original Perth policy',()=>{
  assert.deepEqual(guard('POST','/load','PERTH_DATA_V2'),{status:200,next:true});
  for(const action of ['load-nrt','backup','delete']){
    assert.deepEqual(guard('POST','/'+action,'PERTH_DATA_V2'),{status:400,next:false});
    assert.deepEqual(guard('POST','/'+action,'PERTH_DATA'),{status:200,next:true});
  }
});
test('Australian routes remain available and missing mutation targets fail closed',()=>{
  for(const code of ['ADELAIDE_DATA','ADELAIDE_DATA_V2','PERTH_DATA','BRISBANE_DATA'])for(const action of ['load','load-nrt','backup','delete'])assert(guard('POST','/'+action,code).next);
  for(const code of [undefined,'TYPO',['AMSTERDAM_DATA_V1']])assert.deepEqual(guard('POST','/load',code),{status:400,next:false});
  assert.deepEqual(guard('GET','/profiles',undefined),{status:200,next:true});assert.deepEqual(guard('GET','/profiles','TYPO'),{status:400,next:false});
});
test('only statewide administrator can reach any mutation route',()=>{
  for(const user of ['read_only_viewer','central_analyst','northern_analyst','southern_analyst','unknown'])for(const code of Object.keys(profileConfig))assert.deepEqual(guard('POST','/load',code,user),{status:403,next:false});
});
test('catalogue and selected counts bind the precise requested saved profile',async()=>{
  for(const code of Object.keys(profileConfig)){
    const calls=[];const api=createProfileSetup(async(user,fn)=>fn({execute:async(sql,binds)=>{calls.push({sql,binds});return {rows:sql.includes('WHERE profile_code=:profileCode')?[{PROFILE_CODE:binds.profileCode}]:[{INCIDENTS:7}]};}}));
    const result=await api.profileStatus('statewide_admin',code);assert.equal(result.profile.PROFILE_CODE,code);
    assert.equal(calls.length,5);assert(calls.every(x=>/^SELECT /.test(x.sql)));assert.deepEqual(calls.filter(x=>x.binds).map(x=>x.binds.profileCode),[code,code]);
    for(const target of europe)assert(calls[1].sql.includes("'"+target+"'"));
  }
});
test('bad profile causes no database work; unregistered valid profile fails explicitly',async()=>{
  let called=false;const api=createProfileSetup(async()=>{called=true;throw Error('Unexpected DB');});await assert.rejects(api.profileStatus('statewide_admin','TYPO'),{status:400});assert.equal(called,false);
  const empty=createProfileSetup(async(user,fn)=>fn({execute:async()=>({rows:[]})}));await assert.rejects(empty.profileStatus('statewide_admin','DUBLIN_CITY_DATA_V1'),{status:404});
});
