'use strict';
// Narrow overlay on the captured running image; never rebuild unrelated dirty workspace code.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {ROOT,DIR,OUT,read,save,sha256}=require('./common.cjs');
const {runtime,environment}=require('../evidence-intelligence/connection.cjs');
const {manifest,state,healthy,settingsEqual}=require('../care-trust/release.cjs');
const IMAGE='local/adelaide-crime-intelligence:care-trust-adelaide-20260927';
async function main(){const mode=process.argv[2],pre=read(OUT,'preflight.json'),before=runtime();assert.equal(before.Id,pre.runtime.containerId);assert.equal(before.Image,pre.runtime.imageId);
  if(mode==='build'){
    for(const name of ['browser-preview.json','saved-native-verification.json'])assert.equal(read(OUT,name).status,'passed');
    assert.equal(read(OUT,'load-committed.json').mode,'committed_saved_profile_only');assert(Object.values(read(OUT,'idempotence.json').added).every(n=>n===0));
    const original=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'));assert.equal(sha256(original),pre.composeSha256);fs.writeFileSync(path.join(OUT,'compose.before.yml'),original,{flag:'wx'});
    const live=manifest();assert.deepEqual(live,pre.runtime.manifest,'Running application changed since capture');
    const context=fs.mkdtempSync('/tmp/care-trust-adelaide-image-'),files={};
    function copy(relative,target=relative){const bytes=fs.readFileSync(path.join(ROOT,relative));const file=path.join(context,target);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);files[relative]=sha256(bytes);}
    for(const name of ['evidence-intelligence.js','investigation-trail.js','care-trust-stories.js','care-trust-adelaide-story.json'])copy('backend/'+name);
    copy('frontend/dist/index.html');for(const name of fs.readdirSync(path.join(ROOT,'frontend/dist/assets')))copy('frontend/dist/assets/'+name);
    for(const e of read(DIR,'pack.json').items)copy('testdata/evidence-intelligence/care-trust-adelaide-v1/'+e.asset.path);
    const containerfile=`FROM ${before.Image}\nWORKDIR /app\nCOPY backend/ ./backend/\nCOPY frontend/dist/ ./frontend/dist/\nCOPY testdata/evidence-intelligence/care-trust-adelaide-v1/assets/ ./testdata/evidence-intelligence/care-trust-adelaide-v1/assets/\n`;
    fs.writeFileSync(path.join(context,'Containerfile'),containerfile);fs.writeFileSync(path.join(OUT,'Containerfile'),containerfile,{flag:'wx'});
    execFileSync('podman',['build','--network=none','--pull=never','-f',path.join(context,'Containerfile'),'-t',IMAGE,context],{stdio:'inherit',timeout:120000});
    const built=JSON.parse(execFileSync('podman',['image','inspect',IMAGE],{encoding:'utf8'}))[0];
    save(OUT,'build.json',{at:new Date().toISOString(),status:'passed',image:IMAGE,imageId:built.Id,context,files,oldManifest:live,evaluationAnswersDeployed:false});
    fs.writeFileSync(path.join(OUT,'rollback-image.yml'),`services:\n  app-fu40:\n    image: ${before.ImageName}\n`,{flag:'wx'});return;
  }
  assert.equal(mode,'deploy');const build=read(OUT,'build.json');assert.deepEqual(manifest(),build.oldManifest);
  const original=fs.readFileSync(path.join(OUT,'compose.before.yml'),'utf8'),current=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'),'utf8');assert.equal(sha256(original),pre.composeSha256);
  assert.equal(current,original.replace('image: local/adelaide-crime-intelligence:care-trust-who-knows-20260925-r2','image: '+IMAGE));
  const old=environment(before),env={...process.env};for(const [,key]of current.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)){assert(!['HOME','PATH','CODEX_HOME'].includes(key));if(old[key]!==undefined)env[key]=old[key];}
  Object.assign(env,{ADB_CONNECT_STRING:old.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:old.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:old.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'});
  function compose(rollback=false){const args=['compose','-f','compose.fu40.yml'];if(rollback)args.push('-f','care_trust_adelaide_20260927/rollback-image.yml');args.push('up','-d','--no-build','--no-deps','app-fu40');execFileSync('podman',args,{cwd:ROOT,env,stdio:'pipe',timeout:120000});}
  assert.deepEqual(await state(),{health:'healthy',profile:'AMSTERDAM_DATA_V1',items:54});let attempted=false;
  try{attempted=true;compose();const ready=await healthy(),after=runtime();assert.equal(after.Image,build.imageId);settingsEqual(before,after);assert.deepEqual(ready,{health:'healthy',profile:'AMSTERDAM_DATA_V1',items:54});
    const actual=manifest();for(const[p,h]of Object.entries(build.oldManifest))if(!build.files[p])assert.equal(actual[p],h,'Unexpected runtime modification: '+p);for(const[p,h]of Object.entries(build.files))assert.equal(actual[p],h,p);
    assert(!Object.keys(actual).some(p=>/expected\.json|anchors\.json|knowledge-set\.json|care-trust-adelaide-v1\/pack\.json/.test(p)));
    save(OUT,'deployment.json',{at:new Date().toISOString(),status:'deployed_healthy',image:after.ImageName,imageId:after.Image,containerId:after.Id,rollbackImage:before.ImageName,settingsUnchanged:true,existingAssetsPreserved:true,profileSwitch:false,state:ready});console.log('Adelaide-capable application deployed; Amsterdam remains active with 54 evidence sources.');
  }catch(e){let rollbackVerified=false;if(attempted)try{compose(true);await healthy();assert.equal(runtime().Image,before.Image);settingsEqual(before,runtime());rollbackVerified=true;}catch{}save(OUT,'deployment-failure.json',{at:new Date().toISOString(),rollbackVerified});throw Error('Deployment verification failed; prior image rollback verified='+rollbackVerified);}
}
main().catch(e=>{console.error(e.code==='ERR_ASSERTION'?e.message:'Release stopped: '+(e.code||e.message));process.exitCode=1;});
