'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8706',dir=path.resolve(__dirname,'../data_room_artifact_preview_20261018'),live=process.argv.includes('--live');
async function get(p){const r=await fetch(base+'/api/data-room'+p,{headers:{'X-Demo-User':'statewide_admin'}});assert(r.ok);return r.json();}
(async()=>{
 const batches=(await get('/batches')).batches;let id,data;
 for(const b of batches.slice(0,15)){const e=await get(`/batches/${b.batch_id}/expert`);if(e.board&&e.briefIsCurrent&&e.boardSourcesCurrent&&e.sources.length>=7){id=b.batch_id;data=e;break;}}assert(id);
 const fixtures=new Map();
 if(!live){
  const types=['csv','txt','json','mp3','mp4','txt'];
  data.sources=data.sources.map((s,i)=>{if(i>=types.length)return s;const type=types[i],next={...s,type,path:`fixture-${i}.${type}`};fixtures.set(s.itemId,{type,index:i,body:type==='json'?' {"safe":"<script>bad()</script>","value":42} ':type==='csv'?'name,note\nAlice,"comma, quote"\nBob,"line one\nline two"':type==='txt'?'Original text <script>bad()</script>':Buffer.from('unsupported media fixture')});return next;});
 }
 const browser=await chromium.launch({headless:true});const errors=[],writes=[];
 try{
 const page=await browser.newPage({viewport:{width:1450,height:1050}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin!==base)return route.abort();if(req.method()!=='GET'){writes.push(u.pathname);return route.abort();}
  if(!live&&(u.pathname==='/'||u.pathname.startsWith('/assets/'))){const f=path.join(dir,'image/frontend/dist',u.pathname==='/'?'index.html':u.pathname);return route.fulfill({body:await fs.readFile(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});}
  if(!live&&u.pathname===`/api/data-room/batches/${id}/expert`)return route.fulfill({json:data});
  const m=u.pathname.match(/\/items\/([^/]+)\/download$/),fixture=m&&fixtures.get(m[1]);
  if(!live&&fixture){assert.equal(req.headers()['x-demo-user'],'statewide_admin');if(fixture.index===5)return route.fulfill({status:403,body:'Access denied'});return route.fulfill({body:fixture.body,contentType:'application/octet-stream'});}
  return route.continue();
 });
 await page.goto(base,{waitUntil:'networkidle'});await page.locator('aside nav').getByRole('button',{name:/Data Room/}).click();await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor({timeout:60000});
 if(!(await page.locator('.dr2-summary > .dr2-heading code').textContent()).includes(id)){await page.getByRole('button',{name:'Open existing batch',exact:true}).click();await page.locator('.cdr-history tbody tr').filter({hasText:id}).getByRole('button',{name:'Open',exact:true}).click();}
 await page.getByRole('button',{name:'Assistants',exact:true}).click();const board=page.getByRole('region',{name:'Private investigation board',exact:true});await board.locator('.pib-source').first().waitFor();
 const testSources=live?data.sources.filter(s=>['png','txt','csv'].includes(s.type)).slice(0,8):[...data.sources.slice(0,7),...data.sources.filter(s=>s.type==='png'&&!fixtures.has(s.itemId)).slice(0,1)];
 let images=0,texts=0,players=0;
 for(const s of testSources){
  const card=board.locator('.pib-source').filter({has:page.locator('.pib-source-top strong',{hasText:new RegExp('^'+s.ref+'$')})}),trigger=card.getByRole('button',{name:/Open original artifact/});await trigger.click();const modal=page.getByRole('dialog');await modal.waitFor();await modal.getByRole('heading',{name:s.path,exact:true}).waitFor();
  if(!live&&fixtures.get(s.itemId)?.index===5){await modal.getByRole('alert').filter({hasText:'current access scope'}).waitFor();}
  else{
   await modal.getByRole('link',{name:'Download original'}).waitFor();
   if(['png','jpg','jpeg'].includes(s.type)){await modal.locator('img').evaluate(img=>img.complete&&img.naturalWidth?true:new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;}));images++;}
   else if(['txt','csv','json'].includes(s.type)){const pre=modal.getByLabel('Original file content');await pre.waitFor();assert((await pre.textContent()).length>0);assert.equal(await pre.locator('script').count(),0);texts++;}
   else{const player=modal.locator(s.type==='mp4'?'video':'audio');assert(await player.getAttribute('controls')!==null);assert((await player.getAttribute('src')).startsWith('blob:'));players++;await modal.getByRole('alert').waitFor();}
  }
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert(await trigger.evaluate(el=>el===document.activeElement));
 }
 const card=board.locator('.pib-source').first();await card.getByRole('button',{name:/Open original artifact/}).click();await page.getByRole('dialog').waitFor();await page.setViewportSize({width:390,height:844});const size=await page.getByRole('dialog').evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:innerWidth}));assert(size.left>=0&&size.right<=size.width);await page.screenshot({path:path.join(dir,live?'live-artifact-mobile.png':'preview-artifact-mobile.png')});await page.getByRole('button',{name:'Close artifact',exact:true}).click();
 await page.setViewportSize({width:1450,height:1050});await card.getByRole('button',{name:'Inspect saved source description ↗',exact:true}).click();await page.locator('[aria-label="Files workspace"] .cdr-preview').waitFor();assert.equal(await page.getByRole('dialog').count(),0);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 const receipt={live,images,texts,players,separateDescriptionAction:true,escapeAndFocusRestore:true,mobileFits:true,unauthorizedError:!live,noApplicationWrites:true,errors};await fs.writeFile(path.join(dir,live?'live-browser.json':'preview-browser.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
