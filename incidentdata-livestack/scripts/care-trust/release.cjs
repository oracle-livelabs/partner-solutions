'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {runtime,environment,CONTAINER}=require('../evidence-intelligence/connection.cjs');
const {ROOT,DIR,OUT,PROFILE,read,save,sha256}=require('./common.cjs');
const IMAGE='local/adelaide-crime-intelligence:care-trust-20260925';
function manifest(){const script="const fs=require('fs'),crypto=require('crypto'),r={};function walk(d){for(const n of fs.readdirSync(d)){const p=d+'/'+n;if(fs.statSync(p).isDirectory())walk(p);else r[p]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}for(const d of ['backend','frontend/dist','testdata/evidence-intelligence'])walk(d);console.log(JSON.stringify(r));";return JSON.parse(execFileSync('podman',['exec',CONTAINER,'node','-e',script],{encoding:'utf8',maxBuffer:8*1024*1024}));}
async function state(){const values={};for(const route of ['health','profile-context','evidence-intelligence']){const r=await fetch('http://127.0.0.1:8706/api/'+route,{headers:{'X-Demo-User':'statewide_admin'},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,route);values[route]=await r.json();}return {health:values.health.status,profile:values['profile-context'].profileCode,items:values['evidence-intelligence'].items.length};}
async function healthy(){for(let i=0;i<45;i++){try{const s=await state();if(s.health==='healthy'&&s.profile===PROFILE)return s;}catch{}await new Promise(resolve=>setTimeout(resolve,600));}throw Error('Health timeout');}
function settingsEqual(a,b){const x=environment(a),y=environment(b);assert.deepEqual([...new Set([...Object.keys(x),...Object.keys(y)])].filter(k=>k!=='HOSTNAME'&&x[k]!==y[k]),[],'Environment changed');const mounts=s=>s.Mounts.map(m=>({type:m.Type,source:m.Source,destination:m.Destination,rw:m.RW})).sort((a,b)=>a.destination.localeCompare(b.destination));assert.deepEqual(mounts(a),mounts(b));assert.deepEqual(a.HostConfig.PortBindings,b.HostConfig.PortBindings);}
async function main(){const mode=process.argv[2],pre=read(OUT,'preflight.json'),before=runtime();assert.equal(before.Id,pre.runtime.containerId);assert.equal(before.Image,pre.runtime.imageId);
  if(mode==='build'){
    assert.equal(read(OUT,'staged-native.json').verification.status,'passed');assert.equal(read(OUT,'preview-browser.json').status,'passed');assert.equal(read(OUT,'offline-retrieval.json').status,'passed');
    const original=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'));assert.equal(sha256(original),pre.composeSha256);fs.writeFileSync(path.join(OUT,'compose.before.yml'),original,{flag:'wx'});
    const live=manifest();for(const [p,h]of Object.entries(pre.runtime.hashes))assert.equal(live[p],h,'Baseline runtime changed '+p);
    const context=fs.mkdtempSync('/tmp/care-trust-image-'),files={};
    function copy(source,target,runtimePath){const bytes=fs.readFileSync(source);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);files[runtimePath]=sha256(bytes);}
    copy(path.join(ROOT,'backend/evidence-intelligence.js'),path.join(context,'backend/evidence-intelligence.js'),'backend/evidence-intelligence.js');
    copy(path.join(ROOT,'frontend/dist/index.html'),path.join(context,'frontend/index.html'),'frontend/dist/index.html');
    for(const name of fs.readdirSync(path.join(ROOT,'frontend/dist/assets')))copy(path.join(ROOT,'frontend/dist/assets',name),path.join(context,'frontend/assets',name),'frontend/dist/assets/'+name);
    for(const e of read(DIR,'pack.json').items)copy(path.join(DIR,e.asset.path),path.join(context,e.asset.path),'testdata/evidence-intelligence/care-trust-v1/'+e.asset.path);
    execFileSync('podman',['build','--network=none','--pull=never','-f',path.join(OUT,'Containerfile'),'-t',IMAGE,context],{cwd:ROOT,stdio:'inherit',timeout:120000});
    const built=JSON.parse(execFileSync('podman',['image','inspect',IMAGE],{encoding:'utf8'}))[0];save(OUT,'build.json',{status:'passed',at:new Date().toISOString(),image:IMAGE,imageId:built.Id,files,context,oldManifest:live,allowedBackendChanges:['backend/evidence-intelligence.js'],evaluationAnswersDeployed:false},true);return;
  }
  assert.equal(mode,'deploy');const build=read(OUT,'build.json');assert.equal(build.status,'passed');assert.deepEqual(manifest(),build.oldManifest);
  const current=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'),'utf8'),original=fs.readFileSync(path.join(OUT,'compose.before.yml'),'utf8');assert.equal(sha256(original),pre.composeSha256);assert.equal(current,original.replace('image: local/adelaide-crime-intelligence:evidence-map-fix-20260924','image: '+IMAGE));
  const prior=environment(before),env={...process.env};for(const [,key]of current.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)){assert(!['HOME','PATH','CODEX_HOME'].includes(key));if(prior[key]!==undefined)env[key]=prior[key];}
  Object.assign(env,{ADB_CONNECT_STRING:prior.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:prior.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:prior.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'});
  function compose(rollback=false){const args=['compose','-f','compose.fu40.yml'];if(rollback)args.push('-f','care_trust_20260925/rollback-image.yml');args.push('up','-d','--no-build','--no-deps','app-fu40');execFileSync('podman',args,{cwd:ROOT,env,stdio:'pipe',timeout:120000});}
  let attempted=false,stage='pre-deploy guard';try{
    assert.deepEqual(await state(),{health:'healthy',profile:PROFILE,items:32});
    assert.equal(JSON.parse(execFileSync('podman',['image','inspect',IMAGE],{encoding:'utf8'}))[0].Id,build.imageId);
    attempted=true;stage='recreate app';compose();const ready=await healthy(),after=runtime();assert.equal(after.Image,build.imageId);settingsEqual(before,after);
    stage='runtime integrity';const actual=manifest();for(const[p,h]of Object.entries(build.oldManifest))if(!build.files[p])assert.equal(actual[p],h,'Prior runtime file changed '+p);for(const[p,h]of Object.entries(build.files))assert.equal(actual[p],h,p);
    assert(!Object.keys(actual).some(p=>/expected\.json|anchors\.json|knowledge-set\.json/.test(p)),'Private fixture instructions were deployed');
    assert.deepEqual(ready,{health:'healthy',profile:PROFILE,items:32});
    save(OUT,'deployment.json',{status:'deployed_healthy',at:new Date().toISOString(),image:after.ImageName,imageId:after.Image,containerId:after.Id,rollbackImage:before.ImageName,state:ready,existingAssetsPreserved:true,settingsUnchanged:true,profileSwitch:false,dataLoadPending:true},true);console.log('Updated app deployed healthy; Care-Trust data not yet committed.');
  }catch(e){const failure={stage,attempted,rollbackVerified:false};if(attempted)try{compose(true);await healthy();assert.equal(runtime().Image,before.Image);settingsEqual(before,runtime());failure.rollbackVerified=true;}catch{}save(OUT,'deployment-failure.json',failure,true);console.error(JSON.stringify({...failure,error:e.code==='ERR_ASSERTION'?e.message:e.name}));process.exitCode=1;}
}
if(require.main===module)main().catch(e=>{console.error(e.code==='ERR_ASSERTION'?e.message:'Release stopped: '+(e.code||e.name));process.exitCode=1;});
module.exports={manifest,state,healthy,settingsEqual};
