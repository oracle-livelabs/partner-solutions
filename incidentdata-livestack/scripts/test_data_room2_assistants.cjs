'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {guidance}=require('../backend/data-room-assistant-guidance');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'data_room2_assistants_20261017'),base='http://127.0.0.1:8706',live=process.argv.includes('--live');
const get=async p=>{const r=await fetch(base+'/api/data-room'+p,{headers:{'X-Demo-User':'statewide_admin'}});if(!r.ok)throw Error('Read failed '+p);return r.json();};
(async()=>{
 const browser=await chromium.launch({headless:true}),errors=[],writes=[],guidanceRequests=[],generated=[];
 let fixtureTurn=false;
 try{
 const page=await browser.newPage({viewport:{width:1450,height:1050}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();
  const endpoint=url.pathname.replace('/api/data-room','');
  if(req.method()!=='GET'){
   if(!live&&req.method()==='POST'&&endpoint.endsWith('/conversations'))return route.fulfill({json:{threadId:'assistant-preview-thread'}});
   if(!live&&req.method()==='POST'&&endpoint.endsWith('/conversations/assistant-preview-thread/messages')){generated.push(req.postDataJSON());fixtureTurn=true;return route.fulfill({status:202,json:{runId:'preview-run'}});}
   if(!live&&req.method()==='POST'&&endpoint.endsWith('/expert/assistant')){generated.push(req.postDataJSON());return route.fulfill({json:{answer:'Possible explanation [S01]. Check the original and consider counterevidence.'}});}
   writes.push({path:url.pathname,method:req.method()});return route.abort();
  }
  if(endpoint.endsWith('/conversations/assistant-preview-thread'))return route.fulfill({json:{turns:fixtureTurn?[{run_id:'preview-run',question:'Preview question',created_at:new Date().toISOString(),result:{answer:'Inspect the original source [S01].',manifest:[],profile:'preview-only'}}]:[]}});
  // Force a fresh preview thread so normal-question routing can be checked without writes.
  if(!live&&endpoint.endsWith('/conversations'))return route.fulfill({json:{threads:[]}});
  const match=endpoint.match(/^\/batches\/([^/]+)\/assistants\/(batch|expert)\/(help|status)$/);
  if(match){
   guidanceRequests.push({assistant:match[2],command:match[3]});if(live)return route.continue();
   const [detail,brief,expert]=await Promise.all([get('/batches/'+match[1]),get('/batches/'+match[1]+'/learning'),get('/batches/'+match[1]+'/expert')]);
   const counts={TOTAL:detail.items.length,COMPLETE:detail.items.filter(i=>i.ai?.status==='complete').length,FAILED:detail.items.filter(i=>i.ai?.status==='failed').length};
   const board=expert.board?{REVIEW_STATUS:expert.board.review_status,NODE_COUNT:expert.board.nodes.length,EDGE_COUNT:expert.board.edges.length,SOURCE_FINGERPRINT:expert.board.source_fingerprint}:null;
   return route.fulfill({json:guidance({assistant:match[2],command:match[3],batch:{FILENAME:detail.batch.filename,STATUS:detail.batch.status},stages:detail.stages.map(s=>({STAGE_NO:s.stage_no,STATUS:s.status})),counts,brief,board,historyCount:expert.runs.length})});
  }
  if(!live&&(url.pathname==='/'||url.pathname.startsWith('/assets/'))){const file=path.join(dir,'image/frontend/dist',url.pathname==='/'?'index.html':url.pathname);return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}
  return route.continue();
 });
 await page.goto(base,{waitUntil:'networkidle'});await page.locator('aside nav button').filter({hasText:'Data-Room2 · Preview'}).click();await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor({timeout:60000});
 await page.getByRole('button',{name:'Assistants',exact:true}).click();
 for(const [selector,name,send] of [['.cdr-chat','Batch Assistant','Send'],['.cdr-detective-chat','Crime Expert Assistant','Ask Detective']]){
  const section=page.locator(selector),input=section.locator('form textarea');
  await input.fill(' HELP ');await section.getByRole('button',{name:send,exact:true}).click();await section.getByRole('heading',{name:name+' · Help',exact:true}).waitFor();
  await input.fill('StAtUs!');await section.getByRole('button',{name:send,exact:true}).click();await section.getByRole('heading',{name:name+' · Status',exact:true}).waitFor();
  assert((await section.locator('.assistant-guidance-result').textContent()).includes('Application state · no AI call'));
  const suggestion=section.locator('.assistant-guidance-questions button').first();if(await suggestion.isEnabled()){const q=await suggestion.textContent();await suggestion.click();assert.equal(await input.inputValue(),q);await page.waitForFunction(selector=>document.querySelector(selector+' form textarea')===document.activeElement,selector);}
  assert.equal(generated.length,0);await input.fill('');
 }
 assert.equal(guidanceRequests.length,4);assert.equal(writes.length,0);
 if(!live){
  const batch=page.locator('.cdr-chat');await batch.locator('form textarea').fill('Which original sources should I check?');await batch.getByRole('button',{name:'Send',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cdr-chat-turn'));
  const expert=page.locator('.cdr-detective-chat');await expert.locator('form textarea').fill('What counterevidence would distinguish these alternatives?');await expert.getByRole('button',{name:'Ask Detective',exact:true}).click();await expert.getByText('Possible explanation [S01]. Check the original and consider counterevidence.',{exact:true}).waitFor();
  assert.equal(generated.length,2);assert(generated.every(p=>p.assistantMode==='specialist-v1'));
 }
 await page.locator('.cdr-chat .assistant-guidance').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,live?'live-assistants.png':'preview-assistants.png')});
 for(const width of [760,600,390]){await page.setViewportSize({width,height:1000});const size=await page.locator('.dr2-page').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(size.scroll<=size.client+2,JSON.stringify({width,...size}));}
 await page.screenshot({path:path.join(dir,'assistants-mobile.png')});await page.setViewportSize({width:1450,height:1050});
 await page.getByRole('button',{name:'Open in Data Room',exact:true}).click();await page.locator('.cdr-batch-strip').waitFor();assert.equal(await page.locator('.assistant-guidance').count(),0);
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
 const receipt={live,typedHelpAndStatus:true,rolesDistinct:true,suggestionsFillWithoutSending:true,specialistRequestsVerified:live?'preview-verified':generated.length,originalUnchanged:true,responsiveWidths:[760,600,390],guidanceRequests,writes,errors};await fs.writeFile(path.join(dir,live?'live-browser.json':'preview-browser.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
