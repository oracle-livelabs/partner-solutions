'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],writes=[];
 page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const r=route.request(),url=new URL(r.url());if(r.method()!=='GET'){writes.push(r.method()+' '+url.pathname);return route.abort();}
  if(url.origin!=='http://127.0.0.1:8706')return route.abort();
  if(process.argv.includes('--local')&&(url.pathname==='/'||url.pathname.startsWith('/assets/'))){const file=path.join(__dirname,'../frontend/dist',url.pathname==='/'?'index.html':url.pathname);return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}
  return route.continue();
 });
 await page.goto('http://127.0.0.1:8706/',{waitUntil:'networkidle'});await page.locator('aside nav').getByRole('button',{name:/Data Foundation/}).click();
 const trigger=page.getByRole('button',{name:'Oracle Vector Search',exact:true});await trigger.focus();await page.keyboard.press('Enter');
 const guide=page.getByRole('dialog',{name:'Oracle Vector Search',exact:true});await guide.waitFor();await guide.getByRole('heading',{name:'What is a vector?',exact:true}).waitFor();
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');assert.equal(await guide.getByRole('button',{name:'Back',exact:true}).isDisabled(),true);
 await guide.getByRole('button',{name:'Next →',exact:true}).click();await guide.getByRole('heading',{name:'See similarity',exact:true}).waitFor();
 const ranking=guide.locator('.vg-ranking');assert((await ranking.locator('li').nth(0).innerText()).includes('Greyhound'));assert((await ranking.locator('li').nth(1).innerText()).includes('Poodle'));
 await guide.getByRole('button',{name:'Cat',exact:true}).click();assert((await ranking.locator('li').nth(0).innerText()).includes('Dog'));await guide.getByRole('button',{name:'Car',exact:true}).click();assert((await ranking.locator('li').nth(0).innerText()).includes('Cat'));await guide.getByText(/Closest is relative/).waitFor();
 await guide.getByRole('button',{name:'Dog',exact:true}).click();await guide.screenshot({path:'/tmp/incidentdata-vector-guide-desktop.png'});
 await page.setViewportSize({width:390,height:844});const size=await guide.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));assert(size.scroll<=size.client+2,JSON.stringify(size));assert(size.left>=0&&size.right<=392,JSON.stringify(size));await guide.screenshot({path:'/tmp/incidentdata-vector-guide-mobile.png'});
 await page.setViewportSize({width:1600,height:1100});await guide.getByRole('button',{name:'Next →',exact:true}).click();await guide.getByRole('heading',{name:'What Oracle provides',exact:true}).waitFor();await guide.locator('summary').filter({hasText:'Show illustrative SQL'}).click();await guide.getByText(/VECTOR_DISTANCE\(embedding/).waitFor();
 for(let i=0;i<18;i++){await page.keyboard.press('Tab');assert(await guide.evaluate(el=>el.contains(document.activeElement)),'Focus escaped the modal');}
 await page.keyboard.press('Escape');await guide.waitFor({state:'hidden'});assert(await trigger.evaluate(el=>el===document.activeElement),'Focus did not return to vector tile');assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 await trigger.click();await guide.getByRole('heading',{name:'What is a vector?',exact:true}).waitFor();await guide.getByRole('button',{name:/Apply it to this app/}).click();await guide.getByRole('heading',{name:'Apply it to this app',exact:true}).waitFor();await guide.getByRole('button',{name:'Finish',exact:true}).click();await guide.waitFor({state:'hidden'});
 assert.equal(await page.getByRole('button',{name:'JSON duality views',exact:true}).count(),0);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 console.log(JSON.stringify({vectorTile:true,fourStepWalkthrough:true,dogBreedExample:true,catAndCarComparisons:true,optionalSql:true,mobileWidth:390,keyboardFocus:true,escapeAndFinish:true,reopenResets:true,readOnly:true,browserErrors:errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});
