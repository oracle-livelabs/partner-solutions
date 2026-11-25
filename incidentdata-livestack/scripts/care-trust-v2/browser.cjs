'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {OUT,save}=require('./fixture.cjs');
const base=process.env.CARE_TEST_URL||'http://127.0.0.1:18706',full=process.argv.includes('--full'),ai=process.argv.includes('--ai');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(20000);const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));const check=(name,yes)=>{assert(yes,name);checks.push(name);};
  try{
    await page.goto(base);await page.getByRole('button',{name:'Crime Pattern Signals',exact:false}).first().click();
    await page.locator('.watched-pattern-card button').filter({hasText:'Residential Daytime Occupancy Test Burglary'}).first().click();
    await page.getByRole('heading',{name:'The Care-Trust: Who knows?',exact:true}).waitFor();
    await page.getByRole('button',{name:'View linked incidents',exact:true}).click();
    await page.locator('.incident-result-list__rows button').first().waitFor();check('watch hand-off returns exactly six linked incidents',await page.locator('.incident-result-list__rows button').count()===6);
    await page.getByRole('button',{name:'Back to watch pattern',exact:true}).click();await page.getByRole('heading',{name:'The Care-Trust: Who knows?',exact:true}).waitFor();
    check('return preserves selected watch',await page.locator('.watched-pattern-card button.active').innerText().then(t=>t.includes('Residential Daytime')));
    if(full){
      check('three natural care concerns are visible',await page.locator('.trail-grid article').count()===3);
      check('unlinked billing signal has no follow action',await page.locator('.trail-grid article').nth(2).getByRole('button').count()===0);
      await page.getByRole('button',{name:'Follow this lead',exact:true}).first().click();
      await page.getByRole('button',{name:/Inspect \d+ linked evidence sources/}).waitFor();check('lead resolves original tool-case incident',(await page.locator('.incident-detail-form h3').innerText()).includes('12200'));
      check('private followup basis is visible',(await page.locator('.trail-context').innerText()).includes('private follow-up'));
      await page.getByRole('button',{name:/Inspect \d+ linked evidence sources/}).click();await page.locator('.ei-detail h3').waitFor();
      check('incoming incident opens triage evidence',(await page.locator('.ei-detail header small').innerText()).includes('EV-AMS-H17'));
      await page.getByRole('button',{name:'1. A small concern',exact:true}).click();check('first question displays two sources',await page.locator('.ei-card').count()===2);
      await page.getByRole('button',{name:'2. Who knows?',exact:true}).click();check('second question shows four source-bound comparisons',await page.locator('.ei-card').count()===4);
      await page.getByRole('tab',{name:'Links',exact:true}).click();await page.getByRole('button',{name:'Open person profile: Lena Harper',exact:true}).click();
      await page.getByRole('button',{name:'Return to evidence review',exact:true}).click();await page.locator('.ei-card').first().waitFor();check('person round-trip restores source set',await page.locator('.ei-card').count()===4);check('person round-trip restores focused source',(await page.locator('.ei-detail header small').innerText()).includes('EV-AMS-H03'));check('person round-trip restores active tab',await page.getByRole('tab',{name:'Links',exact:true}).getAttribute('aria-selected')==='true');
      await page.getByRole('button',{name:'3. Check permission',exact:true}).click();await page.getByRole('tab',{name:'Source',exact:true}).click();check('third question opens second resident assignment',(await page.locator('.ei-detail header small').innerText()).includes('EV-AMS-H04'));
      await page.getByRole('button',{name:'4. Follow the money question',exact:true}).click();check('financial question preselects four sources',await page.locator('.ei-card input:checked').count()===4);
      await page.getByRole('button',{name:'One apparent duplicate is explained; one question stays open',exact:true}).click();check('counter-evidence states void and pending refund',(await page.locator('.ei-source').innerText()).includes('voided authorisation')&&(await page.locator('.ei-source').innerText()).includes('completion not confirmed'));
      await page.getByRole('button',{name:'Open linked incident',exact:true}).click();await page.getByRole('button',{name:'Return to evidence review',exact:true}).click();await page.locator('.ei-detail h3').waitFor();check('incident round-trip restores counter-evidence focus',(await page.locator('.ei-detail header small').innerText()).includes('EV-AMS-H21'));
      await page.getByRole('button',{name:'4. Follow the money question',exact:true}).waitFor();
      await page.screenshot({path:OUT+'/source-trail.png',fullPage:true});
      await page.setViewportSize({width:390,height:844});check('mobile page has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));await page.screenshot({path:OUT+'/mobile-trail.png',fullPage:true});await page.setViewportSize({width:1440,height:1100});
      if(ai){await page.getByRole('tab',{name:'AI review',exact:true}).click();for(const [label,mode]of [['Draft with Select AI','select-ai'],['Run native agent review','agent']]){const response=page.waitForResponse(r=>r.url().endsWith('/api/evidence-intelligence/review')&&r.request().method()==='POST',{timeout:240000});await page.getByRole('button',{name:label,exact:true}).click();const r=await response,d=await r.json();save(OUT,'ai-'+mode+'.json',d);check(mode+' completes with selected citations',r.status()===200&&d.citations.every(x=>['EV-AMS-H18','EV-AMS-H19','EV-AMS-H20','EV-AMS-H21'].includes(x)));if(mode==='agent')check('native agent calls both tools',['EI_SOURCES_V1','EI_CONTEXT_V1'].every(t=>d.events.some(e=>e.TOOL_NAME===t)));}}
      await page.getByRole('button',{name:'Back to watch pattern',exact:true}).click();await page.getByRole('heading',{name:'The Care-Trust: Who knows?',exact:true}).waitFor();check('evidence returns to its watch',await page.locator('.watched-pattern-card button.active').count()===1);
    }
    await page.getByRole('button',{name:'Evidence Intelligence',exact:false}).first().click();await page.getByRole('button',{name:'Payment paperwork',exact:true}).click();check('payment walkthrough still returns four sources',await page.locator('.ei-card').count()===4);
    await page.getByRole('button',{name:'Compare object images',exact:true}).click();check('original generated-object comparison retained',await page.locator('.ei-card').count()===4);
    await page.getByRole('combobox',{name:'Demo user',exact:true}).selectOption('read_only_viewer');await page.getByRole('heading',{name:'No Evidence Intelligence pack visible',exact:true}).waitFor();check('persona switch clears care sources',await page.locator('.ei-card').count()===0&&await page.locator('.trail-steps').count()===0);
    for(const suffix of ['/api/investigation-trail?patternCode=RESIDENTIAL_OCCUPANCY_BURGLARY&postRef=SYN-AMS-CARE-POST-01','/api/evidence-intelligence/EV-AMS-H21/asset']){const r=await page.request.get(base+suffix,{headers:{'X-Demo-User':'read_only_viewer'}});if(suffix.includes('asset'))check('restricted source asset blocked',r.status()===404);else{const d=await r.json();check('restricted trail empty',!d.posts.length&&!d.evidence.length&&!d.story);}}
    check('no browser JavaScript exceptions',errors.length===0);save(OUT,(full?(base.endsWith(':8706')?'live':'preview-full'):'preview')+'-browser.json',{at:new Date().toISOString(),base,status:'passed',checks,errors});console.log(JSON.stringify({status:'passed',checks}));
  }catch(e){console.error(e.stack);await page.screenshot({path:OUT+'/browser-failure.png',fullPage:true});process.exitCode=1;}finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
