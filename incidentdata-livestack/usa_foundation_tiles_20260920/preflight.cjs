'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const ROOT=path.dirname(__dirname),NAME='policeadelaide_app-fu40_1',hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const app=JSON.parse(execFileSync('podman',['inspect',NAME],{encoding:'utf8'}))[0];
assert.equal(app.ImageName,'localhost/local/adelaide-crime-intelligence:saved-profile-scale-20260920');
assert.equal(fs.existsSync(path.join(__dirname,'preflight.json')),false);
for(const file of ['frontend/src/foundation-profiles.mjs','frontend/src/ProfileLibraryPanel.jsx','test/foundation-restore.test.js','compose.fu40.yml']){
  const target=path.join(__dirname,'before',file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(ROOT,file),target,fs.constants.COPYFILE_EXCL);fs.chmodSync(target,0o600);
}
const log=execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir','../usa_foundation_tiles_20260920/baseline_dist'],{cwd:path.join(ROOT,'frontend'),encoding:'utf8',timeout:120000});
fs.writeFileSync(path.join(__dirname,'baseline_build.log'),log);
const script=`const fs=require('fs'),c=require('crypto'),r={};function walk(d){for(const n of fs.readdirSync(d).sort()){const f=d+'/'+n;if(fs.statSync(f).isDirectory())walk(f);else r[f]=c.createHash('sha256').update(fs.readFileSync(f)).digest('hex');}}walk('backend');walk('frontend/dist');process.stdout.write(JSON.stringify(r));`;
const manifest=JSON.parse(execFileSync('podman',['exec',NAME,'node','-e',script],{encoding:'utf8',maxBuffer:8*1024*1024}));
for(const file of ['index.html',...fs.readdirSync(path.join(__dirname,'baseline_dist/assets')).map(n=>'assets/'+n)])assert.equal(hash(fs.readFileSync(path.join(__dirname,'baseline_dist',file))),manifest['frontend/dist/'+file],'Baseline differs from running frontend: '+file);
fs.writeFileSync(path.join(__dirname,'preflight.json'),JSON.stringify({at:new Date().toISOString(),container_before:app.Id,image_before:app.ImageName,image_id_before:app.Image,runtime_manifest:manifest,baseline_frontend_reproduced:true,compose_before_sha256:hash(fs.readFileSync(path.join(ROOT,'compose.fu40.yml'))),changed_backend_files:[],added_backend_files:[],rollback_image_retained:app.ImageName},null,2)+'\n',{flag:'wx'});
console.log('Baseline frontend reproduced exactly; source backups and rollback image recorded. No runtime or database changes.');
