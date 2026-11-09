'use strict';
// --local serves the built UI in this browser only, retaining the live GET APIs.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const pages = [
  ['welcome', 'Welcome'], ['foundation', 'Data Foundation'], ['dashboard', 'Incident Activity Center'],
  ['signals', 'Crime Pattern Signals'], ['persons', 'Person Intelligence'], ['evidence', 'Evidence Intelligence'],
  ['graph', 'Case Relationships'], ['geography', 'Incident Map'], ['incidents', 'Incident Explorer'],
  ['analytics', 'Incident and Capacity Analytics'], ['ask', 'Ask IncidentData'],
  ['agents', 'IncidentData AI Agent Console'], ['data-room', 'Data Room'], ['ai-ops', 'AI Opps']
];
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1600,height:1100}});
    const errors = [], writes = [], requests = [];
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') { writes.push(request.method() + ' ' + url.pathname); return route.abort(); }
      if (url.origin !== 'http://127.0.0.1:8706') return route.abort();
      if (url.pathname.startsWith('/api/')) requests.push(url.pathname);
      if (process.argv.includes('--local') && (url.pathname === '/' || url.pathname.startsWith('/assets/'))) {
        const file = path.join(__dirname, '../frontend/dist', url.pathname === '/' ? 'index.html' : url.pathname);
        return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
      }
      return route.continue();
    });
    const api = async endpoint => {
      const response = await page.request.get('http://127.0.0.1:8706/api/' + endpoint, {headers:{'X-Demo-User':'statewide_admin'}});
      assert(response.ok()); return response.json();
    };
    const before = await api('ai-ops?days=90');
    await page.goto('http://127.0.0.1:8706/', {waitUntil:'networkidle'});
    const panel = page.getByRole('complementary', {name:'Oracle Internals'});
    const toggle = panel.getByRole('button', {name:'Show Oracle Internals',exact:true});
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    const initialRequests = requests.length;
    await toggle.focus(); await page.keyboard.press('Enter');
    await panel.getByRole('heading', {name:'What’s happening',exact:true}).waitFor();
    await page.waitForTimeout(250);
    assert.equal(requests.length, initialRequests, 'Opening explanations must not fetch data');
    const checked = [];
    for (const [id, label] of pages) {
      await page.locator('.nav-item').filter({has:page.locator('.nav-item__label>span', {hasText:new RegExp('^' + label + '$')})}).click();
      await page.waitForFunction(id => document.querySelector('.oi-panel')?.dataset.page === id, id);
      await page.waitForLoadState('networkidle');
      for (const heading of ['What’s happening', 'Why it matters', 'How it works', 'Teaching point'])
        await panel.getByRole('heading', {name:heading,exact:true}).waitFor();
      assert.equal(await panel.locator('.oi-flow li').count(), 3);
      assert(await panel.locator('.oi-badge').count() >= 3);
      assert(await panel.locator('pre code').first().innerText());
      assert(await panel.getByRole('button', {name:/Copy SQL:/}).count() >= 1);
      checked.push(id);
    }
    // Exercise both secure-context clipboard and ordinary HTTP fallback paths.
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:async text => {window.__copiedSql=text;}}}));
    await panel.getByRole('button', {name:/Copy SQL:/}).first().click();
    assert.equal(await page.evaluate(() => window.__copiedSql), await panel.locator('pre code').first().innerText());
    await panel.getByRole('status').filter({hasText:'SQL copied.'}).waitFor();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:async () => {throw Error('HTTP clipboard unavailable');}}}));
    await panel.getByRole('button', {name:/Copy SQL:/}).first().click();
    await panel.getByRole('status').filter({hasText:'SQL selected.'}).waitFor();
    assert.equal(await page.evaluate(() => window.getSelection().toString()), await panel.locator('pre code').first().innerText());
    const resize = panel.getByRole('separator', {name:'Resize Oracle Internals'});
    await resize.focus(); await page.keyboard.press('End'); assert.equal(await resize.getAttribute('aria-valuenow'), '560');
    await page.keyboard.press('Home'); assert.equal(await resize.getAttribute('aria-valuenow'), '300');
    await page.keyboard.press('ArrowLeft'); assert.equal(await resize.getAttribute('aria-valuenow'), '320');
    const handle = await resize.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 20); await page.mouse.down();
    await page.mouse.move(handle.x - 50, handle.y + 20); await page.mouse.up();
    assert(Number(await resize.getAttribute('aria-valuenow')) > 320);
    await page.getByLabel('Demo user').selectOption('read_only_viewer');
    await page.waitForLoadState('networkidle');
    await panel.getByRole('heading', {name:'AI Opps',exact:true}).waitFor();
    await panel.getByRole('button', {name:'Collapse Oracle Internals',exact:true}).click();
    assert.equal(await panel.locator('#oracle-internals-content').isVisible(), false);
    await panel.getByRole('button', {name:'Show Oracle Internals',exact:true}).click();
    await panel.locator('.oi-content').evaluate(element => element.scrollTo(0, 0));
    await page.screenshot({path:'/tmp/crimedata-oracle-internals-desktop.png'});
    for (const width of [850, 600, 390]) {
      await page.setViewportSize({width,height:1000});
      await panel.scrollIntoViewIfNeeded();
      assert(await panel.isVisible());
      const size = await panel.evaluate(element => ({client:element.clientWidth,scroll:element.scrollWidth}));
      assert(size.scroll <= size.client + 2, JSON.stringify({width,...size}));
      await panel.getByRole('button', {name:'Collapse Oracle Internals',exact:true}).click();
      const button = panel.getByRole('button', {name:'Show Oracle Internals',exact:true});
      await button.focus(); await page.keyboard.press('Space');
      assert.equal(await panel.getByRole('button', {name:'Collapse Oracle Internals',exact:true}).getAttribute('aria-expanded'), 'true');
      await panel.getByRole('heading', {name:'How it works',exact:true}).waitFor();
    }
    await panel.locator('.oi-content').evaluate(element => element.scrollTo(0, 0));
    await page.screenshot({path:'/tmp/crimedata-oracle-internals-mobile.png'});
    const after = await api('ai-ops?days=90');
    // Person Intelligence already records its GET-only stored-vector comparison
    // as a workflow outcome. Distinguish that existing page behaviour from new
    // model work; opening the panel itself was separately checked for zero HTTP.
    for (const key of ['llm_calls','native_invocations','embedding_calls','reported_tokens'])
      assert.equal(after.summary[key], before.summary[key], 'Explanation review must not add ' + key);
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    console.log(JSON.stringify({mode:process.argv.includes('--local')?'preview':'live',pages:checked,
      keyboard:true,resize:true,clipboardAndHttpFallback:true,mobileWidths:[850,600,390],
      existingPageWorkflowRecords:after.summary.records-before.summary.records,newModelCalls:0,errors,writes}));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
