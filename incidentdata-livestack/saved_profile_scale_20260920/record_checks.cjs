'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.dirname(__dirname),results=[];
const tests=fs.readdirSync(path.join(root,'test')).filter(n=>n.endsWith('.test.js')).sort().map(n=>'test/'+n);
for(const [name,args,cwd] of [['unit_tests',['--test',...tests],root],['frontend_build',['node_modules/vite/bin/vite.js','build','--outDir','../saved_profile_scale_20260920/dist'],path.join(root,'frontend')]]){
  const start=Date.now(),r=spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024});
  fs.writeFileSync(path.join(__dirname,name+'.log'),(r.stdout||'')+(r.stderr||''));
  if(r.error)throw r.error;assert.equal(r.status,0,name);if(name==='unit_tests')assert.match(r.stdout,/# fail 0/);
  results.push({name,exit_code:r.status,elapsed_ms:Date.now()-start});console.log(name+' passed');
}
fs.writeFileSync(path.join(__dirname,'build_checks.json'),JSON.stringify({status:'passed',at:new Date().toISOString(),results},null,2)+'\n');
