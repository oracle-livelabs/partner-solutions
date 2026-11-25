'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve('gallery_refund_20261015'),base='http://127.0.0.1:8706',preview=process.argv.includes('--preview');
(async()=>{
 const headers={'X-Demo-User':'statewide_admin'},livePatterns=await (await fetch(base+'/api/watched-patterns',{headers})).json(),liveContext=await (await fetch(base+'/api/profile-context',{headers})).json();
 const saved=JSON.parse(await fs.readFile(path.resolve('agent_watch_tiles_20261015/saved-watches.json'),'utf8')).saved;
 const codes=[...new Set(saved.map(x=>x.PROFILE_CODE))],posts=[],errors=[],writes=[],watchUsers=[];
 let active=liveContext.profileCode,failCatalog=false,empty=false,useLive=true;
 const patterns=()=>empty?[]:active===liveContext.profileCode?livePatterns:saved.filter(x=>x.PROFILE_CODE===active).map(x=>({...x,INCIDENT_COUNT:6,POST_COUNT:4}));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1100}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();
   if(url.pathname==='/api/agent-v2/teaching-cases'){
    if(useLive&&!preview)return route.continue();
    const user=req.headers()['x-demo-user'];return route.fulfill({json:active==='ADELAIDE_DATA_V2'&&user!=='northern_analyst'?[{PATTERN_CODE:'ART_MARKET_PAYMENTS',CASE_CODE:'GALLERY_REFUND_V1',CASE_TITLE:'Gallery Refund Puzzle',TEACHING_QUESTION:'Do the supplied records establish that the gallery paid the refund twice?',SOURCE_COUNT:3}]:[]});
   }
   if(url.pathname==='/api/profile-context'&&useLive)return route.continue();
   if(url.pathname==='/api/profile-context')return route.fulfill({json:{...liveContext,profileCode:active,cityLabel:active,profileName:active}});
   if(url.pathname==='/api/watched-patterns'&&req.method()==='GET'){
    watchUsers.push(req.headers()['x-demo-user']);if(useLive)return route.continue();
    if(failCatalog){failCatalog=false;return route.fulfill({status:503,json:{error:'Fixture catalogue unavailable'}});}
    return route.fulfill({json:patterns()});
   }
   if(url.pathname==='/api/agent-v2/run'&&req.method()==='POST'){
    posts.push(req.postDataJSON());return route.fulfill({json:{answer:'### Coverage\n\nThe recorded tool results support this brief.',elapsed:18000,team:'CRIMEDATA_PATTERN_INVESTIGATION_TEAM',conversationId:'fixture-'+active,historyThreadId:'fixture-thread',layers:['Planning','Controlled tool use','Reflection','Case-scoped memory']}});
   }
   if(req.method()!=='GET'){writes.push(url.pathname);return route.abort();}
   if(preview&&(url.pathname==='/'||url.pathname.startsWith('/assets/'))){const file=path.join(dir,'image/frontend/dist',url.pathname==='/'?'index.html':url.pathname);return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}
   return route.continue();
  });
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.nav-item').filter({has:page.locator('.nav-item__label>span',{hasText:/^AI Agent Console$/})}).click();await page.getByRole('button',{name:'Run native Agent V2 ↗',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'IncidentData Agent V2',exact:true}),tiles=dialog.locator('.native-agent__watch-tiles button'),input=dialog.getByLabel('Your question',{exact:true}),run=dialog.getByRole('button',{name:'Run Agent V2',exact:true});
  await tiles.nth(5).waitFor();assert.equal(await tiles.count(),6);assert.deepEqual(await tiles.locator('b').allTextContents(),livePatterns.slice(0,6).map(x=>x.PATTERN_NAME));
  for(let i=0;i<6;i++){await tiles.nth(i).click();const q=await input.inputValue();assert(q.includes(livePatterns[i].PATTERN_CODE));assert(q.includes(active));assert(!q.includes('current Adelaide synthetic profile'));assert.equal(await tiles.nth(i).getAttribute('aria-pressed'),'true');}
  assert.equal(posts.length,0,'Tiles only populate the question');
  const payment=tiles.filter({hasText:'Payment-Document Anomaly Chain'});await payment.click();assert.match(await input.inputValue(),/GALLERY_REFUND_V1/);assert.match(await input.inputValue(),/cite the supplied source references/);assert.equal(await payment.locator('.native-agent__teaching-badge').innerText(),'Gallery Refund Puzzle · 3 synthetic sources');
  await dialog.locator(':scope>section').evaluate(e=>e.scrollTop=0);await page.screenshot({path:dir+'/'+(preview?'preview':'live')+'-desktop.png'});
  await run.click();await dialog.getByRole('heading',{name:'Coverage',exact:true}).waitFor();assert(posts[0].question.includes('GALLERY_REFUND_V1'));assert(posts[0].question.includes('ART_MARKET_PAYMENTS'));
  await input.fill('Which data gap did you identify?');const followup=page.waitForResponse(r=>r.url().endsWith('/api/agent-v2/run'));await run.click();await followup;assert.equal(posts[1].conversationId,'fixture-'+active);assert.equal(posts[1].historyThreadId,'fixture-thread');
  const tested=[];useLive=false;
  for(const code of codes){
   active=code;await page.evaluate(()=>window.dispatchEvent(new Event('crimedata-profile-changed')));
   await page.waitForFunction(code=>document.querySelector('.native-agent__watch-heading p')?.textContent===code,code);
   await page.waitForFunction(()=>document.querySelectorAll('.native-agent__watch-tiles button').length===6);
   // Wait for the current request to settle even if the previous city also had six tiles.
   const first=patterns()[0];await tiles.first().locator('b').filter({hasText:first.PATTERN_NAME}).waitFor();
   assert.deepEqual(await tiles.locator('b').allTextContents(),patterns().slice(0,6).map(x=>x.PATTERN_NAME));
   await tiles.first().click();assert((await input.inputValue()).includes(code));assert((await input.inputValue()).includes(first.PATTERN_CODE));tested.push(code);
  }
  assert.equal(await dialog.locator('.native-agent__result').count(),0,'Changing datasets clears the prior brief');
  await run.click();await dialog.getByRole('heading',{name:'Coverage',exact:true}).waitFor();assert.equal(posts.at(-1).conversationId,'');assert.equal(posts.at(-1).historyThreadId,'');
  await page.setViewportSize({width:390,height:900});await dialog.locator(':scope>section').evaluate(e=>e.scrollTop=0);assert(await dialog.locator(':scope>section').evaluate(e=>e.scrollWidth<=e.clientWidth+2));assert.equal(await dialog.locator('.native-agent__watch-tiles').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1);await page.screenshot({path:dir+'/'+(preview?'preview':'live')+'-mobile.png'});
  failCatalog=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await dialog.getByRole('alert').filter({hasText:'Fixture catalogue unavailable'}).waitFor();assert(await run.isDisabled());await dialog.getByRole('button',{name:'Retry loading patterns'}).click();await tiles.nth(5).waitFor();
  empty=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await dialog.getByText('No active watched patterns are available', {exact:false}).waitFor();assert.equal(await tiles.count(),0);
  empty=false;await page.setViewportSize({width:1450,height:1100});await dialog.getByRole('button',{name:'Close native Agent V2',exact:true}).click();await page.getByLabel('Demo user',{exact:true}).selectOption('central_analyst');await page.getByRole('button',{name:'Run native Agent V2 ↗',exact:true}).click();await tiles.nth(5).waitFor();assert.equal(watchUsers.at(-1),'central_analyst');assert.equal(await input.inputValue(),'');assert.equal(await dialog.locator('.native-agent__result').count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const receipt={passed:true,mode:preview?'preview':'live',galleryTeachingCasePrompt:true,sixTilesMatchSignals:true,tileSelectionOnly:true,cityNeutralPrompts:true,savedCityCataloguesTested:tested,sameCaseFollowupMemory:true,profileChangeClearsCaseMemory:true,userContextReset:true,mobile:true,retryAndEmptyStates:true,newModelCalls:0,errors,writes};await fs.writeFile(dir+'/'+(preview?'preview':'live')+'-validation.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
