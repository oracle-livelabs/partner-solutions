'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const {write,withServer}=require('./harness.cjs');
const live=process.argv.includes('--live'),prefix=live?'live':'preview';
const codes=['ADELAIDE_DATA_V2','PERTH_DATA','BRISBANE_DATA','AMSTERDAM_DATA_V1','BRUSSELS_DATA_V1','DUBLIN_CITY_DATA_V1','BOSTON_CITY_DATA_V1','CHICAGO_CITY_DATA_V2','LAS_VEGAS_URBAN_DATA_V1'];
const result={status:'running',mode:prefix,page_errors:[],blocked_writes:[],checks:[]};
withServer(live,async base=>{
  const browser=await chromium.launch({headless:true});let page;
  try{
    page=await browser.newPage({viewport:{width:1600,height:1200}});page.setDefaultTimeout(45000);
    page.on('pageerror',e=>result.page_errors.push(e.message));
    await page.route('**/*',route=>{if(['GET','HEAD'].includes(route.request().method()))return route.continue();result.blocked_writes.push({method:route.request().method(),path:new URL(route.request().url()).pathname});return route.abort();});
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:/Data Foundation/}).click();
    await page.waitForFunction(()=>document.querySelector('[data-testid="active-profile-code"]')?.textContent==='DUBLIN_CITY_DATA_V1');
    const tiles=page.locator('.crimedata-setup__profiles button');
    assert.deepEqual(await tiles.evaluateAll(ns=>ns.map(n=>n.dataset.profileCode)),codes);
    const boxes=await tiles.evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
    for(let row=0;row<3;row++){const b=boxes.slice(row*3,row*3+3);assert.ok(b.every(x=>Math.abs(x.y-b[0].y)<1));assert.ok(b[0].x<b[1].x&&b[1].x<b[2].x);}
    assert.ok(boxes[0].y<boxes[3].y&&boxes[3].y<boxes[6].y);result.tile_geometry=boxes;
    assert.equal(await page.getByText('Other saved profiles (1)',{exact:true}).count(),1);
    await page.locator('.crimedata-setup__additional summary').click();
    assert.equal(await page.locator('.crimedata-setup__additional button').count(),1);
    assert.match(await page.locator('.crimedata-setup__additional button').innerText(),/ADELAIDE_DATA$/);
    await page.locator('.crimedata-setup__additional summary').click();
    fs.mkdirSync(path.join(__dirname,'screenshots'),{recursive:true});
    await page.locator('.crimedata-setup').screenshot({path:path.join(__dirname,'screenshots',prefix+'_nine_tiles.png')});
    result.checks.push('Nine tiles in three desktop rows, USA row ordered Boston / Chicago / Las Vegas; no duplicate USA entries.');
    async function select(code){
      const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/setup/profiles'&&new URL(r.url()).searchParams.get('profileCode')===code&&r.status()===200);
      await page.locator(`[data-profile-code="${code}"]`).click();const d=await(await response).json();assert.equal(d.profile.PROFILE_CODE,code);
      await page.waitForFunction(code=>document.querySelector(`[data-profile-code="${code}"]`)?.getAttribute('aria-pressed')==='true',code);
      return d;
    }
    for(const [code,count,tz]of [[codes[6],14513,'America/New_York'],[codes[7],39649,'America/Chicago'],[codes[8],19527,'America/Los_Angeles']]){
      const d=await select(code);assert.equal(d.backup.INCIDENTS,count);assert.equal(d.capabilities.restore,false);
      await page.getByTestId('activation-blocked').waitFor();assert.equal(await page.getByLabel('Global replacement confirmation').count(),0);assert.equal(await page.getByRole('button',{name:/^Restore /}).count(),0);
      await page.getByRole('button',{name:'Review saved profile (read only)',exact:true}).click();
      await page.getByTestId('saved-summary').waitFor();
      assert.match(await page.locator('.saved-profile-review > header').innerText(),new RegExp(code));
      const summary=await page.getByTestId('saved-summary').innerText();assert.ok(summary.startsWith(count.toLocaleString('en-GB')+' matching incidents'));assert.ok(summary.includes(tz));
      assert.equal(await page.getByTestId('active-profile-code').innerText(),'DUBLIN_CITY_DATA_V1');
      await page.getByRole('button',{name:'Close saved review',exact:true}).click();
      result.checks.push(code+': correct saved review/count/timezone; restore remains disabled and Dublin stays active.');
    }
    await select('ADELAIDE_DATA_V2');await page.getByLabel('Global replacement confirmation').waitFor();
    assert.equal(await page.getByRole('button',{name:'Restore Adelaide',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Restore Adelaide NRT',exact:true}).isDisabled(),true);
    await select('DUBLIN_CITY_DATA_V1');await page.getByLabel('Global replacement confirmation').waitFor();assert.equal(await page.getByRole('button',{name:'Restore Dublin',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Restore Dublin NRT',exact:true}).count(),0);
    await page.setViewportSize({width:390,height:1000});
    assert.equal(await page.locator('.crimedata-setup__profiles').evaluate(e=>getComputedStyle(e).gridTemplateColumns.trim().split(/\s+/).length),1);
    // The existing app header overflows at 390px in both baseline and new build.
    // Check this change does not add overflow; each tile must fit its own bounds.
    const mobile=JSON.parse(fs.readFileSync(path.join(__dirname,'mobile_baseline_comparison.json')));
    assert.equal(mobile.status,'passed');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),mobile.measurements[0].pageWidth);
    assert.ok(await tiles.evaluateAll(ns=>ns.every(e=>e.scrollWidth<=e.clientWidth+1)),'Mobile tile content must fit');
    await page.locator('.crimedata-setup__profiles').screenshot({path:path.join(__dirname,'screenshots',prefix+'_mobile_tiles.png')});
    await page.setViewportSize({width:1600,height:1200});
    await page.getByLabel('Demo user').selectOption('read_only_viewer');
    await page.waitForFunction(()=>document.querySelector('.crimedata-setup')?.textContent.includes('restricted to Statewide Admin'));
    assert.equal(await page.locator('[data-profile-code]').count(),0);assert.equal(await page.locator('.saved-profile-review').count(),0);
    result.checks.push('Existing Australian/European restore confirmations unchanged; mobile single-column tiles fit with no additional page overflow; restricted users cannot access saved review.');
    assert.deepEqual(result.page_errors,[]);assert.deepEqual(result.blocked_writes,[]);result.status='passed';result.api_writes_sent=0;
  }catch(e){result.status='failed';result.error=e.stack;if(page)await page.screenshot({path:path.join(__dirname,prefix+'_failure.png'),fullPage:true}).catch(()=>{});throw e;}
  finally{result.at=new Date().toISOString();write(prefix+'_browser.json',result);await browser.close();}
  console.log(JSON.stringify({status:result.status,mode:prefix,checks:result.checks},null,2));
}).catch(e=>{console.error(e.stack);process.exitCode=1;});
