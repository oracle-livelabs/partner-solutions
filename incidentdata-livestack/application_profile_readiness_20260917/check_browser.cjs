/* Real application UI against the isolated GET-only FU40 review server. */
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'synthetic_amsterdam_may_jun_2026_v1/staging');
const sourceReports=new Map(fs.readFileSync(path.join(stage,'reports.jsonl'),'utf8').trim().split('\n').map(JSON.parse).map(r=>[r.incident_ref,r]));
const result={started_at:new Date().toISOString(),environment:'isolated real application at 127.0.0.1:18706, browser timezone America/Los_Angeles',checks:{},screenshots:[],page_errors:[],write_requests:[]};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1250},timezoneId:'America/Los_Angeles'});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>result.page_errors.push(e.stack||e.message));
  await page.route('**/api/**',route=>{if(!['GET','HEAD'].includes(route.request().method())){result.write_requests.push(route.request().url());return route.abort();}return route.continue();});
  await page.goto('http://127.0.0.1:18706',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Data Foundation/}).click();
  await page.locator('[data-profile-code="AMSTERDAM_DATA_V1"]').click();
  await page.locator('[data-testid="activation-blocked"]').waitFor();
  assert.equal(await page.locator('[data-testid="active-profile-code"]').innerText(),'BRUSSELS_DATA_V1');
  assert.equal(await page.locator('.crimedata-setup__profiles button').count(),6);
  await page.getByRole('button',{name:'Review saved profile (read only)',exact:true}).click();
  const review=page.locator('.saved-profile-review');await review.locator('[data-testid="saved-summary"]').waitFor();
  assert.match(await review.locator('[data-testid="saved-summary"]').innerText(),/14,467 matching incidents/);
  assert.equal(await review.locator('[data-testid="saved-map"]').getAttribute('data-marker-count'),'13297');
  assert.equal(await review.getByLabel('Saved district',{exact:true}).locator('option').count(),10);
  assert.equal(await review.getByLabel('Saved detailed category',{exact:true}).locator('option').count(),40);
  assert.equal(await review.getByLabel('Saved executive group',{exact:true}).locator('option').count(),12);
  result.checks.catalogue_dynamic_filters_and_full_marker_coverage=true;
  const dir=path.join(__dirname,'screenshots');fs.mkdirSync(dir,{recursive:true});
  async function shot(name){await review.scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const tiles=[...document.querySelectorAll('.saved-profile-review .leaflet-tile')];return tiles.length>0&&tiles.every(i=>i.complete&&i.naturalWidth>0);},{},{timeout:20000});await review.screenshot({path:path.join(dir,name+'.png')});result.screenshots.push('screenshots/'+name+'.png');}
  await shot('amsterdam_all');
  async function apply(values){
   for(const [label,value] of Object.entries(values)){const field=review.getByLabel(label,{exact:true});if(await field.evaluate(e=>e.tagName)==='SELECT')await field.selectOption(value);else await field.fill(value);}
   const response=page.waitForResponse(r=>r.url().includes('/AMSTERDAM_DATA_V1/review?')&&r.status()===200);
   await review.getByRole('button',{name:'Apply saved filters',exact:true}).click();await response;
   await review.locator('[data-testid="saved-summary"]').waitFor();await review.getByRole('button',{name:'Apply saved filters',exact:true}).waitFor({state:'visible'});
  }
  for(const name of ['Centrum','West','Nieuw-West','Noord','Oost','Zuid','Zuidoost','Weesp','Westpoort']){
   await apply({'Saved district':name});await review.locator('[data-testid="saved-narrative"]').waitFor();await shot(name.toLowerCase());
  }
  result.checks.all_nine_area_maps_and_details=true;
  await apply({'Saved district':'','Saved location role':'locality_reference'});
  assert.match(await review.locator('[data-testid="saved-summary"]').innerText(),/1,170 matching incidents · 0 physical points/);
  assert.equal(await review.locator('[data-testid="saved-map"]').getAttribute('data-marker-count'),'0');await shot('online_no_markers');
  result.checks.online_no_null_island_markers=true;
  await apply({'Saved location role':'','Saved report search':'SYN-AMS-2026-00002'});
  await review.locator('[data-testid="saved-narrative"]').waitFor();
  assert.equal(await review.locator('[data-testid="saved-narrative"]').innerText(),sourceReports.get('SYN-AMS-2026-00002').report_text);
  assert.equal(await review.locator('.saved-profile-review__detail h3').innerText(),sourceReports.get('SYN-AMS-2026-00002').report_summary);
  assert.match(await review.locator('[data-testid="saved-occurred"]').innerText(),/03 Jun 2026, 16:26:15 GMT\+02:00 \(Europe\/Amsterdam\)/);
  assert.match(await review.locator('.saved-profile-review__detail').innerText(),/Property-description note/);await shot('exact_report_time_and_evidence');
  result.checks.exact_source_report_evidence_and_named_timezone_not_browser_timezone=true;
  await apply({'Saved report search':'Rhônepark'});assert.match(await review.locator('[data-testid="saved-summary"]').innerText(),/37 matching incidents/);await review.locator('[data-testid="saved-narrative"]').waitFor();assert.match(await review.locator('.saved-profile-review__detail').innerText(),/Rhônepark/);await shot('accented_place_search');
  await apply({'Saved report search':'','Saved from date':'2026-05-01','Saved to date':'2026-05-01'});assert.match(await review.locator('[data-testid="saved-summary"]').innerText(),/247 matching incidents/);await review.locator('[data-testid="saved-occurred"]').waitFor();assert.match(await review.locator('[data-testid="saved-occurred"]').innerText(),/01 May 2026/);await shot('local_midnight_boundary');
  result.checks.accent_and_local_midnight_browser_checks=true;
  await apply({'Saved from date':'','Saved to date':'','Saved executive group':'THEFT','Saved detailed category':'AMS_BICYCLE'});assert.match(await review.locator('[data-testid="saved-summary"]').innerText(),/2,290 matching incidents/);
  result.checks.detailed_filter_under_executive_group=true;
  assert.equal(await page.locator('.app-use-notice strong').innerText(),'Synthetic demonstration data. These are not actual police incidents.');assert.equal(await page.locator('.app-use-notice').isVisible(),true);
  result.checks.persistent_exact_synthetic_notice=true;
  await page.getByLabel('Demo user',{exact:true}).selectOption('northern_analyst');
  await page.getByText('Saved-library review is restricted to Statewide Admin.',{exact:false}).waitFor();assert.equal(await page.locator('.saved-profile-review').count(),0);
  result.checks.user_switch_clears_privileged_saved_data=true;
  await page.getByLabel('Demo user',{exact:true}).selectOption('statewide_admin');
  await page.getByRole('button',{name:/Incident Explorer/}).click();
  await page.locator('.incident-result-list__rows button').first().waitFor();
  assert.match(await page.locator('.incident-result-list__rows').innerText(),/SYN-BRU/);
  await page.locator('.incident-detail-form input').first().waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.incident-detail-form input')).some(x=>x.value.includes('Europe/Brussels')));
  result.checks.live_brussels_explorer_uses_active_profile_timezone=true;
  assert.deepEqual(result.page_errors,[]);assert.deepEqual(result.write_requests,[]);
  result.status='passed';result.finished_at=new Date().toISOString();
 }finally{await browser.close();}
 fs.writeFileSync(path.join(__dirname,'browser_acceptance.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
})().catch(e=>{result.status='failed';result.error=e.stack;fs.writeFileSync(path.join(__dirname,'browser_acceptance.json'),JSON.stringify(result,null,2)+'\n');console.error(e.stack);process.exitCode=1;});
