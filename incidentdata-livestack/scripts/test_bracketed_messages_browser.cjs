'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture,batchId}=require('./verify_bracketed_messages_live');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.argv.includes('--preview')){
   const {parsed}=await fixture(),{messages,...snapshot}=parsed;
   await page.route('http://127.0.0.1:8706/**',async route=>{
    const url=new URL(route.request().url()),p=url.pathname;
    if(p==='/'||p.startsWith('/assets/')){const file=path.join(__dirname,'../frontend/dist',p==='/'?'index.html':p);return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}
    if(p===`/api/data-room/batches/${batchId}/capabilities`){const r=await route.fetch(),value=await r.json(),cap=value.capabilities.find(c=>c.id==='messages');Object.assign(cap,{available:true,status:'results',counts:parsed.counts,summary:'17 conversations · 160 messages',snapshot:{id:'preview',version:'cdr-messages-v3'}});cap.coverage.recognisedSources=17;return route.fulfill({json:value});}
    if(p.startsWith(`/api/data-room/batches/${batchId}/messages`)){
     assert.equal(route.request().method(),'GET','Preview must not mutate the batch');const q=url.searchParams.get('q')||'',matches=messages.filter(m=>m.text.toLowerCase().includes(q.toLowerCase()));
     if(p.includes('/threads/')){const thread=parsed.threads.find(t=>t.id===p.split('/').pop()),own=messages.filter(m=>m.threadId===thread.id);return route.fulfill({json:{runId:'preview',thread,participants:parsed.participants.filter(p=>thread.participantIds.includes(p.id)),messages:own,page:1,pages:1,pageSize:40,total:own.length,order:'source',query:q,matches:q?own.flatMap((m,i)=>matches.includes(m)?[{id:m.id,position:i+1,page:1}]:[]):[]}});}
     return route.fulfill({json:{...snapshot,threads:snapshot.threads.map(t=>({...t,matchCount:q?matches.filter(m=>m.threadId===t.id).length:null})),query:q,matchCount:q?matches.length:null,run:{id:'preview',version:'cdr-messages-v3',createdAt:new Date().toISOString()},stale:false,engine:'Read-only preview'}});
    }
    if(route.request().method()!=='GET')return route.abort();return route.continue();
   });
  }
  await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Data Room/}).click();
  const row=page.locator('.cdr-history tbody tr').filter({hasText:batchId});await row.waitFor();if(await row.getByRole('button',{name:'Open',exact:true}).count())await row.getByRole('button',{name:'Open',exact:true}).click();
  await page.getByRole('button',{name:'Explore Messages',exact:true}).click();const panel=page.locator('.cdr-messages');await panel.locator('.cdr-message').nth(5).waitFor();
  assert.equal(await panel.locator('.cdr-msg-person-cards>button').count(),4);assert.equal(await panel.locator('.cdr-msg-person-cards .cdr-msg-avatar').count(),4);assert.equal(await panel.locator('.cdr-msg-thread-list>button').count(),17);assert.match(await panel.locator('.cdr-msg-thread-list>button').first().innerText(),/C01_may2023/);assert.equal(await panel.locator('.cdr-message').count(),6);
  assert.equal(await panel.locator('.cdr-msg-direct').count(),0);assert.match(await panel.locator('.cdr-msg-stats').innerText(),/160/);
  await panel.getByRole('button',{name:'Conversations for kappa66',exact:true}).click();assert.equal(await panel.locator('.cdr-msg-thread-list>button').count(),12);assert.match(await panel.locator('.cdr-msg-participant-detail').innerText(),/identity unverified/);await panel.getByRole('button',{name:'Clear conversation filters'}).click();
  await panel.getByLabel('Recorded month',{exact:true}).selectOption('2025-06');assert.equal(await panel.locator('.cdr-msg-thread-list>button').count(),1);await panel.locator('.cdr-msg-thread-list>button').click();await panel.locator('.cdr-message').nth(9).waitFor();assert.equal(await panel.locator('.cdr-message').count(),10);await panel.getByRole('button',{name:'Clear conversation filters'}).click();
  await panel.locator('.cdr-msg-thread-list>button').first().click();await panel.locator('.cdr-message').nth(5).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.cdr-message').length===6);
  const first=panel.locator('.cdr-message').first(),text=await first.locator('.cdr-msg-body').innerText();assert.match(await first.innerText(),/UTC offset not recorded/);
  const search=panel.getByRole('searchbox',{name:'Search conversation messages'});await search.fill(text.slice(0,30));await panel.locator('.cdr-msg-match-bar').waitFor();await panel.locator('.cdr-message mark').first().waitFor();assert.equal(await panel.locator('.cdr-message').count(),6);await panel.getByRole('button',{name:'Next match',exact:true}).click();assert.equal(await panel.locator('.cdr-message.is-focused').count(),1);
  await panel.getByRole('button',{name:'Clear conversation filters'}).click();await panel.locator('.cdr-msg-match-bar').waitFor({state:'hidden'});
  await first.locator('summary').click();assert.match(await first.innerText(),/Exact body offsets/);await first.getByRole('button',{name:'Open source file details'}).click();await page.locator('.cdr-cap-source').waitFor();assert.match(await page.locator('.cdr-cap-source').innerText(),/C01_may2023.txt/);await page.getByRole('button',{name:'Back to Messages',exact:true}).click();
  const downloadEvent=page.waitForEvent('download');await first.getByRole('button',{name:'Download original source'}).click();assert.equal((await downloadEvent).suggestedFilename(),'C01_may2023.txt');
  await panel.locator('.cdr-msg-network>summary').click();assert.equal(await panel.locator('.cdr-msg-edge').count(),52);assert.equal(await panel.locator('.cdr-msg-person').count(),4);assert.equal(await panel.locator('.cdr-msg-thread').count(),17);await panel.locator('.cdr-msg-network>summary').click();
  await panel.locator('.cdr-msg-participants').screenshot({path:'/tmp/crimedata-bracketed-participants.png'});
  for(const width of [760,600,390]){await page.setViewportSize({width,height:1000});const sizes=await page.locator('.cdr-cap-dialog-body').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert(sizes.scroll<=sizes.client+2,JSON.stringify({width,...sizes}));}
  await panel.locator('.cdr-msg-reader').screenshot({path:'/tmp/crimedata-bracketed-reader.png'});await page.getByRole('button',{name:'Close workspace',exact:true}).click();await page.getByRole('button',{name:'Explore Messages',exact:true}).click();assert.equal(await panel.locator('.cdr-message').count(),6);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({mode:process.argv.includes('--preview')?'read-only preview':'live',participants:4,threads:17,messages:160,edges:52,searchSourceDownloadFilters:'passed',widths:[760,600,390],browserErrors:errors}));
 }finally{for(const context of browser.contexts())for(const page of context.pages())await page.unrouteAll({behavior:'wait'});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
