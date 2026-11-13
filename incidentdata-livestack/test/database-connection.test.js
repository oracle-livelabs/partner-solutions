'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {withCallTimeout,withDatabaseConnection,RESTORE_CALL_TIMEOUT_MS,PROFILE_READ_CALL_TIMEOUT_MS}=require('../backend/database-connection');
const {createProfileLibrary}=require('../backend/profile-library');

test('request limits are bounded; scoped timeout remains applied until asynchronous work settles',async()=>{
  assert.equal(PROFILE_READ_CALL_TIMEOUT_MS,30000);assert.equal(RESTORE_CALL_TIMEOUT_MS,300000);
  const c={callTimeout:17000};let resolve;
  const work=withCallTimeout(c,RESTORE_CALL_TIMEOUT_MS,()=>new Promise(r=>{resolve=r;}));
  assert.equal(c.callTimeout,300000);resolve('finished');assert.equal(await work,'finished');assert.equal(c.callTimeout,17000);
});

test('nested scopes restore their prior limits on success, asynchronous rejection and synchronous throw',async()=>{
  for(const prior of [0,30000,180000])for(const failure of ['none','async','sync']){
    const c={callTimeout:prior},error=new Error('database failure');
    const operation=()=>withCallTimeout(c,300000,async()=>{
      assert.equal(c.callTimeout,300000);
      await withCallTimeout(c,30000,()=>{assert.equal(c.callTimeout,30000);return Promise.resolve();});
      assert.equal(c.callTimeout,300000);
      return withCallTimeout(c,25000,()=>{if(failure==='sync')throw error;if(failure==='async')return Promise.reject(error);return 42;});
    });
    if(failure==='none')assert.equal(await operation(),42);else await assert.rejects(operation(),e=>e===error);
    assert.equal(c.callTimeout,prior);
  }
});

function pooled({executeError,closeError}={}){
  const observations=[],c={callTimeout:180000,execute:async(sql,binds)=>{observations.push({phase:'identify',timeout:c.callTimeout,sql,binds});if(executeError)throw executeError;},close:async()=>{observations.push({phase:'close',timeout:c.callTimeout});if(closeError)throw closeError;}};
  return{c,observations,pool:{getConnection:async()=>c}};
}

test('pool checkout clears stale limits before identifying the user; return resets and closes',async()=>{
  const {c,observations,pool}=pooled();
  const value=await withDatabaseConnection(pool,'statewide_admin',async connection=>{
    assert.equal(connection,c);assert.equal(c.callTimeout,0);c.callTimeout=12000;return 7;
  });
  assert.equal(value,7);assert.equal(c.callTimeout,0);assert.equal(observations[0].timeout,0);
  assert.deepEqual(observations[0].binds,{user:'statewide_admin'});assert.deepEqual(observations[1],{phase:'close',timeout:0});
});

test('pool cleanup runs after identifier failure and callback failure, preserving the original error',async()=>{
  for(const stage of ['identify','callback']){
    const original=new Error(stage),cleanup=new Error('close failure');
    const {c,observations,pool}=pooled({executeError:stage==='identify'?original:undefined,closeError:cleanup});
    await assert.rejects(withDatabaseConnection(pool,'statewide_admin',()=>{c.callTimeout=300000;throw original;}),e=>e===original);
    assert.equal(c.callTimeout,0);assert.equal(observations.filter(x=>x.phase==='close').length,1);
  }
});

test('cleanup failure after successful work is surfaced; acquisition failure never runs the callback',async()=>{
  const error=new Error('cleanup');const {pool}=pooled({closeError:error});
  await assert.rejects(withDatabaseConnection(pool,'statewide_admin',async()=>1),e=>e===error);
  let called=false;
  await assert.rejects(withDatabaseConnection({getConnection:async()=>{throw error;}},'statewide_admin',()=>{called=true;}),e=>e===error);
  assert.equal(called,false);
});

test('an unusable connection still closes and does not hide the original operation failure',async()=>{
  const original=new Error('NJS-123'),reset=new Error('unusable'),state={timeout:30000,broken:false,closed:0};
  const c={get callTimeout(){return state.timeout;},set callTimeout(v){if(state.broken)throw reset;state.timeout=v;},execute:async()=>{},close:async()=>{state.closed++;}};
  await assert.rejects(withDatabaseConnection({getConnection:async()=>c},'statewide_admin',()=>withCallTimeout(c,300000,async()=>{state.broken=true;throw original;})),e=>e===original);
  assert.equal(state.closed,1);
});

test('actual profile reader restores prior timeout after success and each failure stage',async()=>{
  for(const prior of [0,180000])for(const stage of ['success','transaction','admin','callback']){
    const error=new Error(stage),c={callTimeout:prior,execute:async sql=>{
      assert.equal(c.callTimeout,30000);
      if((stage==='transaction'&&sql==='SET TRANSACTION READ ONLY')||(stage==='admin'&&sql.includes('role_name')))throw error;
      return{rows:[{ROLE_NAME:'admin',IS_ACTIVE:1}]};
    }};
    const read=createProfileLibrary(async(user,fn)=>fn(c)).readAdmin('statewide_admin',async()=>{
      await Promise.resolve();assert.equal(c.callTimeout,30000);if(stage==='callback')throw error;return 5;
    });
    if(stage==='success')assert.equal(await read,5);else await assert.rejects(read,e=>e===error);
    assert.equal(c.callTimeout,prior);
  }
});

test('server shared db helper actually delegates to the protected pool boundary',async()=>{
  const source=fs.readFileSync(require.resolve('../backend/server.js'),'utf8');
  const declaration=source.match(/async function db\(user, fn\) \{[\s\S]*?\n\}/)?.[0];assert.ok(declaration);
  const {pool,c,observations}=pooled();
  const db=vm.runInNewContext(declaration+';db',{pool,withDatabaseConnection});
  assert.equal(await db('statewide_admin',async()=>{assert.equal(c.callTimeout,0);return 'ok';}),'ok');
  assert.equal(observations.at(-1).phase,'close');assert.equal(c.callTimeout,0);
});
