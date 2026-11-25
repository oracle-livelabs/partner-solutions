'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'data_room2_files_explain_20261017'),base='http://127.0.0.1:8706';
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
  await page.getByRole('button',{name:'Brief & Connections',exact:true}).click();
  const explain=page.getByRole('button',{name:'Explain Batch Brief',exact:true});
  assert(await explain.isVisible());assert.equal(await explain.locator('svg').count(),1);
  const style=await explain.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  assert.equal(style.color,'rgb(199, 70, 52)');assert.equal(style.background,'rgb(240, 241, 242)');
  const box=await explain.boundingBox(),head=await page.locator('.cdr-learning > .cdr-learning-heading').boundingBox();assert(box.x+box.width>head.x+head.width/2);
  await explain.click();const dialog=page.getByRole('dialog',{name:'Batch Brief explained',exact:true});await dialog.waitFor();
  assert(await dialog.getByText('Refresh brief',{exact:true}).isVisible());
  for(const width of [1450,600,390]){
   await page.setViewportSize({width,height:1000});
   const size=await dialog.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(size.scroll<=size.client+2);
  }
  await page.setViewportSize({width:1450,height:1050});
  await page.screenshot({path:path.join(out,process.argv.includes('--live')?'live-explanation.png':'preview-explanation.png')});
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert(await explain.evaluate(el=>el===document.activeElement));
  await explain.click();await page.getByRole('button',{name:'Close explanation',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByRole('button',{name:'Explore',exact:true}).click();
  const exploreExplain=page.getByRole('button',{name:'Explain Explore',exact:true});
  assert(await exploreExplain.isVisible());assert.equal(await exploreExplain.locator('svg').count(),1);
  const exploreStyle=await exploreExplain.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  assert.deepEqual(exploreStyle,{color:'rgb(199, 70, 52)',background:'rgb(240, 241, 242)'});
  const exploreBox=await exploreExplain.boundingBox(),exploreHead=await page.locator('.cdr-explore-heading').boundingBox();assert(exploreBox.x+exploreBox.width>exploreHead.x+exploreHead.width/2);
  await exploreExplain.click();const exploreDialog=page.getByRole('dialog',{name:'Explore explained',exact:true});await exploreDialog.waitFor();
  for(const heading of ['Money Flows','Messages','Travel','People & Photos','Refresh tiles','Rebuild needed'])assert(await exploreDialog.getByText(heading,{exact:true}).isVisible());
  for(const width of [1450,600,390]){
   await page.setViewportSize({width,height:1000});const size=await exploreDialog.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(size.scroll<=size.client+2);
  }
  await page.screenshot({path:path.join(out,'explore-explanation-mobile.png')});
  await page.setViewportSize({width:1450,height:1050});await page.screenshot({path:path.join(out,process.argv.includes('--live')?'live-explore-explanation.png':'preview-explore-explanation.png')});
  await page.keyboard.press('Escape');assert.equal(await exploreDialog.count(),0);assert(await exploreExplain.evaluate(el=>el===document.activeElement));
  await exploreExplain.click();await page.getByRole('button',{name:'Close explanation',exact:true}).click();assert.equal(await exploreDialog.count(),0);
  await page.screenshot({path:path.join(out,'explore-button.png')});
  await page.getByRole('button',{name:'Files',exact:true}).click();
  const filesExplain=page.getByRole('button',{name:'Explain Files',exact:true});
  assert(await filesExplain.isVisible());assert.equal(await filesExplain.locator('svg').count(),1);
  const filesStyle=await filesExplain.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  assert.deepEqual(filesStyle,{color:'rgb(199, 70, 52)',background:'rgb(240, 241, 242)'});
  const filesBox=await filesExplain.boundingBox(),filesHead=await page.locator('[aria-label="Files workspace"] .cdr-card-top').boundingBox();assert(filesBox.x+filesBox.width>filesHead.x+filesHead.width/2);
  await filesExplain.click();const filesDialog=page.getByRole('dialog',{name:'Files explained',exact:true});await filesDialog.waitFor();
  for(const text of ['How the file list works','What can be described','TXT, CSV and JSON','MP3 and M4A','MP4','Content type','Details','Download'])assert(await filesDialog.getByText(text,{exact:true}).isVisible());
  for(const width of [1450,600,390]){
   await page.setViewportSize({width,height:1000});const size=await filesDialog.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(size.scroll<=size.client+2);
  }
  await page.screenshot({path:path.join(out,'files-explanation-mobile.png')});await page.setViewportSize({width:1450,height:1050});
  await page.screenshot({path:path.join(out,process.argv.includes('--live')?'live-files-explanation.png':'preview-files-explanation.png')});
  await page.keyboard.press('Escape');assert.equal(await filesDialog.count(),0);assert(await filesExplain.evaluate(el=>el===document.activeElement));
  await filesExplain.click();await page.getByRole('button',{name:'Close explanation',exact:true}).click();assert.equal(await filesDialog.count(),0);
  const filter=page.locator('[aria-label="Files workspace"] .cdr-filter select');
  const options=await filter.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
  if(options.length>1){await filter.selectOption(options[1]);assert(await filesExplain.isVisible());await filter.selectOption('all');}

  await page.screenshot({path:path.join(out,process.argv.includes('--live')?'live-desktop.png':'preview-desktop.png'),fullPage:true});
  for(const width of [760,600,390]){
   await page.setViewportSize({width,height:1000});
   const sizes=await page.locator('.dr2-page').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert(sizes.scroll<=sizes.client+2,JSON.stringify({width,...sizes}));
  }
  await page.screenshot({path:path.join(out,'preview-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1450,height:1050});await page.getByRole('button',{name:'Open in Data Room',exact:true}).click();
  await page.locator('.cdr-batch-strip').waitFor({timeout:60000});assert((await page.locator('.cdr-batch-strip').textContent()).includes(selected));
  assert.equal(await page.locator('.brief-explain-trigger').count(),0);
  assert.equal(await page.locator('.cdr-section-title .cdr-letter').allTextContents().then(v=>v.slice(0,7).join('')),'ABCDEFG');
  await nav.nth(ix+1).click();await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor({timeout:60000});
  await page.getByRole('button',{name:'Upload new ZIP',exact:true}).click();assert(await page.getByRole('button',{name:'Load ZIP',exact:true}).isVisible());assert(await page.getByRole('button',{name:'Load ZIP',exact:true}).isDisabled());
  await page.getByLabel('Demo user',{exact:true}).selectOption('read_only_viewer');
  await page.getByRole('button',{name:'Upload new ZIP',exact:true}).click();assert(await page.locator('.dr2-page input[type=file]').isDisabled());
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const receipt={filesExplain:true,exploreExplain:true,batchBriefExplain:true,explainColorsAndIcon:true,escapeRestoresFocus:true,originalHasNoExplain:true,menuAdjacent:true,workspaces:5,comparisonPreservesBatch:true,originalSectionsPreserved:true,responsiveWidths:[760,600,390],readOnlyUploadDisabled:true,writes,errors,mode:process.argv.includes('--live')?'live':'preview'};
  await fs.writeFile(path.join(out,receipt.mode+'-verification.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
