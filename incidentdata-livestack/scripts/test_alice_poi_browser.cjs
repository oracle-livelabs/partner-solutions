const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Data Room/}).click();
  const open=async id=>page.locator('.cdr-history tbody tr').filter({hasText:id}).getByRole('button',{name:/^(Open batch|Selected)$/}).click();
  await open('DR-20260913-c76df9c9-4762-424e');
  const panel=page.getByRole('region',{name:'POI candidate searches'});
  await panel.getByText('Searchable catalogue: 9/11 narrative · 9/11 visual',{exact:true}).waitFor();
  await panel.getByText('Check registered profiles and vector readiness',{exact:true}).click();
  await panel.getByText('Clara Thornhill · narrative: ready · visual: ready',{exact:true}).waitFor();
  await panel.getByLabel('POI source file',{exact:true}).selectOption('9cc33579bf0e5b633605743ded6708f4');
  const request=page.waitForResponse(r=>r.url().endsWith('/9cc33579bf0e5b633605743ded6708f4/poi-candidates'));
  await panel.getByRole('button',{name:'Search selected narrative',exact:true}).click();const response=await (await request).json();
  assert.equal(response.batchId,'DR-20260913-c76df9c9-4762-424e');assert.equal(response.version,'cdr-poi-candidates-v2');
  await panel.locator('.cdr-poi-mentions').waitFor();const names=await panel.locator('.cdr-poi-mentions').innerText();
  for(const name of ['George Kaplan','Eve Kendall','Philip Vandamm'])assert(names.includes(name));assert(!names.includes('Clara Thornhill'));
  await panel.getByRole('button',{name:'Image region → POI portraits',exact:true}).click();await panel.getByLabel('POI source file',{exact:true}).selectOption('fa160fe7851cdf7a5c40487638c25403');
  await panel.locator('.cdr-poi-scene img').waitFor();await page.waitForFunction(()=>document.querySelector('.cdr-poi-scene img')?.naturalWidth>0);
  for(const [region,name] of [[{x:26,y:8,width:23,height:48},'George Kaplan'],[{x:60,y:17,width:25,height:46},'Clara Thornhill']]){
   await panel.getByRole('button',{name:'Clear region',exact:true}).click();
   for(const [key,value] of Object.entries(region))await panel.getByLabel(`Region ${key} percent`,{exact:true}).fill(String(value));
   await panel.getByRole('button',{name:'Compare selected region',exact:true}).click();
   await panel.locator('.cdr-poi-candidate').first().waitFor({timeout:60000});assert.equal(await panel.locator('.cdr-poi-candidate h5').first().innerText(),name);
  }
  await panel.screenshot({path:'/tmp/alice-poi-clara-fixed.png'});
  await panel.getByLabel('Minimum cosine score',{exact:true}).fill('1');await panel.locator('.cdr-poi-inconclusive').waitFor();assert.equal(await panel.locator('.cdr-poi-candidate').count(),0);
  await panel.getByText(/Inspect below-filter neighbours/).click();assert((await panel.locator('.cdr-poi-low').innerText()).includes('Clara Thornhill'));
  await open('DR-20260913-e8c04a3b-ea5f-4fb2');assert.equal(await panel.locator('.cdr-poi-result').count(),0);assert.equal(await panel.locator('.cdr-poi-mentions').count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({catalogue:'9/11',explicitNames:['George Kaplan','Eve Kendall','Philip Vandamm'],visualFirst:['George Kaplan','Clara Thornhill'],inconclusiveFilter:true,batchSwitchClearsResults:true,browserErrors:errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
