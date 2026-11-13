'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {sha}=require('./contract.cjs');
const ROOT=path.resolve(__dirname,'../../..'),CONTAINER='policeadelaide_app-fu40_1';
const IMAGE='localhost/incidentdata-livestack:city-evidence-core-20261020-r1';
const run=(args,options={})=>execFileSync('podman',args,{encoding:'utf8',...options});
const original=JSON.parse(run(['inspect',CONTAINER]))[0],dir=fs.mkdtempSync('/tmp/incidentdata-city-evidence-build-');
function copy(source,target){fs.mkdirSync(path.dirname(path.join(dir,target)),{recursive:true});fs.copyFileSync(path.join(ROOT,source),path.join(dir,target));}
for(const f of ['backend/evidence-intelligence.js','backend/city-evidence-stories.js'])copy(f,f);
copy('frontend/dist/index.html','frontend/index.html');
fs.cpSync(path.join(ROOT,'frontend/dist/assets'),path.join(dir,'frontend/assets'),{recursive:true});
fs.cpSync(path.join(ROOT,'testdata/evidence-intelligence/city-core-v1/assets'),path.join(dir,'assets'),{recursive:true});
fs.writeFileSync(path.join(dir,'Containerfile'),`FROM ${original.Image}\nWORKDIR /app\nCOPY backend/ ./backend/\nCOPY frontend/ ./frontend/dist/\nCOPY assets/ ./testdata/evidence-intelligence/city-core-v1/assets/\n`);
run(['build','--network=none','--pull=never','-t',IMAGE,dir],{timeout:120000,stdio:['ignore',process.stderr,process.stderr]});
console.log(JSON.stringify({image:IMAGE,previousImage:original.ImageName,baseImageId:original.Image,containerId:original.Id,context:dir,backend:['backend/evidence-intelligence.js','backend/city-evidence-stories.js'],assetPack:'EI_CITY_CORE_V1',at:new Date().toISOString()}));
