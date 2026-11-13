'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'data_room2_preview_20261017'),base='http://127.0.0.1:8706';
(async()=>{
 const browser=await chromium.launch({headless:true});
 const errors=[],writes=[];
 try{
  const page=await browser.newPage({viewport:{width:1450,height:1050}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==base)return route.abort();
   if(req.method()!=='GET'){writes.push(url.pathname);return route.abort();}
   if(!process.argv.includes('--live')&&(url.pathname==='/'||url.pathname.startsWith('/assets/'))){const file=path.join(out,'image/frontend/dist',url.pathname==='/'?'index.html':url.pathname);return route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}
   return route.continue();
  });
  await page.goto(base,{waitUntil:'networkidle'});
  const nav=page.locator('aside nav > button'),names=await nav.locator('.nav-item__label>span').allTextContents();
  const ix=names.indexOf('Data Room');assert(ix>=0);assert.equal(names[ix+1],'Data-Room2 · Preview');
  const first=await nav.nth(ix).boundingBox(),second=await nav.nth(ix+1).boundingBox();assert(second.y>=first.y+first.height-1);
  await nav.nth(ix+1).click();await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor({timeout:60000});
  const selected=await page.locator('.dr2-summary > .dr2-heading code').textContent();assert(selected.startsWith('DR-'));
  assert(await page.getByText('Preview layout · Shared batches',{exact:false}).isVisible());
  for(const label of ['Files','Explore','Brief & Connections','Assistants','Outputs']){
   await page.getByRole('navigation',{name:'Data-Room2 workspaces'}).getByRole('button',{name:label,exact:true}).click();
   assert.equal(await page.locator('.dr2-page > div[aria-label$="workspace"]:visible').count(),1);
  }
  await page.getByRole('button',{name:'Files',exact:true}).click();
  await page.screenshot({path:path.join(out,process.argv.includes('--live')?'live-desktop.png':'preview-desktop.png'),fullPage:true});
  for(const width of [760,600,390]){
   await page.setViewportSize({width,height:1000});
   const sizes=await page.locator('.dr2-page').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(sizes.scroll<=sizes.client+2,JSON.stringify({width,...sizes}));
  }
  await page.screenshot({path:path.join(out,'preview-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1450,height:1050});await page.getByRole('button',{name:'Open in Data Room',exact:true}).click();
  await page.locator('.cdr-batch-strip').waitFor({timeout:60000});assert((await page.locator('.cdr-batch-strip').textContent()).includes(selected));
  assert.equal(await page.locator('.cdr-section-title .cdr-letter').allTextContents().then(v=>v.slice(0,7).join('')),'ABCDEFG');
  await nav.nth(ix+1).click();await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor({timeout:60000});
  await page.getByRole('button',{name:'Upload new ZIP',exact:true}).click();assert(await page.getByRole('button',{name:'Load ZIP',exact:true}).isVisible());assert(await page.getByRole('button',{name:'Load ZIP',exact:true}).isDisabled());
  await page.getByLabel('Demo user',{exact:true}).selectOption('read_only_viewer');
  await page.getByRole('button',{name:'Upload new ZIP',exact:true}).click();assert(await page.locator('.dr2-page input[type=file]').isDisabled());
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const receipt={menuAdjacent:true,workspaces:5,comparisonPreservesBatch:true,originalSectionsPreserved:true,responsiveWidths:[760,600,390],readOnlyUploadDisabled:true,writes,errors,mode:process.argv.includes('--live')?'live':'preview'};
  await fs.writeFile(path.join(out,receipt.mode+'-verification.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
