'use strict';
// Read-only mocked UI checks against a local build or deployed static assets.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1550,height:1100}}),errors=[],requests=[];let fail=false;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  const event={event_id:'test-event',trace_id:'test-trace',actor:'statewide_admin',area:'Crime Data Room',feature:'Identify & Describe',kind:'llm',provider:'OCI GenAI',model:'google.gemini-2.5-flash',started_at:'2026-09-15T07:00:00Z',elapsed_ms:6159,status:'complete',attempt:1,vectors:0,token_status:'measured',prompt_tokens:1207,completion_tokens:393,reasoning_tokens:414,total_tokens:2014,batch_id:'batch-demo',source_label:'scene.png'};
  await page.route('http://127.0.0.1:8706/**',async route=>{
   const url=new URL(route.request().url()),p=url.pathname,respond=(json,status=200)=>{
    if(json.summary){Object.assign(json.summary,{average_ai_ms:4000,average_workflow_ms:11000,local_tokens:12,workflow_failures:1,legacy_records:20});json.workerCollector={state:'reporting',collector:{saved:7,dropped:0}};json.operations=[{id:'cdr.describe',feature:'Identify & Describe',coverage:'Provider usage; each validation retry',records:6,failures:1,lastSeen:event.started_at},{id:'room.speech',feature:'Detective Room speech synthesis',coverage:'Local process; no cloud tokens',process:'detective-worker',records:0,failures:0,lastSeen:null}];}
    if(json.detail)Object.assign(json.detail,{operationId:'cdr.describe',profile:'TEST_PROFILE',stage:'description',process:'app',usageBasis:'provider_reported_when_available'});
    return route.fulfill({json,status});
   };
   if(route.request().method()!=='GET')throw Error('AI Opps must be read-only');
   if(p==='/api/ai-ops'){
    const pageNo=Number(url.searchParams.get('page')||1),empty=url.searchParams.get('area')==='Ask Crime Data';
    return respond({summary:{records:empty?0:26,llm_calls:8,native_invocations:2,reported_tokens:16112,vectors:4,failures:1,retries:1,average_ms:6159,measured:8,unavailable:2,not_applicable:16,workflows:12},byArea:[{label:'Crime Data Room',records:26,tokens:16112,unavailable:2}],byModel:[{label:event.model,records:8,tokens:16112}],trend:[{label:'2026-09-14',tokens:8000,records:13},{label:'2026-09-15',tokens:8112,records:13}],events:empty?[]:Array.from({length:pageNo===1?25:1},(_,i)=>({...event,event_id:pageNo===1&&i===0?'test-event':`test-event-${pageNo}-${i}`})),page:pageNo,pageSize:25,options:{areas:['Crime Data Room','Ask Crime Data'],models:[event.model],batches:['batch-demo'],owners:['statewide_admin','northern_analyst']},scope:'Stack-wide operational metadata; conversation content remains owner-only.',collector:{dropped:0},coverage:[{area:'Native AI',state:'Partial token coverage',note:'Tokens unavailable'}],notes:['No replay; reasoning is not counted twice.']});
   }
   if(p.startsWith('/api/ai-ops/events/')){if(fail){fail=false;return respond({error:'Temporary read failure'},503);}return respond({event,detail:{origin:'historical',note:'Saved attempt, not replayed',usage:{totalTokens:2014},prompt:null,response:{text:'Saved answer <img src=x onerror=alert(1)>',truncated:false},timingBasis:'Saved record timestamp'}});}
   if(process.argv.includes('--local')&&(p==='/'||p.startsWith('/assets/'))){const f=path.join(__dirname,'../frontend/dist',p==='/'?'index.html':p);return route.fulfill({body:await fs.readFile(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});}
   return route.continue();
  });
  await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});
  const nav=page.locator('aside nav .nav-item');assert.equal(await nav.nth(await nav.count()-1).innerText().then(x=>x.includes('AI Opps')),true);
  await page.getByRole('button',{name:/AI Opps/}).click();await page.getByRole('heading',{name:'Activity ledger'}).waitFor();
  assert.equal(await page.locator('[aria-label="AI activity ledger"] tbody tr').count(),25);assert.match(await page.locator('.aiops-metrics').innerText(),/16,112/);
  await page.getByText(/Detective Room collector: reporting/).waitFor();
  await page.getByText('Registered operations (2)',{exact:true}).click();
  const register=page.getByRole('region',{name:'Registered AI operations'});assert.equal(await register.locator('tbody tr').count(),2);await register.getByText('No records in selection',{exact:true}).waitFor();
  await Promise.all([page.waitForResponse(r=>r.url().includes('operation=room.speech')),register.getByRole('button',{name:'Detective Room speech synthesis'}).click()]);
  await page.getByRole('button',{name:'Reset filters',exact:true}).click();
  await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText('Page 2 of 2',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('[aria-label="AI activity ledger"] tbody tr').length===1);
  await page.getByRole('button',{name:'Previous',exact:true}).click();await page.getByText('Page 1 of 2',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('[aria-label="AI activity ledger"] tbody tr').length===25);
  const open=page.getByRole('button',{name:'Inspect Identify & Describe test-event',exact:true});await open.focus();await page.keyboard.press('Enter');const dialog=page.getByRole('dialog',{name:'AI activity details'});await dialog.getByText(/No prompt content is available/).waitFor();assert.equal(await dialog.locator('img').count(),0);assert.match(await dialog.innerText(),/2,014/);
  await dialog.getByText('TEST_PROFILE',{exact:true}).waitFor();await dialog.getByText('cdr.describe',{exact:true}).waitFor();
  for(let i=0;i<18;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(e=>e.contains(document.activeElement)));}
  for(const width of [600,390]){await page.setViewportSize({width,height:900});const size=await dialog.locator('.aiops-dialog-body').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert(size.scroll<=size.client+2,JSON.stringify(size));}
  await dialog.screenshot({path:'/tmp/crimedata-aiops-detail-mobile.png'});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await open.evaluate(e=>e===document.activeElement));
  await page.setViewportSize({width:1550,height:1100});await page.locator('.aiops-page').screenshot({path:'/tmp/crimedata-aiops-desktop.png'});
  await page.getByLabel('Application area',{exact:true}).selectOption('Ask Crime Data');await page.getByText('No recorded activity matches these filters.').waitFor();await page.getByRole('button',{name:'Reset filters',exact:true}).click();await open.waitFor();
  fail=true;await open.click();await dialog.getByText(/Temporary read failure/).waitFor();await dialog.getByRole('button',{name:'Retry details'}).click();await dialog.getByText(/No prompt content is available/).waitFor();await dialog.getByRole('button',{name:'Show related activity'}).click();await page.getByText('test-trace',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Reset filters',exact:true}).click();await open.waitFor();await open.click();await dialog.getByText(/No prompt content is available/).waitFor();await page.getByLabel('Demo user',{exact:false}).selectOption('northern_analyst',{force:true});await dialog.waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);assert(!requests.some(r=>r.method!=='GET'));console.log(JSON.stringify({navigation:true,metrics:true,filters:true,paging:true,details:true,legacyNotice:true,escapedContent:true,keyboardFocus:true,mobileWidths:[600,390],readRetry:true,relatedTrace:true,userSwitchClearsDetail:true,readOnly:true,browserErrors:errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
