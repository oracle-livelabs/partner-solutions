'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const {write,withServer}=require('./harness.cjs');
const live=process.argv.includes('--live'),result={mode:live?'live':'read_only_preview',checks:[],page_errors:[],blocked_writes:[],maps:[],status:'running'};
async function run(base){
  const browser=await chromium.launch({headless:true});let page;
  try{
    page=await browser.newPage({viewport:{width:1600,height:1200},timezoneId:'America/Los_Angeles'});page.setDefaultTimeout(45000);
    page.on('pageerror',e=>result.page_errors.push(e.message));
    await page.route('**/*',route=>{
      const r=route.request();if(['GET','HEAD'].includes(r.method()))return route.continue();
      result.blocked_writes.push({method:r.method(),path:new URL(r.url()).pathname,sent_to_server:false});return route.abort();
    });
    const map=page.getByTestId('saved-map');
    async function mapAction(action){
      const pending=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/review/map')&&r.status()===200);
      await action();const response=await pending,{map:m}=await response.json();
      assert.equal(m.representedCount,m.viewportPhysical);assert.ok(m.markers.length<=5000);assert.ok(m.clusters.length<=1000);
      assert.equal(m.sampled,false);assert.equal(m.truncated,false);
      await page.waitForFunction(expected=>{const e=document.querySelector('[data-testid="saved-map"]');return e?.getAttribute('aria-busy')==='false'&&Number(e.dataset.representedCount)===expected;},m.representedCount);
      result.maps.push({zoom:m.zoom,bbox:m.bbox,mode:m.mode,represented:m.representedCount,matched:m.matchedPhysical,markers:m.markers.length,clusters:m.clusters.length});
      return m;
    }
    async function open(code){
      const tile=page.locator(`[data-profile-code="${code}"]`);
      if(await tile.count())await tile.click();else{
        const extras=page.locator('.crimedata-setup__additional');if(!(await extras.getAttribute('open')))await extras.locator('summary').click();
        await extras.getByRole('button',{name:new RegExp(code)}).click();
      }
      await page.getByRole('button',{name:'Review saved profile (read only)',exact:true}).click();
      await page.getByTestId('saved-summary').waitFor();
    }
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Data Foundation/}).click();
    await page.waitForFunction(()=>document.querySelector('[data-testid="active-profile-code"]')?.textContent==='DUBLIN_CITY_DATA_V1');
    const tiles=page.locator('.crimedata-setup__profiles button');
    assert.deepEqual(await tiles.evaluateAll(ns=>ns.map(n=>n.dataset.profileCode)),['ADELAIDE_DATA_V2','PERTH_DATA','BRISBANE_DATA','AMSTERDAM_DATA_V1','BRUSSELS_DATA_V1','DUBLIN_CITY_DATA_V1']);
    assert.equal(await page.getByText('Other saved profiles (3)',{exact:true}).count(),1);
    await open('DUBLIN_CITY_DATA_V1');assert.equal(await page.getByTestId('saved-page-range').count(),0);assert.match(await page.getByTestId('saved-summary').innerText(),/Europe\/Dublin/);
    assert.match(await page.locator('.saved-profile-review__notice').innerText(),/synthetic/i);
    await page.getByTestId('saved-occurred').waitFor();result.checks.push('Six restore tiles and three extra profiles retained; Dublin classic default and stored timezone survive a Los Angeles browser timezone.');
    await open('BRISBANE_DATA');
    const full=await mapAction(()=>page.getByRole('button',{name:'Use clustered map and pages',exact:true}).click());
    assert.equal(full.matchedPhysical,42317);assert.equal(full.representedCount,42317);assert.ok(full.clusters.length>0);
    const labelStyle=await page.locator('.saved-profile-cluster-count').first().evaluate(e=>({background:getComputedStyle(e).backgroundColor,padding:getComputedStyle(e).padding}));assert.equal(labelStyle.background,'rgba(0, 0, 0, 0)');assert.equal(labelStyle.padding,'0px');
    assert.equal(await page.getByTestId('saved-page-range').innerText(),'1–75 of 42,317');
    await map.scrollIntoViewIfNeeded();
    const box=await map.boundingBox(),labels=await page.locator('.saved-profile-cluster-count').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,text:n.textContent};}));
    const visible=labels.filter(r=>r.x>box.x+45&&r.x<box.x+box.width-30&&r.y>box.y+30&&r.y<box.y+box.height-30);
    assert.ok(visible.length>0,'Cluster counts must be visible');const label=visible[Math.floor(visible.length/2)];
    const zoomed=await mapAction(()=>page.mouse.click(label.x,label.y));assert.ok(zoomed.zoom>full.zoom,'Clicking an aggregate should zoom');
    // The same mounted Leaflet element and map transform must survive paging.
    await map.evaluate(e=>{window.__scaleMap=e;window.__scaleTransform=e.querySelector('.leaflet-map-pane').style.transform;});
    await page.getByRole('button',{name:'Next records',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-testid="saved-page-range"]')?.textContent==='76–150 of 42,317');
    assert.equal(await map.evaluate(e=>e===window.__scaleMap&&e.querySelector('.leaflet-map-pane').style.transform===window.__scaleTransform),true);
    await page.getByRole('button',{name:'Previous records',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-testid="saved-page-range"]')?.textContent==='1–75 of 42,317');
    await page.getByRole('button',{name:'Last page',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-testid="saved-page-range"]')?.textContent==='42,301–42,317 of 42,317');
    assert.equal(await page.locator('.saved-profile-review__results button').count(),17);assert.equal(await page.getByRole('button',{name:'Next records',exact:true}).isDisabled(),true);
    assert.equal(await map.evaluate(e=>e===window.__scaleMap&&e.querySelector('.leaflet-map-pane').style.transform===window.__scaleTransform),true);
    result.checks.push('Actual 42,317-record profile reconciles all initial map counts; visible cluster click zooms; next/previous/final-partial paging keeps the existing viewport.');
    // Follow populated clusters down to street detail. Zooming only on an
    // aggregate centroid can legitimately land in an empty gap between points.
    let raw=zoomed;
    for(let step=0;step<7&&raw.mode!=='markers';step++){
      await map.scrollIntoViewIfNeeded();const b=await map.boundingBox();
      const labels=await page.locator('.saved-profile-cluster-count').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,count:Number(n.textContent.replaceAll(',',''))};}));
      const choices=labels.filter(r=>r.x>b.x+45&&r.x<b.x+b.width-30&&r.y>b.y+30&&r.y<b.y+b.height-30).sort((a,b)=>a.count-b.count);
      assert.ok(choices.length,'A populated visible cluster is needed for drill-down');const target=choices[Math.floor(choices.length/2)];
      raw=await mapAction(()=>page.mouse.click(target.x,target.y));
    }
    assert.equal(raw.mode,'markers');assert.ok(raw.markers.length>0);assert.ok(raw.markers.length<=5000);
    const category=await page.getByLabel('Saved detailed category').locator('option').nth(1).getAttribute('value');
    await page.getByLabel('Saved detailed category').selectOption(category);
    const filtered=await mapAction(()=>page.getByRole('button',{name:'Apply saved filters',exact:true}).click());assert.ok(filtered.matchedPhysical>0&&filtered.matchedPhysical<42317);
    assert.match(await page.getByTestId('saved-page-range').innerText(),/^1–/);
    await page.getByLabel('Saved report search').fill('NONEXISTENT_SCALE_BROWSER_20260920');
    const empty=await mapAction(()=>page.getByRole('button',{name:'Apply saved filters',exact:true}).click());assert.equal(empty.representedCount,0);assert.equal(await page.getByTestId('saved-page-range').innerText(),'0–0 of 0');
    await mapAction(()=>page.getByRole('button',{name:'Clear saved filters',exact:true}).click());
    result.checks.push('Street zoom renders bounded original markers; applying filters resets to the first page; empty searches have no false markers.');
    fs.mkdirSync(path.join(__dirname,'screenshots'),{recursive:true});
    await page.locator('.saved-profile-review').screenshot({path:path.join(__dirname,'screenshots',live?'live_review.png':'preview_review.png')});
    await page.setViewportSize({width:390,height:1000});await map.scrollIntoViewIfNeeded();
    // Resizing may trigger a viewport request; wait for its visible loading state.
    await page.waitForFunction(()=>document.querySelector('[data-testid="saved-map"]')?.getAttribute('aria-busy')==='false');
    const columns=await page.locator('.saved-profile-review__columns').evaluate(e=>getComputedStyle(e).gridTemplateColumns);
    assert.equal(columns.trim().split(/\s+/).length,1);await map.screenshot({path:path.join(__dirname,'screenshots',live?'live_map_mobile.png':'preview_map_mobile.png')});
    await page.setViewportSize({width:1600,height:1200});await open('BOSTON_CITY_DATA_V1');
    await page.getByLabel('Saved location role').selectOption('locality_reference');
    await page.getByRole('button',{name:'Apply saved filters',exact:true}).click();
    await page.getByRole('button',{name:'Use clustered map and pages',exact:true}).waitFor();
    const online=await mapAction(()=>page.getByRole('button',{name:'Use clustered map and pages',exact:true}).click());assert.equal(online.representedCount,0);assert.ok(online.referenceOnly>0);
    await page.getByTestId('saved-location').waitFor();assert.match(await page.getByTestId('saved-location').innerText(),/Reference-only/);
    await page.getByLabel('Demo user').selectOption('read_only_viewer');
    await page.waitForFunction(()=>document.querySelector('.crimedata-setup')?.textContent.includes('restricted to Statewide Admin'));assert.equal(await page.locator('.saved-profile-review').count(),0);
    result.checks.push('Mobile review uses one column; Boston online-only records have no physical markers; switching to a restricted user removes the saved review.');
    assert.deepEqual(result.page_errors,[]);assert.deepEqual(result.blocked_writes,[]);
    const final=await(await fetch(base+'/api/setup/profiles')).json();assert.equal(final.profiles.length,9);assert.equal(final.activeProfileCode,'DUBLIN_CITY_DATA_V1');assert.equal(final.live.INCIDENTS,17817);
    result.status='passed';result.finished_at=new Date().toISOString();result.api_writes_sent=0;
  }catch(e){result.status='failed';result.error=e.stack;if(page){result.visible_alerts=await page.locator('[role="alert"]').allTextContents().catch(()=>[]);await page.screenshot({path:path.join(__dirname,live?'live_failure.png':'preview_failure.png'),fullPage:true}).catch(()=>{});}throw e;
  }finally{write(live?'live_browser.json':'preview_browser.json',result);await browser.close();}
  console.log(JSON.stringify({status:result.status,mode:result.mode,checks:result.checks},null,2));
}
withServer(live,run).catch(e=>{console.error(e.stack);process.exitCode=1;});
