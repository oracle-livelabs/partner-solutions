'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {cityEvidenceStories,PACK}=require('../../../backend/city-evidence-stories');
const ROOT=path.resolve(__dirname,'../../..'),pack=JSON.parse(fs.readFileSync(path.join(ROOT,'testdata/evidence-intelligence/city-core-v1/pack.json'))),base='http://127.0.0.1:8706';
const mock=process.argv.includes('--fixtures');
(async()=>{const browser=await chromium.launch({headless:true}),checks=[],errors=[],writes=[];try{
 const page=await browser.newPage({viewport:{width:1450,height:1100}});page.on('pageerror',e=>errors.push(e.message));
 let city=pack.cities[0];
 await page.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());if(u.origin!==base)return route.abort();if(r.method()!=='GET'){writes.push(u.pathname);return route.abort();}
  if(mock){
   const json=body=>route.fulfill({json:body});
   if(u.pathname==='/api/profile-context')return json({profileCode:city.profileCode,cityLabel:city.city,timeZone:'UTC',locale:'en-GB'});
   if(u.pathname==='/api/evidence-intelligence'){
    const items=city.items.map(e=>({...e,score:null,distanceKm:null}));return json({items,profile:{profileCode:city.profileCode},story:null,walkthroughs:cityEvidenceStories(items.map(e=>({PACK_CODE:PACK,DOCUMENT:JSON.stringify(e)}))),engine:'Fixture display',limit:100});
   }
   if(u.pathname.startsWith('/api/evidence-intelligence/')){
    const ref=u.pathname.split('/')[3],item=city.items.find(e=>e.evidenceRef===ref);assert(item);
    if(u.pathname.endsWith('/asset'))return route.fulfill({body:fs.readFileSync(path.join(ROOT,'testdata/evidence-intelligence/city-core-v1',item.asset.path)),contentType:item.asset.mimeType});
    if(u.pathname.endsWith('/relationships'))return json({engine:'Fixture graph display',cases:[],paths:[],mentions:[]});
    return json(item);
   }
   if(u.pathname.startsWith('/api/investigation-trail'))return json({patterns:[],story:null,incidents:[],posts:[],evidence:[],notice:'Fixture display'});
  }
  return route.continue();
 });
 const targets=mock?pack.cities:[null];
 for(const target of targets){
  if(target)city=target;
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('aside nav').getByRole('button',{name:/Evidence Intelligence/}).click();
  const stories=page.getByRole('region',{name:'Shared city evidence stories'});await stories.getByRole('heading',{name:'Six watch-pattern stories'}).waitFor();assert.equal(await stories.getByRole('button').count(),6);
  const buttons=await stories.getByRole('button').all();
  for(const button of buttons){await button.click();await page.waitForFunction(()=>document.querySelector('.ei-status')?.textContent.startsWith('4 results'));assert.equal(await page.locator('.ei-card').count(),4);assert.equal(await page.locator('.ei-card input:checked').count(),4);await page.locator('.ei-asset a').waitFor();}
  await stories.getByRole('button',{name:'After-hours access',exact:true}).click();await page.locator('.ei-card').nth(2).getByRole('button').click();await page.locator('.ei-asset img').waitFor();await page.waitForFunction(()=>document.querySelector('.ei-asset img')?.naturalWidth>0);
  await page.getByRole('tab',{name:'AI review',exact:true}).click();assert(await page.getByRole('button',{name:'Draft with Select AI',exact:true}).isEnabled());assert(await page.getByRole('button',{name:'Run native agent review',exact:true}).isEnabled());
  await page.getByRole('tab',{name:'JSON',exact:true}).click();assert((await page.locator('.ei-source').innerText()).includes('sharedCityStory'));
  for(const width of [1450,760,390]){await page.setViewportSize({width,height:1000});assert(await page.locator('.ei-page').evaluate(e=>e.scrollWidth<=e.clientWidth+2));}
  if(!mock)await page.screenshot({path:'/tmp/incidentdata-city-evidence-live.png',fullPage:false});
  checks.push({city:target?.city||'Live active city',sixStories:true,fourScopedSourcesPerStory:true,imagesLoad:true,reviewActionsReady:true,mobileFits:true});await page.setViewportSize({width:1450,height:1100});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log(JSON.stringify({status:'passed',mode:mock?'nine-city fixture UI':'live UI',checks,errors,noWrites:true},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
