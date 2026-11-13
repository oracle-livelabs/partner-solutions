'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const express=require('express'),{chromium}=require('playwright');
const ROOT=__dirname,live=process.argv.includes('--live'),BASE=live?'http://127.0.0.1:8706':'http://127.0.0.1:18707';
const save=(name,data)=>fs.writeFileSync(path.join(ROOT,name),JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
(async()=>{
 let server,browser;const blocked=[],errors=[],unexpectedWrites=[],checks=[],failedRequests=[];
 try{
  if(!live){const app=express();app.use('/api',async(req,res)=>{
   if(!['GET','HEAD'].includes(req.method))return res.status(405).json({error:'Read-only preview: mutations disabled.'});
   try{const result=await fetch('http://127.0.0.1:8706'+req.originalUrl,{headers:{'X-Demo-User':req.headers['x-demo-user']||'statewide_admin'}});res.status(result.status).type(result.headers.get('content-type')||'application/json').send(Buffer.from(await result.arrayBuffer()));}catch{res.status(502).json({error:'Preview read failed.'});}
  });app.use(express.static(path.join(ROOT,'dist')));server=await new Promise(resolve=>{const s=app.listen(18707,'127.0.0.1',()=>resolve(s));});}
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1600,height:1200}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>failedRequests.push({method:r.method(),url:r.url(),failure:r.failure()}));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(['GET','HEAD'].includes(req.method()))return route.continue();
   if(req.method()==='POST'&&['/api/setup/load','/api/setup/load-nrt'].includes(url.pathname)){
    blocked.push({path:url.pathname,payload:req.postDataJSON(),sent_to_server:false});
    return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Verification only: restore request intercepted; no dataset changed.'})});
   }
   unexpectedWrites.push({method:req.method(),path:url.pathname});return route.abort();
  });
  await page.goto(BASE,{waitUntil:'networkidle'});
  const first=page.waitForResponse(r=>r.url().includes('/api/setup/profiles?profileCode=ADELAIDE_DATA_V2'));
  await page.getByRole('button',{name:/Data Foundation/}).click();await first;
  const restoreName='Restore Adelaide Data Set V2 - Scenario Enrichment';
  await page.getByRole('button',{name:restoreName,exact:true}).waitFor();
  const tile=page.locator('.crimedata-setup__profiles button').filter({hasText:'ADELAIDE_DATA_V2'});
  assert.equal(await tile.count(),1);assert.match(await tile.innerText(),/21,532/);
  assert.equal(await page.locator('.crimedata-setup__profiles button').count(),3);
  assert.deepEqual(blocked,[]);checks.push('Default Adelaide tile selects V2 with explicit label and 21,532 saved incidents; selection sends no write.');
  await page.locator('.crimedata-setup').screenshot({path:path.join(ROOT,live?'live_tile.png':'preview_tile.png')});
  for(const item of [{code:'ADELAIDE_DATA_V2',city:'Adelaide',name:'Adelaide Data Set V2 - Scenario Enrichment'}, {code:'PERTH_DATA',city:'Perth',name:'Perth Data Set Profile'}, {code:'BRISBANE_DATA',city:'Brisbane',name:'Brisbane Data Set Profile'}]){
   if(item.code!=='ADELAIDE_DATA_V2'){
    const response=page.waitForResponse(r=>r.url().includes('/api/setup/profiles?profileCode='+item.code));
    await page.locator('.crimedata-setup__profiles button').filter({hasText:item.city+' Metropolitan Area'}).click();await response;
   }
   for(const nrt of [false,true]){
    const button=page.getByRole('button',{name:'Restore '+item.name+(nrt?' NRT':''),exact:true});
    await button.waitFor();await page.waitForFunction(()=>!document.querySelector('.crimedata-setup__actions .restore').disabled);
    const count=blocked.length;console.log('Checking intercepted restore',item.code,nrt?'NRT':'standard');await button.click();
    try{await page.waitForFunction(()=>document.querySelector('.crimedata-setup .pattern-error')?.textContent.includes('restore request intercepted'),null,{timeout:10000});}
    catch(e){console.error(JSON.stringify({blocked,unexpectedWrites,failedRequests,setup_text:await page.locator('.crimedata-setup').innerText()}));throw e;}
    assert.equal(blocked.length,count+1);assert.equal(blocked.at(-1).path,nrt?'/api/setup/load-nrt':'/api/setup/load');assert.equal(blocked.at(-1).payload.profileCode,item.code);
   }
  }
  checks.push('Standard and NRT buttons send the correct profile code for Adelaide V2, Perth and Brisbane; all six POST requests intercepted in browser.');
  const back=page.waitForResponse(r=>r.url().includes('/api/setup/profiles?profileCode=ADELAIDE_DATA_V2'));
  await tile.click();await back;await page.getByRole('button',{name:restoreName,exact:true}).waitFor();
  const role=page.waitForResponse(r=>r.url().includes('/api/setup/profiles?profileCode=ADELAIDE_DATA_V2')&&r.request().headers()['x-demo-user']==='read_only_viewer');
  await page.getByLabel('Demo user').selectOption('read_only_viewer');await role;
  assert(await page.getByRole('button',{name:restoreName,exact:true}).isDisabled());
  assert(await page.getByRole('button',{name:restoreName+' NRT',exact:true}).isDisabled());checks.push('Limited viewer cannot use either restore button.');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpectedWrites,[]);
  const res=await fetch('http://127.0.0.1:8706/api/setup/profiles?profileCode=ADELAIDE_DATA_V2',{headers:{'X-Demo-User':'statewide_admin'}});assert.equal(res.status,200);const status=await res.json();
  assert.equal(status.activeProfileCode,'ADELAIDE_DATA');assert.equal(status.live.INCIDENTS,21513);assert.equal(status.backup.INCIDENTS,21532);assert.equal(status.profile.PROFILE_CODE,'ADELAIDE_DATA_V2');
  save(live?'live_browser.json':'preview_browser.json',{status:'passed',checked_at:new Date().toISOString(),checks,intercepted_restore_requests:blocked,unexpected_write_requests:unexpectedWrites,page_errors:errors,active_profile:status.activeProfileCode,live_incidents:status.live.INCIDENTS,selected_profile:status.profile.PROFILE_CODE,selected_incidents:status.backup.INCIDENTS});
  console.log(JSON.stringify({status:'passed',mode:live?'live':'preview',checks,active_profile:status.activeProfileCode,restore_requests_sent_to_server:0},null,2));
 }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
