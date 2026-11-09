'use strict';
// End-to-end: three guided requests and one Ask IncidentData V2 request, with normal audit entries.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({baseURL:'http://127.0.0.1:8706/',viewport:{width:1500,height:1100}}), errors = [], requests = [];
    page.on('pageerror',error=>errors.push(error.stack || error.message));
    page.on('request',request=>requests.push({url:request.url(),method:request.method()}));
    await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});
    await page.getByLabel('Demo user').selectOption('read_only_viewer');
    await page.getByRole('button',{name:/IncidentData AI Agent Console/}).click();
    const main = page.locator('.crime-agent-console__chat').first();
    async function guided(question) {
      await main.locator('footer input').fill(question);
      const pending = page.waitForResponse(response=>response.url().endsWith('/api/agents/run') && response.request().method()==='POST');
      await main.getByRole('button',{name:'Run agent',exact:true}).click();
      const response = await pending, body = await response.json();
      assert.equal(response.status(),200,JSON.stringify(body)); assert.equal(body.historySaved,true,JSON.stringify(body));
      await main.getByRole('button',{name:'Run agent',exact:true}).waitFor();
      return body;
    }
    const first = await guided('What is the authorised incident status mix?');
    const second = await guided('Which categories have the most authorised incident reports?');
    assert.equal(first.historyThreadId,second.historyThreadId);
    const saved = await page.request.get(`/api/agents/actions/${second.auditActionId}/thread`,{headers:{'X-Demo-User':'read_only_viewer'}});
    assert.equal(saved.status(),200); const thread = await saved.json();
    assert.equal(thread.total,2); assert.equal(thread.turns[0].response.answer,first.answer); assert.deepEqual(thread.turns[1].response.rows,second.rows);
    const other = await page.request.get(`/api/agents/actions/${second.auditActionId}/thread`,{headers:{'X-Demo-User':'statewide_admin'}});
    assert.equal(other.status(),404);
    const refresh = page.getByRole('button',{name:'Refresh audit history'});
    await refresh.waitFor(); await page.waitForFunction(()=>!document.querySelector('[aria-label="Refresh audit history"]').disabled);
    const refreshed = page.waitForResponse(response=>response.url().endsWith('/api/agents/actions'));
    await refresh.click(); await refreshed;
    const open = page.getByRole('button',{name:`View saved conversation: ${second.title}`,exact:true}).first();
    await open.waitFor(); const readsStart = requests.length; await open.click();
    const dialog = page.getByRole('dialog',{name:'Saved conversation',exact:true});
    await dialog.getByText(first.question,{exact:true}).waitFor(); await dialog.getByText(second.question,{exact:true}).waitFor();
    assert.equal(await dialog.locator('.agent-history-exchange').count(),2);
    assert(!requests.slice(readsStart).some(request=>request.method!=='GET'));
    await dialog.screenshot({path:'/tmp/crimedata-agent-history-live.png'});
    await dialog.getByRole('button',{name:'Close history'}).click();
    await main.getByRole('button',{name:'Clear',exact:true}).click();
    const third = await guided('Which patrol areas and suburbs are in my authorised data scope?');
    assert.notEqual(third.historyThreadId,first.historyThreadId);
    await page.getByLabel('Demo user').selectOption('statewide_admin');
    await page.getByRole('button',{name:/Ask IncidentData/}).click();
    await page.getByRole('button',{name:'Ask IncidentData V2 ↗',exact:true}).click();
    const ask = page.getByRole('dialog',{name:'Ask IncidentData V2 Data Assistant'}), question = 'show me the last 5 incidents in norwood, including report summary and narrative';
    await ask.getByPlaceholder('Ask a factual question across authorised crime data…').fill(question);
    const pendingAsk = page.waitForResponse(response=>response.url().endsWith('/api/ask-v2') && response.request().method()==='POST',{timeout:180000});
    await ask.getByRole('button',{name:'Ask IncidentData V2',exact:true}).click();
    const askResponse = await pendingAsk, result = await askResponse.json();
    assert.equal(askResponse.status(),200,JSON.stringify(result)); assert.equal(result.historySaved,true); assert.equal(result.rowCount,5);
    const askHistory = await page.request.get(`/api/agents/actions/${result.auditActionId}/thread`,{headers:{'X-Demo-User':'statewide_admin'}});
    const storedAsk = await askHistory.json(); assert.deepEqual(storedAsk.turns[0].response.rows,result.rows);
    assert.equal(storedAsk.turns[0].response.generatedSql,result.generatedSql);
    await ask.getByRole('button',{name:'Close Ask IncidentData V2'}).click();
    await page.getByRole('button',{name:/IncidentData AI Agent Console/}).click();
    await page.getByRole('button',{name:`View saved conversation: ${question}`,exact:true}).first().click();
    await dialog.locator('.agent-history-question').getByText(question,{exact:true}).waitFor();
    assert.match(await dialog.innerText(),/Oracle returned 5 authorised rows/);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({guidedAuditIds:[first.auditActionId,second.auditActionId,third.auditActionId],savedGuidedThread:2,clearStartsNewThread:true,ownerIsolation:true,openHistoryIsReadOnly:true,askCrimeV2AuditId:result.auditActionId,norwoodRows:5,savedRowsMatch:true,browserErrors:errors}));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
