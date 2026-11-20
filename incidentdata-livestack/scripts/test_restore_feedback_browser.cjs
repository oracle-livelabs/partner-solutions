'use strict';
// Isolated UI: all requests, including restoration, are fulfilled with fixtures.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const esbuild=require('../frontend/node_modules/esbuild');
(async()=>{
 const {FOUNDATION_PROFILES}=await import('../frontend/src/foundation-profiles.mjs');
 const counts={INCIDENTS:10,REPORTS:10,PERSONS:0,CASES:0};
 const profiles=FOUNDATION_PROFILES.map(p=>({PROFILE_CODE:p.code,PROFILE_NAME:p.city,CITY_LABEL:p.city,INCIDENT_COUNT:10,SUBURB_COUNT:2,RESTORE_ENABLED:true,NRT_RESTORE_ENABLED:p.city==='Adelaide'}));
 const fixture=code=>({profile:profiles.find(p=>p.PROFILE_CODE===code),profiles,live:counts,backup:counts,activeProfileCode:'ADELAIDE_DATA_V2',capabilities:{restore:true,nrtRestore:code==='ADELAIDE_DATA_V2'}});
 const bundle=await esbuild.build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import Panel from './src/ProfileLibraryPanel.jsx';import './src/crimedata-profile-grid.css';createRoot(document.getElementById('root')).render(<Panel user='statewide_admin'/>);",resolveDir:path.join(__dirname,'../frontend'),loader:'jsx'},bundle:true,write:false,loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let posts=0,pending,checking,mode='success',unavailable=false;
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/bundle.js"></script>'});
   if(url.pathname==='/bundle.js')return route.fulfill({contentType:'application/javascript',body:bundle.outputFiles[0].text});
   if(req.method()==='POST'){
    assert.equal(url.pathname,'/api/setup/load');posts++;
    pending=()=>route.fulfill({status:mode==='success'?200:500,json:mode==='success'?{...fixture('ADELAIDE_DATA_V2'),restoreVerification:{verified:true},message:'Adelaide is active.'}:{error:'Simulated timeout'}});return;
   }
   if(url.pathname==='/api/setup/profiles'){
    const fulfill=()=>route.fulfill({status:unavailable?503:200,json:unavailable?{error:'Status unavailable'}:fixture(url.searchParams.get('profileCode')||'ADELAIDE_DATA_V2')});
    if(mode==='failure'&&posts>1){checking=fulfill;return;}return fulfill();
   }
   return route.abort();
  });
  await page.clock.install();await page.goto('http://restore.test/');
  const input=page.getByLabel('Global replacement confirmation');
  await input.fill('ACTIVATE ADELAIDE_DATA_V2');await page.getByRole('button',{name:'Restore Adelaide',exact:true}).click();
  const progress=page.getByTestId('restore-progress');await progress.waitFor();
  assert.equal(await page.locator('progress').getAttribute('value'),null);
  assert(await input.isDisabled());assert(await page.getByRole('button',{name:'Refresh profiles'}).isDisabled());
  await page.clock.fastForward(151000);assert.match(await progress.innerText(),/151s elapsed/);assert.match(await progress.innerText(),/server has not confirmed/);
  while(!pending)await page.waitForTimeout(10);await pending();await page.getByTestId('restore-success').waitFor();
  assert.match(await page.getByTestId('restore-success').innerText(),/complete and verified in/);assert.equal(await progress.count(),0);
  mode='failure';pending=null;
  await input.fill('ACTIVATE ADELAIDE_DATA_V2');await page.getByRole('button',{name:'Restore Adelaide',exact:true}).click();await progress.waitFor();
  while(!pending)await page.waitForTimeout(10);await pending();await page.getByRole('status').filter({hasText:'Checking the current active dataset'}).waitFor();
  assert(await input.isDisabled());while(!checking)await page.waitForTimeout(10);unavailable=true;await checking();
  await page.getByRole('alert').waitFor();assert.equal(await input.count(),0);assert.equal(posts,2);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,mockedRestores:posts,realRequests:0,checks:['indeterminate progress','elapsed and extended wait','disabled controls','verified success duration','failure status check','unknown status blocks retry']}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
