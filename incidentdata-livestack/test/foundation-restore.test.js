'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {profileConfig,standardRestoreCodes,nrtRestoreCodes,europeanProfiles}=require('../backend/setup-profile-selection');
const {createProfileLibrary}=require('../backend/profile-library');
const source=fs.readFileSync(path.join(__dirname,'../backend/server.js'),'utf8');
const usaProfiles=['BOSTON_CITY_DATA_V1','CHICAGO_CITY_DATA_V2','LAS_VEGAS_URBAN_DATA_V1'];

// Use the actual server wiring and handlers, with database execution mocked.
async function request(code,action='load',overrides={}) {
  const mutations=[],routes=new Map();let guard,reads=0;
  const result={status:200},res={status(n){result.status=n;return this;},json(body){result.body=body;return this;}};
  const req={method:'POST',path:'/'+action,demoUser:'statewide_admin',body:{profileCode:code,confirmation:'ACTIVATE '+code,expectedActiveProfileCode:'DUBLIN_CITY_DATA_V1',...overrides.body},...overrides};
  if(overrides.body)req.body={profileCode:code,confirmation:'ACTIVATE '+code,expectedActiveProfileCode:'DUBLIN_CITY_DATA_V1',...overrides.body};
  const connection={callTimeout:30000,execute:async(sql,binds)=>{
    if(sql.startsWith('SELECT')){reads++;return{rows:sql.includes('role_name')?[{ROLE_NAME:'admin',IS_ACTIVE:1}]:[{PROFILE_CODE:'DUBLIN_CITY_DATA_V1'}]};}
    mutations.push({sql,binds,timeout:connection.callTimeout});if(overrides.executeError)throw overrides.executeError;return{rows:[]};
  }};
  const db=async(user,fn)=>fn(connection);
  const lines=source.split('\n').filter(line=>line.startsWith('const {profileConfig,')||line.startsWith('const {withDatabaseConnection,')||line.startsWith('const {createProfileRestorer}')||line.startsWith('const restoreSelectedProfile=')||line.startsWith("app.use('/api/setup',require('./setup-mutation-guard')")||/^app.post\('\/api\/setup\/(load|load-nrt|backup|delete)'/.test(line));
  assert.equal(lines.length,9,'Server must retain the tested restore policy wiring and verification helper');
  vm.runInNewContext(lines.join('\n'),{require:name=>require('../backend/'+name.slice(2)),db,app:{use:(route,fn)=>{guard=fn;},post:(route,fn)=>routes.set(route,fn)},setupAdmin:()=>req.demoUser==='statewide_admin',profileStatus:async(user,target)=>{if(overrides.statusError)throw overrides.statusError;return{profile:{PROFILE_CODE:target,PROFILE_NAME:target},activeProfileCode:target,live:{INCIDENTS:5,REPORTS:5,PERSONS:0,CASES:0},backup:{INCIDENTS:5,REPORTS:5,PERSONS:0,CASES:0}};},console:{error(){}}});
  let proceed=false;await guard(req,res,()=>{proceed=true;});
  if(proceed)await routes.get('/api/setup/'+action)(req,res);
  return{...result,mutations,reads,returnedTimeout:connection.callTimeout};
}

for(const code of standardRestoreCodes)test('confirmed actual restore handler binds only '+code,async()=>{
  const result=await request(code);assert.equal(result.status,200);assert.equal(result.mutations.length,1);
  assert.equal(result.mutations[0].binds.profileCode,code);assert.match(result.mutations[0].sql,/restore_profile\(:profileCode,:nrt,:expectedActiveProfileCode\)/);
  assert.equal(result.mutations[0].binds.nrt,0);assert.equal(result.mutations[0].binds.expectedActiveProfileCode,'DUBLIN_CITY_DATA_V1');assert.equal(result.body.restoreVerification.verified,true);
  assert.equal(result.mutations[0].timeout,300000);assert.equal(result.returnedTimeout,30000);
});

test('European profiles cannot reach NRT, capture or delete',async()=>{
  for(const code of europeanProfiles)for(const action of ['load-nrt','backup','delete']){
    const result=await request(code,action);assert.equal(result.status,400);assert.equal(result.mutations.length,0);assert.equal(result.reads,0);
  }
  for(const code of nrtRestoreCodes){const result=await request(code,'load-nrt');assert.equal(result.status,200);assert.equal(result.mutations[0].binds.profileCode,code);assert.equal(result.mutations[0].timeout,300000);assert.equal(result.returnedTimeout,30000);}
});

test('both restore routes reset timeouts after errors and require state verification without retrying',async()=>{
  for(const action of ['load','load-nrt'])for(const failure of ['executeError','statusError']){
    const result=await request('ADELAIDE_DATA_V2',action,{[failure]:new Error('NJS-123: call timeout exceeded')});
    assert.equal(result.status,500);assert.equal(result.body.verificationRequired,true);
    assert.match(result.body.error,/Refresh Data Foundation to check the active dataset before retrying/);
    assert.equal(result.mutations.length,1);assert.equal(result.mutations[0].timeout,300000);assert.equal(result.returnedTimeout,30000);
  }
});

test('all restore targets require admin, exact confirmation and current global state',async()=>{
  for(const code of standardRestoreCodes){
    for(const overrides of [
      {demoUser:'read_only_viewer'},
      {body:{confirmation:undefined}},
      {body:{confirmation:'ACTIVATE TYPO'}},
      {body:{expectedActiveProfileCode:undefined}},
      {body:{expectedActiveProfileCode:'PERTH_DATA'}},
    ]){const result=await request(code,'load',overrides);assert(result.status>=400);assert.equal(result.mutations.length,0);}
  }
  for(const code of [undefined,null,'TYPO','constructor','__proto__',['DUBLIN_CITY_DATA_V1'],{}]){
    const result=await request(code);assert.equal(result.status,409);assert.equal(result.mutations.length,0);assert.equal(result.reads,0);
  }
});

test('catalogue advertises standard and NRT capabilities independently',async()=>{
  const codes=[...standardRestoreCodes,...usaProfiles,'FUTURE_DATA'];
  for(const code of codes){
    const queries=[];
    const db=async(user,fn)=>fn({execute:async(sql,binds)=>{
      queries.push(sql);
      if(sql.includes('role_name'))return{rows:[{ROLE_NAME:'admin',IS_ACTIVE:1}]};
      if(sql.includes('z_base_active_dataset_profile'))return{rows:[{PROFILE_CODE:'DUBLIN_CITY_DATA_V1'}]};
      if(sql.includes('WHERE p.profile_code=:code'))return{rows:[{PROFILE_CODE:binds.code,DATASET_PROFILE_ID:50}]};
      return{rows:[{INCIDENTS:17817}]};
    }});
    const result=await createProfileLibrary(db,{restoreCodes:standardRestoreCodes,nrtRestoreCodes}).status('statewide_admin',code);
    assert.equal(result.capabilities.restore,standardRestoreCodes.includes(code));
    assert.equal(result.capabilities.nrtRestore,nrtRestoreCodes.includes(code));
    assert.equal(result.profile.PROFILE_CODE,code);
    assert(queries.every(sql=>sql.startsWith('SELECT')||sql==='SET TRANSACTION READ ONLY'));
  }
});

test('validated standard-only profiles allow confirmed restore, but no NRT, capture or delete',async()=>{
  for(const code of [...usaProfiles,'PERTH_DATA_V2']){assert.equal((await request(code)).status,200);for(const action of ['load-nrt','backup','delete']){
    const result=await request(code,action);
    assert.equal(result.status,400);assert.equal(result.mutations.length,0);assert.equal(result.reads,0);
  }}
});

test('nine-city order has a third USA row; only other profiles remain separately accessible',async()=>{
  const {FOUNDATION_PROFILES,foundationTiles,additionalProfiles}=await import('../frontend/src/foundation-profiles.mjs');
  assert.deepEqual(FOUNDATION_PROFILES.map(p=>p.city),['Adelaide','Perth','Brisbane','Amsterdam','Brussels','Dublin','Boston','Chicago','Las Vegas']);
  assert.deepEqual(FOUNDATION_PROFILES.slice(6).map(p=>p.code),['BOSTON_DATA_V2','CHICAGO_DATA_V2','LAS_VEGAS_DATA_V2']);
  const catalogue=[...Object.keys(profileConfig),'FUTURE_DATA'].reverse().map(PROFILE_CODE=>({PROFILE_CODE,INCIDENT_COUNT:42}));
  const tiles=foundationTiles(catalogue);assert.equal(tiles.length,9);
  for(const tile of tiles){assert.equal(tile.profile.PROFILE_CODE,tile.code);assert.equal(tile.profile.INCIDENT_COUNT,42);}
  assert.deepEqual(additionalProfiles(catalogue).map(p=>p.PROFILE_CODE).sort(),['ADELAIDE_DATA','ADELAIDE_DATA_V2','BRISBANE_DATA',...usaProfiles,'FUTURE_DATA','PERTH_DATA'].sort());
  assert.equal(tiles[0].code,'ADELAIDE_DATA_V3');
  assert.equal(tiles[1].code,'PERTH_DATA_V2');
  assert.equal(foundationTiles(catalogue.filter(p=>p.PROFILE_CODE!=='PERTH_DATA_V2'))[1].profile,undefined);
  assert.equal(foundationTiles([]).length,9);assert(foundationTiles([]).every(tile=>tile.profile===undefined));
  const withoutChicago=catalogue.filter(p=>p.PROFILE_CODE!=='CHICAGO_DATA_V2');
  assert.equal(foundationTiles(withoutChicago)[7].profile,undefined);
  assert.equal(foundationTiles(withoutChicago)[8].profile.PROFILE_CODE,'LAS_VEGAS_DATA_V2');
});
