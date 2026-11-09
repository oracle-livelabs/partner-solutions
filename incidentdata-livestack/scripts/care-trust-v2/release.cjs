'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {ROOT,DIR,OUT,PROFILE,read,save,sha256}=require('./fixture.cjs');
const {runtime,environment}=require('../evidence-intelligence/connection.cjs');
const {manifest,state,healthy,settingsEqual}=require('../care-trust/release.cjs');
const IMAGE='local/adelaide-crime-intelligence:care-trust-who-knows-20260925';
(async()=>{const mode=process.argv[2],before=runtime(),pre=read(OUT,'preflight.json');assert.equal(before.Image,pre.runtime.imageId);assert.equal(before.Id,pre.runtime.containerId);
  if(mode==='build'){
    assert.equal(read(OUT,'staged.json').mode,'rolled_back');assert.equal(read(OUT,'preview-browser.json').status,'passed');
    const original=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'));assert.equal(sha256(original),pre.composeSha256);fs.writeFileSync(path.join(OUT,'compose.before.yml'),original,{flag:'wx'});
    const oldManifest=manifest(),server=fs.readFileSync(path.join(ROOT,'backend/server.js'),'utf8');
    assert.equal(sha256(server.replace("require('./investigation-trail').registerInvestigationTrail(app, db);\n",'')),oldManifest['backend/server.js'],'Unrelated backend/server.js changes must not be released');
    const context=fs.mkdtempSync('/tmp/care-trust-v2-image-'),files={};
    function copy(source,target,runtimePath){const bytes=fs.readFileSync(source);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);files[runtimePath]=sha256(bytes);}
    for(const name of ['server.js','evidence-intelligence.js','investigation-trail.js','care-trust-story.json'])copy(path.join(ROOT,'backend',name),path.join(context,'backend',name),'backend/'+name);
    copy(path.join(ROOT,'frontend/dist/index.html'),path.join(context,'frontend/index.html'),'frontend/dist/index.html');
    for(const name of fs.readdirSync(path.join(ROOT,'frontend/dist/assets')))copy(path.join(ROOT,'frontend/dist/assets',name),path.join(context,'frontend/assets',name),'frontend/dist/assets/'+name);
    for(const item of read(DIR,'pack.json').items)copy(path.join(DIR,item.asset.path),path.join(context,item.asset.path),'testdata/evidence-intelligence/care-trust-v2/'+item.asset.path);
    execFileSync('podman',['build','--network=none','--pull=never','-f',path.join(OUT,'Containerfile'),'-t',IMAGE,context],{stdio:'inherit',timeout:120000});
    const built=JSON.parse(execFileSync('podman',['image','inspect',IMAGE],{encoding:'utf8'}))[0];save(OUT,'build.json',{status:'passed',at:new Date().toISOString(),image:IMAGE,imageId:built.Id,files,oldManifest,evaluatorAnswersDeployed:false});return;
  }
  assert.equal(mode,'deploy');const build=read(OUT,'build.json'),original=fs.readFileSync(path.join(OUT,'compose.before.yml'),'utf8'),current=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'),'utf8');assert.equal(sha256(original),pre.composeSha256);assert.equal(current,original.replace('image: local/adelaide-crime-intelligence:care-trust-20260925-r2','image: '+IMAGE));assert.deepEqual(manifest(),build.oldManifest);
  const oldEnv=environment(before),env={...process.env};for(const[,key]of current.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)){assert(!['HOME','PATH','CODEX_HOME'].includes(key));if(oldEnv[key]!==undefined)env[key]=oldEnv[key];}
  Object.assign(env,{ADB_CONNECT_STRING:oldEnv.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:oldEnv.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:oldEnv.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'});
  function compose(rollback=false){const args=['compose','-f','compose.fu40.yml'];if(rollback)args.push('-f','care_trust_v2_20260925/rollback.yml');args.push('up','-d','--no-build','--no-deps','app-fu40');execFileSync('podman',args,{cwd:ROOT,env,stdio:'pipe',timeout:120000});}
  assert.deepEqual(await state(),{health:'healthy',profile:PROFILE,items:48});let attempted=false;
  try{attempted=true;compose();const ready=await healthy(),after=runtime();assert.equal(after.Image,build.imageId);settingsEqual(before,after);
    const actual=manifest();for(const[p,h]of Object.entries(build.oldManifest))if(!build.files[p])assert.equal(actual[p],h,p);for(const[p,h]of Object.entries(build.files))assert.equal(actual[p],h,p);assert(!Object.keys(actual).some(p=>/expected\.json|anchors\.json/.test(p)));assert.deepEqual(ready,{health:'healthy',profile:PROFILE,items:48});
    save(OUT,'deployment.json',{at:new Date().toISOString(),status:'deployed_healthy',image:after.ImageName,imageId:after.Image,containerId:after.Id,rollbackImage:before.ImageName,settingsUnchanged:true,originalAssetsPreserved:true,dataLoadPending:true});console.log('Who knows? UI deployed healthy; original 48 sources remain visible pending additive load.');
  }catch(e){let rollbackVerified=false;if(attempted)try{compose(true);await healthy();assert.equal(runtime().Image,before.Image);rollbackVerified=true;}catch{}save(OUT,'deployment-failure.json',{at:new Date().toISOString(),rollbackVerified});throw Error('Deployment verification failed; rollback verified: '+rollbackVerified);}
})().catch(e=>{console.error(e.code==='ERR_ASSERTION'?e.message:'Release stopped: '+e.message);process.exitCode=1;});
