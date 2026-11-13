'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {write,withServer}=require('./harness.cjs');
const live=process.argv.includes('--live');
withServer(live,async base=>{
  const get=async code=>{const r=await fetch(base+'/api/setup/profiles'+(code?'?profileCode='+code:''),{headers:{'X-Demo-User':'statewide_admin'},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();};
  const first=await get();assert.equal(first.profiles.length,10);
  const profiles=[];
  for(const p of first.profiles){
    const d=await get(p.PROFILE_CODE);assert.equal(d.profile.PROFILE_CODE,p.PROFILE_CODE);assert.equal(d.activeProfileCode,'DUBLIN_CITY_DATA_V1');
    assert.equal(d.live.INCIDENTS,17817);assert.equal(d.live.PERSONS,13);assert.equal(d.live.CASES,5);
    profiles.push({code:p.PROFILE_CODE,profile:d.profile,backup:d.backup,capabilities:d.capabilities,live:d.live,active:d.activeProfileCode});
  }
  profiles.sort((a,b)=>a.code.localeCompare(b.code));
  for(const [code,count]of [['BOSTON_CITY_DATA_V1',14513],['CHICAGO_CITY_DATA_V2',39649],['LAS_VEGAS_URBAN_DATA_V1',19527]]){
    const p=profiles.find(p=>p.code===code);assert.equal(p.backup.INCIDENTS,count);assert.equal(p.capabilities.savedReview,true);assert.equal(p.capabilities.restore,false);assert.equal(p.capabilities.nrtRestore,false);
  }
  if(live)assert.deepEqual(profiles,JSON.parse(fs.readFileSync(path.join(__dirname,'preview_api.json'))).profiles,'Saved catalogue, counts and capabilities changed');
  const receipt={status:'passed',at:new Date().toISOString(),mode:live?'live':'read_only_preview',profiles,database_writes_sent:0};
  write(live?'live_api.json':'preview_api.json',receipt);
  console.log('All ten saved profiles verified; USA read-only capability and active Dublin preserved.');
}).catch(e=>{console.error(e.message);process.exitCode=1;});
