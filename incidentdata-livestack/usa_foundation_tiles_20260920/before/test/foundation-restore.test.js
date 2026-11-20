'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {profileConfig,standardRestoreCodes,nrtRestoreCodes,europeanProfiles}=require('../backend/setup-profile-selection');
const {createProfileLibrary}=require('../backend/profile-library');
const source=fs.readFileSync(path.join(__dirname,'../backend/server.js'),'utf8');

// Use the actual server wiring and handlers, with database execution mocked.
async function request(code,action='load',overrides={}) {
  const mutations=[],routes=new Map();let guard,reads=0;
  const result={status:200},res={status(n){result.status=n;return this;},json(body){result.body=body;return this;}};
  const req={method:'POST',path:'/'+action,demoUser:'statewide_admin',body:{profileCode:code,confirmation:'ACTIVATE '+code,expectedActiveProfileCode:'DUBLIN_CITY_DATA_V1',...overrides.body},...overrides};
  if(overrides.body)req.body={profileCode:code,confirmation:'ACTIVATE '+code,expectedActiveProfileCode:'DUBLIN_CITY_DATA_V1',...overrides.body};
  const db=async(user,fn)=>fn({execute:async(sql,binds)=>{
    if(sql.startsWith('SELECT')){reads++;return{rows:sql.includes('role_name')?[{ROLE_NAME:'admin',IS_ACTIVE:1}]:[{PROFILE_CODE:'DUBLIN_CITY_DATA_V1'}]};}
    mutations.push({sql,binds});return{rows:[]};
  }});
  const lines=source.split('\n').filter(line=>line.startsWith('const {profileConfig,')||line.startsWith("app.use('/api/setup',require('./setup-mutation-guard')")||/^app.post\('\/api\/setup\/(load|load-nrt|backup|delete)'/.test(line));
  assert.equal(lines.length,6,'Server must retain the tested restore policy wiring');
  vm.runInNewContext(lines.join('\n'),{require:name=>require('../backend/'+name.slice(2)),db,app:{use:(route,fn)=>{guard=fn;},post:(route,fn)=>routes.set(route,fn)},setupAdmin:()=>req.demoUser==='statewide_admin',profileStatus:async(user,target)=>({profile:{PROFILE_NAME:target}}),console});
  let proceed=false;await guard(req,res,()=>{proceed=true;});
  if(proceed)await routes.get('/api/setup/'+action)(req,res);
  return{...result,mutations,reads};
}

for(const code of standardRestoreCodes)test('confirmed actual restore handler binds only '+code,async()=>{
  const result=await request(code);assert.equal(result.status,200);assert.equal(result.mutations.length,1);
  assert.equal(result.mutations[0].binds.profileCode,code);assert.match(result.mutations[0].sql,/restore_profile\(:profileCode\)/);
});

test('European profiles cannot reach NRT, capture or delete',async()=>{
  for(const code of europeanProfiles)for(const action of ['load-nrt','backup','delete']){
    const result=await request(code,action);assert.equal(result.status,400);assert.equal(result.mutations.length,0);assert.equal(result.reads,0);
  }
  for(const code of nrtRestoreCodes){const result=await request(code,'load-nrt');assert.equal(result.status,200);assert.equal(result.mutations[0].binds.profileCode,code);}
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
  const codes=[...standardRestoreCodes,'FUTURE_DATA'];
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

test('six-city order is stable; Adelaide V1 and new profiles remain separately accessible',async()=>{
  const {FOUNDATION_PROFILES,foundationTiles,additionalProfiles}=await import('../frontend/src/foundation-profiles.mjs');
  assert.deepEqual(FOUNDATION_PROFILES.map(p=>p.city),['Adelaide','Perth','Brisbane','Amsterdam','Brussels','Dublin']);
  const catalogue=[...Object.keys(profileConfig),'FUTURE_DATA'].reverse().map(PROFILE_CODE=>({PROFILE_CODE,INCIDENT_COUNT:42}));
  const tiles=foundationTiles(catalogue);assert.equal(tiles.length,6);
  for(const tile of tiles){assert.equal(tile.profile.PROFILE_CODE,tile.code);assert.equal(tile.profile.INCIDENT_COUNT,42);}
  assert.deepEqual(additionalProfiles(catalogue).map(p=>p.PROFILE_CODE).sort(),['ADELAIDE_DATA','FUTURE_DATA']);
  assert.equal(foundationTiles([]).length,6);assert(foundationTiles([]).every(tile=>tile.profile===undefined));
});
