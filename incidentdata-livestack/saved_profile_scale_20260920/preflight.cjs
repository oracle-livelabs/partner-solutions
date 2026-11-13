'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const ROOT=path.dirname(__dirname),NAME='policeadelaide_app-fu40_1',hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const app=JSON.parse(execFileSync('podman',['inspect',NAME],{encoding:'utf8'}))[0];
assert.equal(app.ImageName,'localhost/local/adelaide-crime-intelligence:six-city-restore-20260919');
const script='const fs=require("fs"),c=require("crypto"),r={};for(const d of ["backend","frontend/dist/assets"]){for(const n of fs.readdirSync(d).sort()){const f=d+"/"+n;if(fs.statSync(f).isFile())r[f]=c.createHash("sha256").update(fs.readFileSync(f)).digest("hex");}}r["frontend/dist/index.html"]=c.createHash("sha256").update(fs.readFileSync("frontend/dist/index.html")).digest("hex");process.stdout.write(JSON.stringify(r));';
const manifest=JSON.parse(execFileSync('podman',['exec',NAME,'node','-e',script],{encoding:'utf8'}));
assert.equal(manifest['backend/profile-library.js'],hash(fs.readFileSync(path.join(__dirname,'before/profile-library.js'))));
// Prior overlay releases retain obsolete hashed chunks. Verify the current
// entry point and every chunk emitted by this clean baseline, not stale files.
for(const file of ['index.html',...fs.readdirSync(path.join(__dirname,'baseline_dist/assets')).map(n=>'assets/'+n)])assert.equal(hash(fs.readFileSync(path.join(__dirname,'baseline_dist',file))),manifest['frontend/dist/'+file],'Baseline build differs from running frontend: '+file);
const compose=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'));fs.writeFileSync(path.join(__dirname,'before/compose.fu40.yml'),compose,{flag:'wx',mode:0o600});
fs.writeFileSync(path.join(__dirname,'preflight.json'),JSON.stringify({at:new Date().toISOString(),container_before:app.Id,image_before:app.ImageName,image_id_before:app.Image,started_at_before:app.State.StartedAt,runtime_manifest:manifest,baseline_frontend_reproduced:true,compose_before_sha256:hash(compose),changed_backend_files:['backend/profile-library.js'],added_backend_files:['backend/profile-review-scale.js'],rollback_image_retained:app.ImageName},null,2)+'\n',{flag:'wx'});
console.log('Running backend baseline and reproduced frontend verified. Rollback image recorded; no runtime or database change.');
