'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const ai=require('../backend/data-room-learning-ai'),boardTools=require('../backend/data-room-board');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'data_room2_source_board_20261018'),base='http://127.0.0.1:8706',live=process.argv.includes('--live');
async function get(p){const r=await fetch(base+'/api/data-room'+p,{headers:{'X-Demo-User':'statewide_admin'}});if(!r.ok)throw Error('Read failed '+p);return r.json();}
(async()=>{
 const batches=(await get('/batches')).batches;let id,learning,original;
 for(const row of batches.slice(0,15)){const [l,e]=await Promise.all([get('/batches/'+row.batch_id+'/learning'),get('/batches/'+row.batch_id+'/expert')]);if(l.isCurrent&&e.board){id=row.batch_id;learning=l;original=e;break;}}
 assert(id,'A prepared, current private board is required for this read-only check.');
 const records=await Promise.all(learning.manifest.map(async s=>{const item=await get('/batches/'+id+'/items/'+s.itemId+'?descriptionRunId='+s.descriptionRunId),attempt=item.aiAttempts.find(a=>a.run_id===s.descriptionRunId);assert(attempt);return {itemId:s.itemId,path:s.path,type:s.type,sha256:s.sourceSha256,descriptionRunId:s.descriptionRunId,resultJson:JSON.stringify(attempt.result_json),model:s.descriptionModel,promptVersion:s.descriptionPromptVersion,createdAt:s.descriptionCreatedAt};}));
 const input=ai.snapshot(records);input.fingerprint=learning.run.input_fingerprint;
 let fixture={...original,currentFingerprint:input.fingerprint,briefIsCurrent:true,boardSourcesCurrent:true,board:{...original.board,review_status:'draft',nodes:input.manifest.map(s=>({id:s.ref,label:s.path})),edges:[]}};
 const browser=await chromium.launch({headless:true}),errors=[],writes=[],saves=[];let generated=0,concurrent=false;
 try{
 const page=await browser.newPage({viewport:{width:1450,height:1050}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin!==base)return route.abort();const endpoint=u.pathname.replace('/api/data-room','');
  if(!live&&endpoint===`/batches/${id}/expert`&&req.method()==='GET')return route.fulfill({json:fixture});
  if(!live&&endpoint===`/batches/${id}/expert/board`&&req.method()==='PUT'){
   const b=req.postDataJSON();const result=boardTools.validateBoard(b,input,'statewide_admin',{UPDATED_AT:new Date(fixture.board.updated_at),EDGES_JSON:JSON.stringify(fixture.board.edges)});saves.push(b);
   fixture={...fixture,board:{...fixture.board,summary_brief:result.summary,detailed_brief:result.detailed,nodes:result.nodes,edges:result.edges,review_status:result.status,source_fingerprint:input.fingerprint,updated_at:new Date(Date.now()+saves.length*1000).toISOString()}};return route.fulfill({json:{saved:true}});
  }
  if(!live&&endpoint===`/batches/${id}/expert/board/suggestions`&&req.method()==='POST'){
   assert.equal(req.postDataJSON().expectedUpdatedAt,fixture.board.updated_at);generated++;
   const a=input.sources[0],b=input.sources.find(s=>s.source_id!==a.source_id),quote=s=>boardTools.sourceFields(s).find(v=>v.length>=8).slice(0,80);
   const candidates=[0,1,2].map(i=>({from:a.source_id,to:b.source_id,label:'Preview-only source hypothesis '+i,basis:'Compare the source descriptions before proposing a link.',uncertainty:'Description overlap may be incidental.',alternative:'The sources may concern unrelated matters.',test:'Read both originals and compare their context.',support:[{sourceRef:a.source_id,quote:quote(a)},{sourceRef:b.source_id,quote:quote(b)}]}));
   return route.fulfill({json:{...boardTools.validateSuggestions(JSON.stringify({summary:'Synthetic browser fixture; no actual AI call.',suggestions:candidates}),input),sourceFingerprint:input.fingerprint}});
  }
  if(!live&&endpoint===`/batches/${id}/expert/assistant`&&req.method()==='POST'){
   if(concurrent)fixture={...fixture,board:{...fixture.board,updated_at:new Date(Date.now()+10000).toISOString()}};
   return route.fulfill({json:{answer:'Preview-only chat response. No model was called.'}});
  }
  if(req.method()!=='GET'){writes.push(endpoint);return route.abort();}
  if(!live&&(u.pathname==='/'||u.pathname.startsWith('/assets/'))){const f=path.join(dir,'image/frontend/dist',u.pathname==='/'?'index.html':u.pathname);return route.fulfill({body:await fs.readFile(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});}
  return route.continue();
 });
 await page.goto(base,{waitUntil:'networkidle'});await page.locator('aside nav button').filter({hasText:'Data-Room2 · Preview'}).click();await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor({timeout:60000});
 if(!(await page.locator('.dr2-summary > .dr2-heading code').textContent()).includes(id)){await page.getByRole('button',{name:'Open existing batch',exact:true}).click();await page.locator('.cdr-history tbody tr').filter({hasText:id}).getByRole('button',{name:'Open',exact:true}).click();}
 await page.getByRole('button',{name:'Assistants',exact:true}).click();const board=page.getByRole('region',{name:'Private investigation board',exact:true});await board.locator('.pib-source').first().waitFor();
 assert.equal(await board.locator('.pib-source').count(),input.manifest.length);assert.equal(await board.locator('svg line').count(),0);assert.equal(await board.locator('.cdr-diagram-wrap').count(),0);
 for(const s of input.manifest)assert(await board.getByRole('button',{name:`Open source ${s.ref}: ${s.path}`,exact:true}).isVisible());
 await board.getByPlaceholder('Source ID or filename').fill(input.manifest[0].ref);assert.equal(await board.locator('.pib-source').count(),1);await board.getByPlaceholder('Source ID or filename').fill('');
 if(!live){
  assert(await board.getByText(`${input.manifest.length} sources · No relationships added yet`,{exact:true}).isVisible());
  async function manual(label){await board.getByRole('button',{name:'Add relationship',exact:true}).click();const editor=board.getByRole('form',{name:'Relationship editor'});await editor.getByLabel('From source',{exact:true}).selectOption(input.manifest[0].ref);await editor.getByLabel('To source',{exact:true}).selectOption(input.manifest[1].ref);await editor.getByLabel('Relationship label',{exact:true}).fill(label);await editor.getByLabel('Supporting basis',{exact:true}).fill('Check both original records for a shared reference.');await editor.getByLabel('What remains uncertain?',{exact:true}).fill('The reference could be coincidental.');await editor.getByRole('button',{name:'Add to draft',exact:true}).click();}
  await manual('Preview manual proposal');assert.equal(saves.length,0);assert.equal(await board.locator('.pib-relation').count(),1);
  await board.getByRole('button',{name:'Edit / review relationship',exact:true}).click();let editor=board.getByRole('form',{name:'Relationship editor'});await editor.getByLabel('Review status',{exact:true}).selectOption('reviewed');await editor.getByLabel('Review note (required)',{exact:true}).fill('Checked the original source references; association remains a hypothesis.');await editor.getByRole('button',{name:'Update draft relationship',exact:true}).click();
  await board.getByRole('button',{name:'Save board',exact:true}).click();await board.getByText('Private board saved.',{exact:true}).waitFor();assert.equal(saves.length,1);assert.equal(fixture.board.edges[0].reviewedBy,'statewide_admin');
  await board.getByRole('button',{name:'Edit / review relationship',exact:true}).click();editor=board.getByRole('form',{name:'Relationship editor'});await editor.getByLabel('Supporting basis',{exact:true}).fill('Changed supporting basis.');assert.equal(await editor.getByLabel('Review status',{exact:true}).inputValue(),'proposed');await editor.getByRole('button',{name:'Cancel editing',exact:true}).click();
  await board.getByRole('button',{name:'Suggest relationships',exact:true}).click();const pending=board.getByRole('region',{name:'Relationship suggestions',exact:true});await pending.getByRole('button',{name:'Add as proposed',exact:true}).first().waitFor();assert.equal(await board.locator('.pib-relation').count(),1);assert.equal(saves.length,1);
  await pending.getByRole('button',{name:'Add as proposed',exact:true}).first().click();assert.equal(await board.locator('.pib-relation').count(),2);assert.equal(saves.length,1);
  await pending.getByRole('button',{name:'Edit before adding',exact:true}).first().click();editor=board.getByRole('form',{name:'Relationship editor'});await editor.getByLabel('Relationship label',{exact:true}).fill('Preview edited AI proposal');await editor.getByRole('button',{name:'Add to draft',exact:true}).click();
  await pending.getByRole('button',{name:'Dismiss suggestion',exact:true}).click();assert.equal(await pending.getByRole('button',{name:'Add as proposed',exact:true}).count(),0);assert.equal(await board.locator('.pib-relation').count(),3);
  await board.getByRole('button',{name:'Save board',exact:true}).click();await board.getByText('Private board saved.',{exact:true}).waitFor();assert.equal(saves.length,2);assert.equal(fixture.board.edges[1].support.length,2);assert.equal(fixture.board.edges[2].origin,'ai_assisted');
  await manual('Unsaved proposal survives chat');const chat=page.locator('.cdr-detective-chat');await chat.locator('form textarea').fill('Preview refresh check');await chat.getByRole('button',{name:'Ask Detective',exact:true}).click();await chat.getByText('Preview-only chat response. No model was called.',{exact:true}).waitFor();assert.equal(await board.locator('.pib-relation').count(),4);
  concurrent=true;await chat.locator('form textarea').fill('Preview conflict check');await chat.getByRole('button',{name:'Ask Detective',exact:true}).click();await board.getByText('The saved board changed elsewhere.',{exact:false}).waitFor();assert.equal(await board.locator('.pib-relation').count(),4);assert(await board.getByRole('button',{name:'Save board',exact:true}).isDisabled());await board.getByRole('button',{name:'Discard local edits and reload saved board',exact:true}).click();assert.equal(await board.locator('.pib-relation').count(),3);
 }
 await board.locator('.pib-inventory').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,live?'live-source-board.png':'preview-source-board.png')});
 for(const width of [760,600,390]){await page.setViewportSize({width,height:1000});const s=await page.locator('.dr2-page').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(s.scroll<=s.client+2,JSON.stringify({width,...s}));}
 await page.screenshot({path:path.join(dir,'source-board-mobile.png')});await page.setViewportSize({width:1450,height:1050});
 await board.locator('.pib-source').first().click();await page.locator('[aria-label="Files workspace"] .cdr-preview').waitFor();await page.getByRole('button',{name:'Assistants',exact:true}).click();assert.equal(await board.locator('.pib-source').count(),input.manifest.length);
 await page.getByRole('button',{name:'Open in Data Room',exact:true}).click();await page.locator('.cdr-batch-strip').waitFor();assert.equal(await page.locator('.pib-board').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);const receipt={live,sourceCards:input.manifest.length,noDecorativeLinks:true,inspector:true,previewSaveAndReviewVerified:!live,previewSuggestionActions:!live?generated:'preview-verified',concurrentEditsProtected:!live?'verified':'preview-verified',realApplicationWrites:0,realModelCalls:0,originalUnchanged:true,responsiveWidths:[760,600,390],errors};await fs.writeFile(path.join(dir,live?'live-browser.json':'preview-browser.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
