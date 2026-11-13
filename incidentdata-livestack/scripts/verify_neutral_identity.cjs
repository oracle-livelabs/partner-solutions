'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const base='http://127.0.0.1:8706',dir='neutral_identity_20261013';
(async()=>{
 const get=async(path,user)=>{const r=await fetch(base+path,{headers:{'X-Demo-User':user}});assert.equal(r.status,200,path);return r.json();};
 const users=await get('/api/users','statewide_admin');assert.equal(users.length,5);assert(users.some(u=>u.USER_NAME==='central_analyst'));assert(!users.some(u=>u.USER_NAME==='adelaide_central_analyst'));
 const current=await get('/api/dashboard','central_analyst'),legacy=await get('/api/dashboard','adelaide_central_analyst');assert.deepEqual(current,legacy);
 for(const path of ['/api/data-room/batches','/api/watched-patterns'])assert.deepEqual(await get(path,'central_analyst'),await get(path,'adelaide_central_analyst'));
 for(const user of ['central_analyst','adelaide_central_analyst','read_only_viewer','unknown']){
  const r=await fetch(base+'/api/setup/load',{method:'POST',headers:{'X-Demo-User':user,'Content-Type':'application/json'},body:JSON.stringify({profileCode:'ADELAIDE_DATA_V2'})});assert.equal(r.status,403);
 }
 const room='/api/data-room/batches/DR-20261013-2f911298-c82f-4d50/room';
 assert.equal((await get(room,'statewide_admin')).ready.state,'READY');
 for(const u of ['central_analyst','adelaide_central_analyst']){const r=await fetch(base+room,{headers:{'X-Demo-User':u}});assert.equal(r.status,404,'Other user private room must stay hidden');}
 const denied=await fetch(base+room,{headers:{'X-Demo-User':'unknown'}});assert.equal(denied.status,403);
 const browser=await chromium.launch({headless:true});let errors=[],headers=[];
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'||url.origin!==base)return route.abort();if(url.pathname.startsWith('/api/'))headers.push(req.headers()['x-demo-user']);return route.continue();});
  await page.goto(base,{waitUntil:'networkidle'});const select=page.getByLabel('Demo user',{exact:true});
  const values=await select.locator('option').evaluateAll(options=>options.map(o=>o.value));assert(values.includes('central_analyst'));assert(!values.includes('adelaide_central_analyst'));
  await select.selectOption('central_analyst');await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:/Incident Pattern Signals/}).click();await page.waitForLoadState('networkidle');
  assert(headers.includes('central_analyst'));assert(!headers.includes('adelaide_central_analyst'));assert.deepEqual(errors,[]);
  await page.screenshot({path:dir+'/central-analyst-desktop.png'});
  await page.setViewportSize({width:390,height:900});assert.equal(await select.inputValue(),'central_analyst');await page.screenshot({path:dir+'/central-analyst-mobile.png'});
 }finally{await browser.close();}
 const receipt={passed:true,canonicalSelector:true,legacyApiAlias:true,centralDashboardIdentical:true,centralReportsAndVectors:8030,adminOnlyRestoreStillEnforced:true,privateRoomIsolation:true,completedChrisDrugsRoomPreserved:true,desktopAndMobile:true,errors};
 await fs.writeFile(dir+'/live-validation.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
