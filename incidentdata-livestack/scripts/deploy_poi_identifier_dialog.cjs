'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out='/home/opc/scratch/poi-identifier-dialog-20261030',container='policeadelaide_app-fu40_1';
const artifact=JSON.parse(fs.readFileSync(path.join(out,'artifact.json'),'utf8'));
const run=(args,options={})=>execFileSync('podman',args,{encoding:'utf8',...options});
const inspect=()=>JSON.parse(run(['inspect',container]))[0];
const settings=c=>({env:c.Config.Env.filter(s=>!s.startsWith('HOSTNAME=')).sort(),mounts:c.Mounts.map(m=>({source:m.Source,destination:m.Destination,type:m.Type,rw:m.RW})).sort((a,b)=>a.destination.localeCompare(b.destination)),ports:c.HostConfig.PortBindings});
const serverHash=()=>run(['exec',container,'node','-e',"console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('/app/backend/server.js')).digest('hex'))"]).trim();
const backendHash=()=>run(['exec',container,'node','-e',"const fs=require('fs'),path=require('path'),c=require('crypto');function files(dir){return fs.readdirSync(dir).sort().flatMap(name=>{const p=path.join(dir,name);return fs.statSync(p).isDirectory()?files(p):[p];});}console.log(c.createHash('sha256').update(JSON.stringify(files('/app/backend').filter(p=>!['/app/backend/server.js','/app/backend/poi-identifier-detail.js'].includes(p)).map(p=>[p,c.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))).digest('hex'));"]).trim();
const up=()=>execFileSync(process.execPath,[path.join(root,'scripts/redeploy_data_room_workspace.js')],{cwd:root,stdio:'pipe'});
(async()=>{
 const before=inspect();assert.equal(before.ImageName,artifact.previousImage,'Running image changed; inspect before deployment');assert.equal(serverHash(),artifact.previousServerSha256);
 const beforeSettings=settings(before),beforeBackend=backendHash();
 const compose=path.join(root,'compose.fu40.yml'),old=fs.readFileSync(compose,'utf8');assert(old.includes('image: '+artifact.previousImage));
 run(['exec','-i',container,'node'],{input:fs.readFileSync(path.join(root,'scripts/check_data_room_idle.js'))});
 const beforeProfile=await(await fetch('http://127.0.0.1:8706/api/profile-context',{headers:{'X-Demo-User':'statewide_admin'}})).json();
 let changed=false;
 try{
  fs.writeFileSync(path.join(out,'compose-before.yml'),old);
  fs.writeFileSync(compose,old.replace('image: '+artifact.previousImage,'image: '+artifact.image));changed=true;up();
  assert.equal(inspect().ImageName,artifact.image);assert.deepEqual(settings(inspect()),beforeSettings,'Runtime settings changed');assert.equal(serverHash(),artifact.serverSha256);assert.equal(backendHash(),beforeBackend,'Unrelated deployed backend changed');
  let body,healthy=false;
  for(let i=0;i<25;i++){
   try{const r=await fetch('http://127.0.0.1:8706/api/persons/POI-V2-TONY/identifiers',{headers:{'X-Demo-User':'statewide_admin'},signal:AbortSignal.timeout(4000)});if(r.ok){body=await r.json();if(body.person?.PERSON_REF==='POI-V2-TONY'&&body.identifiers.length>=5){healthy=true;break;}}}catch{}
   await new Promise(r=>setTimeout(r,800));
  }
  assert(healthy,'New endpoint failed health check');
  const afterProfile=await(await fetch('http://127.0.0.1:8706/api/profile-context',{headers:{'X-Demo-User':'statewide_admin'}})).json();assert.equal(afterProfile.profileCode,beforeProfile.profileCode);
  const receipt={deployed:true,image:artifact.image,previousImage:artifact.previousImage,environmentMountsAndPortsUnchanged:true,unrelatedBackendUnchanged:true,unrelatedLocalServerChangesExcluded:true,newEndpointHealthy:true,activeDatasetUnchanged:true,at:new Date().toISOString()};fs.writeFileSync(path.join(out,'deployment.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }catch(e){
  if(changed){fs.writeFileSync(compose,old);up();assert.equal(inspect().ImageName,artifact.previousImage);}
  throw Error('Deployment failed; previous image restored. '+e.message);
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
