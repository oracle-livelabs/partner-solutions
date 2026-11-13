'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1050}});page.setDefaultTimeout(45000);
  const errors=[],blocked=[];page.on('pageerror',e=>errors.push(e.message));
  const allowed=new Set(['/api/watched-patterns/semantic-search','/api/patterns/semantic-search','/api/patterns/result-relationships']);
  await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!=='http://127.0.0.1:8706')return route.abort();if(r.method()!=='GET'&&!allowed.has(u.pathname)){blocked.push(u.pathname);return route.abort();}return route.continue();});
  await page.goto('http://127.0.0.1:8706/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Incident Pattern Signals/}).click();
  const query='Payments for an exhibition have inconsistent invoices, changed bank instructions and missing supporting documents.';
  await page.getByRole('textbox',{name:'Find watched patterns'}).fill(query);
  const watchResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/watched-patterns/semantic-search');
  await page.getByRole('button',{name:'Find watched patterns',exact:true}).click();
  const watches=await(await watchResponse).json();assert.equal(watches.results[0].PATTERN_CODE,'ART_MARKET_PAYMENTS');
  await page.locator('.pattern-catalog-results button').filter({hasText:'Payment-Document Anomaly Chain'}).click();
  await page.getByRole('textbox',{name:'Search incident reports'}).fill(query);
  const reportResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/patterns/semantic-search');
  await page.getByRole('button',{name:'Search incident reports',exact:true}).click();
  const reports=await(await reportResponse).json();assert.equal(reports.coverage.embedded,21532);assert(reports.results.length>0);
  await page.locator('.incident-semantic-results article').first().waitFor();
  const graphResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/patterns/result-relationships');
  await page.getByRole('button',{name:'Explore result relationships',exact:true}).click();
  const graph=await(await graphResponse).json();assert(graph.edges.some(e=>e.type==='similarity'));assert(graph.edges.some(e=>e.type==='membership'));assert(graph.edges.some(e=>e.type==='reviewed'));
  await page.locator('.result-graph__canvas svg').waitFor();
  const out=path.join(__dirname,'../signal_vector_diagnosis_20261013');
  await page.screenshot({path:path.join(out,'signals_repaired_desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:900});await page.screenshot({path:path.join(out,'signals_repaired_mobile.png'),fullPage:true});
  // Simulate a missing-coverage response without changing any database table.
  await page.route('**/api/watched-patterns/semantic-search',route=>route.fulfill({status:503,json:{error:'Watched-pattern search is unavailable: the visible watches have no compatible saved vectors. The watch cards and recorded relationships remain available.'}}));
  await page.getByRole('button',{name:'Find watched patterns',exact:true}).click();
  await page.getByText(/Watched-pattern search is unavailable: the visible watches/).waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  const receipt={passed:true,liveQuery:query,watchTopResult:watches.results[0].PATTERN_CODE,reportCoverage:reports.coverage,reportMatches:reports.results.length,graphEdgeTypes:[...new Set(graph.edges.map(e=>e.type))],missingCoverageMessage:true,mobile:true,errors,blocked};
  fs.writeFileSync(path.join(out,'browser_validation.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
