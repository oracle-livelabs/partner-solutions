'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {sha256}=require('./contract.cjs'),{runtime}=require('./connection.cjs');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'evidence_intelligence_20260924'),IMAGE='local/adelaide-crime-intelligence:evidence-intelligence-20260924';
const read=n=>JSON.parse(fs.readFileSync(path.join(OUT,n)));
const pre=read('preflight.json');assert.equal(read('native-verification.json').status,'passed');assert.equal(read('preview-browser.json').status,'passed');assert.equal(read('load-committed.json').mode,'committed');
const before=runtime();assert.equal(before.Id,pre.runtime.containerId);assert.equal(before.Image,pre.runtime.imageId);
const changed=['backend/server.js','backend/ai-ops-telemetry.js','backend/evidence-intelligence.js'];
for(const [name,digest] of Object.entries(pre.runtime.hashes))if(name.startsWith('backend/')&&!changed.includes(name))assert.equal(sha256(fs.readFileSync(path.join(ROOT,name))),digest,'Unrelated backend changed: '+name);
const context=fs.mkdtempSync('/tmp/evidence-image-'),manifest={};
function copy(source,target){const dest=path.join(context,target);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);manifest[target]=sha256(fs.readFileSync(source));}
for(const name of changed)copy(path.join(ROOT,name),name);
copy(path.join(ROOT,'frontend/dist/index.html'),'frontend/index.html');
for(const n of fs.readdirSync(path.join(ROOT,'frontend/dist/assets')))copy(path.join(ROOT,'frontend/dist/assets',n),'frontend/assets/'+n);
for(const dir of ['documents','images'])for(const n of fs.readdirSync(path.join(ROOT,'testdata/evidence-intelligence/v1/assets',dir)))copy(path.join(ROOT,'testdata/evidence-intelligence/v1/assets',dir,n),'assets/'+dir+'/'+n);
execFileSync('podman',['build','--network=none','--pull=never','-f',path.join(OUT,'Containerfile'),'-t',IMAGE,context],{cwd:ROOT,stdio:'inherit',timeout:120000});
const image=JSON.parse(execFileSync('podman',['image','inspect',IMAGE],{encoding:'utf8'}))[0];
fs.writeFileSync(path.join(OUT,'image-build.json'),JSON.stringify({status:'passed',at:new Date().toISOString(),image:IMAGE,imageId:image.Id,baseImage:before.ImageName,baseImageId:before.Image,manifest,context,changedBackend:changed,credentialsIncluded:false,publicAssetsOverwritten:false},null,2)+'\n');
