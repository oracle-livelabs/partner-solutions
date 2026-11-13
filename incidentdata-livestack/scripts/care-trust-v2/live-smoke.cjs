'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {OUT,save}=require('./fixture.cjs');
const {watchTiles,assertMapTiles}=require('../evidence-intelligence/map-test-helpers.cjs');
const base='http://127.0.0.1:8706',pattern='RESIDENTIAL_OCCUPANCY_BURGLARY';
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const checks=[];
  const check=(name,yes)=>{assert(yes,name);checks.push(name);};
  try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),tiles=watchTiles(page);page.setDefaultTimeout(20000);
    const response=await page.goto(base);check('no-referrer policy retained',response.headers()['referrer-policy']==='no-referrer');
    await page.getByRole('button',{name:'Evidence Intelligence',exact:false}).first().click();await page.locator('.ei-card').nth(53).waitFor();
    await page.getByRole('button',{name:'Care-Trust: Who knows?',exact:true}).click();await page.getByRole('tab',{name:'Map',exact:true}).click();
    const map=await assertMapTiles(page,tiles);check('real basemap tiles load without blocked OSM requests',map.successfulResponses>0&&map.directOsmRequests===0);
    check('two approximate incident markers retained',await page.locator('.ei-map path.leaflet-interactive').count()===2);
    await page.locator('.ei-map').screenshot({path:OUT+'/live-map-final.png'});
    const get=(suffix,user='statewide_admin')=>page.request.get(base+suffix,{headers:{'X-Demo-User':user}});
    const bad=await(await get('/api/investigation-trail?patternCode='+pattern+'&postRef=SYN-AMS-CARE-POST-01&incidentRef=SYN-AMS-2026-06302')).json();check('mismatched post and incident cannot produce evidence or story',!bad.incidents.length&&!bad.evidence.length&&!bad.story);
    const unlinked=await(await get('/api/investigation-trail?patternCode='+pattern+'&postRef=SYN-AMS-CARE-POST-03')).json();check('unlinked billing signal stays unlinked',!unlinked.incidents.length&&!unlinked.evidence.length&&!unlinked.story);
    for(const user of ['read_only_viewer','central_analyst','northern_analyst','southern_analyst']){
      const r=await get('/api/investigation-trail?patternCode='+pattern+'&postRef=SYN-AMS-CARE-POST-01',user);check(user+' trail responds successfully',r.status()===200);const d=await r.json();check(user+' sees no care records',!d.incidents.length&&!d.posts.length&&!d.evidence.length&&!d.story);
      for(const suffix of ['/EV-AMS-H21','/EV-AMS-H21/asset','/EV-AMS-H21/relationships'])check(user+' denied '+suffix,(await get('/api/evidence-intelligence'+suffix,user)).status()===404);
    }
    const health=await(await get('/api/health')).json(),profile=await(await get('/api/profile-context')).json();check('healthy Amsterdam remains active',health.status==='healthy'&&profile.profileCode==='AMSTERDAM_DATA_V1');
    save(OUT,'live-smoke-final.json',{at:new Date().toISOString(),status:'passed',checks,map});console.log(JSON.stringify({status:'passed',checks,map}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
