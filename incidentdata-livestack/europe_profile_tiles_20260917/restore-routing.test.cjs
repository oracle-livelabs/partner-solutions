'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {requestedProfile,profileSelectionGuard}=require('../backend/setup-profile-selection');
const source=fs.readFileSync(path.join(__dirname,'runtime_server_after.js'),'utf8');
const lines=source.split('\n').filter(l=>l.startsWith("app.post('/api/setup/load',")||l.startsWith("app.post('/api/setup/load-nrt',"));assert.equal(lines.length,2);
async function request(code,action='load',user='statewide_admin'){
 const calls=[],routes=new Map(),result={status:200};
 const res={status(n){result.status=n;return this;},json(x){result.body=x;return this;}};
 const req={method:'POST',path:'/'+action,demoUser:user,body:{profileCode:code}};
 vm.runInNewContext(lines.join('\n'),{app:{post:(p,h)=>routes.set(p,h)},requestedProfile,setupAdmin:()=>user==='statewide_admin',profileStatus:async(u,p)=>({profile:{PROFILE_NAME:p}}),db:async(u,fn)=>fn({execute:async(sql,binds)=>{calls.push({sql,binds});return {rows:[]};}}),console});
 let proceed=false;profileSelectionGuard(req,res,()=>proceed=true);if(proceed)await routes.get('/api/setup/'+action)(req,res);
 return {calls,...result};
}
for(const code of ['ADELAIDE_DATA','ADELAIDE_DATA_V2','PERTH_DATA','BRISBANE_DATA','AMSTERDAM_DATA_V1','BRUSSELS_DATA_V1','DUBLIN_CITY_DATA_V1'])test('actual restore route binds '+code+' without fallback (mock DB only)',async()=>{
 const result=await request(code);assert.equal(result.status,200);assert.equal(result.calls.length,1);assert.equal(result.calls[0].binds.profileCode,code);assert.match(result.calls[0].sql,/z_base_dataset_admin\.restore_profile\(:profileCode\)/);
});
test('invalid and unauthorised restores never reach database execution',async()=>{
 for(const code of ['TYPO',undefined,'constructor']){const r=await request(code);assert.equal(r.status,400);assert.equal(r.calls.length,0);}
 const r=await request('DUBLIN_CITY_DATA_V1','load','read_only_viewer');assert.equal(r.status,403);assert.equal(r.calls.length,0);
});
test('European NRT rejected before execution, Australian NRT target preserved',async()=>{
 for(const code of ['AMSTERDAM_DATA_V1','BRUSSELS_DATA_V1','DUBLIN_CITY_DATA_V1']){const r=await request(code,'load-nrt');assert.equal(r.status,400);assert.equal(r.calls.length,0);}
 for(const code of ['ADELAIDE_DATA_V2','PERTH_DATA','BRISBANE_DATA']){const r=await request(code,'load-nrt');assert.equal(r.status,200);assert.equal(r.calls[0].binds.profileCode,code);}
});
