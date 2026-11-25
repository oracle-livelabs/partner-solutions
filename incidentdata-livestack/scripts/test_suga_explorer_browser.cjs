const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const batchId='DR-20260914-13f650e8-dfa8-450e';
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 if(process.argv.includes('--local'))await page.route('http://127.0.0.1:8706/**',async route=>{const pathname=new URL(route.request().url()).pathname;if(pathname!=='/'&&!pathname.startsWith('/assets/'))return route.continue();const file=path.join(__dirname,'../frontend/dist',pathname==='/'?'index.html':pathname);await route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});});
 await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});await page.getByRole('button',{name:/Data Room/}).click();
 const row=page.locator('.cdr-history tbody tr').filter({hasText:batchId});await row.waitFor();if(await row.getByRole('button',{name:'Open',exact:true}).count())await row.getByRole('button',{name:'Open',exact:true}).click();
 const money=page.getByRole('button',{name:'Explore Money Flows',exact:true}),messages=page.getByRole('button',{name:'Explore Messages',exact:true});await money.waitFor();await messages.waitFor();
 assert.match(await money.innerText(),/10 transactions · 8 accounts/);assert.match(await messages.innerText(),/2 conversations · 28 messages/);
 assert.equal(await page.locator('.cdr-money,.cdr-messages').count(),0);assert(!requests.some(r=>/\/(money-flows|messages)(\?|$)/.test(r.url)),'Closed tools must not fetch graphs');assert(!requests.some(r=>r.method==='POST'),'Discovery must not start any work');
 await page.locator('.cdr-explore').screenshot({path:'/tmp/crimedata-suga-explorer-tiles.png'});
 await money.scrollIntoViewIfNeeded();await money.focus();const scrollBefore=await page.evaluate(()=>window.scrollY);await page.keyboard.press('Enter');const dialog=page.getByRole('dialog');await dialog.waitFor();await page.locator('.cdr-money-node').nth(7).waitFor();
 assert(await dialog.evaluate(el=>el.contains(document.activeElement)));assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 const find=page.locator('.cdr-money').getByRole('searchbox');await find.fill('Hartley');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await money.evaluate(el=>el===document.activeElement));assert(Math.abs(await page.evaluate(()=>window.scrollY)-scrollBefore)<4);
 await money.click();assert.equal(await find.inputValue(),'Hartley');await find.fill('');await page.locator('.cdr-cap-dialog').screenshot({path:'/tmp/crimedata-suga-explorer-money.png'});
 const tabs=page.getByRole('navigation',{name:'Batch exploration tools'});await tabs.getByRole('button',{name:'Messages',exact:true}).click();await page.locator('.cdr-message').nth(11).waitFor();
 await page.locator('.cdr-msg-thread').filter({hasText:'SUGA-CHAT-002'}).click();await page.locator('.cdr-message').nth(15).waitFor();const search=page.getByRole('searchbox',{name:'Search conversation messages'});await search.fill('agreed');await page.locator('.cdr-msg-match-bar').waitFor();
 await page.getByRole('button',{name:'Close workspace',exact:true}).click();await messages.click();assert.equal(await search.inputValue(),'agreed');assert.match(await page.locator('.cdr-msg-reader h4').innerText(),/SUGA-CHAT-002/);
 for(let n=0;n<30;n++){await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)),'Keyboard focus escaped the modal');}
 for(const width of [760,600,390]){await page.setViewportSize({width,height:900});const size=await page.locator('.cdr-cap-dialog-body').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(size.scroll<=size.client+2,JSON.stringify({width,...size}));}
 await page.locator('.cdr-cap-dialog').screenshot({path:'/tmp/crimedata-suga-explorer-mobile.png'});
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.body.style.overflow),'');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({tiles:'SUGA 8 accounts / 10 transactions; 2 conversations / 28 messages',lazyLoading:'passed',noAutomaticAnalysis:'passed',focusTrap:'passed',escapeAndFocusReturn:'passed',pagePosition:'passed',moneyFilters:'retained',conversationAndSearch:'retained',widths:[760,600,390],browserErrors:errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
