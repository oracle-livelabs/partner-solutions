'use strict';
// Read-only browser test; --local previews built frontend assets on the live API.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {batchId}=require('./verify_bracketed_messages_live');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method()+' '+new URL(r.url()).pathname);});
  if(process.argv.includes('--local'))await page.route('http://127.0.0.1:8706/**',async route=>{const p=new URL(route.request().url()).pathname;if(p!=='/'&&!p.startsWith('/assets/'))return route.continue();const f=path.join(__dirname,'../frontend/dist',p==='/'?'index.html':p);return route.fulfill({body:await fs.readFile(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Data Room/}).click();
  const row=page.locator('.cdr-history tbody tr').filter({hasText:batchId});await row.waitFor();if(await row.getByRole('button',{name:'Open',exact:true}).count())await row.getByRole('button',{name:'Open',exact:true}).click();
  await page.getByRole('button',{name:'Explore Messages',exact:true}).click();const panel=page.locator('.cdr-messages'),mode=panel.getByLabel('Message order',{exact:true});await panel.locator('.cdr-message').nth(5).waitFor();
  const bodies=await panel.locator('.cdr-msg-body').allTextContents();assert.equal(bodies.length,6);
  await mode.selectOption('messaging-space');await panel.locator('.cdr-message--bubble').nth(5).waitFor();await panel.locator('.cdr-msg-turn>.cdr-msg-avatar img').first().waitFor();
  assert.deepEqual(await panel.locator('.cdr-msg-body').allTextContents(),bodies);assert.equal(await panel.locator('.cdr-msg-turn--left').count(),3);assert.equal(await panel.locator('.cdr-msg-turn--right').count(),3);
  assert.equal(await panel.locator('.cdr-msg-portrait-basis').count(),6);assert.equal(await panel.locator('.cdr-msg-date-divider').count(),3);
  await page.waitForFunction(()=>{const im=document.querySelector('.cdr-msg-turn .cdr-msg-avatar img');return im?.complete&&im.naturalWidth>0;});
  const positions=await panel.locator('.cdr-msg-turn').evaluateAll(turns=>turns.slice(0,2).map(t=>({side:t.className,x:t.querySelector('article').getBoundingClientRect().x,bg:getComputedStyle(t.querySelector('article')).backgroundColor})));
  assert(positions[0].x>positions[1].x);assert.notEqual(positions[0].bg,positions[1].bg);
  await panel.getByLabel('Right-side participant').selectOption({label:'kappa66'});assert.deepEqual(await panel.locator('.cdr-msg-turn--right').evaluateAll(t=>[...new Set(t.map(e=>e.dataset.sender))]),['kappa66']);
  const search=panel.getByRole('searchbox',{name:'Search conversation messages'});await search.fill(bodies[2].slice(0,25));await panel.locator('.cdr-message mark').first().waitFor();await panel.getByRole('button',{name:'Next match',exact:true}).click();await panel.locator('.cdr-message.is-focused').waitFor();assert.equal(await panel.locator('.cdr-message').count(),6);
  await panel.getByRole('button',{name:'Clear conversation filters'}).click();await panel.locator('.cdr-msg-match-bar').waitFor({state:'hidden'});
  const first=panel.locator('.cdr-message').first();await first.locator('summary').click();assert.match(await first.innerText(),/Exact body offsets/);await first.getByRole('button',{name:'Open source file details'}).click();await page.locator('.cdr-cap-source').waitFor();await page.getByRole('button',{name:'Back to Messages',exact:true}).click();assert.equal(await mode.inputValue(),'messaging-space');
  const download=page.waitForEvent('download');await first.getByRole('button',{name:'Download original source'}).click();assert.equal((await download).suggestedFilename(),'C01_may2023.txt');await first.locator('summary').click();
  await panel.locator('.cdr-msg-exchange--space').evaluate(e=>e.scrollTop=0);await panel.locator('.cdr-msg-reader').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/crimedata-messaging-space-desktop.png'});
  await panel.locator('.cdr-msg-thread-list>button').filter({hasText:'C17_jun2025.txt'}).click();await panel.locator('.cdr-message--bubble').nth(9).waitFor();assert.equal(await mode.inputValue(),'messaging-space');
  const hues=await panel.locator('.cdr-msg-turn').evaluateAll(turns=>[...new Set(turns.map(t=>t.style.getPropertyValue('--speaker-hue')))]);assert.equal(hues.length,4);assert.equal(await panel.getByLabel('Right-side participant').locator('option').count(),4);
  for(const width of [760,600,390]){await page.setViewportSize({width,height:1000});for(const selector of ['.cdr-cap-dialog-body','.cdr-msg-exchange--space']){const sizes=await page.locator(selector).evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert(sizes.scroll<=sizes.client+2,JSON.stringify({width,selector,...sizes}));}}
  await panel.locator('.cdr-msg-exchange--space').evaluate(e=>e.scrollTop=0);await panel.locator('.cdr-msg-exchange--space').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/crimedata-messaging-space-mobile.png'});
  await page.setViewportSize({width:1500,height:1100});await panel.locator('.cdr-msg-thread-list>button').first().click();await panel.locator('.cdr-message--bubble').nth(5).waitFor();
  await mode.selectOption('source');assert.equal(await panel.locator('.cdr-message--bubble').count(),0);assert.deepEqual(await panel.locator('.cdr-msg-body').allTextContents(),bodies);
  const catalogue=`**/batches/${batchId}/poi-catalogue`;
  await page.route(catalogue,route=>route.fulfill({json:{profiles:[]}}));await mode.selectOption('messaging-space');await page.waitForFunction(()=>!document.querySelector('.cdr-msg-space-heading [role=status]'));assert.equal(await panel.locator('.cdr-msg-turn img').count(),0);assert.equal(await panel.locator('.cdr-msg-portrait-basis').count(),0);assert.equal(await panel.locator('.cdr-message').count(),6);
  await mode.selectOption('source');await page.unroute(catalogue);await page.route(catalogue,route=>route.fulfill({status:503,json:{error:'Catalogue unavailable'}}));await mode.selectOption('messaging-space');await panel.getByText(/POI portraits unavailable/).waitFor();assert.equal(await panel.locator('.cdr-message').count(),6);
  await mode.selectOption('source');await page.unroute(catalogue);
  await page.route(catalogue,async route=>{const r=await route.fetch(),value=await r.json();value.profiles=value.profiles.map(p=>p.display_name==='Eve Kendall'?{...p,portrait_asset_uri:'/poi/test/missing.png'}:p);return route.fulfill({json:value});});await page.route('**/poi/test/missing.png',route=>route.abort());await mode.selectOption('messaging-space');await panel.locator('.cdr-msg-portrait-basis').first().waitFor();await panel.locator('.cdr-msg-turn[data-sender="evek81"]>.cdr-msg-avatar').first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const avatar=document.querySelector('.cdr-msg-turn[data-sender="evek81"]>.cdr-msg-avatar');return avatar?.textContent==='EV'&&!avatar.querySelector('img');});assert.equal(await panel.locator('.cdr-message').count(),6);await page.unroute(catalogue);await page.unroute('**/poi/test/missing.png');
  // A read-only 43-record response fixture verifies second-page match navigation.
  await mode.selectOption('auto');await panel.locator('.cdr-message').nth(5).waitFor();
  await page.route('**/messages/threads/**',async route=>{
   const url=new URL(route.request().url()),pageNo=Number(url.searchParams.get('page')||1),q=url.searchParams.get('q')||'';url.searchParams.set('page','1');const response=await route.fetch({url:url.href}),r=await response.json();
   const records=Array.from({length:43},(_,i)=>({...r.messages[i%r.messages.length],id:'fixture-'+i,sequence:i+1,text:i===42?'Unique last-page needle':`Fixture message ${i+1}`}));
   return route.fulfill({json:{...r,thread:{...r.thread,messageCount:43},messages:records.slice((pageNo-1)*40,pageNo*40),page:pageNo,pages:2,pageSize:40,total:43,query:q,matches:q?[{id:'fixture-42',position:43,page:2}]:[]}});
  });
  await mode.selectOption('messaging-space');await panel.locator('.cdr-message').nth(39).waitFor();await search.fill('Unique last-page needle');await panel.getByText('1 matching message',{exact:true}).waitFor();await panel.getByRole('button',{name:'Next match',exact:true}).click();await panel.locator('.cdr-message.is-focused').waitFor();assert.match(await panel.locator('.cdr-message.is-focused .cdr-msg-body').innerText(),/Unique last-page needle/);assert.equal(await panel.locator('.cdr-message').count(),3);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log(JSON.stringify({mode:process.argv.includes('--local')?'local preview':'live',sourceText:'unchanged',sidesColoursAndGroupChats:'passed',portraits:'scoped catalogue matches',missingAndFailedPhotos:'initials',searchSourceDownloadPagination:'passed',widths:[760,600,390],writes:0,browserErrors:errors}));
 }finally{for(const context of browser.contexts())for(const page of context.pages())await page.unrouteAll({behavior:'wait'});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
