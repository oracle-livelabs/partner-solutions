/* Capture only this task's source changes and reproducible local verification. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const refresh=process.argv.includes('--verify-existing'),writeFlag=refresh?'w':'wx';
const files=['backend/server.js','backend/profile-library.js','backend/presentation-copy.js','backend/setup-mutation-guard.js','backend/live-incident-map.js','frontend/src/main.jsx','frontend/src/app-use-notice.css','frontend/src/profile-presentation.mjs','frontend/src/ProfileContext.jsx','frontend/src/ProfileLibraryPanel.jsx','frontend/src/SavedProfileReview.jsx','frontend/src/profile-review.css','test/profile-library.test.js','test/ask-crime-v2-results.test.js'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifest={created_at:new Date().toISOString(),production_deployed:false,amsterdam_activated:false,files:{},checks:[]};let patch='';
for(const file of files){
 const before=path.join(__dirname,'source_before',file),current=path.join(root,file),bytes=fs.readFileSync(current),dest=path.join(__dirname,'source_after',file);
 if(refresh)assert.deepEqual(fs.readFileSync(dest),bytes,'Captured source changed: '+file);
 else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx',mode:0o600});}
 manifest.files[file]={operation:fs.existsSync(before)?'modified':'added',before_sha256:fs.existsSync(before)?sha(fs.readFileSync(before)):null,after_sha256:sha(bytes)};
 const diff=cp.spawnSync('diff',['-u','--label','a/'+file,'--label','b/'+file,fs.existsSync(before)?before:'/dev/null',current],{encoding:'utf8',maxBuffer:20e6});
 assert.ifError(diff.error);assert.ok([0,1].includes(diff.status),diff.stderr);patch+=diff.stdout;
}
fs.writeFileSync(path.join(__dirname,'source_changes.patch'),patch,{flag:writeFlag,mode:0o600});
const commands=[['unit-tests','npm',['test'],root],['profile-unit-tests','node',['test/profile-library.test.js'],root],['report-regressions','node',['test/ask-crime-v2-results.test.js'],root],['backend-syntax','node',['--check','backend/server.js'],root],['frontend-build','npm',['run','build','--','--outDir','../application_profile_readiness_20260917/frontend-dist'],path.join(root,'frontend')]];
for(const [name,command,args,cwd]of commands){const r=cp.spawnSync(command,args,{cwd,encoding:'utf8',timeout:120000,maxBuffer:10e6});assert.ifError(r.error);fs.writeFileSync(path.join(__dirname,name+'.log'),(r.stdout||'')+(r.stderr||''),{flag:writeFlag});manifest.checks.push({name,command:[command,...args],exit_code:r.status});assert.equal(r.status,0,name+' failed');}
assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname,'api_acceptance.json'))).status,'passed');
assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname,'browser_acceptance.json'))).status,'passed');
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname,'database_before.json'))),JSON.parse(fs.readFileSync(path.join(__dirname,'database_after.json'))));
manifest.built_index_sha256=sha(fs.readFileSync(path.join(__dirname,'frontend-dist/index.html')));
fs.writeFileSync(path.join(__dirname,'delivery_manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:writeFlag});
console.log(JSON.stringify({status:'passed',source_files:files.length,checks:manifest.checks,production_deployed:false,amsterdam_activated:false}));
