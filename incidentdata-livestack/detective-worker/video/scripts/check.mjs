import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,v)=>i%2===0?[...a,[x,v[i+1]]]:a,[]));
const require=createRequire(path.resolve(args['--runtime-package'])),{chromium}=require('playwright');
const out=path.resolve(args['--out']),build=path.resolve(args['--build']),C=JSON.parse(fs.readFileSync(args['--case'],'utf8'));
const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+path.join(out,'Case-Overview.html'));await page.waitForFunction(()=>document.getElementById('film').readyState>=1);
const result=await page.locator('#film').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight}));assert(result.duration>=120&&result.duration<=240);assert.equal(result.width,1920);assert.equal(result.height,1080);assert.equal(await page.locator('.chapter').count(),C.scenes.length);
await page.locator('#film').evaluate(v=>v.muted=true);
for(let i=0;i<C.scenes.length;i++){await page.locator('.chapter').nth(i).click();await page.waitForFunction(()=>!document.getElementById('film').paused);await page.locator('#film').evaluate(v=>v.pause());const actual=await page.locator('#film').evaluate(v=>v.currentTime),expected=Number(await page.locator('.chapter').nth(i).getAttribute('data-time'));assert(Math.abs(actual-expected)<1);}
await page.reload();await page.screenshot({path:path.join(build,'player-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:950});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(build,'player-mobile.png'),fullPage:true});
await page.locator('.links a.primary').click();assert((await page.locator('body').innerText()).includes(C.batch_id));assert.deepEqual(errors,[]);
fs.writeFileSync(path.join(out,'player-validation.json'),JSON.stringify({...result,chapters:C.scenes.length,playback:'passed',allChapterSeeks:'passed',mobileLayout:'passed',evidenceRegister:'passed',browserErrors:errors},null,2));console.log(JSON.stringify(result));}finally{await browser.close();}
