'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8706',dir=path.resolve(__dirname,'../stage6_oracle_graph_20261019'),live=process.argv.includes('--live'),id='DR-20261018-6363d783-dacc-4f81';
(async()=>{
 const browser=await chromium.launch({headless:true});const errors=[],writes=[],queries=[];
 try{
 const page=await browser.newPage({viewport:{width:1450,height:1100}});page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin!==base)return route.abort();if(req.method()!=='GET'){writes.push(u.pathname);return route.abort();}
  if(!live&&(u.pathname==='/'||u.pathname.startsWith('/assets/'))){const f=path.join(dir,'image/frontend/dist',u.pathname==='/'?'index.html':u.pathname);return route.fulfill({body:await fs.readFile(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});}
  if(u.pathname.endsWith('/connections/graph')){queries.push(u.searchParams.get('runId'));if(!live)return route.fulfill({json:JSON.parse(await fs.readFile(path.join(dir,'native-dublin.json'),'utf8'))});}
  return route.continue();
 });
 await page.goto(base,{waitUntil:'networkidle'});await page.locator('aside nav').getByRole('button',{name:/Data Room/}).click();await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor({timeout:60000});
 if(!(await page.locator('.dr2-summary > .dr2-heading code').textContent()).includes(id)){await page.getByRole('button',{name:'Open existing batch',exact:true}).click();await page.locator('.cdr-history tbody tr').filter({hasText:id}).getByRole('button',{name:'Open',exact:true}).click();}
 await page.getByRole('button',{name:'Brief & Connections',exact:true}).click();const choice=page.getByLabel('Connection view',{exact:true});await choice.waitFor();await page.getByRole('img',{name:'Batch source connection graph'}).waitFor();
 await choice.selectOption('oracle');const region=page.getByRole('region',{name:'Oracle Graph Visualizer',exact:true}),frame=page.frameLocator('iframe[title="Oracle Stage 6 graph canvas"]');
 const waitEdges=expected=>page.waitForFunction(n=>document.querySelector('iframe[title="Oracle Stage 6 graph canvas"]')?.contentDocument?.querySelectorAll('g.edge:not(.gvt-preview g.edge)').length===n,expected);
 const vertices=frame.locator('g.vertex:not(.legend-active)'),edges=frame.locator('g.edge:not(.gvt-preview g.edge)');
 await region.locator('iframe').waitFor();await region.locator('[role="status"]').waitFor({state:'hidden'});await vertices.nth(15).waitFor();assert.equal(await vertices.count(),16);assert.equal(await edges.count(),30);
 await page.getByText('Oracle graph model & SQL',{exact:true}).click();await page.getByText('SECURE_CDR_CONN_NODES_V',{exact:true}).waitFor();await page.getByText('SECURE_CDR_CONN_EDGES_V',{exact:true}).waitFor();
 for(const layout of ['hierarchical','radial','force']){await page.getByLabel('Oracle connection layout').selectOption(layout);await region.locator('[role="status"]').waitFor({state:'hidden'});await vertices.nth(15).waitFor();assert.equal(await edges.count(),30);}
 await page.getByLabel('Oracle connection link type').selectOption('literal_reference');await region.locator('[role="status"]').waitFor({state:'hidden'});await edges.nth(11).waitFor();assert.equal(await edges.count(),12);
 await page.getByLabel('Oracle connection focus').selectOption({label:'DEMO-DUB-LL-208'});await region.locator('[role="status"]').waitFor({state:'hidden'});await waitEdges(8);assert.equal(await edges.count(),8);
 await page.getByLabel('Oracle connection focus').selectOption('');await page.getByLabel('Oracle connection link type').selectOption('all');await waitEdges(30);await vertices.nth(15).waitFor();
 await edges.first().locator('text').first().click();await region.getByRole('region',{name:'Selected Oracle graph record'}).waitFor();
 await page.getByText('Accessible nodes and connections',{exact:true}).click();const lists=region.locator('.stage6-oracle-lists');await lists.locator('section').nth(1).getByRole('button').first().click();await region.getByRole('region',{name:'Selected Oracle graph record'}).waitFor();
 const snapshot=JSON.parse(await fs.readFile(path.join(dir,'native-dublin.json'),'utf8'));const item=snapshot.graph.nodes.find(n=>n.kind==='item');await lists.locator('section').first().getByRole('button',{name:item.label,exact:true}).click();await region.getByRole('button',{name:'Inspect saved source description',exact:true}).click();await page.locator('[aria-label="Files workspace"] .cdr-preview').waitFor();
 await page.getByRole('button',{name:'Brief & Connections',exact:true}).click();await choice.selectOption('saved');await page.getByRole('img',{name:'Batch source connection graph'}).waitFor();assert.equal(await page.locator('iframe[title="Oracle Stage 6 graph canvas"]').count(),0);
 await choice.selectOption('oracle');await region.locator('[role="status"]').waitFor({state:'hidden'});await vertices.nth(15).waitFor();await region.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,live?'live-oracle.png':'preview-oracle.png')});
 await page.setViewportSize({width:390,height:844});await region.scrollIntoViewIfNeeded();const dims=await region.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert(dims.scroll<=dims.width+2,JSON.stringify(dims));await page.screenshot({path:path.join(dir,live?'live-mobile.png':'preview-mobile.png')});
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert(queries.every(r=>r==='ba476f70-a634-466b-a7cd-97df1c59d355'));
 const receipt={live,vertices:16,edges:30,officialOracleLibrary:true,layouts:['force','hierarchical','radial'],linkTypeAndFocusFilters:true,sourceInspection:true,viewSwitching:true,mobileFits:true,noModelCalls:true,noWrites:true,queries,errors};await fs.writeFile(path.join(dir,live?'live-browser.json':'preview-browser.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
