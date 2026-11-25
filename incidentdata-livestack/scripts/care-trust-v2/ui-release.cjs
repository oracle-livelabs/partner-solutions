'use strict';
// One UI-only correction, guarded against the first v2 deployment.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {ROOT,OUT,PROFILE,read,save,sha256}=require('./fixture.cjs');
const {runtime,environment}=require('../evidence-intelligence/connection.cjs');
const {manifest,state,healthy,settingsEqual}=require('../care-trust/release.cjs');
const IMAGE='local/adelaide-crime-intelligence:care-trust-who-knows-20260925-r2';
(async()=>{const mode=process.argv[2],before=runtime(),previous=read(OUT,'deployment.json');assert.equal(before.Image,previous.imageId);assert.equal(before.Id,previous.containerId);
  if(mode==='build'){
    assert.equal(read(OUT,'preview-full-browser.json').status,'passed');
    const original=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'));fs.writeFileSync(path.join(OUT,'ui-compose.before.yml'),original,{flag:'wx'});
    const context=fs.mkdtempSync('/tmp/care-trust-ui-'),files={};
    function copy(source,target,runtimePath){const bytes=fs.readFileSync(source);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);files[runtimePath]=sha256(bytes);}
    copy(path.join(ROOT,'frontend/dist/index.html'),path.join(context,'frontend/index.html'),'frontend/dist/index.html');
    for(const name of fs.readdirSync(path.join(ROOT,'frontend/dist/assets')))copy(path.join(ROOT,'frontend/dist/assets',name),path.join(context,'frontend/assets',name),'frontend/dist/assets/'+name);
    execFileSync('podman',['build','--network=none','--pull=never','-f',path.join(OUT,'UI-Containerfile'),'-t',IMAGE,context],{stdio:'inherit',timeout:120000});const built=JSON.parse(execFileSync('podman',['image','inspect',IMAGE],{encoding:'utf8'}))[0];save(OUT,'ui-build.json',{at:new Date().toISOString(),imageId:built.Id,files,oldManifest:manifest(),composeSha256:sha256(original)});return;
  }
  assert.equal(mode,'deploy');const build=read(OUT,'ui-build.json'),original=fs.readFileSync(path.join(OUT,'ui-compose.before.yml'),'utf8'),current=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'),'utf8');assert.equal(sha256(original),build.composeSha256);assert.equal(current,original.replace('image: local/adelaide-crime-intelligence:care-trust-who-knows-20260925','image: '+IMAGE));assert.deepEqual(manifest(),build.oldManifest);
  const e=environment(before),env={...process.env};for(const[,k]of current.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)){assert(!['HOME','PATH','CODEX_HOME'].includes(k));if(e[k]!==undefined)env[k]=e[k];}Object.assign(env,{ADB_CONNECT_STRING:e.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:e.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:e.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'});
  function compose(rollback=false){const args=['compose','-f','compose.fu40.yml'];if(rollback)args.push('-f','care_trust_v2_20260925/ui-rollback.yml');args.push('up','-d','--no-build','--no-deps','app-fu40');execFileSync('podman',args,{cwd:ROOT,env,stdio:'pipe',timeout:120000});}
  assert.deepEqual(await state(),{health:'healthy',profile:PROFILE,items:54});let attempted=false;
  try{attempted=true;compose();await healthy();const after=runtime();assert.equal(after.Image,build.imageId);settingsEqual(before,after);const actual=manifest();for(const[p,h]of Object.entries(build.oldManifest))if(!build.files[p])assert.equal(actual[p],h,p);for(const[p,h]of Object.entries(build.files))assert.equal(actual[p],h,p);
    save(OUT,'ui-deployment.json',{at:new Date().toISOString(),status:'deployed_healthy',image:after.ImageName,imageId:after.Image,containerId:after.Id,rollbackImage:before.ImageName,settingsUnchanged:true,backendAndDataUnchanged:true});console.log('Narrow-screen header fix deployed; backend and data unchanged.');
  }catch(e){let rollbackVerified=false;if(attempted)try{compose(true);await healthy();assert.equal(runtime().Image,before.Image);rollbackVerified=true;}catch{}save(OUT,'ui-deployment-failure.json',{rollbackVerified});throw Error('UI verification failed; rollback '+rollbackVerified);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
