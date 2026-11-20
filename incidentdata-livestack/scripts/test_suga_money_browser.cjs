const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const batchId='DR-20260914-13f650e8-dfa8-450e';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.argv.includes('--local'))await page.route('http://127.0.0.1:8706/**',async route=>{const pathname=new URL(route.request().url()).pathname;if(pathname!=='/'&&!pathname.startsWith('/assets/'))return route.continue();const file=path.join(__dirname,'../frontend/dist',pathname==='/'?'index.html':pathname);await route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/Data Room/}).click();
  const row=page.locator('.cdr-history tbody tr').filter({hasText:batchId});await row.waitFor();
  if(await row.getByRole('button',{name:'Open',exact:true}).count())await row.getByRole('button',{name:'Open',exact:true}).click();
  await page.getByRole('button',{name:'Explore Money Flows',exact:true}).click();
  const panel=page.locator('.cdr-money');await panel.locator('.cdr-money-node').first().waitFor();
  assert.equal(await panel.locator('.cdr-money-node').count(),8);assert.equal(await panel.locator('.cdr-money-edge').count(),10);
  assert.match(await panel.locator('.cdr-money-stats').innerText(),/1,500,000\.00/);assert.match(await panel.locator('.cdr-money-stats').innerText(),/4,500,000\.00/);
  assert.equal(await panel.locator('.cdr-money-ledger tbody tr').count(),10);
  const canvasSizes=await panel.locator('.cdr-money-canvas').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(canvasSizes.scroll<=canvasSizes.client+2,'Desktop graph should fit without clipping the destination account.');
  // An arrow narrows the ledger, preserving source-row access.
  await panel.locator('.cdr-money-edge').filter({hasText:'450,000'}).first().click();
  assert.equal(await panel.locator('.cdr-money-ledger tbody tr').count(),1);
  await panel.getByRole('button',{name:'Record 1',exact:true}).click();
  const source=panel.getByRole('region',{name:'Original transaction record'});assert.match(await source.innerText(),/SUGA-TX-001/);assert.match(await source.innerText(),/SYN-AUD-001/);
  const downloadEvent=page.waitForEvent('download');await source.getByRole('button',{name:'Download original CSV'}).click();const file=await downloadEvent;assert.equal(file.suggestedFilename(),'transactions.csv');
  await source.getByRole('button',{name:'Open source file details'}).click();await page.locator('.cdr-cap-source').waitFor();assert.match(await page.locator('.cdr-cap-source').innerText(),/transactions.csv/);
  await page.getByRole('button',{name:'Back to Money Flows',exact:true}).click();
  await panel.getByRole('button',{name:'Close record',exact:true}).click();await panel.getByRole('button',{name:'Show all accounts / transfers'}).click();
  const hartley=panel.locator('.cdr-money-node').filter({hasText:'Hartley'});await hartley.focus();await page.keyboard.press('Enter');assert.equal(await panel.locator('.cdr-money-ledger tbody tr').count(),2);await panel.getByRole('button',{name:'Show all accounts / transfers'}).click();
  await panel.getByRole('button',{name:'Find routes',exact:true}).click();await panel.getByText('4 routes found · up to 4 hops.').waitFor();
  await panel.getByRole('button',{name:'Route 1 · 3 hops',exact:true}).click();assert.equal(await panel.locator('.cdr-money-route-steps li').count(),3);assert.equal(await panel.locator('.cdr-money-ledger tbody tr').count(),3);assert.equal(await panel.locator('.cdr-money-edge:not(.is-dim)').count(),3);
  await panel.getByRole('button',{name:'Clear route',exact:true}).click();
  await panel.getByLabel('Maximum route hops').selectOption('2');await panel.getByRole('button',{name:'Find routes',exact:true}).click();await panel.getByText('0 routes found · up to 2 hops.').waitFor();
  await panel.getByLabel('Maximum route hops').selectOption('4');
  await panel.getByLabel('Money flow from date').fill('2026-09-14');await panel.getByText('8 accounts · 10 transfers').waitFor({state:'hidden'});await panel.getByText('3 accounts · 2 transfers').waitFor();assert.equal(await panel.locator('.cdr-money-edge').count(),2);
  await panel.getByRole('button',{name:'Clear filters',exact:true}).click();await panel.getByText('8 accounts · 10 transfers').waitFor();
  // An invalid date range must leave controls available for recovery.
  await panel.getByLabel('Money flow to date').fill('2026-09-10');await panel.getByText('No transfers in the selected date/currency window.').waitFor();await panel.getByLabel('Money flow from date').fill('2026-09-14');await panel.getByRole('alert').filter({hasText:'start date'}).waitFor();await panel.getByRole('button',{name:'Clear filters',exact:true}).click();await panel.getByText('8 accounts · 10 transfers').waitFor();
  await panel.getByRole('searchbox').fill('Hartley');assert.equal(await panel.locator('.cdr-money-ledger tbody tr').count(),2);await panel.getByRole('searchbox').fill('');
  await panel.getByLabel('Highlight pattern').selectOption('split');assert.equal(await panel.locator('.cdr-money-node.is-pattern').count(),1);await panel.getByLabel('Highlight pattern').selectOption('convergence');assert.equal(await panel.locator('.cdr-money-node.is-pattern').count(),3);await panel.getByLabel('Highlight pattern').selectOption('all');
  await panel.locator('.cdr-money-canvas').screenshot({path:'/tmp/crimedata-suga-money-graph.png'});
  await panel.screenshot({path:'/tmp/crimedata-suga-money-desktop.png'});
  for(const width of [760,600]){await page.setViewportSize({width,height:1000});const sizes=await page.locator('.cdr-cap-dialog-body').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(sizes.scroll<=sizes.client+2,JSON.stringify({width,...sizes}));}
  await panel.screenshot({path:'/tmp/crimedata-suga-money-narrow.png'});
  await page.setViewportSize({width:1500,height:1100});
  const build=page.waitForResponse(r=>r.url().endsWith(`/batches/${batchId}/money-flows`)&&r.request().method()==='POST');await panel.getByRole('button',{name:'Verify / rebuild money flows'}).click();assert.equal((await (await build).json()).reused,true);await panel.getByText('8 accounts · 10 transfers').waitFor();
  // Persistence and no duplicate account/transfer render after reload.
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/Data Room/}).click();await page.getByRole('button',{name:'Explore Money Flows',exact:true}).click();await page.locator('.cdr-money-node').first().waitFor();assert.equal(await page.locator('.cdr-money-node').count(),8);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({accounts:8,transfers:10,routeHighlight:3,routes:4,sourceRow:'passed',originalDownload:'passed',sourceDetails:'passed',dateFilter:'passed',search:'passed',patterns:'passed',idempotentRebuild:'passed',persistence:'passed',widths:[760,600],browserErrors:errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
