'use strict';
// Read-only post-deployment regression of the still-active Amsterdam profile.
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {OUT,save}=require('./common.cjs');
async function main(){const base='http://127.0.0.1:8706',checks=[];const check=(n,v)=>{assert(v,n);checks.push(n);};
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    const r=await page.request.get(base+'/api/evidence-intelligence',{headers:{'X-Demo-User':'statewide_admin'}}),d=await r.json();check('Amsterdam remains active with 54 sources and four story questions',r.status()===200&&d.profile.profileCode==='AMSTERDAM_DATA_V1'&&d.items.length===54&&d.story.steps.length===4);
    check('Adelaide sources cannot leak through the active Amsterdam catalog',d.items.every(e=>!e.evidenceRef.startsWith('EV-ADL-')));
    check('Adelaide asset remains unavailable until its profile is active',(await page.request.get(base+'/api/evidence-intelligence/EV-ADL-H15/asset',{headers:{'X-Demo-User':'statewide_admin'}})).status()===404);
    await page.goto(base);await page.getByRole('button',{name:'Crime Pattern Signals',exact:false}).first().click();await page.locator('.watched-pattern-card button').filter({hasText:'Residential Daytime Occupancy Test Burglary'}).first().click();await page.getByRole('heading',{name:'The Care-Trust: Who knows?',exact:true}).waitFor();
    await page.getByRole('button',{name:'Follow this lead',exact:true}).first().click();await page.getByRole('button',{name:/Inspect \d+ linked evidence sources/}).click();await page.locator('.ei-detail h3').waitFor();check('Amsterdam public-lead hand-off still opens its private triage source',(await page.locator('.ei-detail header small').innerText()).includes('EV-AMS-H17'));
    await page.getByRole('button',{name:'2. Who knows?',exact:true}).click();await page.getByRole('tab',{name:'Links',exact:true}).click();await page.getByRole('button',{name:'Open person profile: Lena Harper',exact:true}).click();await page.getByRole('button',{name:'Return to evidence review',exact:true}).click();await page.locator('.ei-card').first().waitFor();check('live Amsterdam person round-trip retains the four-source set',await page.locator('.ei-card').count()===4&&(await page.locator('.ei-detail header small').innerText()).includes('EV-AMS-H03'));
    await page.getByRole('button',{name:'4. Follow the money question',exact:true}).click();check('existing financial comparison preserved',await page.locator('.ei-card input:checked').count()===4);
    await page.getByRole('button',{name:'Payment paperwork',exact:true}).click();check('existing independent payment walkthrough preserved',await page.locator('.ei-card').count()===4);await page.getByRole('button',{name:'Compare object images',exact:true}).click();check('existing generated-object comparison preserved',await page.locator('.ei-card').count()===4);
    await page.screenshot({path:OUT+'/live-amsterdam-regression.png',fullPage:true});
    await page.getByRole('combobox',{name:'Demo user',exact:true}).selectOption('read_only_viewer');await page.getByRole('heading',{name:'No Evidence Intelligence pack visible',exact:true}).waitFor();check('restricted persona clears all story sources',await page.locator('.ei-card').count()===0&&!await page.locator('.trail-steps').count());
    const restricted=await page.request.get(base+'/api/evidence-intelligence/EV-AMS-H21/asset',{headers:{'X-Demo-User':'read_only_viewer'}});check('restricted asset request denied',restricted.status()===404);
    check('no live browser exceptions',errors.length===0);save(OUT,'live-regression.json',{at:new Date().toISOString(),status:'passed',profile:'AMSTERDAM_DATA_V1',checks,errors});console.log(JSON.stringify({status:'passed',checks}));
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
