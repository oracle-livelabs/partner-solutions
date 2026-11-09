'use strict';
const assert=require('node:assert/strict');
const TILE_PREFIX='https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/';
function watchTiles(page){
  const record={requests:[],responses:[],failures:[],osmRequests:[]};
  page.on('request',r=>{if(r.url().startsWith(TILE_PREFIX))record.requests.push(r.url());if(/https:\/\/[^/]*tile\.openstreetmap\.org\//.test(r.url()))record.osmRequests.push(r.url());});
  page.on('response',r=>{if(r.url().startsWith(TILE_PREFIX))record.responses.push({url:r.url(),status:r.status(),contentType:r.headers()['content-type']||''});});
  page.on('requestfailed',r=>{if(r.url().startsWith(TILE_PREFIX))record.failures.push({url:r.url(),error:r.failure()?.errorText});});
  return record;
}
async function assertMapTiles(page,record){
  await page.waitForFunction(()=>{const tiles=[...document.querySelectorAll('.ei-map .leaflet-tile-container img')];return tiles.length>0&&tiles.every(t=>t.complete&&t.naturalWidth===256&&t.naturalHeight===256);},null,{timeout:30000});
  assert(record.requests.length>0,'No basemap requests were observed');
  assert(record.responses.some(r=>r.status===200&&r.contentType.startsWith('image/')),'No successful basemap image response');
  assert.deepEqual(record.responses.filter(r=>r.status>=400),[],'Basemap returned an HTTP error');
  assert.deepEqual(record.failures.filter(r=>!r.error.includes('ERR_ABORTED')),[],'Basemap network failure');
  assert.deepEqual(record.osmRequests,[],'Evidence map must not use direct OpenStreetMap tiles');
  assert.equal(await page.getByTestId('ei-basemap-error').count(),0,'Basemap failure warning is displayed');
  const tiles=await page.locator('.ei-map .leaflet-tile-container img').evaluateAll(nodes=>nodes.map(t=>({url:t.src,width:t.naturalWidth,height:t.naturalHeight})));
  assert(tiles.every(t=>t.url.startsWith(TILE_PREFIX)),'Unexpected basemap provider');
  return {tileCount:tiles.length,successfulResponses:record.responses.filter(r=>r.status===200).length,provider:'Esri World Light Gray Base',directOsmRequests:0};
}
module.exports={TILE_PREFIX,watchTiles,assertMapTiles};
