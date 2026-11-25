'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {ROOT,OUT,PROFILE,read,save,sha256}=require('./common.cjs');
const {runtime,environment}=require('../evidence-intelligence/connection.cjs');
const {manifest,state,healthy,settingsEqual}=require('./release.cjs');
const IMAGE='local/adelaide-crime-intelligence:care-trust-20260925-r2';
async function main(){const mode=process.argv[2],before=runtime(),deployed=read(OUT,'deployment.json');assert.equal(before.Id,deployed.containerId);assert.equal(before.Image,deployed.imageId);
  if(mode==='build'){
    assert(read(OUT,'citation-fix-ai-check.json').citations.includes('EV-AMS-H16'));
    const original=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'),'utf8');fs.writeFileSync(path.join(OUT,'citation-compose.before.yml'),original,{flag:'wx'});
    const context=fs.mkdtempSync('/tmp/care-trust-citation-'),bytes=fs.readFileSync(path.join(ROOT,'backend/evidence-intelligence.js'));
    fs.writeFileSync(path.join(context,'evidence-intelligence.js'),bytes);
    execFileSync('podman',['build','--network=none','--pull=never','-f',path.join(OUT,'Citation-Containerfile'),'-t',IMAGE,context],{stdio:'inherit',timeout:120000});
    const image=JSON.parse(execFileSync('podman',['image','inspect',IMAGE],{encoding:'utf8'}))[0];
    save(OUT,'citation-build.json',{status:'passed',at:new Date().toISOString(),image:IMAGE,imageId:image.Id,backendSha256:sha256(bytes),oldManifest:manifest(),composeSha256:sha256(original)},true);return;
  }
  assert.equal(mode,'deploy');const build=read(OUT,'citation-build.json'),original=fs.readFileSync(path.join(OUT,'citation-compose.before.yml'),'utf8'),current=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'),'utf8');assert.equal(sha256(original),build.composeSha256);assert.equal(current,original.replace('image: local/adelaide-crime-intelligence:care-trust-20260925','image: '+IMAGE));assert.deepEqual(manifest(),build.oldManifest);
  const e=environment(before),env={...process.env};for(const[,k]of current.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)){assert(!['HOME','PATH','CODEX_HOME'].includes(k));if(e[k]!==undefined)env[k]=e[k];}
  Object.assign(env,{ADB_CONNECT_STRING:e.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:e.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:e.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'});
  function compose(rollback=false){const args=['compose','-f','compose.fu40.yml'];if(rollback)args.push('-f','care_trust_20260925/citation-rollback.yml');args.push('up','-d','--no-build','--no-deps','app-fu40');execFileSync('podman',args,{cwd:ROOT,env,stdio:'pipe',timeout:120000});}
  assert.deepEqual(await state(),{health:'healthy',profile:PROFILE,items:48});
  let attempted=false;try{attempted=true;compose();await healthy();const after=runtime();assert.equal(after.Image,build.imageId);settingsEqual(before,after);const actual=manifest();
    for(const[p,h]of Object.entries(build.oldManifest))assert.equal(actual[p],p==='backend/evidence-intelligence.js'?build.backendSha256:h,p);
    assert.deepEqual(await state(),{health:'healthy',profile:PROFILE,items:48});
    save(OUT,'citation-deployment.json',{status:'deployed_healthy',at:new Date().toISOString(),image:after.ImageName,imageId:after.Image,containerId:after.Id,rollbackImage:before.ImageName,changedFiles:['backend/evidence-intelligence.js'],settingsUnchanged:true,databaseWrites:0,citationGuardUnchanged:true},true);console.log('Explicit selected-source citation prompt deployed; data and citation guard unchanged.');
  }catch(error){let rollbackVerified=false;if(attempted)try{compose(true);await healthy();assert.equal(runtime().Image,before.Image);rollbackVerified=true;}catch{}save(OUT,'citation-deployment-failure.json',{at:new Date().toISOString(),rollbackVerified},true);throw Error('Citation release verification failed; rollback '+rollbackVerified);}
}
main().catch(e=>{console.error(e.code==='ERR_ASSERTION'?e.message:e.name==='Error'?e.message:'Release stopped');process.exitCode=1;});
