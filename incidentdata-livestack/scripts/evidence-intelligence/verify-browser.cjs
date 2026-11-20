'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {watchTiles,assertMapTiles}=require('./map-test-helpers.cjs');
const live=process.argv.includes('--live'),base='http://127.0.0.1:'+(live?'8706':'18706'),OUT=process.env.EVIDENCE_BROWSER_OUTPUT_DIR?path.resolve(process.env.EVIDENCE_BROWSER_OUTPUT_DIR):path.resolve(__dirname,'../../evidence_intelligence_20260924');
async function main(){const browser=await chromium.launch({headless:true});const checks=[],errors=[];try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}});page.on('pageerror',e=>errors.push(e.message));
  const tiles=watchTiles(page);
  await page.goto(base,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Evidence Intelligence',exact:false}).first().click();
  await page.locator('.ei-card').nth(31).waitFor();checks.push('32 evidence cards');
  await page.locator('.ei-asset a').waitFor();checks.push('Scoped original text download');
  await page.screenshot({path:path.join(OUT,(live?'live':'preview')+'-desktop.png'),fullPage:false});
  await page.getByLabel('Search source material').fill('blue divided tray');await page.getByRole('button',{name:'Semantic search',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.ei-score').length>0,null,{timeout:60000});assert.equal(await page.locator('.ei-card').count(),8);checks.push('Runtime semantic search with 8 native scores');
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  await page.locator('.ei-card').filter({hasText:'EV-AMS-V01'}).getByRole('button').click();
  await page.locator('.ei-asset img').waitFor();await page.waitForFunction(()=>document.querySelector('.ei-asset img')?.naturalWidth>0);checks.push('Scoped generated image loads');
  await page.getByRole('button',{name:'Compare images',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ei-score').length===3);assert((await page.locator('.ei-card').first().innerText()).includes('EV-AMS-V02'));checks.push('CLIP visual ranking V02 before distractor');
  await page.screenshot({path:path.join(OUT,(live?'live':'preview')+'-visual.png')});
  await page.getByRole('button',{name:'Reset',exact:true}).click();await page.locator('.ei-card').filter({hasText:'EV-AMS-N01'}).getByRole('button').click();
  await page.getByRole('tab',{name:'Links',exact:true}).click();await page.getByText('Literal name mentions in this source',{exact:true}).waitFor();assert((await page.locator('.ei-tab-panel').innerText()).includes('Philip Vandamm'));checks.push('Native graph and literal name mentions shown separately');
  await page.getByRole('tab',{name:'Map',exact:true}).click();await page.locator('.ei-map').waitFor();await assertMapTiles(page,tiles);checks.push('Incident-context map loads actual Esri tiles without HTTP errors');
  await page.getByRole('button',{name:'Find nearby incidents',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ei-status')?.textContent.includes('SDO_GEOM'));checks.push('Native spatial distance search');
  await page.getByRole('tab',{name:'AI review',exact:true}).click();assert(await page.getByRole('button',{name:'Draft with Select AI',exact:true}).isEnabled());assert(await page.getByRole('button',{name:'Run native agent review',exact:true}).isEnabled());checks.push('Both AI actions available');
  if(process.argv.includes('--ai')){
    await page.getByRole('button',{name:'Shared-code caution',exact:true}).click();
    for(const [button,mode] of [['Draft with Select AI','select-ai'],['Run native agent review','agent']]){
      const response=page.waitForResponse(r=>r.url().endsWith('/api/evidence-intelligence/review'),{timeout:180000});
      await page.getByRole('button',{name:button,exact:true}).click();const r=await response;assert.equal(r.status(),200,await r.text());
      await page.locator('.ei-draft').waitFor();assert((await page.locator('.ei-draft').innerText()).includes('EV-AMS-'));checks.push(mode+' completed through UI and HTTP');
    }
    await page.screenshot({path:path.join(OUT,(live?'live':'preview')+'-ai-review.png')});
    await page.getByRole('button',{name:'Reset',exact:true}).click();await page.locator('.ei-card').filter({hasText:'EV-AMS-N01'}).getByRole('button').click();
  }
  await page.getByRole('tab',{name:'JSON',exact:true}).click();assert((await page.locator('.ei-source').innerText()).includes('literal_name_mention'));checks.push('Native JSON source projection');
  const sizes=[];for(const width of [1200,760,390]){await page.setViewportSize({width,height:1000});const x=await page.locator('.ei-page').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert(x.scroll<=x.width+2,JSON.stringify({width,...x}));sizes.push({width,...x});}
  await page.screenshot({path:path.join(OUT,(live?'live':'preview')+'-mobile.png')});checks.push('Evidence page has no horizontal overflow at 1200/760/390px');
  await page.setViewportSize({width:1600,height:1100});
  const user=page.locator('select').filter({has:page.locator('option[value="read_only_viewer"]')});await user.selectOption('read_only_viewer');
  await page.getByText('No Evidence Intelligence pack visible',{exact:true}).waitFor();assert.equal(await page.locator('.ei-card').count(),0);checks.push('User switch clears visible records and selection');
  for(const suffix of ['','/EV-AMS-V01','/EV-AMS-V01/asset','/EV-AMS-N01/relationships']){
    const r=await page.request.get(base+'/api/evidence-intelligence'+suffix,{headers:{'X-Demo-User':'read_only_viewer'}});assert.equal(r.status(),suffix?404:200);if(!suffix)assert.equal((await r.json()).items.length,0);
  }checks.push('Direct restricted list/detail/asset/graph HTTP checks');
  const missing=await page.request.get(base+'/evidence-assets/images/EV-AMS-V01.png');assert(!(missing.headers()['content-type']||'').includes('image/'));checks.push('Assets are not served from public static paths');
  assert.deepEqual(errors,[]);checks.push('No browser JavaScript errors');
  const result={status:'passed',at:new Date().toISOString(),base,checks,sizes,errors};fs.writeFileSync(path.join(OUT,(live?'live':'preview')+'-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
