'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const ROOT=path.dirname(__dirname),image='local/adelaide-crime-intelligence:usa-foundation-tiles-20260920';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n)));
for(const receipt of ['build_checks.json','preview_api.json','preview_browser.json'])assert.equal(read(receipt).status,'passed',receipt);
const pre=read('preflight.json'),base=JSON.parse(execFileSync('podman',['image','inspect',pre.image_before],{encoding:'utf8'}))[0];assert.equal(base.Id,pre.image_id_before,'Rollback/base image tag changed');
const context=fs.mkdtempSync(path.join(__dirname,'image_context_'));
const manifest={};
function copy(source,target){const dest=path.join(context,target);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);manifest[target]=hash(fs.readFileSync(source));}
copy(path.join(__dirname,'dist/index.html'),'frontend/index.html');
for(const file of fs.readdirSync(path.join(__dirname,'dist/assets')))copy(path.join(__dirname,'dist/assets',file),'frontend/assets/'+file);
// No workspace data, public photos, wallets, settings or unrelated sources
// enter this minimal build context. Existing base assets remain in the image.
execFileSync('podman',['build','--network=none','--pull=never','-f',path.join(__dirname,'Containerfile'),'-t',image,context],{cwd:ROOT,stdio:'inherit',timeout:120000});
const built=JSON.parse(execFileSync('podman',['image','inspect',image],{encoding:'utf8'}))[0];
fs.writeFileSync(path.join(__dirname,'image_build.json'),JSON.stringify({status:'passed',at:new Date().toISOString(),image,image_id:built.Id,manifest,isolated_context:true,base_image:read('preflight.json').image_before,profile_data_included:false,public_assets_overwritten:false},null,2)+'\n',{flag:'wx'});
