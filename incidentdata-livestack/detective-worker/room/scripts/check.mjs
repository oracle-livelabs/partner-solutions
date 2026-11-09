import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,v)=>i%2===0?[...a,[x,v[i+1]]]:a,[]));
for(const k of ['--case','--out','--build','--runtime-package'])assert(args[k],`Missing ${k}`);
const C=JSON.parse(fs.readFileSync(args['--case'],'utf8')),out=path.resolve(args['--out']),build=path.resolve(args['--build']);
assert(!fs.existsSync(build),'Use a fresh QA folder');fs.mkdirSync(build,{recursive:true});
const B=JSON.parse(fs.readFileSync(path.join(out,'build-validation.json'),'utf8'));
assert.equal(B.batch_id,C.batch_id);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const entry=path.join(out,'Virtual-Detective-Room.html'),htmlSHA256=sha(fs.readFileSync(entry));assert.equal(htmlSHA256,B.htmlSHA256);
const require=createRequire(path.resolve(args['--runtime-package'])),{chromium}=require('playwright');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
 await page.goto(pathToFileURL(entry).href);
 await page.locator('.board-mount img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 assert.equal(await page.title(),`${C.title} · Virtual Detective Room ${C.version}`);
 assert.equal(await page.locator('.case-id').innerText(),C.batch_id);
 const shot=async name=>page.screenshot({path:path.join(build,name+'.png'),fullPage:true});
 const nav=async view=>{await page.locator(`[data-view="${view}"]:visible`).first().click();assert.equal(await page.locator(`[data-panel="${view}"]`).isVisible(),true);};
 const close=async()=>page.locator('.dialog-close').click();
 const match=(scope,attribute,value)=>page.locator(scope).locator(`[${attribute}]`).evaluateAll((els,{attribute,value})=>els.findIndex(e=>e.getAttribute(attribute)===value),{attribute,value});
 const action=async(scope,attribute,value)=>{const i=await match(scope,attribute,value);assert(i>=0,`Missing ${attribute}=${value}`);await page.locator(scope).locator(`[${attribute}]`).nth(i).click();};
 const bounds=async()=>{
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Page overflow');
  const clipped=await page.locator('button:visible,select:visible').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1;}).map(e=>e.textContent.trim()));
  assert.deepEqual(clipped,[],'Control outside viewport');
  const pins=await page.locator('.pinboard:visible').evaluateAll(bs=>bs.flatMap(b=>{const r=b.getBoundingClientRect();return [...b.querySelectorAll('.pin,.board-stamp')].filter(e=>{const s=e.getBoundingClientRect();return s.top<r.top-5||s.bottom>r.bottom+5||s.left<r.left-5||s.right>r.right+5;}).map(e=>e.textContent.trim());}));assert.deepEqual(pins,[],'Pin outside board');
 };
 await bounds();await shot('room-desktop');
 for(const [selector,key] of [['.person-pin','people'],['.photo-pin','photos'],['.thread-pin','conversations']])assert.equal(await page.locator('[data-panel="room"] '+selector).count(),C.board[key].length);
 assert.equal(await page.locator('[data-panel="room"] .cords path').count(),C.board.links.length);
 await nav('board');await shot('crime-board');
 for(const id of C.board.people){await action('[data-panel="board"]','data-person',id);assert((await page.locator('#dialog-body').innerText()).includes(C.people.find(p=>p.id===id).detail));await page.keyboard.press('Escape');assert.equal(await page.locator('#evidence-dialog').evaluate(d=>d.open),false);}
 for(const id of C.board.conversations){await action('[data-panel="board"]','data-conversation',id);assert.equal(await page.locator('#dialog-body .source-message').count(),C.messages.filter(m=>m.conversation===id).length);await close();}
 if(C.photos.length){await nav('gallery');assert.equal(await page.locator('.gallery-card').count(),C.photos.length);for(const p of C.photos){await action('#scene-gallery','data-photo',p.path);assert((await page.locator('#dialog-body').innerText()).includes(p.note));await page.locator('.detail-image').evaluate(i=>i.decode());assert.equal(await page.locator('.detail-image').evaluate(i=>i.naturalWidth>0),true);await close();}}
 if(C.messages.length){
  await nav('messages');assert.equal(await page.locator('.message-record').count(),C.messages.length);await shot('messages');
  const ids=await page.locator('[data-message]').evaluateAll(bs=>bs.map(b=>b.dataset.message));assert.deepEqual(ids,C.messages.map(m=>m.id));
  for(const c of C.conversations){await page.locator('#conversation-filter').selectOption(c.id);assert.equal(await page.locator('.message-record').count(),C.messages.filter(m=>m.conversation===c.id).length);}
  await page.locator('[data-reset]').click();
  for(const sender of [...new Set(C.messages.map(m=>m.sender))]){await page.locator('#sender-filter').selectOption(sender);assert.equal(await page.locator('.message-record').count(),C.messages.filter(m=>m.sender===sender).length);}
  const empty=C.conversations.flatMap(c=>[...new Set(C.messages.map(m=>m.sender))].filter(sender=>!C.messages.some(m=>m.conversation===c.id&&m.sender===sender)).map(sender=>[c.id,sender]))[0];
  if(empty){await page.locator('#conversation-filter').selectOption(empty[0]);await page.locator('#sender-filter').selectOption(empty[1]);assert.equal(await page.locator('.message-record').count(),0);assert.equal(await page.locator('.empty').isVisible(),true);}
  await page.locator('[data-reset]').click();
  await action('#message-list','data-message',C.messages[0].id);assert((await page.locator('#dialog-body').innerText()).includes(C.messages[0].text));await page.locator('#dialog-body [data-conversation]').click();await page.locator('#dialog-body [data-open-thread]').click();assert.equal(await page.locator('#evidence-dialog').evaluate(d=>d.open),false);await page.locator('[data-reset]').click();
 }
 for(const p of C.panels){await nav(p.id);await shot('panel-'+p.id);const controls=page.locator(`[data-panel="${p.id}"] button`);for(let i=0;i<await controls.count();i++){const attrs=await controls.nth(i).evaluate(e=>Object.keys(e.dataset));if(attrs.some(a=>['record','file','person','photo','conversation'].includes(a))){await controls.nth(i).click();assert.equal(await page.locator('#evidence-dialog').evaluate(d=>d.open),true);await close();}}}
 await nav('sources');assert.equal(await page.locator('.source-file').count(),B.verifiedFiles);
 for(let i=0;i<B.verifiedFiles;i++){await page.locator('.source-file button').nth(i).click();assert.equal(await page.locator('#evidence-dialog').evaluate(d=>d.open),true);await close();}
 for(const r of C.records){await action('[data-panel="sources"] .all-records','data-record',r.id);assert.equal(await page.locator('#dialog-title').innerText(),r.title);assert.equal(await page.locator('#dialog-body dt').count(),Object.keys(r.fields).length);await close();}
 const downloads=await page.locator('.source-file a').evaluateAll(as=>as.map(a=>a.getAttribute('href')));for(const href of downloads)assert(fs.existsSync(path.join(out,decodeURIComponent(href))));
 if(C.briefing){await nav('briefing');await page.locator('#briefing-video').evaluate(async v=>{v.muted=true;v.load();await v.play();});await page.waitForFunction(()=>document.getElementById('briefing-video').currentTime>.1);assert.equal(await page.locator('#briefing-video').evaluate(v=>v.videoWidth),1920);assert(Math.abs(await page.locator('#briefing-video').evaluate(v=>v.duration)-B.briefing.durationSeconds)<.1);await nav('room');assert.equal(await page.locator('#briefing-video').evaluate(v=>v.paused),true);}
 const widths=[1440,1056,850,560,390,320],views=['room','board',...C.panels.map(p=>p.id),...(C.messages.length?['messages']:[]),...(C.photos.length?['gallery']:[]),'sources',...(C.briefing?['briefing']:[])];
 for(const width of widths){await page.setViewportSize({width,height:1000});for(const view of views){await nav(view);await bounds();if(width===390)await shot(view+'-390');}}
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 const report={status:'passed',batch_id:C.batch_id,htmlSHA256,widths,views,checks:['board selections and explicit cords','portrait / scene / conversation inspectors','all message IDs and filters; applicable empty-state','all custom panel source controls and source records','original download paths and source readers','keyboard Escape and nested dialog navigation','responsive control and board bounds','matching video playback and pause when included','no browser errors or remote requests'],note:'Baseline automated checks; source-specific calculations and visual review remain required.'};
 fs.writeFileSync(path.join(out,'room-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
