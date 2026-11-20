const test=require('node:test'),assert=require('node:assert/strict');
const {NOTICE,profileCode,parseFilters,contextFrom,zonedSql,createProfileLibrary,whereFor,detail}=require('../backend/profile-library');
const {presentationCopy}=require('../backend/presentation-copy');
const {setupMutationGuard}=require('../backend/setup-mutation-guard');
test('profile identifiers are explicit and never fall back to another city',()=>{
  assert.equal(profileCode('AMSTERDAM_DATA_V1'),'AMSTERDAM_DATA_V1');
  for(const code of [undefined,'','../ADELAIDE_DATA','constructor','A\' OR 1=1--',['ADELAIDE_DATA']])assert.throws(()=>profileCode(code),{status:400});
});
test('saved filters validate real calendar dates and independent marker limits',()=>{
  const f=parseFilters({from:'2026-05-01',to:'2026-06-30',role:'locality_reference'});assert.equal(f.mapLimit,15000);assert.equal(f.limit,75);
  for(const q of [{from:'2026-02-30'},{from:'2026-07-01',to:'2026-06-30'},{role:'any'},{limit:201},{mapLimit:25001},{q:['a']},{q:'x'.repeat(201)}])assert.throws(()=>parseFilters(q),{status:400});
});
test('stored configuration supplies timezone; legacy missing zone is explicit UTC',()=>{
  const base={PROFILE_CODE:'A',PROFILE_NAME:'A',CITY_LABEL:'A',PROFILE_STATUS:'staged'};
  const c=contextFrom({...base,CONFIG_DOCUMENT:{config:{time_zone:'Europe/Amsterdam',locale:'en-GB'},activation_ready:false}});
  assert.equal(c.timeZone,'Europe/Amsterdam');assert.equal(c.activationReady,false);assert.equal(c.notice,NOTICE);
  assert.equal(contextFrom(base).timeZoneConfigured,false);assert.equal(contextFrom(base).timeZone,'UTC');
  assert.throws(()=>zonedSql('i.occurred_at','UTC\' OR 1=1'),{status:400});
  assert.match(zonedSql('i.occurred_at','Europe/Amsterdam'),/AT TIME ZONE 'Europe\/Amsterdam'/);
});
test('neutral administrative geography and Irish timezone need no city branch',()=>{
  const context=contextFrom({PROFILE_CODE:'DUBLIN_CITY_DATA_V1',CONFIG_DOCUMENT:{config:{time_zone:'Europe/Dublin',locale:'en-IE'}}});
  assert.equal(context.timeZone,'Europe/Dublin');
  const sql=whereFor({},context.timeZone);
  assert.match(sql,/\$\.administrative_area_name/);
  assert.match(sql,/\$\.district_area_name_nl/);
  assert.match(sql,/AT TIME ZONE 'Europe\/Dublin'/);
});
test('source prose, identifiers, notices and JSON survive presentation unchanged',()=>{
  const record={REPORT_TEXT:'A fictional witness reported a synthetic sample.',REPORT_SUMMARY:'Rhônepark: a resident\'s account',INCIDENT_ATTRIBUTES:{synthetic_record:true,synthetic_profile_code:'synthetic-demo',source:'fictional source label'},PROFILE_NOTES:NOTICE,notice:NOTICE,PROFILE_CODE:'SYNTHETIC_PROFILE',AREA_NAME:'Synthetic coverage (not a police unit)'};
  assert.deepEqual(presentationCopy(record),record);assert.equal(presentationCopy({explanation:'synthetic demonstration'}).explanation,'demonstration demonstration');
});
test('saved library rejects every non-admin before opening a database connection',async()=>{
  const library=createProfileLibrary(()=>{throw Error('Must not access saved rows');});
  for(const user of ['central_analyst','northern_analyst','southern_analyst','read_only_viewer','unknown'])await assert.rejects(library.status(user,'AMSTERDAM_DATA_V1'),{status:403});
});
test('detail binds both selected profile and incident; cross-profile reference is 404',async()=>{
  const queries=[];const c={execute:async(sql,binds)=>{queries.push({sql,binds});return {rows:queries.length===1?[{DATASET_PROFILE_ID:30,PROFILE_CODE:'AMSTERDAM_DATA_V1',CONFIG_DOCUMENT:{config:{time_zone:'Europe/Amsterdam'}}}]:[]};}};
  await assert.rejects(detail(c,'AMSTERDAM_DATA_V1','SYN-BRU-2026-00003'),{status:404});
  assert.equal(queries[1].binds.pid,30);assert.equal(queries[1].binds.reference,'SYN-BRU-2026-00003');
  assert.match(queries[1].sql,/cat.dataset_profile_id=i.dataset_profile_id/);assert.match(queries[1].sql,/r.dataset_profile_id=i.dataset_profile_id/);
  assert.match(whereFor({},'Europe/Amsterdam'),/DBMS_LOB.INSTR\(LOWER\(r.report_text\)/);
});
test('mutation guard blocks new/unknown profiles, missing approval and stale global state',async()=>{
  let dbCalls=0,nextCalls=0;const db=async(user,fn)=>{dbCalls++;return fn({execute:async sql=>({rows:sql.includes('role_name')?[{ROLE_NAME:'admin',IS_ACTIVE:1}]:[{PROFILE_CODE:'BRUSSELS_DATA_V1',CONFIG_DOCUMENT:{config:{time_zone:'Europe/Brussels'}}}]})});};
  const guard=setupMutationGuard({legacyProfiles:{ADELAIDE_DATA:{}},db});
  async function run(body,user='statewide_admin',path='/load'){let status=200;const res={status(n){status=n;return this;},json(){}};await guard({method:'POST',path,body,demoUser:user},res,()=>nextCalls++);return status;}
  assert.equal(await run({profileCode:'AMSTERDAM_DATA_V1',confirmation:'ACTIVATE AMSTERDAM_DATA_V1'}),409);assert.equal(dbCalls,0);
  assert.equal(await run({profileCode:'TYPO'}),409);assert.equal(await run({profileCode:'ADELAIDE_DATA'}),400);
  assert.equal(await run({profileCode:'ADELAIDE_DATA'},'read_only_viewer'),403);
  assert.equal(await run({profileCode:'ADELAIDE_DATA',confirmation:'ACTIVATE ADELAIDE_DATA',expectedActiveProfileCode:'PERTH_DATA'}),409);
  assert.equal(await run({profileCode:'ADELAIDE_DATA',expectedActiveProfileCode:'BRUSSELS_DATA_V1'},'statewide_admin','/backup'),409);
  assert.equal(nextCalls,0);
});
test('presentation helpers reject NULL/blank/non-physical coordinates and retain genuine zero',async()=>{
  const {physicalCoordinates,boundsFromContext,formatProfileTime}=await import('../frontend/src/profile-presentation.mjs');
  for(const v of [null,undefined,'',' ',false,NaN,Infinity])assert.equal(physicalCoordinates({LATITUDE:v,LONGITUDE:4.9}),null);
  assert.equal(physicalCoordinates({LATITUDE:52,LONGITUDE:4,LOCATION_ROLE:'locality_reference'}),null);
  assert.equal(physicalCoordinates({LATITUDE:91,LONGITUDE:4}),null);assert.deepEqual(physicalCoordinates({LATITUDE:0,LONGITUDE:0}),[0,0]);
  assert.deepEqual(boundsFromContext({bounds:[4.728,52.277,5.108,52.432]}),[[52.277,4.728],[52.432,5.108]]);
  const local=formatProfileTime('2026-04-30T22:15:16Z',{timeZone:'Europe/Amsterdam',locale:'en-GB'});
  assert.match(local,/01 May 2026/);assert.match(local,/00:15:16/);assert.match(local,/GMT\+02:00/);assert.match(local,/Europe\/Amsterdam/);
});
