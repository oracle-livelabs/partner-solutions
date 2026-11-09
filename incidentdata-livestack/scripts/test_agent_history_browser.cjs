'use strict';
// Read-only UI fixtures; no database writes or AI requests. --local serves the new build.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1500,height:1100}}), errors = [], requests = [];
    page.on('pageerror',error=>errors.push(error.stack || error.message)); page.on('request',request=>requests.push({url:request.url(),method:request.method()}));
    let failNext = false;
    await page.route('http://127.0.0.1:8706/**', async route => {
      const url = new URL(route.request().url()), pathname = url.pathname;
      const respond = (body,status=200) => route.fulfill({status,json:body});
      if (route.request().method() !== 'GET') throw Error('History must not make a mutating or AI request');
      if (pathname === '/api/agents/actions') return respond([
        {ACTION_ID:1012,ACTION_TYPE:'agent_query',CREATED_AT:'2026-09-15T05:00:00Z',PAYLOAD:{title:'Saved conversation test'},HISTORY_STATUS:'complete'},
        {ACTION_ID:1,ACTION_TYPE:'select_ai_v2_query',CREATED_AT:'2026-09-14T05:00:00Z',PAYLOAD:{question:'Older Norwood question'},HISTORY_STATUS:'limited'},
      ]);
      if (/\/api\/agents\/actions\/\d+\/thread$/.test(pathname)) {
        if (failNext) {failNext=false; return respond({error:'History test: temporary read failure'},503);}
        if (pathname.includes('/1/')) return respond({selectedActionId:1,total:1,page:1,pages:1,turns:[{actionId:1,actionType:'select_ai_v2_query',createdAt:'2026-09-14T05:00:00Z',question:'Older Norwood question',response:null,status:'limited',details:{generatedSql:'SELECT report_summary FROM secure_incident_reports_v',rowCount:5}}]});
        const requestedPage = Number(url.searchParams.get('page') || 2);
        const turns = Array.from({length:requestedPage === 1 ? 10 : 2},(_,index) => {
          const id = 1001 + (requestedPage-1)*10 + index;
          return {actionId:id,actionType:'agent_query',createdAt:'2026-09-15T05:00:00Z',question:`Saved question ${id}`,status:'complete',
            response:{title:'Saved response',answer:`Original saved answer ${id}. <img src=x onerror=alert(1)>`,sql:'SELECT report_text FROM secure_incident_reports_v',model:'Test model',rows:[{REPORT_TEXT:'Original long narrative. '.repeat(120)}],columns:['REPORT_TEXT']},details:{question:`Saved question ${id}`,team:'SIGNALS_AGENT'}};
        });
        return respond({selectedActionId:1012,total:12,page:requestedPage,pages:2,turns});
      }
      if (process.argv.includes('--local') && (pathname === '/' || pathname.startsWith('/assets/'))) {
        const file = path.join(__dirname,'../frontend/dist',pathname === '/' ? 'index.html' : pathname);
        return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
      }
      return route.continue();
    });
    await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:/IncidentData AI Agent Console/}).click();
    const open = page.getByRole('button',{name:'View saved conversation: Saved conversation test',exact:true});
    await open.waitFor(); assert(!requests.some(request=>request.url.includes('/thread')));
    await open.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog',{name:'Saved conversation',exact:true});
    await dialog.getByText('Saved question 1012',{exact:true}).waitFor();
    assert.match(await dialog.innerText(),/Page 2 of 2/); assert.equal(await dialog.locator('img').count(),0);
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
    for(let i=0;i<25;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(element=>element.contains(document.activeElement)));}
    const selected = dialog.locator('[data-action-id="1012"]');
    await selected.getByText('Saved results · 1 rows',{exact:true}).click();
    assert.match(await selected.locator('table').innerText(),/Original long narrative/);
    await selected.getByText('Saved SQL',{exact:true}).click();
    assert.match(await selected.innerText(),/SELECT report_text/);
    await dialog.getByRole('button',{name:'Earlier exchanges'}).click();
    await dialog.getByText('Saved question 1001',{exact:true}).waitFor(); assert.equal(await dialog.locator('.agent-history-exchange').count(),10);
    await dialog.getByRole('button',{name:'Later exchanges'}).click(); await dialog.getByText('Saved question 1012',{exact:true}).waitFor();
    await dialog.screenshot({path:'/tmp/crimedata-agent-history-desktop.png'});
    for(const width of [600,390]) {await page.setViewportSize({width,height:900});const size=await dialog.locator('.agent-history-body').evaluate(element=>({client:element.clientWidth,scroll:element.scrollWidth}));assert(size.scroll<=size.client+2,JSON.stringify({width,...size}));assert(Number.parseFloat(await dialog.getByRole('button',{name:'Earlier exchanges'}).evaluate(element=>getComputedStyle(element).fontSize))>=12,'Mobile page controls must remain legible');}
    await dialog.screenshot({path:'/tmp/crimedata-agent-history-mobile.png'});
    await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'}); assert(await open.evaluate(element=>element===document.activeElement));
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    await page.getByRole('button',{name:'View saved conversation: Older Norwood question',exact:true}).click();
    await dialog.getByText(/No original assistant response was stored/).waitFor();
    assert.equal(await dialog.locator('.agent-history-answer').count(),0);
    await dialog.getByRole('button',{name:'Close history'}).click();
    failNext=true; await open.click(); await dialog.getByText('History test: temporary read failure',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Retry loading history'}).click(); await dialog.getByText('Saved question 1012',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Close history'}).click();
    assert.deepEqual(errors,[]); assert(!requests.some(request=>request.method!=='GET'));
    console.log(JSON.stringify({savedThread:true,pagination:true,legacyNotice:true,sqlAndResults:true,readFailureRetry:true,escapedContent:true,keyboardAndFocusReturn:true,widths:[600,390],readOnlyRequests:true,browserErrors:errors}));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
