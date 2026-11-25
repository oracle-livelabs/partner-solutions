'use strict';
// One native Select AI query and its normal application audit entry.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1500, height: 1100}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8706/', {waitUntil: 'networkidle'});
    await page.getByRole('button', {name: /Ask IncidentData/}).click();
    await page.getByRole('button', {name: 'Ask IncidentData V2 ↗', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Ask IncidentData V2 Data Assistant'});
    const question = 'show me the last 5 incidents in norwood, including report summary and narrative';
    await dialog.getByPlaceholder('Ask a factual question across authorised crime data…').fill(question);
    const pendingResponse = page.waitForResponse(response => response.url().endsWith('/api/ask-v2') && response.request().method() === 'POST', {timeout: 180000});
    await dialog.getByRole('button', {name: 'Ask IncidentData V2', exact: true}).click();
    const response = await pendingResponse;
    const body = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(body));
    assert.equal(body.question, question);
    assert.equal(body.rowCount, 5);
    assert.equal(body.rows.length, 5);
    assert.match(body.generatedSql, /norwood/i);
    assert.match(body.generatedSql, /ORDER BY[\s\S]*OCCURRED_AT[\s\S]*DESC/i);
    const narrativeColumn = body.columns.find(column => /narrative|report_?text/i.test(column));
    const summaryColumn = body.columns.find(column => /summary/i.test(column));
    assert(narrativeColumn, 'Response must contain a narrative column');
    assert(summaryColumn, 'Response must contain a summary column');
    for (const row of body.rows) {
      assert.equal(typeof row[narrativeColumn], 'string');
      assert(row[narrativeColumn].length > 100);
      assert.equal(typeof row[summaryColumn], 'string');
    }
    await dialog.locator('.ask-message__table tbody tr').nth(4).waitFor();
    assert.equal(await dialog.locator('.ask-message__table tbody tr').count(), 5);
    assert.equal(await dialog.locator('.pattern-error').count(), 0);
    for (const row of body.rows) assert((await dialog.locator('.ask-message__table').innerText()).includes(row[narrativeColumn]));
    assert.deepEqual(errors, []);
    await dialog.screenshot({path: '/tmp/crimedata-ask-v2-norwood-fixed.png'});
    console.log(JSON.stringify({status: response.status(), question, rows: body.rowCount, columns: body.columns, narrativeLengths: body.rows.map(row => row[narrativeColumn].length), elapsedMs: body.elapsed, browserErrors: errors}));
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
