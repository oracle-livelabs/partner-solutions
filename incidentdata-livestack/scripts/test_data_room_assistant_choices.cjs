'use strict';
// Read-only UI regression check. --local previews the build over the running API.
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8706',local=process.argv.includes('--local');
(async()=>{
 const browser=await chromium.launch({headless:true}),errors=[],writes=[];
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1050}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(r.method()!=='GET'){writes.push(r.method()+' '+u.pathname);return route.abort();}
   if(u.origin!==base)return route.abort();
   if(local&&(u.pathname==='/'||u.pathname.startsWith('/assets/'))){const f=path.join(__dirname,'../frontend/dist',u.pathname==='/'?'index.html':u.pathname);return route.fulfill({body:await fs.readFile(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});}
   return route.continue();
  });
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('aside nav button').filter({has:page.getByText('Data Room',{exact:true})}).click();
  await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor({timeout:60000});
  await page.getByRole('button',{name:'Assistants',exact:true}).click();
  const choices=page.getByRole('group',{name:'Choose an assistant'}),batch=page.locator('#batch-assistant-workspace'),expert=page.locator('#expert-assistant-workspace');
  assert(await batch.isVisible());assert(!await expert.isVisible());
  assert.equal(await batch.locator('.assistant-examples button').count(),2);
  const input=batch.locator('form textarea');await batch.locator('.assistant-examples button').first().click();
  assert.equal(await input.inputValue(),'What does this batch contain?');assert(await input.evaluate(e=>e===document.activeElement));
  await input.fill('Unsaved batch question');
  await choices.getByRole('button',{name:/Crime Expert Assistant/}).click();assert(await expert.isVisible());assert(!await batch.isVisible());
  const board=expert.locator('.assistant-board');assert.equal(await board.getAttribute('open'),null);assert(!await expert.locator('.pib-board').isVisible());
  const expertInput=expert.locator('form textarea');assert.equal(await expert.locator('.assistant-examples button').count(),2);
  await expert.locator('.assistant-examples button').last().click();assert.match(await expertInput.inputValue(),/counterevidence/);
  await expertInput.fill('Unsaved expert question');
  await board.locator(':scope > summary').click();assert(await expert.locator('.pib-board').isVisible());
  const notes=expert.locator('.pib-notes');let notesChecked=false;
  if(await notes.count()){
   await notes.locator('summary').click();const brief=notes.getByLabel('Summary Brief',{exact:true});
   if(await brief.isEnabled()){await brief.fill('Unsaved board note for browser verification');notesChecked=true;}
  }
  await board.locator(':scope > summary').click();await choices.getByRole('button',{name:/Batch Assistant/}).click();
  assert.equal(await input.inputValue(),'Unsaved batch question');
  await choices.getByRole('button',{name:/Crime Expert Assistant/}).click();assert.equal(await expertInput.inputValue(),'Unsaved expert question');
  await board.locator(':scope > summary').click();if(notesChecked)assert.equal(await notes.getByLabel('Summary Brief',{exact:true}).inputValue(),'Unsaved board note for browser verification');
  await board.locator(':scope > summary').click();
  await expert.getByRole('button',{name:'Status',exact:true}).click();await expert.getByRole('heading',{name:'Crime Expert Assistant · Status',exact:true}).waitFor();
  await choices.getByRole('button',{name:/Batch Assistant/}).click();await batch.getByRole('button',{name:'Help',exact:true}).click();await batch.getByRole('heading',{name:'Batch Assistant · Help',exact:true}).waitFor();
  await page.getByRole('button',{name:'Explain Assistants',exact:true}).click();await page.getByRole('dialog').getByText(/One workspace is shown/).waitFor();await page.getByRole('button',{name:'Close explanation'}).click();
  for(const width of [1450,760,390]){
   await page.setViewportSize({width,height:1050});
   for(const name of [/Batch Assistant/,/Crime Expert Assistant/]){
    await choices.getByRole('button',{name}).click();
    const size=await page.locator('.dr2-page').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert(size.scroll<=size.client+2,JSON.stringify({width,...size}));
   }
  }
  await page.setViewportSize({width:1450,height:1050});await choices.scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/incident-assistant-choices.png'});
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({local,oneWorkspaceVisible:true,examplesFillWithoutSending:true,draftsPreserved:true,optionalBoard:true,boardEditsPreserved:notesChecked,helpAndStatus:true,responsive:true,writes,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
