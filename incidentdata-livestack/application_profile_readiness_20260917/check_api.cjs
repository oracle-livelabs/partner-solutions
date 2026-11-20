/* GET-only acceptance against isolated app + unchanged production service. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dataRoot=path.join(root,'synthetic_amsterdam_may_jun_2026_v1');
const read=f=>JSON.parse(fs.readFileSync(path.join(dataRoot,f),'utf8'));
const data=f=>fs.readFileSync(path.join(dataRoot,'staging',f),'utf8').trim().split('\n').map(JSON.parse);
const result={started_at:new Date().toISOString(),environment:'isolated loopback application; real FU40 data; GET only',checks:{},requests:[]};
async function get(route,{status=200,user='statewide_admin',port=18706,quiet=false}={}){
 const started=Date.now(),response=await fetch(`http://127.0.0.1:${port}${route}`,{headers:{'X-Demo-User':user},signal:AbortSignal.timeout(45000)});
 const body=await response.json();assert.equal(response.status,status,`${route}: ${JSON.stringify(body).slice(0,200)}`);
 if(!quiet)result.requests.push({route,port,user,status,elapsed_ms:Date.now()-started});return body;
}
(async()=>{
 const validation=read('staging/validation_report.json'),incidents=data('incidents.jsonl'),byRef=new Map(incidents.map(i=>[i.incident_ref,i]));
 const prefix='/api/setup/profiles/AMSTERDAM_DATA_V1';
 const catalog=await get('/api/setup/profiles?profileCode=AMSTERDAM_DATA_V1');
 assert.equal(catalog.profile.PROFILE_CODE,'AMSTERDAM_DATA_V1');assert.equal(catalog.activeProfileCode,'BRUSSELS_DATA_V1');assert.equal(catalog.profiles.length,6);assert.equal(catalog.capabilities.restore,false);
 result.checks.catalogue_six_profiles_and_explicit_saved_selection=true;
 await get('/api/setup/profiles?profileCode=DOES_NOT_EXIST',{status:404});await get('/api/setup/profiles?profileCode=constructor',{status:400});
 const full=await get(prefix+'/review?limit=1');
 assert.equal(full.summary.TOTAL_COUNT,14467);assert.equal(full.summary.PHYSICAL_COUNT,13297);assert.equal(full.summary.REFERENCE_COUNT,1170);assert.equal(full.summary.LOCAL_DATES,61);
 assert.equal(full.markers.length,13297);assert.equal(full.markersTruncated,false);assert.equal(full.categories.length,39);assert.equal(full.areas.length,9);assert.equal(full.context.timeZone,'Europe/Amsterdam');
 const markerRefs=new Set();for(const m of full.markers){const source=byRef.get(m.INCIDENT_REF);assert(source);assert.equal(m.LATITUDE,source.latitude);assert.equal(m.LONGITUDE,source.longitude);assert.notEqual(source.incident_attributes.location_role,'locality_reference');markerRefs.add(m.INCIDENT_REF);}
 assert.equal(markerRefs.size,13297);result.checks.all_physical_api_coordinates_exactly_match_validated_source=true;
 const count=async(params,expected)=>{const x=await get(prefix+'/review?'+new URLSearchParams({...params,limit:1,mapLimit:1}));assert.equal(x.summary.TOTAL_COUNT,expected,JSON.stringify(params));return x;};
 for(const [group,n] of Object.entries(validation.counts.group))await count({group},n);
 for(const [category,n] of Object.entries(validation.counts.category))await count({category},n);
 for(const [area,n] of Object.entries(validation.counts.district))await count({area},n);
 result.checks.all_11_groups_39_categories_9_areas_match=true;
 await count({from:'2026-05-01',to:'2026-05-31'},7447);await count({from:'2026-06-01',to:'2026-06-30'},7020);await count({from:'2026-05-01',to:'2026-05-01'},247);
 result.checks.profile_local_month_and_midnight_boundaries=true;
 const online=await get(prefix+'/review?role=locality_reference');assert.equal(online.summary.TOTAL_COUNT,1170);assert.equal(online.markers.length,0);assert(online.records.every(r=>r.LATITUDE===null&&r.LONGITUDE===null));
 result.checks.online_references_never_map=true;
 await count({q:"' OR 1=1 --"},0);await count({q:'%'},0);
 const reports=data('reports.jsonl');const phrase='short absence followed by the discovery of a damaged lock';const expected=reports.filter(r=>(r.report_text+' '+r.report_summary).toLowerCase().includes(phrase)).length;
 await count({q:phrase},expected);const accent=await get(prefix+'/review?q='+encodeURIComponent('Rhônepark')+'&limit=1&mapLimit=1');assert.equal(accent.summary.TOTAL_COUNT,37);
 result.checks_full_report_search_literal_escaping_and_accented_search=true;
 const sample=read('staging/stratified_review_sample.json');let index=0,verified=0;
 await Promise.all(Array.from({length:3},async()=>{while(index<sample.length){const s=sample[index++],ref=s.incident.incident_ref;const got=await get(prefix+'/incidents/'+ref,{quiet:true});assert.equal(got.incident.REPORT_SUMMARY,s.report.report_summary);assert.equal(got.incident.REPORT_TEXT,s.report.report_text);assert.equal(got.incident.OCCURRED_AT,s.incident.occurred_at);assert.deepEqual(got.incident.INCIDENT_ATTRIBUTES,s.incident.incident_attributes);assert.deepEqual(got.evidence.map(e=>e.EVIDENCE_METADATA),s.evidence);verified++;}}));
 result.checks.stratified_file_database_api_roundtrips=verified;
 await get(prefix+'/incidents/SYN-BRU-2026-00003',{status:404});
 for(const user of ['adelaide_central_analyst','northern_analyst','southern_analyst','read_only_viewer','unknown']){
  for(const route of ['/api/setup/profiles?profileCode=AMSTERDAM_DATA_V1',prefix+'/review',prefix+'/incidents/SYN-AMS-2026-00002'])await get(route,{status:403,user});
  const live=await get('/api/dashboard',{user}),production=await get('/api/dashboard',{user,port:8706});assert.deepEqual(live.summary,production.summary);
  const ams=await get('/api/incidents?q=SYN-AMS-2026-00002',{user});assert.equal(ams.length,0);
 }
 result.checks.nonadmin_library_denied_and_live_scopes_unchanged=true;
 const active=await get('/api/profile-context');assert.equal(active.profileCode,'BRUSSELS_DATA_V1');assert.equal(active.timeZone,'Europe/Brussels');
 const map=await get('/api/incidents/map/timeline?limit=100');assert.equal(map.summary.TOTAL_COUNT,25691);assert.equal(map.timeBounds.EARLIEST_DATE,'2026-05-01');assert.equal(map.context.profileCode,'BRUSSELS_DATA_V1');
 const prod=await get('/api/health',{port:8706});assert.equal(prod.status,'healthy');
 result.checks.brussels_live_health_and_map_regression=true;
 result.status='passed';result.finished_at=new Date().toISOString();
 fs.writeFileSync(path.join(__dirname,'api_acceptance.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,requests:result.requests.length},null,2));
})().catch(e=>{result.status='failed';result.error=e.stack;fs.writeFileSync(path.join(__dirname,'api_acceptance.json'),JSON.stringify(result,null,2)+'\n');console.error(e.stack);process.exitCode=1;});
