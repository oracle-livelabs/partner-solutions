'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {AGENT_FRAMEWORK_INTERNALS:guide}=await import('../frontend/src/agent-framework-internals.mjs');
 const base='http://127.0.0.1:8706',dir=path.resolve('agent_framework_explain_20261015'),preview=process.argv.includes('--preview'),errors=[],writes=[];
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1550,height:1100}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'){writes.push(url.pathname);return route.abort();}if(url.origin!==base)return route.abort();if(preview&&(url.pathname==='/'||url.pathname.startsWith('/assets/'))){const file=path.join(dir,'image/frontend/dist',url.pathname==='/'?'index.html':url.pathname);return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}return route.continue();});
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.nav-item').filter({has:page.locator('.nav-item__label>span',{hasText:/^AI Agent Console$/})}).click();
  const panel=page.getByRole('complementary',{name:'Oracle Internals'});await panel.getByRole('button',{name:'Show Oracle Internals',exact:true}).click();
  assert.equal(await panel.getByRole('heading',{name:'AI Agent Console',exact:true}).count(),1);assert.equal(await panel.locator('.oi-flow li').count(),7);
  assert.equal(await panel.locator('.oi-lesson').count(),4);assert(await panel.getByText('CRIMEDATA_PATTERN_INVESTIGATION_TEAM',{exact:true}).isVisible());
  const stages=panel.locator('.oi-lesson').filter({has:page.locator('summary',{hasText:'What the four stage tiles actually mean'})});await stages.locator('summary').click();assert.match(await stages.innerText(),/not live progress events/);
  const boundaries=panel.locator('.oi-lesson').filter({has:page.locator('summary',{hasText:'City context, access and model boundaries'})});await boundaries.locator('summary').click();assert.match(await boundaries.innerText(),/do not generate embeddings/);assert.match(await boundaries.innerText(),/schema-level/);
  assert.equal(await panel.locator('.oi-implementation').getAttribute('open'),null);await panel.locator('.oi-implementation>summary').click();
  const codeSample=guide.implementationExamples.find(e=>e.title==='Implementation: register a PL/SQL function as a tool');
  const code=panel.getByLabel('PL/SQL: '+codeSample.title,{exact:true});assert.equal(await code.innerText(),codeSample.code);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}}));await panel.getByRole('button',{name:'Copy PL/SQL: '+codeSample.title,exact:true}).click();assert.equal(await page.evaluate(()=>window.__copied),codeSample.code);
  const runExample=guide.implementationExamples.find(e=>e.title==='Implementation: invoke the native team');assert.match(runExample.note,/can incur model usage/);assert.match(await panel.locator('.oi-implementation').innerText(),/never executes code/);
  const diagnostic=guide.examples.find(e=>e.kind==='plsql');assert.equal(await panel.getByLabel('PL/SQL: '+diagnostic.title,{exact:true}).innerText(),diagnostic.code);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Clipboard unavailable');}}}));await panel.getByRole('button',{name:'Copy PL/SQL: '+diagnostic.title,exact:true}).click();assert.equal(await page.evaluate(()=>window.getSelection().toString()),diagnostic.code);
  const ids=await panel.locator('[id]').evaluateAll(elements=>elements.map(e=>e.id));assert.equal(ids.length,new Set(ids).size,'SQL block labels have unique IDs');
  await panel.locator('.oi-content').evaluate(e=>e.scrollTop=0);await page.screenshot({path:dir+'/'+(preview?'preview':'live')+'-desktop.png'});
  await page.setViewportSize({width:390,height:900});await panel.locator('.oi-content').evaluate(e=>e.scrollTop=0);assert(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+2));assert(await panel.locator('.oi-content').evaluate(e=>e.scrollWidth<=e.clientWidth+2));await page.screenshot({path:dir+'/'+(preview?'preview':'live')+'-mobile.png'});
  await page.setViewportSize({width:1550,height:1100});await panel.getByRole('button',{name:'Collapse Oracle Internals',exact:true}).click();await page.getByRole('button',{name:/Incident Pattern Signals/}).click();await panel.getByRole('button',{name:'Show Oracle Internals',exact:true}).click();assert.equal(await panel.locator('.oi-lesson').count(),0);assert.equal(await panel.getByRole('heading',{name:'APEX SQL Workshop: check Adelaide V2 vector coverage',exact:true}).count(),1);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const receipt={passed:true,mode:preview?'preview':'live',sevenStepFlow:true,schemaObjectMap:true,stageCapabilityDistinction:true,cityAndSecurityBoundaries:true,implementationExcerptsSeparated:true,readOnlyInspectionExamples:true,clipboardAndFallback:true,uniqueLabels:true,mobile:true,signalsPanelRetained:true,newModelCalls:0,errors,writes};await fs.writeFile(dir+'/'+(preview?'preview':'live')+'-validation.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
