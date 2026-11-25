'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {groupPeople}=require('../backend/data-room-people-mentioned');
const base='http://127.0.0.1:8706',local=process.argv.includes('--local');
(async()=>{
 const response=await fetch(base+'/api/persons',{headers:{'X-Demo-User':'statewide_admin'}});assert(response.ok);
 const profiles=await response.json(),registered=profiles.find(p=>p.PORTRAIT_ASSET_URI);assert(registered);
 const profile=Object.fromEntries(Object.entries(registered).map(([k,v])=>[k.toLowerCase(),v]));
 const sources=['S01','S02'].map((ref,i)=>({ref,itemId:'browser-fixture-'+i,path:'witness-'+i+'.txt',basis:'original_text_excerpt'}));
 const coverage={llm:{model:'google.gemini-2.5-flash',provider:'OCI GenAI',region:'us-chicago-1',operationId:'cdr.people.mentioned'},sources,coverage:sources.map(s=>({...s,characters:100})),fingerprint:'browser-fixture'};
 const mentions=sources.map((source,i)=>({id:'m'+i,label:profile.display_name,sourceRef:source.ref,mentionQuote:profile.display_name+' was mentioned in this synthetic source.',attributes:{name:{value:profile.display_name,quote:profile.display_name},gender:null,age:null,role:null}}));
 const people=groupPeople(mentions,[profile]);
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1450,height:1100}}),errors=[],writes=[];let extractions=0;
 try{
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();
   if(url.pathname.endsWith('/people-mentioned')){if(req.method()==='POST'&&++extractions>1)return route.fulfill({status:502,json:{error:'The LLM reached its output limit before completing the people list.',llm:coverage.llm,traceId:'browser-failure-trace',usage:{attempts:2,retries:1,elapsedMs:2200,inputTokens:200,outputTokens:40,reasoningTokens:160,totalTokens:400,tokenStatus:'measured'}}});return route.fulfill({json:req.method()==='POST'?{...coverage,people,mentionCount:2,warnings:[{sourceRef:'S01',mentionId:'m0',attribute:'mention',reason:'Invalid mention excerpt replaced with its independently verified name excerpt.'}],usage:{attempts:1,retries:0,elapsedMs:1000,inputTokens:100,outputTokens:20,reasoningTokens:80,totalTokens:200,tokenStatus:'measured'},notice:'Browser fixture; no model call.'}:coverage});}
   if(req.method()!=='GET'){writes.push(req.method()+' '+url.pathname);return route.abort();}
   if(local&&(url.pathname==='/'||url.pathname.startsWith('/assets/'))){const file=path.join(__dirname,'../frontend/dist',url.pathname==='/'?'index.html':url.pathname);return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}
   return route.continue();
  });
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('aside nav button').filter({has:page.locator('.nav-item__label > span').filter({hasText:/^Data Room$/})}).click();
  await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor({timeout:60000});
  await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:'Explore People mentioned',exact:true}).click();
  const workspace=page.getByRole('dialog',{name:'People mentioned',exact:true});
  await workspace.getByText('Google Gemini 2.5 Flash',{exact:true}).waitFor();await workspace.getByRole('button',{name:'Find people in material'}).click();
  const card=workspace.locator('.people-mentioned-card');await card.waitFor();assert.equal(await card.count(),1);
  assert.match(await workspace.innerText(),/1 people cards · 2 source mentions/);await workspace.getByText('Source-check warnings (1)',{exact:true}).click();assert.match(await workspace.locator('.people-mentioned-warnings').innerText(),/Invalid mention excerpt replaced with its independently verified name excerpt/);
  assert(await card.locator('img').evaluate(async e=>{await e.decode();return e.naturalWidth>0;}));
  await card.getByText('Source mentions and supporting excerpts (2)',{exact:true}).click();assert.equal(await card.locator('.people-mentioned-source').count(),2);
  const trigger=card.getByRole('button',{name:/View POI details/});await trigger.click();
  const popup=page.locator('.people-poi-dialog');await popup.getByText('Profile summary',{exact:true}).waitFor();assert.match(await popup.innerText(),new RegExp(profile.person_ref));
  assert(await popup.getByRole('heading',{name:'Registered visual assets'}).isVisible());
  for(const width of [1450,760,390]){await page.setViewportSize({width,height:1000});const bounds=await popup.evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}));assert(bounds.scroll<=bounds.width+2&&bounds.left>=0&&bounds.right<=width,JSON.stringify(bounds));}
  await page.screenshot({path:'/tmp/people-grouped-poi-mobile.png'});
  await page.keyboard.press('Escape');await popup.waitFor({state:'detached'});assert.equal(await popup.count(),0);assert(await workspace.isVisible());assert(await trigger.evaluate(e=>e===document.activeElement));
  await workspace.getByRole('button',{name:'Read material again'}).click();await workspace.getByRole('alert').waitFor();assert.match(await workspace.getByRole('alert').innerText(),/output limit/);assert.match(await workspace.locator('.people-mentioned-usage').innerText(),/400/);assert.match(await workspace.innerText(),/browser-failure-trace/);
  await workspace.getByRole('button',{name:'View this batch in AI Ops ↗'}).click();await page.getByRole('heading',{name:'AI Opps',exact:true,level:2}).waitFor();await page.getByRole('heading',{name:'Activity ledger',exact:true}).waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  console.log(JSON.stringify({local,cards:1,mentions:2,registeredPortraitLoaded:true,liveScopedPoiDetailsLoaded:true,escapePreservesWorkspace:true,focusRestored:true,mobileOverflow:false,browserErrors:errors,unexpectedWrites:writes}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
