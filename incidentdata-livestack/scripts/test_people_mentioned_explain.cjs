'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8706',preview=process.argv.includes('--preview'),out='/home/opc/scratch/people-mentioned-explain-20261030';
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1450,height:1050}}),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route(base+'/**',async route=>{
  const request=route.request(),pathname=new URL(request.url()).pathname;
  if(request.method()!=='GET'){writes.push(request.method()+' '+pathname);return route.abort();}
  if(preview&&(pathname==='/'||pathname.startsWith('/assets/'))){const file=path.join(__dirname,'../frontend/dist',pathname==='/'?'index.html':pathname);if(fs.existsSync(file))return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}
  return route.continue();
 });
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.locator('aside nav button').filter({has:page.locator('.nav-item__label > span').filter({hasText:/^Data Room$/})}).click();
 await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor();
 await page.getByRole('button',{name:'Explore',exact:true}).click();
 await page.getByRole('button',{name:'Explore People mentioned',exact:true}).click();
 const workspace=page.getByRole('dialog',{name:'People mentioned',exact:true}),trigger=workspace.getByRole('button',{name:'Explain People mentioned',exact:true}),red=workspace.getByRole('button',{name:'Find people in material',exact:true});
 await trigger.waitFor();const a=await trigger.boundingBox(),b=await red.boundingBox();assert(Math.abs(a.y-b.y)<4,'EXPLAIN is not next to the red button');assert(a.x+a.width<=b.x+2,'EXPLAIN is not left of the red button');
 await workspace.screenshot({path:path.join(out,(preview?'preview':'live')+'-tile.png')});
 await trigger.click();const dialog=page.getByRole('dialog',{name:'People mentioned explained',exact:true});await dialog.waitFor();
 for(const text of ['1. Find source-supported mentions','2. Compare names with the POI register','Example: Tony Kapoor','How people cards are grouped','A possible match is not confirmed identity.'])assert(await dialog.getByText(text,{exact:true}).isVisible());
 const explanation=await dialog.innerText();assert(explanation.includes('PERSONS_OF_INTEREST.DISPLAY_NAME'));assert(explanation.includes('ALIAS_NAME'));assert(explanation.includes('POI_IDENTIFIERS'));assert(explanation.includes('currently not checked'));assert(explanation.includes('not vector similarity, facial comparison'));
 await dialog.screenshot({path:path.join(out,(preview?'preview':'live')+'-explanation.png')});
 for(const width of [760,390,320]){await page.setViewportSize({width,height:900});const size=await dialog.evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert(size.scroll<=size.width+2,JSON.stringify({width,...size}));}
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await workspace.isVisible());assert(await trigger.evaluate(e=>e===document.activeElement));
 await trigger.click();await dialog.waitFor();await dialog.getByRole('button',{name:'Close explanation',exact:true}).click();assert(await workspace.isVisible());
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 const receipt={mode:preview?'preview':'live',tileBesideRedButton:true,tileLeftOfRedButton:true,explanationContentsPassed:true,mobile320390760Passed:true,escapePreservesWorkspace:true,focusRestored:true,noExtractionOrWrites:true,pageErrors:errors};fs.writeFileSync(path.join(out,(preview?'preview':'live')+'-browser.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
 }finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1});
