'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),express=require('express'),{chromium}=require('playwright');
const {connect}=require('../common_watch_catalog_20260917/common.cjs');
const {createProfileSetup}=require('../backend/setup-profile-selection');
const ROOT=__dirname,live=process.argv.includes('--live'),BASE=live?'http://127.0.0.1:8706':'http://127.0.0.1:18707';
const targets=[['ADELAIDE_DATA_V2',21532,true],['PERTH_DATA',33511,true],['BRISBANE_DATA',42317,true],['AMSTERDAM_DATA_V1',14467,false],['BRUSSELS_DATA_V1',25691,false],['DUBLIN_CITY_DATA_V1',17817,false]];
const save=(n,v)=>fs.writeFileSync(path.join(ROOT,n),JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
(async()=>{let server,browser;const intercepted=[],errors=[],unexpectedWrites=[],checks=[],apiResults=[];try{
 if(!live){const app=express(),setup=createProfileSetup(async(user,fn)=>{const c=await connect();try{await c.execute('SET TRANSACTION READ ONLY');return await fn(c);}finally{await c.rollback();await c.close();}});
  app.use('/api/setup',(req,res,next)=>{req.demoUser=req.headers['x-demo-user']||'statewide_admin';setup.profileSelectionGuard(req,res,next);});
  app.get('/api/setup/profiles',async(req,res)=>{try{res.json(await setup.profileStatus(req.headers['x-demo-user']||'statewide_admin',req.query.profileCode));}catch(e){res.status(e.status||500).json({error:e.message});}});
  app.use('/api',async(req,res)=>{if(!['GET','HEAD'].includes(req.method))return res.status(405).json({error:'Read-only preview; mutations disabled.'});try{const r=await fetch('http://127.0.0.1:8706'+req.originalUrl,{headers:{'X-Demo-User':req.headers['x-demo-user']||'statewide_admin'}});res.status(r.status).type(r.headers.get('content-type')||'application/json').send(Buffer.from(await r.arrayBuffer()));}catch{res.status(502).json({error:'Preview read failed.'});}});
  app.use(express.static(path.join(ROOT,'dist')));server=await new Promise(resolve=>{const s=app.listen(18707,'127.0.0.1',()=>resolve(s));});
 }
 for(const[code,count]of targets){const r=await fetch(BASE+'/api/setup/profiles?profileCode='+code);assert.equal(r.status,200);const data=await r.json();assert.equal(data.profile.PROFILE_CODE,code);assert.equal(data.backup.INCIDENTS,count);assert.equal(data.activeProfileCode,'ADELAIDE_DATA_V2');assert.equal(data.profiles.length,7);apiResults.push({code,count,name:data.profile.PROFILE_NAME});}
 assert.equal((await fetch(BASE+'/api/setup/profiles?profileCode=TYPO')).status,400);checks.push('All six exact profile/count mappings verified against Z_BASE; unknown code returns 400.');
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1600,height:1200}});page.on('pageerror',e=>errors.push(e.message));let spoofNext=false;
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
  if(['GET','HEAD'].includes(req.method())){if(spoofNext&&url.pathname==='/api/setup/profiles'&&url.searchParams.get('profileCode')==='AMSTERDAM_DATA_V1'){spoofNext=false;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({profile:{PROFILE_CODE:'ADELAIDE_DATA'},backup:{INCIDENTS:21513}})});}return route.continue();}
  if(req.method()==='POST'&&['/api/setup/load','/api/setup/load-nrt'].includes(url.pathname)){intercepted.push({path:url.pathname,payload:req.postDataJSON(),sent_to_server:false});return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Verification only: restore request intercepted; no dataset changed.'})});}
  unexpectedWrites.push({method:req.method(),path:url.pathname});return route.abort();
 });
 await page.goto(BASE,{waitUntil:'networkidle'});await page.getByRole('button',{name:/Data Foundation/}).click();await page.waitForFunction(()=>document.querySelectorAll('.crimedata-setup__profiles button').length===6&&!document.querySelector('.crimedata-setup').innerText.includes('PROFILE PENDING'));
 const tiles=page.locator('.crimedata-setup__profiles button');assert.deepEqual(await tiles.evaluateAll(xs=>xs.map(x=>x.dataset.profileCode)),targets.map(x=>x[0]));
 const boxes=await tiles.evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));assert(boxes.slice(0,3).every(b=>Math.abs(b.y-boxes[0].y)<1));assert(boxes.slice(3).every(b=>Math.abs(b.y-boxes[3].y)<1));assert(boxes[3].y>boxes[0].y);for(let i=0;i<3;i++)assert(Math.abs(boxes[i].x-boxes[i+3].x)<1);assert.deepEqual(intercepted,[]);
 await page.locator('.crimedata-setup').screenshot({path:path.join(ROOT,live?'live_tiles.png':'preview_tiles.png')});checks.push('Desktop has requested three-column, two-row order; selecting tiles sends no write.');
 for(const[code,,nrt]of targets){console.log('Checking tile',code);if(code!=='ADELAIDE_DATA_V2'){await page.locator(`[data-profile-code="${code}"]`).click();}
  const name=apiResults.find(x=>x.code===code).name,standard=page.getByRole('button',{name:'Restore '+name,exact:true});await standard.waitFor();await page.waitForFunction(()=>!document.querySelector('.crimedata-setup__actions .restore').disabled);
  assert.equal(await page.locator('.crimedata-setup__actions .nrt').count(),nrt?1:0);
  for(const action of nrt?['load','load-nrt']:['load']){const button=action==='load'?standard:page.getByRole('button',{name:'Restore '+name+' NRT',exact:true});const count=intercepted.length;await button.click();await page.waitForFunction(()=>document.querySelector('.crimedata-setup .pattern-error')?.textContent.includes('restore request intercepted'));assert.equal(intercepted.length,count+1);assert.equal(intercepted.at(-1).payload.profileCode,code);assert.equal(intercepted.at(-1).path,'/api/setup/'+action);}
 }
 assert.equal(intercepted.length,9);checks.push('All nine standard/NRT restore requests target the correct profiles; none sent to the server.');
 spoofNext=true;await page.locator('[data-profile-code="AMSTERDAM_DATA_V1"]').click();await page.waitForFunction(()=>document.querySelector('.crimedata-setup .pattern-error')?.textContent.includes('different dataset profile'));assert(await page.locator('.crimedata-setup__actions .restore').isDisabled());checks.push('Mismatched server profile disables Restore rather than allowing a fallback.');
 await page.locator('[data-profile-code="ADELAIDE_DATA_V2"]').click();await page.waitForFunction(()=>!document.querySelector('.crimedata-setup__actions .restore').disabled);
 await page.setViewportSize({width:390,height:1000});await page.locator('.crimedata-setup__profiles').screenshot({path:path.join(ROOT,live?'live_tiles_mobile.png':'preview_tiles_mobile.png')});
 const mobile=await tiles.evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width};}));assert(mobile.every(b=>Math.abs(b.x-mobile[0].x)<1));assert(mobile.every((b,i)=>!i||b.y>mobile[i-1].y));checks.push('Mobile layout stacks all six tiles in the same order.');
 await page.getByLabel('Demo user').selectOption('read_only_viewer');await page.waitForFunction(()=>document.querySelector('.crimedata-setup__access'));
 for(const[code]of targets){await page.locator(`[data-profile-code="${code}"]`).click();for(const button of await page.locator('.crimedata-setup__actions .restore').all())assert(await button.isDisabled());}checks.push('Limited viewer cannot use any restore button.');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpectedWrites,[]);
 const active=await(await fetch('http://127.0.0.1:8706/api/setup/profiles?profileCode=ADELAIDE_DATA_V2')).json();assert.equal(active.activeProfileCode,'ADELAIDE_DATA_V2');assert.equal(active.live.INCIDENTS,21532);
 save(live?'live_browser.json':'preview_browser.json',{status:'passed',checked_at:new Date().toISOString(),checks,api_results:apiResults,layout:boxes,mobile_layout:mobile,intercepted_restore_requests:intercepted,page_errors:errors,unexpected_write_requests:unexpectedWrites,active_profile:active.activeProfileCode,live_incidents:active.live.INCIDENTS});console.log(JSON.stringify({status:'passed',mode:live?'live':'preview',checks,restore_requests_sent_to_server:0},null,2));
 }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
