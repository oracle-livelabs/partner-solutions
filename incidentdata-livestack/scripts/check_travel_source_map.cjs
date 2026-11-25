'use strict';
const {chromium}=require('/tmp/crimedata-graph-browser.Sdn124/node_modules/playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{normalize}=require('../backend/data-room-travel'),{createHash}=require('node:crypto');
const base='http://127.0.0.1:8706',id='DR-20261018-6363d783-dacc-4f81',dir=path.resolve(__dirname,'../travel_source_map_20261019'),live=process.argv.includes('--live');
async function get(p){const r=await fetch(base+'/api/data-room'+p,{headers:{'X-Demo-User':'statewide_admin'}});assert(r.ok);return r.json();}
(async()=>{
 const data=await get('/batches/'+id);let fixture;
 if(!live){const items=await Promise.all(data.items.filter(i=>['travel.csv','locations.json'].includes(i.original_path)).map(async i=>{const r=await fetch(base+`/api/data-room/batches/${id}/items/${i.item_id}/download`,{headers:{'X-Demo-User':'statewide_admin'}}),b=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(b).digest('hex'),i.sha256);return{ITEM_ID:i.item_id,ORIGINAL_PATH:i.original_path,CONTENT_TYPE:i.content_type,CONTENT_BLOB:b,SHA256:i.sha256,BYTE_COUNT:b.length};}));fixture={...normalize(items),engine:'Source travel parsing'};}
 const browser=await chromium.launch({headless:true});const errors=[],writes=[];let tiles=0;
 try{
 const page=await browser.newPage({viewport:{width:1450,height:1050}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());
  if(u.hostname==='server.arcgisonline.com'){tiles++;return route.continue();}
  if(u.origin!==base)return route.abort();
  if(req.method()!=='GET'){writes.push(u.pathname);return route.abort();}
  if(!live&&(u.pathname==='/'||u.pathname.startsWith('/assets/'))){const f=path.join(dir,'image/frontend/dist',u.pathname==='/'?'index.html':u.pathname);return route.fulfill({body:await fs.readFile(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html'});}
  if(!live&&u.pathname===`/api/data-room/batches/${id}/travel`)return route.fulfill({json:fixture});return route.continue();
 });
 await page.goto(base,{waitUntil:'networkidle'});await page.locator('aside nav').getByRole('button',{name:/Data Room/}).click();await page.locator('.dr2-summary > .dr2-heading > .cdr-status').waitFor({timeout:60000});
 if(!(await page.locator('.dr2-summary > .dr2-heading code').textContent()).includes(id)){await page.getByRole('button',{name:'Open existing batch',exact:true}).click();await page.locator('.cdr-history tbody tr').filter({hasText:id}).getByRole('button',{name:'Open',exact:true}).click();}
 await page.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:'Explore Travel',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Travel',exact:true});await dialog.getByLabel('Map view').selectOption('geo');const map=dialog.getByRole('region',{name:'Travel geographic map'});await map.getByText('8 of 8 journeys mapped · 4 of 4 locations',{exact:true}).waitFor();await map.locator('.leaflet-overlay-pane path').first().waitFor();assert.equal(await map.locator('.leaflet-overlay-pane path').count(),12);assert.equal(await map.locator('.cdr-source-map-label').count(),4);
 await map.getByRole('button',{name:'Fit journeys',exact:true}).click();
 await map.getByText('Location sources and journey records',{exact:true}).click();await map.locator('details>button').first().click();await dialog.getByRole('heading',{name:/Original travel record/}).waitFor();
 await dialog.getByLabel('Person',{exact:true}).selectOption('Mara Vega');await map.getByText('4 of 4 journeys mapped · 3 of 3 locations',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Clear filters',exact:true}).click();await map.getByText('8 of 8 journeys mapped · 4 of 4 locations',{exact:true}).waitFor();
 await page.screenshot({path:path.join(dir,live?'live-map.png':'preview-map.png')});await page.setViewportSize({width:390,height:844});const dims=await map.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert(dims.scroll<=dims.width+2);await page.screenshot({path:path.join(dir,live?'live-mobile.png':'preview-mobile.png')});
 await dialog.getByLabel('Map view').selectOption('schematic');await dialog.getByRole('img',{name:'Schematic travel journey map with source-record connections'}).waitFor();assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 const receipt={live,mappedJourneys:8,locations:4,sourceRecordSelection:true,personFilters:true,schematicPreserved:true,mobileFits:true,tileRequests:tiles,errors,writes};await fs.writeFile(path.join(dir,live?'live-browser.json':'preview-browser.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
