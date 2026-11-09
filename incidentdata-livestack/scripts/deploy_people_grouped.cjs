'use strict';
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),container='policeadelaide_app-fu40_1';
const previousImage='localhost/incidentdata-livestack:people-schema-fix-20261028-r1',image='localhost/incidentdata-livestack:people-grouped-20261028-r1';
const run=(args,options={})=>execFileSync('podman',args,{encoding:'utf8',...options});
const inspect=()=>JSON.parse(run(['inspect',container]))[0];
const settings=c=>({env:c.Config.Env.filter(v=>!v.startsWith('HOSTNAME=')).sort(),mounts:c.Mounts.map(m=>({source:m.Source,destination:m.Destination,type:m.Type,rw:m.RW})).sort((a,b)=>a.destination.localeCompare(b.destination)),ports:c.HostConfig.PortBindings});
(async()=>{
 const original=inspect();assert.equal(original.ImageName,previousImage);
 const compose=path.join(root,'compose.fu40.yml'),before=fs.readFileSync(compose,'utf8');assert(before.includes('image: '+previousImage));
 const unchangedHash=()=>run(['exec',container,'node','-e',"const fs=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(JSON.stringify(fs.readdirSync('/app/backend').filter(f=>f!=='data-room-people-mentioned.js').sort().map(f=>[f,c.createHash('sha256').update(fs.readFileSync('/app/backend/'+f)).digest('hex')]))).digest('hex'));"]).trim();
 const backendBefore=unchangedHash();
 run(['exec','-i',container,'node'],{input:fs.readFileSync(path.join(root,'scripts/check_data_room_idle.js'))});
 let changed=false;
 try{
  fs.writeFileSync(compose,before.replace('image: '+previousImage,'image: '+image));changed=true;
  execFileSync(process.execPath,[path.join(root,'scripts/redeploy_data_room_workspace.js')],{cwd:root,stdio:'pipe'});
  assert.equal(inspect().ImageName,image);assert.deepEqual(settings(inspect()),settings(original));assert.equal(unchangedHash(),backendBefore);
  const expected=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'backend/data-room-people-mentioned.js'))).digest('hex');
  const actual=run(['exec',container,'node','-e',"console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('/app/backend/data-room-people-mentioned.js')).digest('hex'));"]).trim();assert.equal(actual,expected);
  let healthy=false;
  for(let i=0;i<25;i++){try{const r=await fetch('http://127.0.0.1:8706/api/data-room/batches',{headers:{'X-Demo-User':'statewide_admin'},signal:AbortSignal.timeout(5000)});if(r.ok&&Array.isArray((await r.json()).batches)){healthy=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}assert(healthy,'Batch history unavailable');
  const receipt={deployed:true,image,previousImage,environmentMountsPortsUnchanged:true,unrelatedBackendUnchanged:true,peopleBackendHashVerified:true,batchHistoryAvailable:true,at:new Date().toISOString()};
  fs.mkdirSync(path.join(root,'docs/verification/people-grouped-20261028'),{recursive:true});fs.writeFileSync(path.join(root,'docs/verification/people-grouped-20261028/deployment.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }catch(e){if(changed){fs.writeFileSync(compose,before);execFileSync(process.execPath,[path.join(root,'scripts/redeploy_data_room_workspace.js')],{cwd:root,stdio:'pipe'});}throw Error('Deployment failed; previous image restored. '+e.message);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
