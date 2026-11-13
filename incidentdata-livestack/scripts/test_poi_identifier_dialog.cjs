'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const base='http://127.0.0.1:8706',preview=!process.argv.includes('--live'),out='/home/opc/scratch/poi-identifier-dialog-20261030';
const dist=path.resolve(__dirname,'../frontend/dist');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(preview)await page.route(base+'/**',async route=>{
   const url=new URL(route.request().url());
   if(/^\/api\/persons\/[^/]+\/identifiers$/.test(url.pathname))return route.fulfill({response:await route.fetch({url:'http://127.0.0.1:8717'+url.pathname})});
   if(url.pathname==='/'||url.pathname.startsWith('/assets/')){
    const file=path.join(dist,url.pathname==='/'?'index.html':url.pathname);
    if(fs.existsSync(file))return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
   }
   return route.continue();
  });
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Person Intelligence/}).click();
  await page.locator('.person-list button').filter({hasText:'POI-V2-TONY'}).click();
  const trigger=page.getByRole('button',{name:'Open person record for Tony Kapoor',exact:true});await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Tony Kapoor',exact:true});await dialog.waitFor();
  await dialog.getByRole('group',{name:/Person identifier network/}).waitFor();
  assert(await dialog.locator('.pid-node').count()>5);
  await dialog.getByRole('button',{name:'Tone, Current',exact:true}).click();
  await dialog.getByRole('region',{name:'Selected identifier details'}).getByRole('heading',{name:'Tone',exact:true}).waitFor();
  await dialog.screenshot({path:path.join(out,(preview?'preview':'live')+'-graph.png')});
  await dialog.getByRole('tab',{name:'Table',exact:true}).click();
  const count=await dialog.locator('tbody tr').count();assert(count>=8);
  await dialog.getByRole('button',{name:'Tone',exact:true}).click();
  await dialog.getByLabel('Find identifiers').fill('nonexistent-identifier-for-test');
  await dialog.getByText('No identifiers match these filters.').waitFor();
  await dialog.getByLabel('Find identifiers').fill('');
  await dialog.getByLabel('Identifier state',{exact:true}).selectOption('Expired');assert.equal(await dialog.locator('tbody tr').count(),1);
  await dialog.getByLabel('Identifier state',{exact:true}).selectOption('all');
  await dialog.getByRole('tab',{name:'Time',exact:true}).click();
  await dialog.getByRole('group',{name:'Identifier validity Gantt chart'}).waitFor();
  await dialog.getByRole('button',{name:'Capture & review',exact:true}).click();
  await dialog.getByRole('group',{name:'Identifier capture and review timeline'}).waitFor();
  await dialog.screenshot({path:path.join(out,(preview?'preview':'live')+'-time.png')});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await trigger.evaluate(el=>el===document.activeElement),'Focus was not restored');
  await trigger.focus();await page.keyboard.press('Enter');await dialog.waitFor();
  await dialog.getByRole('tab',{name:'Graph',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await dialog.getByRole('tab',{name:'Table',exact:true}).getAttribute('aria-selected'),'true');
  await page.setViewportSize({width:390,height:844});
  const size=await dialog.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert(size.scroll<=size.width+2,'Dialog horizontal overflow '+JSON.stringify(size));
  await dialog.screenshot({path:path.join(out,(preview?'preview':'live')+'-mobile.png')});
  await dialog.getByRole('button',{name:'Close person record'}).click();
  // A fallback portrait also opens a person with observation-only identity.
  await page.locator('.person-list button').filter({hasText:'POI-2026-0317A'}).click();
  await page.getByRole('button',{name:'Open person record for Profile Alder',exact:true}).click();
  const fallback=page.getByRole('dialog',{name:'Profile Alder',exact:true});await fallback.waitFor();await fallback.getByRole('group',{name:/Person identifier network/}).waitFor();await fallback.getByRole('button',{name:'Close person record'}).click();
  await page.setViewportSize({width:1440,height:1050});
  await page.locator('.person-list button').filter({hasText:'POI-V2-TONY'}).click();
  let failed=false;const target='**/api/persons/POI-V2-TONY/identifiers';
  const failOnce=async route=>{if(!failed){failed=true;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary identifier service test failure'})});}return route.fallback();};
  await page.route(target,failOnce);await trigger.click();
  await page.getByRole('dialog').getByRole('alert').getByText('Temporary identifier service test failure').waitFor();
  await page.getByRole('button',{name:'Try again',exact:true}).click();await dialog.getByRole('group',{name:/Person identifier network/}).waitFor();await dialog.getByRole('button',{name:'Close person record'}).click();await page.unroute(target,failOnce);
  const response=await page.request.get((preview?'http://127.0.0.1:8717':base)+'/api/persons/POI-V2-TONY/identifiers',{headers:{'X-Demo-User':'statewide_admin'}});const body=await response.json();assert(response.ok());
  const empty=route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...body,identifiers:[]})});
  await page.route(target,empty);await trigger.click();await dialog.getByText('No identifiers recorded for this profile.').waitFor();await dialog.getByRole('button',{name:'Close person record'}).click();await page.unroute(target,empty);
  const delayed=async route=>{await new Promise(r=>setTimeout(r,600));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});};
  await page.route(target,delayed);await trigger.click();await page.getByRole('dialog').getByRole('button',{name:'Close person record'}).click();
  await page.locator('.person-list button').filter({hasText:'POI-2026-0317A'}).click();await page.getByRole('button',{name:'Open person record for Profile Alder',exact:true}).click();await fallback.waitFor();await fallback.getByRole('group',{name:/Person identifier network/}).waitFor();await page.waitForTimeout(700);assert.equal(await page.getByRole('dialog').getAttribute('aria-labelledby'),'pid-title');await fallback.getByRole('heading',{name:'Profile Alder',exact:true,level:2}).waitFor();await fallback.getByRole('button',{name:'Close person record'}).click();await page.unroute(target,delayed);
  assert.equal(errors.length,0,errors.join('; '));
  const receipt={mode:preview?'preview':'live',graphTableTimePassed:true,filterEmptyAndExpiredStatesPassed:true,selectionDetailsPassed:true,keyboardTabsEscapeAndFocusRestorePassed:true,mobile390Passed:true,fallbackPortraitPassed:true,errorRetryEmptyAndStaleResponsePassed:true,tonyIdentifierRows:count,pageErrors:errors};fs.writeFileSync(path.join(out,(preview?'preview':'live')+'-browser.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
