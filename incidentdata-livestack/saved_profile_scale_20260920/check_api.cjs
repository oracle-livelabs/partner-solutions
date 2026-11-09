'use strict';
const assert=require('node:assert/strict');const {write,withServer}=require('./harness.cjs');
const live=process.argv.includes('--live'),result={mode:live?'live':'read_only_preview',started_at:new Date().toISOString(),requests:[],checks:[],writes:0};
async function run(base){
  async function get(p,status=200,user='statewide_admin'){
    const start=performance.now(),r=await fetch(base+p,{headers:{'X-Demo-User':user},signal:AbortSignal.timeout(45000)}),body=await r.text();
    result.requests.push({path:p,status:r.status,milliseconds:Math.round(performance.now()-start),bytes:Buffer.byteLength(body),user});assert.equal(r.status,status,p+': '+body.slice(0,160));assert.ok(Buffer.byteLength(body)<8*1024*1024,'Payload budget exceeded');return JSON.parse(body);
  }
  const catalog=await get('/api/setup/profiles');assert.equal(catalog.activeProfileCode,'DUBLIN_CITY_DATA_V1');assert.equal(catalog.profiles.length,9);assert.equal(catalog.live.INCIDENTS,17817);
  const expected={ADELAIDE_DATA:21513,ADELAIDE_DATA_V2:21532,BRISBANE_DATA:42317,PERTH_DATA:33511,AMSTERDAM_DATA_V1:14467,BRUSSELS_DATA_V1:25691,DUBLIN_CITY_DATA_V1:17817,LAS_VEGAS_URBAN_DATA_V1:19527,BOSTON_CITY_DATA_V1:14513};
  for(const p of catalog.profiles)assert.equal(p.INCIDENT_COUNT,expected[p.PROFILE_CODE]);
  result.checks.push('All nine saved profiles and active Dublin catalogue counts unchanged');
  const legacy=await get('/api/setup/profiles/DUBLIN_CITY_DATA_V1/review');assert.equal(legacy.viewMode,'legacy');assert.equal(legacy.markerLimit,15000);assert.equal(legacy.recordLimit,75);assert.equal(legacy.records.length,75);assert.equal(legacy.pagination,undefined);assert.equal(legacy.context.savedReview.required,false);
  assert.equal(legacy.context.timeZone,'Europe/Dublin');result.checks.push('Default Dublin review limits and timezone preserved');
  const endpoint='/api/setup/profiles/BRISBANE_DATA/review',full=await get(endpoint+'?view=clustered');
  assert.equal(full.summary.TOTAL_COUNT,42317);assert.equal(full.viewMode,'clustered');assert.equal(full.records.length,75);assert.equal(full.map.mode,'clusters');assert.equal(full.map.representedCount,full.summary.PHYSICAL_COUNT);assert.ok(full.map.clusters.length<=1000);assert.equal(full.map.markers.length,0);
  const sum=full.map.clusters.reduce((n,c)=>n+c.RECORD_COUNT,0);assert.equal(sum,full.summary.PHYSICAL_COUNT);
  result.scale_profile={code:'BRISBANE_DATA',saved_records:42317,physical:full.summary.PHYSICAL_COUNT,clusters:full.map.clusters.length,scope:'Actual saved Oracle rows, larger than Chicago; Chicago itself is still not loaded.'};
  const second=await get(endpoint+'/records?offset=75&limit=75'),lastOffset=Math.floor((42317-1)/75)*75,last=await get(endpoint+'/records?offset='+lastOffset+'&limit=75');
  assert.ok(second.records.every(r=>!full.records.some(a=>a.INCIDENT_REF===r.INCIDENT_REF)));assert.equal(last.pagination.end,42317);assert.equal(last.pagination.hasNext,false);assert.equal(last.records.length,17);
  const past=await get(endpoint+'/records?offset=42317');assert.equal(past.records.length,0);assert.equal(past.pagination.total,42317);
  result.checks.push('Stable disjoint first/second pages, final partial page and end-of-results verified');
  const code=full.categories.find(c=>c.RECORD_COUNT>0).CATEGORY_CODE;
  const filtered=await get(endpoint+'?view=clustered&category='+encodeURIComponent(code));
  assert.equal(filtered.summary.TOTAL_COUNT,full.categories.find(c=>c.CATEGORY_CODE===code).RECORD_COUNT);assert.equal(filtered.map.representedCount,filtered.summary.PHYSICAL_COUNT);
  const filteredLast=await get(endpoint+'/records?category='+encodeURIComponent(code)+'&offset='+Math.floor((filtered.summary.TOTAL_COUNT-1)/75)*75);assert.equal(filteredLast.pagination.total,filtered.summary.TOTAL_COUNT);assert.ok(filteredLast.records.every(r=>r.CATEGORY_CODE===code));
  const area=full.areas.find(a=>a.AREA_NAME)?.AREA_NAME;
  if(area){const x=await get(endpoint+'?view=clustered&area='+encodeURIComponent(area));assert.equal(x.map.representedCount,x.summary.PHYSICAL_COUNT);assert.ok(x.records.every(r=>r.DISTRICT_AREA===area));}
  const missing=await get(endpoint+'?view=clustered&q=NONEXISTENT_SCALE_CHECK_20260920');assert.equal(missing.summary.TOTAL_COUNT,0);assert.equal(missing.map.representedCount,0);assert.equal(missing.map.markers.length,0);assert.equal(missing.pagination.start,0);
  result.checks.push('Category, area and empty-query totals remain exact and independent of paging');
  // Verify the returned markers lie inside a narrow viewport, and that an
  // oversized requested limit cannot bypass the cap. No all-points response.
  const c=full.map.clusters.find(c=>c.RECORD_COUNT>0),cx=c.LONGITUDE,cy=c.LATITUDE,bbox=[cx-.001,cy-.001,cx+.001,cy+.001];
  const close=await get(endpoint+'/map?zoom=19&mapLimit=25000&bbox='+bbox.join(','));assert.ok(close.map.markers.length<=5000);assert.ok(close.map.clusters.length<=1000);assert.equal(close.map.representedCount,close.map.viewportPhysical);
  assert.equal(close.map.rawMarkerLimit,5000);
  for(const m of close.map.markers)assert.ok(m.LONGITUDE>=bbox[0]&&m.LONGITUDE<=bbox[2]&&m.LATITUDE>=bbox[1]&&m.LATITUDE<=bbox[3]);
  const dense=await get(endpoint+'/map?zoom=19&mapLimit=25000');assert.equal(dense.map.mode,'clusters');assert.equal(dense.map.representedCount,full.summary.PHYSICAL_COUNT);assert.equal(dense.map.markers.length,0);
  result.independent_coordinates=await require('./check_coordinates.cjs')(full,dense,close,bbox);
  result.checks.push('Both cluster grids and narrow viewport membership independently reconciled against all 42,317 stored physical rows streamed in bounded batches');
  result.checks.push('High zoom cannot bypass 5000 raw-marker cap; large selection coarsens clusters without sampling');
  const online=await get('/api/setup/profiles/BOSTON_CITY_DATA_V1/review?view=clustered&role=locality_reference');assert.ok(online.summary.TOTAL_COUNT>0);assert.equal(online.map.representedCount,0);assert.equal(online.map.referenceOnly,online.summary.TOTAL_COUNT);assert.equal(online.map.markers.length,0);
  const reference=legacy.records[0].INCIDENT_REF;
  const detail=await get('/api/setup/profiles/DUBLIN_CITY_DATA_V1/incidents/'+encodeURIComponent(reference));assert.equal(detail.incident.INCIDENT_REF,reference);assert.equal(detail.incident.REPORT_SUMMARY,legacy.records[0].REPORT_SUMMARY);
  await get('/api/setup/profiles/BRISBANE_DATA/incidents/'+encodeURIComponent(reference),404);
  for(const suffix of ['/map','/records'])for(const user of ['read_only_viewer','northern_analyst'])await get(endpoint+suffix,403,user);
  for(const q of ['offset=-1','limit=201','zoom=20','bbox=0,2,1,1','bbox=NaN,0,1,1'])await get(endpoint+'/map?'+q,400);
  await get('/api/setup/profiles/NOT_A_REAL_PROFILE/review?view=clustered',404);
  result.checks.push('Reference-only records have no false markers; detail/profile isolation and restricted-user denials pass');
  const final=await get('/api/setup/profiles');assert.equal(final.activeProfileCode,'DUBLIN_CITY_DATA_V1');assert.equal(final.live.INCIDENTS,17817);assert.equal(final.live.PERSONS,13);assert.equal(final.live.CASES,5);
  assert.ok(result.requests.filter(r=>r.status===200).every(r=>r.milliseconds<10000),'10 second API budget exceeded');
  result.status='passed';result.finished_at=new Date().toISOString();write(live?'live_api.json':'preview_api.json',result);console.log(JSON.stringify({status:result.status,requests:result.requests.length,scale:result.scale_profile,max_ms:Math.max(...result.requests.map(r=>r.milliseconds)),max_bytes:Math.max(...result.requests.map(r=>r.bytes)),checks:result.checks},null,2));
}
withServer(live,run).catch(e=>{result.status='failed';result.error=e.stack;write(live?'live_api.json':'preview_api.json',result);console.error(e.stack);process.exitCode=1;});
