'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const PROJECT=path.dirname(__dirname),NAME='policeadelaide_app-fu40_1';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifestScript='const fs=require("fs"),c=require("crypto");const result={};for(const directory of ["backend","frontend/dist/assets"]){for(const name of fs.readdirSync(directory).sort()){const file=directory+"/"+name;if(fs.statSync(file).isFile())result[file]=c.createHash("sha256").update(fs.readFileSync(file)).digest("hex");}}result["frontend/dist/index.html"]=c.createHash("sha256").update(fs.readFileSync("frontend/dist/index.html")).digest("hex");process.stdout.write(JSON.stringify(result));';
const [before]=JSON.parse(execFileSync('podman',['inspect',NAME],{encoding:'utf8'}));
assert.equal(before.ImageName,'localhost/local/adelaide-crime-intelligence:cdr-messages-dated-v2-20260918');
const manifest=JSON.parse(execFileSync('podman',['exec',NAME,'node','-e',manifestScript],{encoding:'utf8'}));
const changed=['backend/server.js','backend/profile-library.js','backend/setup-mutation-guard.js','backend/setup-profile-selection.js'];
for(const file of changed)assert.equal(hash(fs.readFileSync(path.join(__dirname,'before',file))),manifest[file],file+' baseline differs from runtime');
for(const[file,digest]of Object.entries(manifest).filter(([file])=>file.startsWith('frontend/dist/'))){
  assert.equal(hash(fs.readFileSync(path.join(__dirname,'baseline_dist',file.slice('frontend/dist/'.length)))),digest,'Frontend baseline must reproduce runtime: '+file);
}
const tests=execFileSync(process.execPath,['--test',...fs.readdirSync(path.join(PROJECT,'test')).filter(name=>name.endsWith('.test.js')).map(name=>'test/'+name)],{cwd:PROJECT,encoding:'utf8',maxBuffer:12*1024*1024});
assert.match(tests,/# fail 0/);fs.writeFileSync(path.join(__dirname,'unit_tests.log'),tests,{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'preflight.json'),JSON.stringify({at:new Date().toISOString(),image_before:before.ImageName,image_id_before:before.Image,container_before:before.Id,runtime_manifest:manifest,changed_backend_files:changed,baseline_frontend_reproduced:true},null,2)+'\n',{flag:'wx'});
console.log('Runtime baseline matches; full test suite passed; preflight saved.');
