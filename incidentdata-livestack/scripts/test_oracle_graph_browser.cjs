'use strict';
// Read-only browser checks; --local serves built frontend files over the live API.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true}),pending=[];
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[],writes=[],external=[],messages=[];
  page.setDefaultTimeout(12000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')messages.push(m.text());});
  await page.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(r.method()!=='GET'){writes.push(r.method()+' '+u.pathname);return route.abort();}if(u.origin!=='http://127.0.0.1:8706'){external.push(u.origin);return route.abort();}
   if(process.argv.includes('--local')&&(u.pathname==='/'||['/assets/','/oracle-graph/','/vendor/oracle-graph/'].some(p=>u.pathname.startsWith(p)))){const f=path.join(__dirname,'../frontend/dist',u.pathname==='/'?'index.html':u.pathname);return route.fulfill({body:await fs.readFile(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.woff2')?'font/woff2':f.endsWith('.woff')?'font/woff':'text/html'});}return route.continue();});
  await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Case Relationships/}).click();
  const mode=page.getByLabel('Case graph view');await page.locator('.case-graph__metrics').waitFor();assert.equal(await mode.locator('option').count(),4);
  await mode.selectOption('oracle');const frame=page.frameLocator('iframe[title="Oracle Graph Explorer canvas"]');
  await frame.locator('#graph svg').first().waitFor();await page.locator('.oracle-case [role="status"]').waitFor({state:'hidden'});
  const vertices=frame.locator('g.vertex:not(.legend-active)'),caseRef=await page.locator('.case-graph__node-list button.active strong').innerText();
  const network=await (await page.request.get('http://127.0.0.1:8706/api/graph/network?caseRef='+encodeURIComponent(caseRef)+'&depth=2',{headers:{'X-Demo-User':'statewide_admin'}})).json();await vertices.nth(network.nodes.length-1).waitFor();
  assert.equal(await vertices.count(),network.nodes.length);
  const ready=()=>page.locator('.oracle-case[data-ready="true"]').waitFor();
  await page.getByLabel('Oracle graph layout').selectOption('force');await ready();await vertices.nth(network.nodes.length-1).waitFor();
  await page.getByLabel('Oracle graph layout').selectOption('hierarchical');await ready();await vertices.nth(network.nodes.length-1).waitFor();
  await vertices.filter({hasText:network.nodes.find(n=>n.type==='incident').label}).dblclick();await page.getByRole('dialog').waitFor();await page.getByLabel('Close detail dialog').click();
  await page.getByText('Accessible node list and details',{exact:true}).click();const person=network.nodes.find(n=>n.type==='person');await page.getByLabel('Oracle graph node').selectOption(person.id);await page.getByRole('button',{name:'Open node details',exact:true}).click();await page.getByRole('dialog').waitFor();assert.match(await page.getByRole('dialog').innerText(),/PERSON OF INTEREST/);await page.getByLabel('Close detail dialog').click();
  await frame.getByRole('button',{name:'Enter Exploration Mode',exact:true}).click();
  await vertices.nth(1).click();await vertices.nth(2).click({modifiers:['Control']});await frame.getByRole('button',{name:'Group - Group selected vertices',exact:true}).click();
  await frame.getByText('Manually grouped',{exact:true}).waitFor();assert.equal(await vertices.count(),network.nodes.length-1);
  await frame.getByRole('button',{name:'Undo - Undo last action',exact:true}).click();await vertices.nth(network.nodes.length-1).waitFor();
  await page.getByRole('button',{name:'Reset exploration',exact:true}).click();await ready();await vertices.nth(network.nodes.length-1).waitFor();
  await frame.getByPlaceholder('Search graph').fill(caseRef);await frame.locator('g.vertex[data-selected="true"]').waitFor();await frame.getByRole('button',{name:'Clear search',exact:true}).click();
  const legend=frame.getByText('Incident',{exact:true}).locator('xpath=../../..');await legend.getByRole('checkbox').click();await vertices.filter({hasText:network.nodes.find(n=>n.type==='incident').label}).waitFor({state:'detached'});assert.equal(await vertices.count(),network.nodes.filter(n=>n.type!=='incident').length);await legend.getByRole('checkbox').click();await vertices.nth(network.nodes.length-1).waitFor();
  await page.locator('.oracle-case').scrollIntoViewIfNeeded();await page.mouse.move(300,100);await page.screenshot({path:'/tmp/crimedata-oracle-graph-desktop.png'});
  for(const [view,label]of [['investigation','Case relationship network'],['pathway','Case relationship pathway network'],['force','Interactive force-directed case relationship network']]){await mode.selectOption(view);await page.getByRole('img',{name:label,exact:true}).waitFor();assert.equal(await page.locator('iframe.oracle-case__frame').count(),0);}
  await mode.selectOption('oracle');await ready();await vertices.nth(network.nodes.length-1).waitFor();
  // Synthetic response fixtures stay in this browser only; no records are written.
  const hostile='${globalThis.__graphInjected=1}<img src=x onerror=globalThis.__graphInjected=2>';
  const fixture=(ref='Fixture-A')=>({center:{CASE_REF:ref,PATTERN_LABEL:'Browser-only graph fixture'},nodes:[{id:ref,type:'case',label:ref,detail:'Browser-only fixture'},{id:'photo',type:'person',label:'Photo fixture',detail:'Synthetic test',PORTRAIT_ASSET_URI:'/poi/v2/julian-cross.png'},{id:'literal',type:'person',label:hostile,detail:'Literal text test'},{id:'evidence',type:'evidence',label:'Evidence fixture',detail:'Browser-only'}],edges:[{source:ref,target:'photo',type:'recorded test link'},{source:'photo',target:'literal',type:'recorded test link'},{source:'literal',target:'evidence',type:'recorded test link'},{source:ref,target:'outside',type:'bounded endpoint'}]});
  let delayed=false,release,settled;
  await page.route('**/api/graph/cases',route=>route.fulfill({json:route.request().headers()['x-demo-user']==='northern_analyst'?[]:[{CASE_REF:'Fixture-A',PATTERN_LABEL:'Browser-only A',INCIDENT_COUNT:1},{CASE_REF:'Fixture-B',PATTERN_LABEL:'Browser-only B',INCIDENT_COUNT:1}]}));
  await page.route('**/api/graph/network?**',async route=>{const ref=new URL(route.request().url()).searchParams.get('caseRef');if(delayed&&ref==='Fixture-B'){settled=new Promise(done=>{let released=false;release=async()=>{if(released)return;released=true;try{await route.fulfill({json:fixture(ref)});}catch{}done();};pending.push(release);});return;}return route.fulfill({json:fixture(ref)});});
  await page.getByLabel('Demo user').selectOption('read_only_viewer');await ready();await vertices.nth(3).waitFor();assert.equal(await vertices.count(),4);
  await frame.locator('image').waitFor({state:'attached'});const portrait=await frame.locator('image').evaluate(e=>e.getAttribute('href')||e.getAttribute('xlink:href'));assert.equal(portrait,'/poi/v2/julian-cross.png');
  const photo=await frame.locator('image').evaluate(e=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth);img.onerror=()=>resolve(0);img.src=e.getAttribute('href');}));assert(photo>0);assert(await vertices.filter({hasText:'Photo fixture'}).locator('[fill^="url("]').count()>0);
  assert.equal(await page.evaluate(()=>document.querySelector('iframe.oracle-case__frame').contentWindow.__graphInjected),undefined);assert.equal(await frame.locator('img[onerror]').count(),0);await page.getByText(/1 relationship\(s\) have endpoints outside/).waitFor();
  for(const width of [760,600,390]){await page.setViewportSize({width,height:1000});const size=await page.locator('.oracle-case').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert(size.scroll<=size.client+2,JSON.stringify({width,...size}));assert(size.client>200);}
  await page.locator('iframe.oracle-case__frame').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/crimedata-oracle-graph-mobile.png'});await page.setViewportSize({width:1600,height:1200});
  delayed=true;await page.locator('.case-graph__node-list button').filter({hasText:'Fixture-B'}).click();await page.locator('iframe.oracle-case__frame').waitFor({state:'detached'});
  await page.getByLabel('Demo user').selectOption('northern_analyst');await page.getByText('No case relationships are available in this scope.',{exact:true}).waitFor();assert(release);await release();await settled;assert.equal(await page.locator('iframe.oracle-case__frame').count(),0);assert.equal(await page.locator('.case-graph__briefing').count(),0);
  const sdk='**/vendor/oracle-graph/26.4.0/index.js';await page.route(sdk,route=>route.fulfill({body:'/* browser-only unavailable-library fixture */',contentType:'application/javascript'}));await page.getByLabel('Demo user').selectOption('read_only_viewer');await page.locator('.oracle-case [role="alert"]').waitFor();assert.equal(await mode.locator('option').count(),4);await page.unroute(sdk);await page.getByRole('button',{name:'Retry Oracle view',exact:true}).click();await ready();await vertices.nth(3).waitFor();
  await page.evaluate(()=>window.postMessage({channel:'crimedata-oracle-graph-v1',type:'select',id:'photo'},location.origin));assert.equal(await page.getByRole('dialog').count(),0);
  console.log(JSON.stringify({mode:process.argv.includes('--local')?'preview':'live',liveNodes:network.nodes.length,layoutsDetailsGroupingUndoSearchAndLegend:'passed',legacyViews:3,portraitAndLiteralTextFixture:'passed',boundedEdges:'passed',scopeChangeAndDelayedResponse:'passed',sdkFailureAndRetry:'passed',widths:[760,600,390],errors,messages:messages.slice(0,5),writes,external}));
  assert.deepEqual(errors,[]);assert.deepEqual(messages,[]);assert.deepEqual(writes,[]);assert.deepEqual(external,[]);
 }catch(e){const page=browser.contexts()[0]?.pages()[0];if(page)await page.screenshot({path:'/tmp/crimedata-oracle-graph-failure.png'});throw e;}finally{for(const release of pending)await release();for(const context of browser.contexts())for(const page of context.pages())await page.unrouteAll({behavior:'wait'});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
