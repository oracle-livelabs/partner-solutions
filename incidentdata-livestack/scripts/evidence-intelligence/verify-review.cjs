'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../../testdata/evidence-intelligence/v1');
async function main(){
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(ROOT,'review.html')).href,{waitUntil:'load'});
    assert.equal(await page.locator('article').count(),32);
    assert.equal(await page.locator('figure img').count(),4);
    assert(await page.locator('figure img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)));
    await page.getByText('Source and provenance',{exact:true}).first().click();
    assert(await page.locator('article details').first().evaluate(el=>el.open));
    for(const href of await page.locator('a').evaluateAll(links=>links.map(a=>a.getAttribute('href')))) {
      assert(!href.includes('..'));assert(fs.existsSync(path.join(ROOT,href)),href);
    }
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(ROOT,'review-desktop.png')});
    const layouts=[];
    for(const width of [760,390]){
      await page.setViewportSize({width,height:1000});
      const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
      assert(size.scroll<=size.width+1,JSON.stringify(size));layouts.push({width,...size});
    }
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(ROOT,'review-mobile.png')});
    assert.deepEqual(errors,[]);
    const result={cards:32,images:4,imagesLoaded:true,sourceDisclosure:true,assetLinksResolve:true,layouts,pageErrors:errors,
      scope:'Local dataset review catalogue only; no production Evidence Intelligence UI is deployed.'};
    fs.writeFileSync(path.join(ROOT,'review-verification.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result));
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
