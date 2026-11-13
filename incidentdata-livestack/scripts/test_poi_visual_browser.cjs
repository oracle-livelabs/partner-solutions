const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const live = process.argv.includes('--live');
const testFile = name => `/home/opc/scratch/photos/test/${name}-portrait-sheet (1).jpeg`;
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1100}});
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    if (!live) await page.route('http://127.0.0.1:8706/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname !== '/' && !pathname.startsWith('/assets/')) return route.continue();
      const file = path.join(root,'frontend/dist',pathname === '/' ? 'index.html' : pathname);
      const contentType = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
      await route.fulfill({body:await fs.readFile(file),contentType});
    });
    await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:/Person Intelligence/}).click();
    const search = page.locator('.poi-visual-search');
    const results = page.locator('.poi-search-results');
    const upload = search.getByLabel('Choose test image',{exact:true});
    const cards = results.locator('.poi-visual-match');
    await page.locator('.person-list button').filter({hasText:'POI-FNET-TESSA'}).click();
    await page.locator('.person-profile h3').filter({hasText:'POI-FNET-TESSA'}).waitFor();
    const visualBox = await search.boundingBox();
    const narrativeBox = await page.locator('.poi-narrative-search').boundingBox();
    assert(Math.abs(visualBox.y - narrativeBox.y) < 2 && narrativeBox.x > visualBox.x, JSON.stringify({visualBox,narrativeBox}));
    assert.equal(await page.getByRole('button',{name:'Test selected portrait',exact:true}).count(),0);
    await upload.setInputFiles(testFile('darnell-price'));
    await cards.first().getByRole('heading',{name:'Darnell Price'}).waitFor();
    assert.equal(await cards.count(),5);
    assert.match(await cards.first().innerText(),/0\.7735/);
    const preview = await search.getByAltText('Uploaded search image').getAttribute('src');
    await cards.filter({hasText:'Tessa Rowe'}).getByRole('button',{name:'View profile'}).click();
    assert.equal(await search.getByAltText('Uploaded search image').getAttribute('src'),preview);
    await page.locator('.person-list button').filter({hasText:'POI-FNET-MARA'}).click();
    assert.equal(await search.getByAltText('Uploaded search image').getAttribute('src'),preview);
    assert.match(await cards.first().innerText(),/Darnell Price/);
    assert.equal(await results.getAttribute('data-mode'),'visual');
    await page.getByLabel('Narrative vector query').fill('Methodical associate with a practical interest in cash flow and personal finances');
    await page.getByRole('button',{name:'Search narratives',exact:true}).click();
    await results.getByRole('heading',{name:'Narrative search results',exact:true}).waitFor();
    await cards.first().getByRole('heading',{name:'Elias Grant'}).waitFor();
    assert.equal(await page.locator('.poi-search-results').count(),1);
    assert.equal(await search.getByAltText('Uploaded search image').getAttribute('src'),preview);
    assert.equal(await results.getByRole('heading',{name:'Visual search results',exact:true}).count(),0);
    // Starting another visual search chooses the visible result type immediately.
    await upload.setInputFiles(testFile('darnell-price'));
    await cards.first().getByRole('heading',{name:'Darnell Price'}).waitFor();
    assert.equal(await results.getAttribute('data-mode'),'visual');
    await page.locator('.person-intelligence__workbench').screenshot({path:'/tmp/poi-dual-search-desktop.png'});
    for (const width of [760,600]) {
      await page.setViewportSize({width,height:1100});
      const size=await page.locator('.person-intelligence__workbench').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
      assert(size.scroll<=size.width+2,JSON.stringify({width,...size}));
    }
    await page.locator('.person-intelligence__workbench').screenshot({path:'/tmp/poi-dual-search-mobile.png'});
    await page.setViewportSize({width:1440,height:1100});
    await page.route('**/api/persons/search/narrative',async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,700));await route.fulfill({response});});
    await page.getByRole('button',{name:'Search narratives',exact:true}).click();
    await upload.setInputFiles(testFile('darnell-price'));
    await cards.first().getByRole('heading',{name:'Darnell Price'}).waitFor();
    await page.waitForTimeout(900);
    assert.equal(await results.getAttribute('data-mode'),'visual');
    assert.match(await cards.first().innerText(),/Darnell Price/);
    await page.unroute('**/api/persons/search/narrative');
    // Delayed stale response must not replace a newer upload's results.
    let calls=0;
    await page.route('**/api/persons/search/visual',async route=>{
      calls++;
      if (calls===1) {const response=await route.fetch();await new Promise(r=>setTimeout(r,700));await route.fulfill({response}).catch(()=>{});}
      else await route.continue();
    });
    await upload.setInputFiles(testFile('darnell-price'));
    await page.waitForTimeout(100);
    await upload.setInputFiles(testFile('tessa-rowe'));
    await cards.first().getByRole('heading',{name:'Tessa Rowe'}).waitFor();
    await page.waitForTimeout(800);
    assert.match(await cards.first().innerText(),/Tessa Rowe/);
    await page.unroute('**/api/persons/search/visual');
    // A failed new query clears previous matches and preserves its upload.
    await page.route('**/api/persons/search/visual', route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Test search failure'})}));
    await upload.setInputFiles(testFile('darnell-price'));
    await search.getByRole('alert').waitFor();
    assert.equal(await cards.count(),0);
    assert.equal(await search.getByAltText('Uploaded search image').getAttribute('src'),preview);
    await search.getByRole('button',{name:'Clear image search'}).click();
    assert.equal(await search.getByAltText('Uploaded search image').count(),0);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({mode:live?'live':'local-build-with-live-api',sideBySide:'passed',exclusiveResults:'passed',crossSearchRace:'passed',uploadRanking:'passed',persistentPreview:'passed',profileSelection:'passed',staleResponses:'passed',failureState:'passed',responsiveWidths:[760,600],browserErrors:errors}));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
