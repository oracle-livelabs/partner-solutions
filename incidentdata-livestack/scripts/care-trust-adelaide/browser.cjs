'use strict';
// Offline browser contract test. Fixture-backed API responses are explicitly not a live city restore.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),express=require('express'),{chromium}=require('playwright');
const {ROOT,DIR,OUT,PROFILE,PATTERN,CASE,KNOWLEDGE,read,save}=require('./common.cjs');
const {visibleStory}=require('../../backend/care-trust-stories');
const pack=read(DIR,'pack.json'),anchors=read(DIR,'anchors.json');
const context={profileCode:PROFILE,profileName:'Adelaide Data Set V2',cityLabel:'Adelaide',timeZone:'Australia/Adelaide',locale:'en-AU',synthetic:true};
const sources=pack.items.map(e=>({...e,ingestedAt:'2026-09-27T00:00:00Z',score:null,distanceKm:null}));
const watch={...anchors.watch,INCIDENT_COUNT:7,POST_COUNT:11,REVIEWED_LINK_COUNT:5};
const incidents=anchors.incidents.map(i=>({...i,CATEGORY_NAME:'Offences Against Property',DETAILED_CATEGORY_NAME:i.CATEGORY_NAME,DISPLAY_COLOR:'#7B5B45',AREA_NAME:'Southern & Eastern Adelaide',EVIDENCE_COUNT:sources.filter(e=>e.incidentRef===i.INCIDENT_REF).length}));
const posts=pack.posts.map(p=>({POST_REF:p.ref,POST_TEXT:p.text,POSTED_AT:p.date,KNOWLEDGE_SET_ID:KNOWLEDGE,INCIDENT_REF:p.incidentRef,LINK_SUMMARY:p.basis,VERIFICATION_STATUS:p.incidentRef?'incident_link_reviewed':'unverified',REVIEW_STATUS:p.incidentRef?'reviewed':null}));
const personRows=pack.people.map(p=>({PERSON_REF:p.personRef,DISPLAY_NAME:p.displayName,ALIAS_NAME:'Fictional documentary contact',PERSON_STATUS:'associate',NARRATIVE_SUMMARY:p.narrativeSummary,NARRATIVE_TEXT:p.narrativeText,NARRATIVE_VECTOR_READY:0,PROFILE_ATTRIBUTES:{synthetic_record:true},INCIDENT_COUNT:2}));
function trail(q,allowed){
  let ii=allowed?incidents:[],pp=allowed?posts:[];
  if(q.patternCode&&q.patternCode!==PATTERN){ii=[];pp=[];}
  if(q.postRef){pp=pp.filter(p=>p.POST_REF===q.postRef);ii=ii.filter(i=>pp.some(p=>p.INCIDENT_REF===i.INCIDENT_REF));}
  if(q.incidentRef){ii=ii.filter(i=>i.INCIDENT_REF===q.incidentRef);pp=pp.filter(p=>p.INCIDENT_REF===q.incidentRef);}
  const evidence=sources.filter(e=>ii.some(i=>i.INCIDENT_REF===e.incidentRef)).map(e=>({EVIDENCE_REF:e.evidenceRef,INCIDENT_REF:e.incidentRef,EVIDENCE_TYPE:e.kind,TITLE:e.title,CASE_REF:CASE}));
  return {context:q,patterns:ii.length?[watch]:[],incidents:ii,posts:pp,evidence,story:ii.length?visibleStory(PROFILE,sources.map(e=>e.evidenceRef)):null,notice:'Fixture preview: explicit comparison links are not corroboration.'};
}
async function main(){
  const app=express();app.use(express.json());
  app.use('/api',(req,res)=>{
    const allowed=['statewide_admin','southern_analyst'].includes(req.header('X-Demo-User')||'statewide_admin'),route=req.path,q=req.query;
    res.set('Cache-Control','no-store');
    if(req.method!=='GET')return res.status(405).json({error:'Offline UI test: no writes or AI provider calls.'});
    if(route==='/profile-context')return res.json(context);
    if(route==='/users')return res.json(['statewide_admin','central_analyst','northern_analyst','southern_analyst','read_only_viewer'].map(u=>({USER_NAME:u,DISPLAY_NAME:u,ROLE_NAME:u==='statewide_admin'?'admin':'analyst'})));
    if(route==='/dashboard')return res.json({summary:{INCIDENT_COUNT:7},categories:[],statuses:[],areas:[],recentIncidents:[],watchedPatterns:[watch],actions:[],people:[]});
    if(route==='/watched-patterns')return res.json([watch]);
    if(route==='/community-signals/summary')return res.json({AUTHORISED_INCIDENT_COUNT:allowed?7:0,LINKED_INCIDENT_COUNT:allowed?2:0,postsByTopic:[],byTopic:[],byMomentum:[]});
    if(route==='/community-signals/posts')return res.json({posts:[],notice:'Fixture preview; the connected concerns are in the source trail.'});
    if(route==='/investigation-trail')return res.json(trail(q,allowed));
    if(route==='/incidents/filters')return res.json({categories:[],suburbs:[],statuses:[],areas:[]});
    if(route==='/incidents')return res.json(allowed?incidents.filter(i=>(!q.q||i.INCIDENT_REF.includes(q.q))&&(!q.patternCode||q.patternCode===PATTERN)):[]);
    if(route.startsWith('/incidents/')){const i=incidents.find(i=>i.INCIDENT_REF===route.split('/').at(-1));return allowed&&i?res.json({incident:i,evidence:sources.filter(e=>e.incidentRef===i.INCIDENT_REF).map(e=>({EVIDENCE_TYPE:e.kind})),people:[]}):res.status(404).json({error:'Not available'});}
    if(route==='/persons')return res.json(allowed?personRows:[]);
    if(route.startsWith('/persons/'))return res.json({person:personRows.find(p=>p.PERSON_REF===route.split('/').at(-1)),incidents:[],evidence:[]});
    if(route==='/evidence-intelligence'){const items=allowed?sources:[];return res.json({items,profile:context,story:visibleStory(PROFILE,items.map(e=>e.evidenceRef)),engine:'Fixture-backed browser contract preview'});}
    if(route.startsWith('/evidence-intelligence/')){
      const [,r,action]=route.split('/').slice(1),e=allowed&&sources.find(e=>e.evidenceRef===r);if(!e)return res.status(404).json({error:'Not available'});
      if(action==='asset')return res.type('text/plain').send(fs.readFileSync(path.join(DIR,e.asset.path)));
      if(action==='relationships')return res.json({engine:'Fixture relationship preview — not native graph execution',evidenceRef:r,incidentRef:e.incidentRef,cases:[{CASE_REF:CASE,PATTERN_LABEL:'Residential daytime occupancy-context comparison'}],paths:pack.newLinks.filter(l=>l.incidentRef===e.incidentRef).map(l=>({personRef:l.personRef,displayName:pack.people.find(p=>p.personRef===l.personRef).displayName,connectionType:'associate',linkSummary:l.summary})),mentions:e.personLinks.map(l=>({...l,displayName:pack.people.find(p=>p.personRef===l.personRef).displayName})),notice:'Recorded incident context, not proof of handling a source.'});
      return res.json(e);
    }
    return res.json([]);
  });
  app.use(express.static(path.join(ROOT,'frontend/dist')));app.get('*',(req,res)=>res.sendFile(path.join(ROOT,'frontend/dist/index.html')));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(15000);
  const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));const check=(n,v)=>{assert(v,n);checks.push(n);};
  try{
    await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'Crime Pattern Signals',exact:false}).first().click();
    await page.locator('.watched-pattern-card button').filter({hasText:'Residential Daytime Occupancy Test Burglary'}).first().click();await page.getByRole('heading',{name:'The Care-Trust: Who knows?',exact:true}).waitFor();
    check('three care signals, including unlinked awareness',await page.locator('.trail-grid article').count()===3);check('awareness has no follow action',await page.locator('.trail-grid article').nth(2).getByRole('button').count()===0);
    await page.getByRole('button',{name:'View linked incidents',exact:true}).click();await page.locator('.incident-result-list__rows button').first().waitFor();check('exact watch hand-off shows seven reports',await page.locator('.incident-result-list__rows button').count()===7);
    await page.getByRole('button',{name:'Back to watch pattern',exact:true}).click();await page.getByRole('button',{name:'Follow this lead',exact:true}).first().click();
    await page.getByRole('button',{name:/Inspect \d+ linked evidence sources/}).waitFor();check('first concern resolves to Marion report',(await page.locator('.incident-detail-form h3').innerText()).includes('0001'));
    await page.getByRole('button',{name:/Inspect \d+ linked evidence sources/}).click();await page.locator('.ei-detail h3').waitFor();check('lead opens Adelaide private triage source',(await page.locator('.ei-detail header small').innerText()).includes('EV-ADL-H15'));
    await page.getByRole('button',{name:'2. Who knows?',exact:true}).click();check('four access comparison sources',await page.locator('.ei-card').count()===4);
    await page.getByRole('tab',{name:'Links',exact:true}).click();await page.getByRole('button',{name:'Open person profile: Ellis Ward',exact:true}).click();
    await page.getByRole('button',{name:'Return to evidence review',exact:true}).click();await page.locator('.ei-card').first().waitFor();check('person round-trip restores focused source and four-source set',(await page.locator('.ei-detail header small').innerText()).includes('EV-ADL-H03')&&await page.locator('.ei-card').count()===4);check('person round-trip preserves Links tab',await page.getByRole('tab',{name:'Links',exact:true}).getAttribute('aria-selected')==='true');
    await page.getByRole('button',{name:'3. Check permission',exact:true}).click();check('permission widens visibly to Oaklands Park',(await page.locator('.trail-context').last().innerText()).includes('Oaklands Park'));
    await page.getByRole('button',{name:'4. Check the spending',exact:true}).click();check('four financial sources selected',await page.locator('.ei-card input:checked').count()===4);
    await page.getByRole('button',{name:'A later reconciliation changes the spending picture',exact:true}).click();check('void and unconfirmed refund both visible',(await page.locator('.ei-source').innerText()).includes('voided authorisation')&&(await page.locator('.ei-source').innerText()).includes('completion is not confirmed'));
    await page.getByRole('button',{name:'Open linked incident',exact:true}).click();await page.getByRole('button',{name:'Return to evidence review',exact:true}).click();await page.locator('.ei-detail h3').waitFor();check('incident round-trip keeps reconciliation focus',(await page.locator('.ei-detail header small').innerText()).includes('EV-ADL-H20'));
    await page.getByRole('button',{name:'5. Test the wider pattern',exact:true}).click();check('countercheck opens resolved Mitchell Park source',(await page.locator('.ei-source').innerText()).includes('status: resolved'));
    check('unavailable Amsterdam-only walkthroughs hidden',await page.getByRole('button',{name:'Payment paperwork',exact:true}).count()===0&&await page.getByRole('button',{name:'Compare object images',exact:true}).count()===0);
    await page.screenshot({path:OUT+'/adelaide-preview.png',fullPage:true});await page.setViewportSize({width:390,height:844});check('390px viewport has no horizontal page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));await page.screenshot({path:OUT+'/adelaide-mobile.png',fullPage:true});
    await page.getByRole('combobox',{name:'Demo user',exact:true}).selectOption('read_only_viewer');await page.getByRole('heading',{name:'No Evidence Intelligence pack visible',exact:true}).waitFor();check('persona change clears source selection and story',await page.locator('.ei-card').count()===0&&await page.locator('.trail-steps').count()===0);
    check('no browser exceptions',errors.length===0);save(OUT,'browser-preview.json',{at:new Date().toISOString(),status:'passed',mode:'offline fixture-backed navigation test; not a live restore or native capability test',checks,errors});console.log(JSON.stringify({status:'passed',checks}));
  }catch(e){await page.screenshot({path:OUT+'/browser-failure.png',fullPage:true});throw e;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
