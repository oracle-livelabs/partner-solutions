'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createProfileRestorer}=require('../backend/profile-restore');
test('restore timing separates database work from status verification',async()=>{
 let clock=0;
 const run=createProfileRestorer({now:()=>clock,db:async(user,fn)=>{await fn({callTimeout:0,execute:async()=>{clock+=90000;}});},profileStatus:async(user,code)=>{
  clock+=2000;return{profile:{PROFILE_CODE:code},activeProfileCode:code,live:{INCIDENTS:10,REPORTS:10,PERSONS:0,CASES:0},backup:{INCIDENTS:10,REPORTS:10,PERSONS:0,CASES:0}};
 }});
 const result=await run('statewide_admin','ADELAIDE_DATA_V2','DUBLIN_CITY_DATA_V1');
 assert.deepEqual(result.restoreTiming,{restoreMs:90000,verificationMs:2000,totalMs:92000});
 assert.equal(result.restoreVerification.verified,true);
});
function fixture(change=x=>x){const calls=[],c={callTimeout:0,execute:async(sql,binds)=>{calls.push({sql,binds,timeout:c.callTimeout});}};
 const run=createProfileRestorer({db:async(user,fn)=>fn(c),profileStatus:async(user,code)=>change({profile:{PROFILE_CODE:code},activeProfileCode:code,live:{INCIDENTS:10,REPORTS:10,PERSONS:0,CASES:0},backup:{INCIDENTS:10,REPORTS:10,PERSONS:0,CASES:0}})});return{run,c,calls};}
test('standard and NRT use one atomic procedure with exact active-profile binding',async()=>{for(const nrt of [false,true]){const f=fixture();const r=await f.run('statewide_admin','ADELAIDE_DATA_V2','DUBLIN_CITY_DATA_V1',nrt);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].binds,{profileCode:'ADELAIDE_DATA_V2',nrt:nrt?1:0,expectedActiveProfileCode:'DUBLIN_CITY_DATA_V1'});assert.equal(f.calls[0].timeout,300000);assert.equal(f.c.callTimeout,0);assert.equal(r.restoreVerification.verified,true);assert.equal(r.restoreVerification.mode,nrt?'nrt':'standard');assert.doesNotMatch(f.calls[0].sql,/UPDATE|COMMIT/);}});
test('a successful database call alone never produces a false verified response',async()=>{for(const change of [x=>({...x,activeProfileCode:'DUBLIN_CITY_DATA_V1'}),x=>({...x,profile:{PROFILE_CODE:'PERTH_DATA'}}),x=>({...x,live:{...x.live,REPORTS:9}}),x=>({...x,live:{...x.live,INCIDENTS:undefined}})]){const f=fixture(change);await assert.rejects(f.run('statewide_admin','ADELAIDE_DATA_V2','DUBLIN_CITY_DATA_V1'));assert.equal(f.calls.length,1);assert.equal(f.c.callTimeout,0);}});
test('missing or malformed zero counts cannot be reported as verified',async()=>{for(const value of [null,'',false,undefined,NaN,-1,0.5])for(const side of ['live','backup']){const f=fixture(x=>({...x,[side]:{...x[side],PERSONS:value}}));await assert.rejects(f.run('statewide_admin','BOSTON_CITY_DATA_V1','DUBLIN_CITY_DATA_V1'));}});
