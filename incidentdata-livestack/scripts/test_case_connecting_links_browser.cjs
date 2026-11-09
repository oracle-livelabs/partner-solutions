'use strict';
// GET-only checks. --local previews the built UI against the running API.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});let release;
 try {
  const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[],writes=[],external=[];
  page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()!=='GET'){writes.push(request.method()+' '+url.pathname);return route.abort();}
   if(url.origin!=='http://127.0.0.1:8706'){external.push(url.origin);return route.abort();}
   if(process.argv.includes('--local')&&(url.pathname==='/'||['/assets/','/oracle-graph/','/vendor/oracle-graph/'].some(prefix=>url.pathname.startsWith(prefix)))){
    const file=path.join(__dirname,'../frontend/dist',url.pathname==='/'?'index.html':url.pathname);
    return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':file.endsWith('.woff')?'font/woff':'text/html'});
   }return route.continue();
  });
  await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Case Relationships/}).click();
  await page.locator('.case-graph__node-list button').filter({hasText:'CASE-2026-0317'}).click();
  await page.locator('.case-graph__metrics').waitFor();
  const mode=page.getByLabel('Case graph view'),picker=page.getByLabel('Connecting link explanation'),explanation=page.getByRole('article',{name:'Recorded link explanation'}),layers=page.getByRole('region',{name:'Graph layers'});
  const original=()=>page.getByRole('button',{name:'Original network',exact:true}).click();
  const similarity=()=>page.getByRole('button',{name:'Add similarity links',exact:true}).click();
  const focus=()=>page.getByRole('button',{name:'Highlight connecting groups',exact:true}).click();
  const advanced=async()=>{if(!await page.locator('.case-connections__advanced').getAttribute('open').then(value=>value!==null))await page.getByText('Advanced controls',{exact:true}).click();};
  const summary=()=>page.getByText('5 incident groups · 4 connecting links · 12 loaded incidents',{exact:true}).waitFor();
  const baseline=await (await page.request.get('http://127.0.0.1:8706/api/graph/network?caseRef=CASE-2026-0317&depth=2',{headers:{'X-Demo-User':'statewide_admin'}})).json();
  const fullEdges=()=>page.locator('.case-graph__metrics').getByText(`${baseline.edges.length} graph relationships`,{exact:true}).waitFor();
  assert.equal(await layers.getAttribute('data-layer'),'original');await fullEdges();assert.equal(await page.locator('.case-graph__findings').isVisible(),false);assert.equal(await page.getByRole('button',{name:'2 Hops',exact:true}).isVisible(),false);assert.equal(await picker.count(),0);
  await page.locator('.case-graph__head').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/crimedata-layers-original.png'});
  for(const view of ['investigation','pathway','force']){
   await mode.selectOption(view);await original();await fullEdges();
   const selector=view==='investigation'?'.case-graph__svg-node':view==='pathway'?'.case-graph__pathway-node':'.case-force__node';
   assert.equal(await page.locator(selector).count(),baseline.nodes.length);
   await similarity();await page.locator('.case-graph__metrics').getByText(`${baseline.edges.length+11} graph relationships`,{exact:true}).waitFor();assert.equal(await layers.getAttribute('data-layer'),'similarity');assert.equal(await page.locator(selector).count(),baseline.nodes.length);
   await focus();await summary();const lines=page.locator('[data-connecting-link="true"]');assert.equal(await lines.count(),4);assert.equal(await page.locator(selector).count(),12);
   const buttons=page.getByRole('button',{name:/Explain connecting link/});assert.equal(await buttons.count(),4);
   await picker.selectOption('');await buttons.first().focus();await page.keyboard.press('Enter');await explanation.waitFor();assert.match(await explanation.innerText(),/Service-corridor review:/);
   assert.equal(await picker.locator('option').count(),5);
   await page.getByRole('button',{name:'Close explanation',exact:true}).click();assert.equal(await explanation.count(),0);
   await page.getByRole('button',{name:'Back to original',exact:true}).click();await fullEdges();assert.equal(await mode.inputValue(),view);assert.equal(await page.locator(selector).count(),baseline.nodes.length);assert.equal(await explanation.count(),0);
  }
  await mode.selectOption('oracle');const frame=page.frameLocator('iframe[title="Oracle Graph Explorer canvas"]');
  const ready=()=>page.locator('.oracle-case[data-ready="true"]').waitFor();await ready();
  const waitVertices=count=>page.waitForFunction(expected=>document.querySelector('iframe.oracle-case__frame')?.contentDocument?.querySelectorAll('g.vertex:not(.legend-active)').length===expected,count);
  const vertices=frame.locator('g.vertex:not(.legend-active)');await vertices.nth(baseline.nodes.length-1).waitFor();assert.equal(await vertices.count(),baseline.nodes.length);
  await similarity();await ready();await vertices.nth(baseline.nodes.length-1).waitFor();assert.equal(await frame.locator('g.edge').evaluateAll(edges=>edges.filter(edge=>!edge.closest('.gvt-preview')).length),baseline.edges.length+11);
  await focus();await summary();await ready();await waitVertices(12);assert.equal(await vertices.count(),12);
  const connectors=frame.locator('g.edge:not(.legend-active)').filter({hasText:'Connecting comparison'});
  assert.equal(await connectors.count(),4);
  await picker.selectOption('');await connectors.first().locator('text').first().click();await explanation.waitFor();
  assert.match(await explanation.innerText(),/Service-corridor review:/);
  const styles=await connectors.first().evaluate(element=>[...element.querySelectorAll('path,line')].map(e=>({stroke:getComputedStyle(e).stroke,width:getComputedStyle(e).strokeWidth})));
  assert(styles.some(s=>s.stroke==='rgb(183, 80, 31)'&&s.width==='5px'),JSON.stringify(styles));
  await page.locator('iframe.oracle-case__frame').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/crimedata-connecting-links-graph.png'});
  await page.getByLabel('Oracle graph layout').selectOption('force');await ready();await vertices.nth(11).waitFor();assert.equal(await connectors.count(),4);
  await page.getByLabel('Oracle graph layout').selectOption('hierarchical');await ready();
  const threshold=page.getByLabel('Incident grouping threshold');assert.equal(await threshold.isVisible(),false);await advanced();await threshold.focus();await page.keyboard.press('End');
  await page.getByText('12 incident groups · 11 connecting links · 12 loaded incidents',{exact:true}).waitFor();assert.equal(await explanation.count(),0);
  await threshold.focus();await page.keyboard.press('Home');await page.getByText('No connecting links at this threshold. Open Advanced controls to adjust it, or go back to original.',{exact:true}).waitFor();assert.equal(await picker.count(),0);
  await page.getByRole('button',{name:'Back to original',exact:true}).click();await ready();await waitVertices(28);assert.equal(await vertices.count(),28);await fullEdges();assert.equal(await page.locator('.case-connections__advanced').getAttribute('open'),null);
  // Expert hop controls remain available; the one-click reset really returns to 2 hops.
  await advanced();await page.getByRole('button',{name:'1 Hop',exact:true}).click();await ready();await waitVertices(13);assert.equal(await vertices.count(),13);
  await original();await ready();await fullEdges();assert.equal(await page.locator('.case-connections__advanced').getAttribute('open'),null);
  // Case changes reset the focus and threshold; renderer choice is retained.
  await page.locator('.case-graph__node-list button').filter({hasText:'CASE-2026-0421'}).click();await ready();assert.equal(await layers.getAttribute('data-layer'),'original');await focus();await ready();
  assert.equal(await threshold.inputValue(),'0.75');await page.getByText('3 incident groups · 3 connecting links · 8 loaded incidents',{exact:true}).waitFor();
  await picker.selectOption({index:1});await explanation.waitFor();await page.locator('.case-connections').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/crimedata-connecting-links-desktop.png'});
  for(const width of [760,600,390]){
   await page.setViewportSize({width,height:1000});const size=await page.locator('.case-connections').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert(size.scroll<=size.client+2,JSON.stringify({width,...size}));
  }
  await page.locator('.case-connections').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/crimedata-connecting-links-mobile.png'});await page.setViewportSize({width:1600,height:1200});
  // Browser-only fixtures: literal explanations, missing reasons, empty graphs,
  // and a late response must never carry a previous scope's explanations over.
  const hostile='${globalThis.__connectionInjected=1}<img src=x onerror=globalThis.__connectionInjected=2>';
  const fixture={center:{CASE_REF:'Fixture',PATTERN_LABEL:'Browser-only'},nodes:[{id:'case',type:'case',label:'Fixture',detail:''},...['a','b'].map(id=>({id,type:'incident',label:id,detail:'Synthetic'}))],edges:[{source:'a',target:'b',type:'semantic similarity',score:.7,reason:hostile}]};
  let delay=false,delayDepth=2,empty=false,missingReason=false,fail=false;
  await page.route('**/api/graph/cases',route=>route.fulfill({json:route.request().headers()['x-demo-user']==='northern_analyst'?[]:[{CASE_REF:'Fixture',PATTERN_LABEL:'Browser-only',INCIDENT_COUNT:2}]}));
  await page.route('**/api/graph/network?**',async route=>{
   const requestedDepth=Number(new URL(route.request().url()).searchParams.get('depth'));
   if(fail&&requestedDepth===3)return route.fulfill({status:503,json:{error:'Browser-only unavailable layer'}});
   const result={...fixture,edges:empty||requestedDepth<3?[]:fixture.edges.map(e=>({...e,reason:missingReason?'':e.reason}))};
   if(delay&&requestedDepth===delayDepth){await new Promise(resolve=>{release=async()=>{try{await route.fulfill({json:result});}catch{}resolve();release=null;};});return;}
   await route.fulfill({json:result});
  });
  await page.getByLabel('Demo user').selectOption('read_only_viewer');await ready();assert.equal(await layers.getAttribute('data-layer'),'original');await focus();await ready();await picker.selectOption({index:1});assert((await explanation.innerText()).includes(hostile));
  assert.equal(await page.evaluate(()=>window.__connectionInjected),undefined);assert.equal(await page.evaluate(()=>document.querySelector('iframe').contentWindow.__connectionInjected),undefined);assert.equal(await explanation.locator('img').count(),0);
  missingReason=true;await original();await ready();await focus();await ready();await picker.selectOption({index:1});await explanation.getByText('No comparison reason was supplied for this link.',{exact:true}).waitFor();
  await original();await ready();fail=true;await similarity();await page.getByText('This layer could not load. Choose another layer to continue.',{exact:true}).waitFor();assert.equal(await explanation.count(),0);await original();await ready();fail=false;
  empty=true;await original();await ready();await focus();await page.getByText('No incident-similarity links are available in this loaded result.',{exact:true}).waitFor();assert.equal(await explanation.count(),0);
  await original();await ready();delay=true;delayDepth=3;await focus();await page.getByText('Waiting for authorised graph data…',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Back to original',exact:true}).click();await ready();assert.equal(await layers.getAttribute('data-layer'),'original');assert(release);await release();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await ready();await waitVertices(3);assert.equal(await layers.getAttribute('data-layer'),'original');assert.equal(await picker.count(),0);assert.equal(await mode.inputValue(),'oracle');
  delay=false;await focus();await ready();delayDepth=2;
  delay=true;await original();await page.getByText('Waiting for authorised graph data…',{exact:true}).waitFor();await page.getByLabel('Demo user').selectOption('northern_analyst');await page.getByText('No case relationships are available in this scope.',{exact:true}).waitFor();assert(release);await release();assert.equal(await explanation.count(),0);assert.equal(await page.locator('.case-connections').count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(external,[]);
  console.log(JSON.stringify({mode:process.argv.includes('--local')?'preview':'live',views:4,layers:3,originalTwoHopBaseline:'passed',advancedDisclosureAndReset:'passed',adelaideGroups:5,adelaideConnectingLinks:4,artMarketGroups:3,thresholdAndRestore:'passed',edgeSelectionAndKeyboard:'passed',scopeRaceAndLiteralReasons:'passed',emptyAndMissingReasons:'passed',widths:[760,600,390],writes,errors}));
 } catch(error){const page=browser.contexts()[0]?.pages()[0];if(page)await page.screenshot({path:'/tmp/crimedata-connecting-links-failure.png'});throw error;}
 finally{if(release)await release();for(const context of browser.contexts())for(const page of context.pages())await page.unrouteAll({behavior:'wait'});await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
