'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const ROOT=path.dirname(__dirname),NAME='policeadelaide_app-fu40_1',IMAGE='local/adelaide-crime-intelligence:usa-foundation-tiles-20260920';
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n))),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const inspect=()=>JSON.parse(execFileSync('podman',['inspect',NAME],{encoding:'utf8'}))[0];
const settings=app=>Object.fromEntries(app.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));
const manifest=()=>JSON.parse(execFileSync('podman',['exec',NAME,'node','-e',`const fs=require('fs'),crypto=require('crypto'),r={};function walk(d){for(const n of fs.readdirSync(d).sort()){const f=d+'/'+n;if(fs.statSync(f).isDirectory())walk(f);else r[f]=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');}}walk('backend');walk('frontend/dist');process.stdout.write(JSON.stringify(r));`],{encoding:'utf8',maxBuffer:8*1024*1024}));
let stage='preflight',attempted=false,env,before,beforeFiles;
function compose(rollback=false){const args=['compose','-f','compose.fu40.yml'];if(rollback)args.push('-f','usa_foundation_tiles_20260920/rollback_image.yml');args.push('up','-d','--no-build','--no-deps','app-fu40');execFileSync('podman',args,{cwd:ROOT,env,stdio:'pipe',timeout:120000,maxBuffer:4*1024*1024});}
async function healthy(){const until=Date.now()+45000;while(Date.now()<until){try{const r=await fetch('http://127.0.0.1:8706/api/health',{signal:AbortSignal.timeout(2000)});if(r.ok&&(await r.json()).status==='healthy')return;}catch{}await new Promise(r=>setTimeout(r,800));}throw Error('Health timeout');}
function sameSettings(a,b){
  const x=settings(a),y=settings(b),changed=[...new Set([...Object.keys(x),...Object.keys(y)])].filter(k=>k!=='HOSTNAME'&&x[k]!==y[k]);
  assert.equal(changed.length,0,'Changed setting names: '+changed.join(','));
  const mounts=a=>a.Mounts.map(m=>({type:m.Type,source:m.Source,destination:m.Destination,rw:m.RW})).sort((a,b)=>a.destination.localeCompare(b.destination));
  assert.deepEqual(mounts(a),mounts(b));assert.deepEqual(a.HostConfig.PortBindings,b.HostConfig.PortBindings);
}
async function catalogue(){
  const mappings=[];
  for(const[code,count,nrt,restore=true]of [['ADELAIDE_DATA_V2',21532,true],['PERTH_DATA',33511,true],['BRISBANE_DATA',42317,true],['AMSTERDAM_DATA_V1',14467,false],['BRUSSELS_DATA_V1',25691,false],['DUBLIN_CITY_DATA_V1',17817,false],['BOSTON_CITY_DATA_V1',14513,false,false],['CHICAGO_CITY_DATA_V2',39649,false,false],['LAS_VEGAS_URBAN_DATA_V1',19527,false,false]]){
    const r=await fetch('http://127.0.0.1:8706/api/setup/profiles?profileCode='+code,{headers:{'X-Demo-User':'statewide_admin'},signal:AbortSignal.timeout(10000)});assert.equal(r.status,200);const d=await r.json();
    assert.equal(d.profile.PROFILE_CODE,code);assert.equal(d.backup.INCIDENTS,count);assert.equal(d.profiles.length,10);assert.equal(d.activeProfileCode,'DUBLIN_CITY_DATA_V1');
    assert.equal(d.live.INCIDENTS,17817);assert.equal(d.live.PERSONS,13);assert.equal(d.live.CASES,5);assert.equal(d.capabilities.restore,restore);assert.equal(d.capabilities.nrtRestore,nrt);mappings.push({code,count,nrt,restore});
  }return mappings;
}
(async()=>{
  for(const name of ['build_checks.json','preview_api.json','preview_browser.json','image_build.json'])assert.equal(read(name).status,'passed',name);
  const pre=read('preflight.json'),build=read('image_build.json');
  assert.equal(fs.existsSync(path.join(__dirname,'deployment.json')),false);
  before=inspect();assert.equal(before.Id,pre.container_before);assert.equal(before.Image,pre.image_id_before);beforeFiles=manifest();
  for(const [file,digest]of Object.entries(pre.runtime_manifest))assert.equal(beforeFiles[file],digest,file);
  for(const [file,digest]of Object.entries(build.manifest)){
    const local=file.startsWith('backend/')?path.join(ROOT,file):path.join(__dirname,'dist',file.slice('frontend/'.length));assert.equal(hash(fs.readFileSync(local)),digest,'Built source changed: '+file);
  }
  const original=fs.readFileSync(path.join(__dirname,'before/compose.fu40.yml'),'utf8'),current=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'),'utf8');
  assert.equal(hash(original),pre.compose_before_sha256);assert.equal(current,original.replace('image: local/adelaide-crime-intelligence:saved-profile-scale-20260920','image: '+IMAGE),'Only the app image may change in compose');
  const prior=settings(before);env={...process.env};
  for(const[,key]of current.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)){assert(!['HOME','PATH','CODEX_HOME'].includes(key));if(prior[key]!==undefined)env[key]=prior[key];}
  Object.assign(env,{ADB_CONNECT_STRING:prior.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:prior.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:prior.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'});
  const image=JSON.parse(execFileSync('podman',['image','inspect',IMAGE],{encoding:'utf8'}))[0];assert.equal(image.Id,build.image_id);assert.notEqual(image.Id,before.Image);
  await catalogue();stage='application recreation';attempted=true;compose();stage='health';await healthy();const after=inspect();assert.equal(after.Image,image.Id);
  stage='settings';sameSettings(before,after);stage='runtime files';const afterFiles=manifest();
  const changed=new Set([...pre.changed_backend_files,...pre.added_backend_files]);
  for(const[file,digest]of Object.entries(beforeFiles))if(!changed.has(file)&&!file.startsWith('frontend/dist/assets/')&&file!=='frontend/dist/index.html')assert.equal(afterFiles[file],digest,'Unrelated runtime file: '+file);
  for(const[file,digest]of Object.entries(build.manifest)){const target=file.startsWith('backend/')?file:'frontend/dist/'+file.slice('frontend/'.length);assert.equal(afterFiles[target],digest,target);}
  // Old hashed assets also remain untouched unless explicitly present in the
  // build. Public photographs and other base assets are never overwritten.
  for(const[file,digest]of Object.entries(beforeFiles))if(file.startsWith('frontend/dist/assets/')&&!build.manifest['frontend/'+file.slice('frontend/dist/'.length)])assert.equal(afterFiles[file],digest,file);
  stage='profile capabilities';const mappings=await catalogue();
  for(const check of ['check_api.cjs','check_browser.cjs']){stage='live '+check;console.log('Verifying '+stage);execFileSync(process.execPath,[path.join(__dirname,check),'--live'],{cwd:ROOT,stdio:'inherit',timeout:360000});}
  fs.writeFileSync(path.join(__dirname,'deployment.json'),JSON.stringify({status:'deployed_healthy',at:new Date().toISOString(),image_before:before.ImageName,image_after:after.ImageName,image_id_after:after.Image,container_after:after.Id,started_at:after.State.StartedAt,settings_unchanged:true,mounts_unchanged:true,ports_unchanged:true,unrelated_backend_and_public_assets_unchanged:true,profile_mappings:mappings,active_profile_unchanged:'DUBLIN_CITY_DATA_V1',database_writes_sent:0,restore_invoked:false,rollback_image_retained:before.ImageName,live_api_and_browser:'passed'},null,2)+'\n',{flag:'wx'});
  console.log('Nine-city tile deployment verified. Dublin and all ten saved profiles preserved.');
})().catch(async error=>{
  const failure={status:'failed',at:new Date().toISOString(),stage,app_recreation_attempted:attempted,rollback_verified:false};
  if(attempted){try{compose(true);await healthy();const restored=inspect();assert.equal(restored.Image,before.Image);sameSettings(before,restored);failure.rollback_verified=true;console.error('Verification failed at '+stage+'; previous image restored.');}catch{console.error('Failure at '+stage+'; rollback needs operator review.');}}
  else console.error('Stopped before runtime changes at '+stage+'.');
  // Do not print child-process arguments, environment or compose output.
  if(error.code==='ERR_ASSERTION')failure.assertion=error.message;
  fs.writeFileSync(path.join(__dirname,'deployment_failure.json'),JSON.stringify(failure,null,2)+'\n',{mode:0o600});process.exitCode=1;
});
