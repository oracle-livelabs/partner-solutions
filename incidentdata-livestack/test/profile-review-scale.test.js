const test=require('node:test'),assert=require('node:assert/strict');
const scale=require('../backend/profile-review-scale');
const {contextFrom,recordPage,mapReview,createProfileLibrary}=require('../backend/profile-library');
test('Legacy defaults stay unchanged; stored limits gate bounded review without city branches',()=>{
  assert.equal(scale.policy().defaultMode,'legacy');
  assert.equal(scale.mode({},scale.policy()),'legacy');assert.equal(scale.mode({view:'clustered'},scale.policy()),'clustered');
  const p=scale.policy({performance:{raw_map_marker_limit:5000}});assert.equal(p.defaultMode,'clustered');assert.equal(p.rawMarkerLimit,5000);
  assert.throws(()=>scale.mode({view:'legacy'},p),{status:400});assert.throws(()=>scale.mode({view:['clustered']}),{status:400});
  assert.equal(scale.policy({saved_review:{mode:'clustered',raw_marker_limit:60000,cluster_limit:50000}}).rawMarkerLimit,5000);
  assert.equal(scale.policy({saved_review:{mode:'clustered',cluster_limit:50000}}).clusterLimit,1000);
  const ctx=contextFrom({PROFILE_CODE:'ANY_PROFILE',CONFIG_DOCUMENT:{config:{geography:{community_area_label:'Community Area'},performance:{raw_map_marker_limit:5000}}}});assert.equal(ctx.savedReview.required,true);assert.equal(ctx.areaLabel,'Community Area');
});
test('Paging and viewport inputs are bounded and reject malformed values',()=>{
  const o=scale.options({offset:'39500',limit:'200',mapLimit:'25000',zoom:'19',bbox:'-88,41,-87,42'});assert.equal(o.rawLimit,5000);assert.equal(o.offset,39500);
  for(const q of [{offset:-1},{offset:1.5},{offset:true},{offset:100000001},{zoom:'NaN'},{zoom:20},{bbox:'-181,41,-87,42'},{bbox:'0,0,0,1'},{bbox:'0,2,1,1'},{bbox:'0,,1,1'},{bbox:['0,0,1,1']},{mapLimit:0},{limit:201}])assert.throws(()=>scale.options(q),{status:400});
  const p=scale.pagination(39600,75,39649,49);assert.deepEqual({start:p.start,end:p.end,next:p.hasNext,previous:p.hasPrevious},{start:39601,end:39649,next:false,previous:true});
  assert.equal(scale.pagination(0,75,0,0).start,0);
});
test('Dateline viewport is explicitly split, ordinary bounds use intersection',()=>{
  let b={};assert.match(scale.viewportWhere({bbox:[170,-10,-170,10]},b),/OR/);assert.equal(b.west,170);assert.equal(b.east,-170);
  b={};assert.match(scale.viewportWhere({bbox:[-88,41,-87,42]},b),/longitude>=:west AND/);
});
const sql={joins:'FROM z_base_crime_incidents i JOIN z_base_incident_reports r ON r.dataset_profile_id=i.dataset_profile_id AND r.incident_id=i.incident_id',where:'i.dataset_profile_id=:pid',binds:{pid:123},physicalSql:'i.latitude IS NOT NULL',areaSql:'i.suburb'};
test('Extent planning skips tiny high-zoom cells and reaches a guaranteed bound in at most two scans',()=>{
  for(const [WEST,SOUTH,EAST,NORTH] of [[152,-28,154,-26],[-180,-90,180,90],[-88,41,-87,42],[0,0,0,0]]){
    const p=scale.policy(),plan=scale.gridPlan(scale.options({zoom:19}),p,{WEST,SOUTH,EAST,NORTH}),d=plan.gridDegrees*2;
    const upper=(Math.floor((EAST+180)/d)-Math.floor((WEST+180)/d)+1)*(Math.floor((NORTH+90)/d)-Math.floor((SOUTH+90)/d)+1);
    assert.ok(upper<=p.clusterLimit);if(EAST>WEST)assert.ok(plan.skippedSteps>0);
  }
});
test('Full-volume clustered results reconcile, remain bounded and never return raw rows',async()=>{
  const queried=[];let n=0;
  const c={execute:async(q,b)=>{queried.push({q,b});n++;return {rows:n===1?Array.from({length:17},(_,i)=>({GRID_X:i,GRID_Y:0,RECORD_COUNT:1})): [{GRID_X:0,GRID_Y:0,RECORD_COUNT:20000,LATITUDE:41,LONGITUDE:-87},{GRID_X:1,GRID_Y:0,RECORD_COUNT:19649,LATITUDE:42,LONGITUDE:-88}]};}};
  const result=await scale.mapData(c,sql,scale.options({zoom:19}),{...scale.policy(),clusterLimit:16},{PHYSICAL_COUNT:39649,REFERENCE_COUNT:0});
  assert.equal(result.mode,'clusters');assert.equal(result.representedCount,39649);assert.equal(result.coarseningSteps,1);assert.deepEqual(result.markers,[]);assert.equal(result.sampled,false);
  assert.ok(queried.every(x=>x.b.pid===123&&x.b.clusterFetch===17&&/GROUP BY grid_x,grid_y/.test(x.q)));assert.equal(queried[1].b.cellDegrees,2*queried[0].b.cellDegrees);
});
test('Raw viewport returns all points only below limit, exact count mismatch fails closed',async()=>{
  const p=scale.policy(),o=scale.options({zoom:15,mapLimit:2});const c={execute:async(q,b)=>{assert.equal(b.rawLimit,2);assert.equal(b.pid,123);return {rows:[{INCIDENT_REF:'a'},{INCIDENT_REF:'b'}]};}};
  const result=await scale.mapData(c,sql,o,p,{PHYSICAL_COUNT:2,REFERENCE_COUNT:10});assert.equal(result.mode,'markers');assert.equal(result.referenceOnly,10);
  await assert.rejects(scale.mapData({execute:async()=>({rows:[{INCIDENT_REF:'a'}]})},sql,o,p,{PHYSICAL_COUNT:2}),/reconcile/);
  await assert.rejects(scale.mapData({execute:async()=>({rows:[{RECORD_COUNT:1}]})},sql,scale.options(),p,{PHYSICAL_COUNT:2}),/reconcile/);
});
test('Reference-only and empty selections produce zero map markers with exact totals',async()=>{
  const result=await scale.mapData({execute:()=>{throw Error('No query needed');}},sql,scale.options(),scale.policy(),{PHYSICAL_COUNT:0,REFERENCE_COUNT:3803});
  assert.equal(result.viewportPhysical,0);assert.equal(result.referenceOnly,3803);assert.deepEqual(result.markers,[]);assert.deepEqual(result.clusters,[]);
});
test('Paged endpoint binds profile, all filters and deterministic offset order',async()=>{
  const calls=[],profile={DATASET_PROFILE_ID:123,PROFILE_CODE:'TEST_PROFILE',CONFIG_DOCUMENT:{config:{time_zone:'America/Chicago'}}};
  const c={execute:async(q,b)=>{calls.push({q,b});if(calls.length===1)return {rows:[profile]};if(calls.length===2)return {rows:[{TOTAL_COUNT:39649,PHYSICAL_COUNT:35846,REFERENCE_COUNT:3803}]};return {rows:[{INCIDENT_REF:'SYN-CHI-2026-039649'}]};}};
  const result=await recordPage(c,'TEST_PROFILE',{offset:'39648',limit:'1',q:'parcel',area:'OHARE',group:'THEFT',from:'2026-06-30',to:'2026-06-30'});
  assert.equal(result.pagination.hasNext,false);assert.equal(calls[2].b.offset,39648);assert.equal(calls[2].b.pid,123);assert.equal(calls[2].b.q,'parcel');assert.equal(calls[2].b.area,'OHARE');
  assert.match(calls[2].q,/ORDER BY i.occurred_at,i.incident_ref,i.incident_id OFFSET :offset ROWS/);assert.match(calls[2].q,/America\/Chicago/);
});
test('Both new endpoints reject non-admin before accessing saved data',async()=>{
  let dbCalls=0;const lib=createProfileLibrary(async()=>{dbCalls++;throw Error('No database allowed');});const routes=new Map();lib.register({get:(p,fn)=>routes.set(p,fn)});
  for(const suffix of ['map','records']){
    let status=200,payload;const res={status:s=>{status=s;return res;},json:x=>{payload=x;}};
    await routes.get('/api/setup/profiles/:profileCode/review/'+suffix)({demoUser:'read_only_viewer',params:{profileCode:'TEST_PROFILE'},query:{}},res);
    assert.equal(status,403);assert.ok(payload.error);
  }
  assert.equal(dbCalls,0);
});
