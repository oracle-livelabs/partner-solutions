'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8706',local=process.argv.includes('--local');
const source={ref:'S01',itemId:'browser-only-source',path:'witness.txt',sha256:'browser-fixture',basis:'original_text_excerpt'};
const coverage={sources:[source],coverage:[{...source,characters:98,truncated:false}],fingerprint:'browser-fixture'};
const quote='Mara Bell, a middle-aged female witness, spoke to an unnamed senior male driver.';
const people=[{id:'mara',label:'Mara Bell',sourceRef:'S01',mentionQuote:quote,attributes:{name:{value:'Mara Bell',quote},gender:{value:'female',quote},age:{value:'middle-aged',quote},role:{value:'witness',quote}}},{id:'driver',label:'Unnamed person 2',sourceRef:'S01',mentionQuote:'an unnamed senior male driver',attributes:{name:null,gender:{value:'male',quote},age:{value:'senior',quote},role:{value:'driver',quote}}}];
(async()=>{
 const browser=await chromium.launch({headless:true}),errors=[],writes=[],analyses=[];let page;
 try{
  page=await browser.newPage({viewport:{width:1450,height:1100}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();
   if(url.pathname.endsWith('/people-mentioned')){
    if(req.method()==='POST'){analyses.push(req.postData());return route.fulfill({json:{...coverage,people:require('../backend/data-room-people-mentioned').groupPeople(people),mentionCount:people.length,createdAt:new Date().toISOString(),notice:'Browser-only AI response fixture. No model was called.'}});}
    return route.fulfill({json:coverage});
   }
   if(req.method()!=='GET'){writes.push(req.method()+' '+url.pathname);return route.abort();}
   if(url.pathname.endsWith('/capabilities')&&local){const response=await route.fetch(),body=await response.json();body.capabilities=body.capabilities.filter(capability=>capability.id!=='people_mentioned');body.capabilities.push({id:'people_mentioned',title:'People mentioned',available:true,status:'ready',summary:'1 text source · photos optional',warnings:[],coverage:{recognisedSources:1,sources:[]}});return route.fulfill({json:body});}
   if(local&&(url.pathname==='/'||url.pathname.startsWith('/assets/'))){const file=path.join(__dirname,'../frontend/dist',url.pathname==='/'?'index.html':url.pathname);return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}
   return route.continue();
  });
  const nav=name=>page.locator('aside nav button').filter({has:page.locator('.nav-item__label > span').filter({hasText:new RegExp('^'+name+'$')})});
  await page.goto(base,{waitUntil:'networkidle'});await nav('Data Room').click();await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor({timeout:60000});
  await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:'Explore People mentioned',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'People mentioned',exact:true});await dialog.getByRole('button',{name:'Find people in material'}).click();await dialog.getByRole('heading',{name:'Mara Bell',exact:true}).waitFor();assert.equal(analyses.length,1);
  assert.equal(await dialog.locator('.people-mentioned-card').count(),2);assert.equal(await dialog.locator('.people-mentioned-card img').count(),0);
  assert.equal(await dialog.getByText('Not stated',{exact:true}).count(),1);assert(await dialog.getByText('Unnamed person 2',{exact:true}).isVisible());
  await dialog.locator('.people-mentioned-card').first().getByText('Attribute evidence',{exact:true}).click();assert(await dialog.locator('.people-mentioned-card').first().getByText('name: Mara Bell',{exact:true}).isVisible());
  for(const width of [1450,760,390]){await page.setViewportSize({width,height:1100});const size=await dialog.locator('.people-mentioned').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert(size.scroll<=size.width+2,JSON.stringify({width,...size}));}
  await page.screenshot({path:'/tmp/incident-people-mobile.png'});await page.setViewportSize({width:1450,height:1100});await dialog.getByRole('button',{name:'Close workspace'}).click();
  // Control browser time to check the exact ten-second threshold without changing app code.
  await page.clock.install();await page.clock.pauseAt(new Date());await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/persons')&&r.ok()),nav('Incident and Capacity Analytics').click()]);await page.getByRole('heading',{name:'Incident and Capacity Analytics',exact:true,level:2}).waitFor();
  await page.clock.runFor(9900);assert.equal(await page.locator('.questioning-notification').count(),0);
  await page.clock.runFor(200);const popup=page.getByRole('status',{name:'Questioning notification'});await popup.waitFor();await page.clock.runFor(400);
  assert.match(await popup.innerText(),/Detective Karen Cannell/);assert.doesNotMatch(await popup.innerText(),/simulat|fictional demonstration/i);assert.match(await popup.locator('.questioning-notification-permission strong').innerText(),/^[A-Z0-9]{6}$/);assert.match(await popup.innerText(),/120 minutes remaining/);
  assert(await popup.locator('img').evaluate(async e=>{await e.decode();return e.naturalWidth>0;}));await page.screenshot({path:'/tmp/incident-questioning-notification.png'});
  await page.setViewportSize({width:390,height:850});const bounds=await popup.evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,right:e.getBoundingClientRect().right,left:e.getBoundingClientRect().left}));assert(bounds.scroll<=bounds.width+2&&bounds.left>=0&&bounds.right<=390,JSON.stringify(bounds));await page.screenshot({path:'/tmp/incident-questioning-mobile.png'});await page.setViewportSize({width:1450,height:1100});
  await page.clock.fastForward(2*60*60*1000);assert(await popup.getByText('Code expired',{exact:true}).isVisible());assert(await popup.getByRole('button',{name:'Copy code'}).isDisabled());
  await popup.getByRole('button',{name:'Dismiss notification'}).click();assert.equal(await page.locator('.questioning-notification').count(),0);
  await nav('Data Room').click();await nav('Incident and Capacity Analytics').click();await page.clock.runFor(5000);await nav('Data Room').click();await page.clock.runFor(6000);assert.equal(await page.locator('.questioning-notification').count(),0);
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);console.log(JSON.stringify({local,namedAndUnnamedCards:true,quotedAttributes:true,noPhotosRequired:true,responsive:true,delay10Seconds:true,codeSixAlphanumeric:true,expiresAfterTwoHours:true,leavingCancelsTimer:true,writes,errors}));
 }catch(e){console.error(e);if(page){await page.screenshot({path:'/tmp/incident-people-browser-failure.png'});if(await page.locator('.cdr-explore').count())console.error(await page.locator('.cdr-explore').innerText());console.error(JSON.stringify({errors}));}throw e;}finally{if(page)await page.unrouteAll({behavior:'ignoreErrors'});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
