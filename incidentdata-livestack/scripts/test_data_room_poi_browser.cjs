const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/Data Room/}).click();
  await page.locator('.cdr-history tbody tr').filter({hasText:'DR-20260913-e8c04a3b-ea5f-4fb2'}).getByRole('button',{name:/^(Open batch|Selected)$/}).click();
  const panel=page.getByRole('region',{name:'POI candidate searches'});
  await panel.getByLabel('POI source file',{exact:true}).selectOption('b9d434e4e9df1cc2ccdb4a5307f7c961');
  await panel.getByLabel('Minimum cosine score',{exact:true}).fill('-1');
  assert.equal(await panel.getByLabel('Minimum cosine score',{exact:true}).inputValue(),'-1');
  await panel.getByRole('button',{name:'Search selected narrative',exact:true}).click();
  await panel.locator('.cdr-poi-candidate').first().waitFor({timeout:90000});
  assert.equal(await panel.locator('.cdr-poi-candidate').count(),3,'selected narrative cards');
  await panel.getByText('Source excerpt used for this search',{exact:true}).click();
  assert((await panel.locator('pre').innerText()).length>0);
  await panel.getByRole('button',{name:'Search all batch narratives',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.cdr-poi-result').length===11&&!document.querySelector('.cdr-poi [role="status"]'),{},{timeout:90000});
  assert.equal(await panel.locator('.cdr-poi-candidate').count(),33);
  assert.equal(await panel.locator('.cdr-failure').count(),0);
  await panel.getByRole('button',{name:'Image region → POI portraits',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.cdr-poi-filter input')?.value==='0.6');
  await panel.getByLabel('Minimum cosine score',{exact:true}).fill('-1');
  await panel.getByLabel('POI source file',{exact:true}).selectOption('aa0b11d1b8b9285964d199e1d135f6f1');
  await panel.locator('.cdr-poi-scene img').waitFor();
  await page.waitForFunction(()=>document.querySelector('.cdr-poi-scene img')?.naturalWidth>0);
  const scene=panel.locator('.cdr-poi-scene');await scene.scrollIntoViewIfNeeded();const b=await scene.boundingBox();
  await page.mouse.move(b.x+b.width*0.25,b.y+b.height*0.06);await page.mouse.down();await page.mouse.move(b.x+b.width*0.63,b.y+b.height*0.66,{steps:8});await page.mouse.up();
  assert.equal(await panel.locator('.cdr-poi-box').count(),1);
  const original=await scene.locator('img').getAttribute('src');
  await panel.getByRole('button',{name:'Compare selected region',exact:true}).click();
  await panel.locator('.cdr-poi-query img').waitFor({timeout:90000});
  assert.equal(await panel.getByLabel('Minimum cosine score',{exact:true}).inputValue(),'-1');
  assert.equal(await panel.locator('.cdr-poi-candidate').count(),3,'visual cards with filter disabled');assert.equal(await scene.locator('img').getAttribute('src'),original);
  const exported=page.waitForEvent('download');await panel.getByRole('button',{name:'Download candidate report',exact:true}).click();assert.equal((await exported).suggestedFilename(),'poi-candidates.json');
  await panel.screenshot({path:'/tmp/cdr-poi-candidates-desktop.png'});
  for(const width of [760,600]){await page.setViewportSize({width,height:1000});const sizes=await panel.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert(sizes.scroll<=sizes.width+2,JSON.stringify(sizes));}
  await panel.screenshot({path:'/tmp/cdr-poi-candidates-mobile.png'});
  await panel.getByRole('button',{name:'Dismiss these candidates',exact:true}).click();assert.equal(await panel.locator('.cdr-poi-candidate').count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({narrativeCards:3,allBatchNarratives:11,visualCards:3,manualCrop:'passed',originalRetained:true,download:'passed',dismiss:'passed',widths:[760,600],browserErrors:errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
