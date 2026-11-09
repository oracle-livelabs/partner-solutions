'use strict';
// Read-only native SDK layout checks. --local previews built frontend files.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const {caseConnectingLinks}=await import('../frontend/src/case-connecting-links.mjs');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1200}}),errors=[],writes=[],external=[];
  page.setDefaultTimeout(18000);page.on('pageerror',error=>errors.push(error.message));
  // Instrument only this test browser: capture the settings/data actually
  // passed into the genuine Oracle constructor, without replacing its renderer.
  await page.addInitScript(()=>{let constructor;
   Object.defineProperty(window,'GraphVisualization',{configurable:true,get:()=>constructor,set:Original=>{constructor=new Proxy(Original,{construct(Target,args,newTarget){const props=args[0].props;window.__layoutProbe=JSON.parse(JSON.stringify({layout:props.settings.layout,vertices:props.data.vertices.map(v=>({id:v.id,labels:v.labels,properties:v.properties})),edges:props.data.edges.map(e=>({id:e.id,source:e.source,target:e.target,properties:e.properties}))}));return Reflect.construct(Target,args,newTarget);}});}});
  });
  await page.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());
   if(request.method()!=='GET'){writes.push(request.method()+' '+url.pathname);return route.abort();}
   if(url.origin!=='http://127.0.0.1:8706'){external.push(url.origin);return route.abort();}
   if(process.argv.includes('--local')&&(url.pathname==='/'||['/assets/','/oracle-graph/','/vendor/oracle-graph/'].some(prefix=>url.pathname.startsWith(prefix)))){
    const file=path.join(__dirname,'../frontend/dist',url.pathname==='/'?'index.html':url.pathname);
    return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':file.endsWith('.woff')?'font/woff':'text/html'});
   }return route.continue();
  });
  await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Case Relationships/}).click();await page.locator('.case-graph__node-list button').filter({hasText:'CASE-2026-0317'}).click();await page.locator('.case-graph__metrics').waitFor();await page.getByLabel('Case graph view').selectOption('oracle');
  const layout=page.getByLabel('Oracle graph layout'),frame=page.frameLocator('iframe.oracle-case__frame');
  const probe=()=>page.evaluate(()=>document.querySelector('iframe.oracle-case__frame').contentWindow.__layoutProbe);
  const ready=async(type,count,cluster=false)=>{
   await page.waitForFunction(({type,count,cluster})=>{const frame=document.querySelector('iframe.oracle-case__frame'),p=frame?.contentWindow?.__layoutProbe;if(!p||p.layout.type!==type||Boolean(p.layout.clusterEnabled)!==cluster||p.vertices.length!==count)return false;const vertices=[...frame.contentDocument.querySelectorAll('g.vertex')].filter(v=>!v.closest('.gvt-preview'));return vertices.length===count&&vertices.every(v=>{if(v.getAttribute('transform')?.includes('NaN'))return false;let opacity=1;for(let e=v.firstElementChild||v;e;e=e.parentElement)opacity*=Number(frame.contentWindow.getComputedStyle(e).opacity);return opacity>.95;});},{type,count,cluster});
   await page.locator('.oracle-case[data-ready="true"]').waitFor();
  };
  const network=await (await page.request.get('http://127.0.0.1:8706/api/graph/network?caseRef=CASE-2026-0317&depth=3',{headers:{'X-Demo-User':'statewide_admin'}})).json();
  await ready('hierarchical',network.nodes.length);assert.equal(await layout.inputValue(),'hierarchical');assert.deepEqual(await layout.locator('option').evaluateAll(options=>options.map(o=>o.value)),['hierarchical','force','radial']);
  const original=await probe();await layout.selectOption('radial');await ready('radial',network.nodes.length);const radial=await probe();assert.deepEqual(radial.vertices,original.vertices);assert.deepEqual(radial.edges,original.edges);
  const radialNode=frame.locator('g.vertex').filter({hasText:'ACI-2026-07569'});
  await radialNode.scrollIntoViewIfNeeded();
  // Wait for the SDK's animated fit-to-screen transform before pointer events.
  await page.waitForFunction(()=>{const node=document.querySelector('iframe.oracle-case__frame').contentDocument.querySelector('[aria-label="Vertex ACI-2026-07569"]');if(!node)return false;const r=node.getBoundingClientRect(),key=[r.x,r.y,r.width,r.height].map(n=>n.toFixed(2)).join(','),old=window.__settledRadialNode;if(old?.key!==key){window.__settledRadialNode={key,since:performance.now()};return false;}return performance.now()-old.since>350;});
  await radialNode.locator('text').dblclick({delay:150});await page.getByRole('dialog').waitFor();await page.getByLabel('Close detail dialog').click();
  await page.getByRole('button',{name:'Reset exploration',exact:true}).click();await ready('radial',network.nodes.length);
  await page.locator('iframe.oracle-case__frame').scrollIntoViewIfNeeded();await page.mouse.move(300,100);await page.screenshot({path:'/tmp/crimedata-oracle-radial.png'});
  await page.getByRole('button',{name:'Add similarity links',exact:true}).click();await ready('radial',network.nodes.length);assert.equal(await layout.inputValue(),'radial');assert.equal((await probe()).edges.length,network.edges.length);
  await page.getByRole('button',{name:'Highlight connecting groups',exact:true}).click();await ready('radial',12);assert.equal(await layout.inputValue(),'radial');assert.equal(await layout.locator('option[value="clustered"]').count(),1);
  const focusBefore=await probe();await layout.selectOption('clustered');await ready('force',12,true);
  const clustered=await probe(),analysis=caseConnectingLinks(network);
  assert.equal(clustered.layout.clusterOptions.clusterBy,'comparison_group');assert.equal(clustered.layout.clusterOptions.hideUnclusteredVertices,false);
  assert.deepEqual(clustered.edges,focusBefore.edges);assert.deepEqual(clustered.vertices.map(v=>v.id),focusBefore.vertices.map(v=>v.id));
  for(const v of clustered.vertices){const n=analysis.network.nodes.find(n=>n.id===v.id);assert.equal(v.properties.comparison_group,`Group ${n.connectionGroup}`);assert.deepEqual(v.labels,[`Group ${n.connectionGroup}`]);}
  assert.equal(new Set(clustered.vertices.map(v=>v.properties.comparison_group)).size,5);
  await page.getByText('5 computed incident groups',{exact:false}).waitFor();
  const connector=frame.locator('g.edge:not(.gvt-preview g.edge)').filter({hasText:'Connecting comparison'}).first();await connector.locator('text').first().click();await page.getByRole('article',{name:'Recorded link explanation'}).waitFor();
  await page.getByRole('button',{name:'Close explanation',exact:true}).click();await page.getByRole('button',{name:'Reset exploration',exact:true}).click();await ready('force',12,true);await page.locator('iframe.oracle-case__frame').scrollIntoViewIfNeeded();await page.mouse.move(300,100);await page.screenshot({path:'/tmp/crimedata-oracle-clustered.png'});
  // Native legend filtering remains local; Reset exploration restores all nodes.
  const legend=frame.getByText('Group 1',{exact:true}).locator('xpath=../../..');await legend.getByRole('checkbox').click();
  await page.waitForFunction(()=>[...document.querySelector('iframe.oracle-case__frame').contentDocument.querySelectorAll('g.vertex')].filter(v=>!v.closest('.gvt-preview')).length===9);
  await page.getByRole('button',{name:'Reset exploration',exact:true}).click();await ready('force',12,true);
  await page.getByText('Advanced controls',{exact:true}).click();const threshold=page.getByLabel('Incident grouping threshold');await threshold.focus();await page.keyboard.press('Home');
  await page.waitForFunction(()=>new Set(document.querySelector('iframe.oracle-case__frame').contentWindow.__layoutProbe.vertices.map(v=>v.properties.comparison_group)).size===1);await ready('force',12,true);assert.equal(await layout.inputValue(),'clustered');
  await threshold.focus();await page.keyboard.press('End');await page.waitForFunction(()=>new Set(document.querySelector('iframe.oracle-case__frame').contentWindow.__layoutProbe.vertices.map(v=>v.properties.comparison_group)).size===12);await ready('force',12,true);
  await page.getByRole('button',{name:'Back to original',exact:true}).click();await ready('force',network.nodes.length);assert.equal(await layout.inputValue(),'force');assert.equal(await layout.locator('option[value="clustered"]').count(),0);assert.equal((await probe()).vertices.some(v=>v.properties.comparison_group),false);
  await page.locator('.case-graph__node-list button').filter({hasText:'CASE-2026-0421'}).click();await ready('hierarchical',28);assert.equal(await layout.inputValue(),'hierarchical');await layout.selectOption('radial');await ready('radial',28);
  await page.getByRole('button',{name:'Highlight connecting groups',exact:true}).click();await ready('radial',8);await layout.selectOption('clustered');await ready('force',8,true);assert.equal(new Set((await probe()).vertices.map(v=>v.properties.comparison_group)).size,3);
  for(const width of [760,600,390]){await page.setViewportSize({width,height:1000});const size=await page.locator('.oracle-case').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert(size.scroll<=size.client+2,JSON.stringify({width,...size}));}
  await page.locator('iframe.oracle-case__frame').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/crimedata-oracle-layouts-mobile.png'});
  // Small disconnected and empty results are browser-only fixtures.
  let empty=false;
  await page.route('**/api/graph/cases',route=>route.fulfill({json:[{CASE_REF:'Fixture',PATTERN_LABEL:'Disconnected layout fixture',INCIDENT_COUNT:2}]}));
  await page.route('**/api/graph/network?**',route=>route.fulfill({json:{center:{CASE_REF:'Fixture',PATTERN_LABEL:'Disconnected layout fixture'},nodes:empty?[]:[{id:'one',label:'One',type:'incident',detail:'Synthetic'},{id:'two',label:'Two',type:'incident',detail:'Synthetic'}],edges:[]}}));
  await page.getByLabel('Demo user').selectOption('read_only_viewer');await ready('hierarchical',2);await layout.selectOption('radial');await ready('radial',2);await page.getByRole('button',{name:'Highlight connecting groups',exact:true}).click();await ready('radial',2);assert.equal(await layout.locator('option[value="clustered"]').count(),0);assert.equal(new Set((await probe()).vertices.map(v=>v.properties.comparison_group)).size,2);
  empty=true;await page.getByRole('button',{name:'Original network',exact:true}).click();await ready('force',0);await layout.selectOption('force');await ready('force',0);await layout.selectOption('radial');await ready('force',0);assert.equal(await layout.locator('option[value="clustered"]').count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(external,[]);
  console.log(JSON.stringify({mode:process.argv.includes('--local')?'preview':'live',nativeRadial:'passed',nativeClusteredForce:'passed',groupsFromCurrentThreshold:[5,1,12,3],recordsAndEdges:'preserved',defaultAndLayerFallback:'passed',scopeResetAndDisconnectedResults:'passed',legendDetailsAndReset:'passed',widths:[760,600,390],errors,writes,external}));
 }catch(error){const page=browser.contexts()[0]?.pages()[0];if(page){console.log(await page.evaluate(()=>{const f=document.querySelector('iframe.oracle-case__frame'),p=f?.contentWindow?.__layoutProbe,vertices=[...(f?.contentDocument?.querySelectorAll('g.vertex')||[])].filter(v=>!v.closest('.gvt-preview'));return {probeLayout:p?.layout,probeNodes:p?.vertices.length,drawnNodes:vertices.length,invalid:vertices.filter(v=>v.getAttribute('transform')?.includes('NaN')).map(v=>v.textContent)};}));await page.screenshot({path:'/tmp/crimedata-oracle-layouts-failure.png'});}throw error;}
 finally{for(const context of browser.contexts())for(const page of context.pages())await page.unrouteAll({behavior:'wait'});await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
