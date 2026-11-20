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
  const row=page.locator('tr').filter({hasText:'scn-009-scene-09.png'});
  await row.getByRole('button',{name:'Details',exact:true}).click();
  const details=page.locator('.cdr-ai-detail');
  await details.getByText('Model: google.gemini-2.5-flash',{exact:true}).waitFor();
  await details.getByText('Generation diagnostics',{exact:true}).click();
  assert.match(await details.innerText(),/Attempt 1: complete/);
  assert.match(await details.innerText(),/Previous attempts/);
  await page.screenshot({path:'/home/opc/scratch/crime-data-model-evaluation/live-description-diagnostics.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({liveGeminiDescription:'passed',generationDiagnostics:'passed',historyRetained:'passed',browserErrors:errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
