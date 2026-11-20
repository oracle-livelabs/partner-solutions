'use strict';
// Default: read-only deployed UI. --exercise: bounded normal queries to verify
// new capture. Only their normal audit/usage records persist; no source edits.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1560,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:8706',headers={'X-Demo-User':'statewide_admin'},get=async path=>{const r=await page.request.get(base+path,{headers});assert(r.ok(),`${path}: ${r.status()}`);return r.json();};
  const before=await get('/api/ai-ops?days=90'),checks=[];let expected=0;
  await page.goto(base+'/',{waitUntil:'networkidle'});
  if(process.argv.includes('--exercise')){
   const post=async(path,data)=>{const r=await page.request.post(base+path,{headers,data,timeout:180000});const body=await r.json();assert(r.ok(),`${path}: ${r.status()} ${body.error||''}`);checks.push({path,rows:body.rowCount??body.results?.length??null});return body;};
   await post('/api/ask',{question:'Show me the last five incidents in Norwood',mode:'narrate'});expected++;
   await post('/api/agents/run',{question:'Show me the last five incidents in Norwood'});expected++;
   await post('/api/persons/search/narrative',{query:'Business adviser and mentor',topK:3});expected++;
   const image=await page.request.get(base+'/poi/v2/julian-cross.png');assert(image.ok());
   await post('/api/persons/search/visual',{imageDataUrl:'data:image/png;base64,'+(await image.body()).toString('base64'),topK:3});expected++;
   const semantic=await post('/api/patterns/semantic-search',{query:'Counterfeit goods at a warehouse',topK:3});if(semantic.coverage?.embedded>0)expected++;
   await post('/api/ask-v2',{question:'Show me the last 5 incidents in Norwood, including report summary and narrative'});expected++;
   await page.waitForFunction(async({base,headers,n})=>{const r=await fetch(base+'/api/ai-ops?days=90',{headers});return (await r.json()).summary.records>=n;},{base,headers,n:before.summary.records+expected},{timeout:30000});
  }
  const after=await get('/api/ai-ops?days=90');assert.equal(after.collector.dropped,0);
  await page.goto(base+'/',{waitUntil:'networkidle'});await page.getByRole('button',{name:/AI Opps/}).click();await page.getByRole('heading',{name:'Activity ledger'}).waitFor();
  await page.getByRole('button',{name:'Refresh activity',exact:true}).waitFor();
  assert(await page.getByRole('region',{name:'AI activity ledger',exact:true}).locator('tbody tr').count()>0);
  assert.equal(after.operations.length,31);assert.equal(after.workerCollector.state,'reporting');assert.equal(after.workerCollector.collector.dropped,0);
  await page.getByText('Registered operations (31)',{exact:true}).click();
  const register=page.getByRole('region',{name:'Registered AI operations'});assert.equal(await register.locator('tbody tr').count(),31);
  await register.getByRole('button',{name:'Ask Detective',exact:true}).waitFor();await register.getByRole('button',{name:'Detective Room speech synthesis',exact:true}).waitFor();
  const event=(await get('/api/ai-ops?days=90&coverage=measured')).events[0];assert(event);
  const detail=await get('/api/ai-ops/events/'+encodeURIComponent(event.event_id));assert.equal(detail.event.total_tokens,event.total_tokens);
  if(event.actor==='statewide_admin'){const denied=await page.request.get(base+'/api/ai-ops/events/'+encodeURIComponent(event.event_id),{headers:{'X-Demo-User':'northern_analyst'}});assert.equal(denied.status(),404);}
  await page.locator('.aiops-filters details>summary').click();await page.getByLabel('Token coverage',{exact:true}).selectOption('measured');
  const open=page.getByRole('button',{name:`Inspect ${event.feature} ${event.event_id}`,exact:true});await open.waitFor();await open.click();const dialog=page.getByRole('dialog',{name:'AI activity details'});await dialog.getByText('Reported total',{exact:true}).waitFor();
  await dialog.screenshot({path:'/tmp/crimedata-aiops-live-detail.png'});await dialog.getByRole('button',{name:'Close details'}).click();
  await page.getByRole('button',{name:'Reset filters',exact:true}).click();await page.getByRole('button',{name:'Refresh activity',exact:true}).waitFor();await page.screenshot({path:'/tmp/crimedata-aiops-live-desktop.png',fullPage:false});
  const batches=await get('/api/data-room/batches');if(batches.batches.length){await page.getByRole('button',{name:/Data Room/}).first().click();const activity=page.getByRole('button',{name:'View AI activity ↗',exact:true});await activity.waitFor();await page.locator('.cdr-batch-strip code').waitFor();await activity.click();await page.locator('.aiops-notice').first().waitFor();assert.match(await page.locator('.aiops-notice').first().innerText(),/Batch:/);}
  const stable=await get('/api/ai-ops?days=90');assert.equal(stable.summary.records,after.summary.records,'Dashboard and details must not generate AI activity');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({deployedUi:true,detail:true,scopeIsolation:true,dataRoomLink:true,readOnlyDashboard:true,newCapture:checks,recordsAdded:after.summary.records-before.summary.records,collector:after.collector,summary:after.summary,browserErrors:errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
