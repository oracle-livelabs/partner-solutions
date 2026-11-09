'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const {DIR,OUT,read,save,sha256}=require('./common.cjs');
const {watchTiles,assertMapTiles}=require('../evidence-intelligence/map-test-helpers.cjs');
const base='http://127.0.0.1:8706';
async function main(){const browser=await chromium.launch({headless:true}),checks=[],errors=[],ai=[];const check=(name,value=true)=>{assert(value,name);checks.push(name);console.log('PASS '+name);};try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}});page.on('pageerror',e=>errors.push(e.message));const tiles=watchTiles(page);
  const initial=await page.goto(base,{waitUntil:'networkidle'});check('Existing no-referrer security header retained',initial.headers()['referrer-policy']==='no-referrer');
  const evidence=async()=>{await page.getByRole('button',{name:'Evidence Intelligence',exact:false}).first().click();await page.locator('.ei-card').nth(47).waitFor();};
  const care=async()=>{await page.getByRole('button',{name:'Care-Trust: Who knew?',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ei-card').length===8);};
  const open=async ref=>{await page.locator('.ei-card').filter({hasText:ref}).getByRole('button').click();await page.waitForFunction(r=>document.querySelector('.ei-detail>header>small')?.textContent.includes(r),ref);};
  await evidence();check('48 evidence items visible');await care();check('Care shortcut opens eight sources and six review selections',(await page.locator('.ei-list-heading').innerText()).includes('6/6'));
  check('Care shortcut keeps semantic search in the occupancy case',await page.locator('.ei-filter-row select').nth(1).inputValue()==='CASE-AMS-2026-03');
  await page.locator('.ei-asset a').waitFor();check('New source download available');await page.screenshot({path:path.join(OUT,'live-care-opening.png')});
  await open('EV-AMS-H03');await page.getByRole('button',{name:'care_worker : DEMO-WORKER-17',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ei-card').length===3);check('Exact worker search isolates three sources and excludes form-label collision',!(await page.locator('.ei-results').innerText()).includes('EV-AMS-H09'));
  await page.getByRole('tab',{name:'JSON',exact:true}).click();check('JSON shows knowledge set and source-backed person bindings',(await page.locator('.ei-source').innerText()).includes('KS-CARE-TRUST-001'));
  await care();await open('EV-AMS-H06');await page.getByRole('tab',{name:'Links',exact:true}).click();await page.getByRole('button',{name:'Open person profile: Lena Harper',exact:true}).waitFor();
  check('Links show source-qualified graph path and literal mentions',(await page.locator('.ei-tab-panel').innerText()).includes('no physical presence'));
  await page.getByRole('button',{name:'Open person profile: Lena Harper',exact:true}).click();await page.locator('.person-profile h3').filter({hasText:'POI-AMS-CARE-W01'}).waitFor();check('Evidence link opens the correct Person Intelligence profile');
  await page.getByLabel('Narrative vector query').fill('home support worker assigned to residents and care information consent');await page.getByRole('button',{name:'Search narratives',exact:true}).click();await page.locator('.poi-search-results').getByText('Lena Harper',{exact:false}).first().waitFor({timeout:60000});check('Person Intelligence narrative search retrieves new care worker');
  await evidence();await care();await page.getByRole('tab',{name:'Map',exact:true}).click();const map=await assertMapTiles(page,tiles);check('Care walkthrough map loads real tiles with two incident markers',await page.locator('.ei-map path.leaflet-interactive').count()===2);await page.locator('.ei-map').screenshot({path:path.join(OUT,'live-care-map.png')});
  await page.getByRole('button',{name:'Find nearby incidents',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ei-status')?.textContent.includes('SDO_GEOM'));check('Spatial proximity search runs from care incident');
  await page.getByRole('button',{name:'Reset',exact:true}).click();await page.getByLabel('Search source material').fill('private client appointment information forwarded to an outside account');await page.getByRole('button',{name:'Semantic search',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ei-score').length===8,null,{timeout:60000});check('Runtime semantic search ranks H05 first',(await page.locator('.ei-card').first().innerText()).includes('EV-AMS-H05'));
  await care();
  if(process.argv.includes('--ai')){
    await page.getByRole('tab',{name:'AI review',exact:true}).click();
    for(const [button,mode]of [['Draft with Select AI','select-ai'],['Run native agent review','agent']]){
      const response=page.waitForResponse(r=>r.url().endsWith('/api/evidence-intelligence/review'),{timeout:240000});await page.getByRole('button',{name:button,exact:true}).click();const r=await response;assert.equal(r.status(),200,await r.text());const d=await r.json();await page.locator('.ei-draft').waitFor();
      check(mode+' returns checked citations for selected care sources',d.citations.length>0&&d.citations.every(r=>read(DIR,'expected.json').mainReview.includes(r)));
      if(mode==='agent')check('Native agent executed both request-bound tools',['EI_SOURCES_V1','EI_CONTEXT_V1'].every(t=>d.events.some(e=>e.TOOL_NAME===t)));
      ai.push(d);save(OUT,'live-ai-results.json',{status:'pending_human_source_review',ai});
    }
    await page.screenshot({path:path.join(OUT,'live-care-ai.png')});
    await page.getByRole('button',{name:'Care-Trust: check assumptions',exact:true}).click();await page.getByRole('tab',{name:'AI review',exact:true}).click();
    const response=page.waitForResponse(r=>r.url().endsWith('/api/evidence-intelligence/review'),{timeout:240000});await page.getByRole('button',{name:'Draft with Select AI',exact:true}).click();const r=await response;assert.equal(r.status(),200,await r.text());const d=await r.json();ai.push(d);check('Assumptions review flags hostile source explicitly',d.sourceWarnings.some(w=>w.includes('EV-AMS-H16')));save(OUT,'live-ai-results.json',{status:'pending_human_source_review',ai});
  }
  await care();await open('EV-AMS-H03');await page.getByRole('tab',{name:'Links',exact:true}).click();await page.getByRole('button',{name:/CASE-AMS-2026-03/}).click();await page.getByRole('heading',{name:'Case Relationships',exact:true}).first().waitFor();check('Case context opens Case Relationships');
  await evidence();await page.getByRole('button',{name:'Payment paperwork',exact:true}).click();check('Payment vignette preserved',await page.locator('.ei-card').count()===4);
  await page.getByRole('button',{name:'Compare object images',exact:true}).click();await page.locator('.ei-asset img').waitFor();await page.getByRole('button',{name:'Compare images',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.ei-score').length===3);check('Original CLIP image ranking preserved',(await page.locator('.ei-card').first().innerText()).includes('EV-AMS-V02'));
  await care();for(const width of [1200,760,390]){await page.setViewportSize({width,height:1000});const layout=await page.locator('.ei-page').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));check('No care-page overflow at '+width,layout.scroll<=layout.width+2);}await page.screenshot({path:path.join(OUT,'live-care-mobile.png')});
  await page.getByLabel('Demo user',{exact:true}).selectOption('read_only_viewer');await page.getByText('No Evidence Intelligence pack visible',{exact:true}).waitFor();check('Restricted-user switch clears care data and shortcuts',await page.getByRole('button',{name:'Care-Trust: Who knew?',exact:true}).count()===0);
  const req=async(route,user='statewide_admin',body)=>{const r=body?await page.request.post(base+route,{headers:{'X-Demo-User':user},data:body}):await page.request.get(base+route,{headers:{'X-Demo-User':user}});return r;};
  for(const e of read(DIR,'pack.json').items){const r=await req('/api/evidence-intelligence/'+e.evidenceRef+'/asset');assert.equal(r.status(),200);assert.equal(sha256(await r.body()),e.asset.sha256);}check('All 16 live source assets match fixture checksums');
  for(const user of ['central_analyst','northern_analyst','southern_analyst','read_only_viewer']){
    for(const suffix of ['/EV-AMS-H05','/EV-AMS-H05/asset','/EV-AMS-H06/relationships'])assert.equal((await req('/api/evidence-intelligence'+suffix,user)).status(),404);
    assert.equal((await req('/api/persons/POI-AMS-CARE-W01',user)).status(),404);
    assert.equal((await req('/api/evidence-intelligence/review',user,{evidenceRefs:['EV-AMS-H05']})).status(),404);
  }check('Direct HTTP evidence, asset, graph, person and review access denied to all restricted personas');
  const graph=await (await req('/api/graph/network?caseRef=CASE-AMS-2026-03&depth=2')).json();check('Case graph includes both new fictional contacts',['POI-AMS-CARE-W01','POI-AMS-CARE-X01'].every(r=>graph.nodes.some(n=>n.PERSON_REF===r)));
  const incident=await (await req('/api/incidents/SYN-AMS-2026-12200')).json();check('Incident Explorer exposes care-context links without changing original report',incident.incident.PROPERTY_CATEGORY==='a small tool case'&&incident.people.some(p=>p.PERSON_REF==='POI-AMS-CARE-W01'));
  const watched=await (await req('/api/watched-patterns')).json(),watch=watched.find(w=>w.PATTERN_CODE==='RESIDENTIAL_OCCUPANCY_BURGLARY');check('Existing watch pattern retains six incidents and correct case',watch.INCIDENT_COUNT===6&&watch.CASE_REF==='CASE-AMS-2026-03');
  check('No browser JavaScript errors',errors.length===0);save(OUT,'live-browser.json',{status:'passed',at:new Date().toISOString(),checks,map,errors,aiRuns:ai.map(d=>({mode:d.mode,runId:d.runId,citations:d.citations}))});
}finally{await browser.close();}}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
