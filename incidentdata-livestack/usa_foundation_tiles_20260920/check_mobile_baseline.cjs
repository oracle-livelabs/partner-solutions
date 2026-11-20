'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const {write,withServer}=require('./harness.cjs');
(async()=>{
  const measurements=[];
  for(const dir of ['baseline_dist','dist'])await withServer(false,async base=>{
    const browser=await chromium.launch({headless:true});
    try{
      const page=await browser.newPage({viewport:{width:1600,height:1200}});
      await page.route('**/*',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
      await page.goto(base);await page.getByRole('button',{name:/Data Foundation/}).click();
      await page.waitForFunction(()=>document.querySelector('[data-testid="active-profile-code"]')?.textContent==='DUBLIN_CITY_DATA_V1');
      await page.setViewportSize({width:390,height:1000});
      measurements.push({build:dir,...await page.evaluate(()=>({viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right})),tileWidths:[...document.querySelectorAll('.crimedata-setup__profiles button')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth}))}))});
    }finally{await browser.close();}
  },dir);
  assert.equal(measurements[0].pageWidth,measurements[1].pageWidth);
  assert.ok(measurements[1].tileWidths.every(w=>w.scroll<=w.client+1));
  write('mobile_baseline_comparison.json',{status:'passed',measurements});console.log(JSON.stringify(measurements,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
