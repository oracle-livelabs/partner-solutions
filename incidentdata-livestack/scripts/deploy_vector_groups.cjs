'use strict';
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'vector_groups_20261025');
const container='policeadelaide_app-fu40_1',image='localhost/incidentdata-livestack:vector-groups-20261025-r2';
const run=(args,options={})=>execFileSync('podman',args,{encoding:'utf8',...options});
const inspect=()=>JSON.parse(run(['inspect',container]))[0];
const backendHash=()=>run(['exec',container,'node','-e',"const fs=require('fs'),c=require('crypto');const files=fs.readdirSync('/app/backend').filter(f=>f!=='server.js').sort();console.log(c.createHash('sha256').update(JSON.stringify(files.map(f=>[f,c.createHash('sha256').update(fs.readFileSync('/app/backend/'+f)).digest('hex')]))).digest('hex'));" ]).trim();
// Podman generates a new HOSTNAME from each container ID on recreation.
const settings=c=>({env:c.Config.Env.filter(v=>!v.startsWith('HOSTNAME=')).sort(),mounts:c.Mounts.map(m=>({source:m.Source,destination:m.Destination,type:m.Type,rw:m.RW})).sort((a,b)=>a.destination.localeCompare(b.destination)),ports:c.HostConfig.PortBindings});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 fs.mkdirSync(path.join(dir,'before'),{recursive:true});
 const original=inspect();if(original.ImageName!=='localhost/incidentdata-livestack:vector-groups-20261025-r1')throw Error('Unexpected current image');
 const originalSettings=settings(original);
 const originalBackendHash=backendHash();
 const previous=Object.fromEntries(original.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));
 const appSettings=Object.fromEntries(Object.entries(previous).filter(([key])=>/^(ORACLE_|OCI_|CDR_|APP_SCHEMA_|OLLAMA_|TRANSFORMERS_|WATCH_PATTERN_)/.test(key)));
 const env={...process.env,...appSettings,ADB_CONNECT_STRING:previous.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:previous.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:previous.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'};
 const compose=path.join(root,'compose.fu40.yml'),before=fs.readFileSync(compose,'utf8');
 if(!before.includes('image: '+original.ImageName))throw Error('Compose image differs from running image');
 fs.writeFileSync(path.join(dir,'before/compose.fu40.yml'),before);
 const up=()=>run(['compose','-f','compose.fu40.yml','up','-d','--no-build','--no-deps','app-fu40'],{cwd:root,env,stdio:'pipe'});
 let changed=false;
 try{
  execFileSync('podman',['exec','-i',container,'node'],{input:fs.readFileSync(path.join(root,'scripts/check_data_room_idle.js')),stdio:['pipe','pipe','pipe']});
  fs.writeFileSync(compose,before.replace('image: '+original.ImageName,'image: '+image));changed=true;up();
  const after=inspect();if(backendHash()!==originalBackendHash)throw Error('Unrelated backend changed unexpectedly');
  const actual=run(['exec',container,'node','-e',"process.stdout.write(require('fs').readFileSync('/app/backend/server.js','utf8'))"]);
  if(actual!==fs.readFileSync(path.join(dir,'image/backend/server.js'),'utf8'))throw Error('Deployed query differs from reviewed candidate');
  if(after.ImageName!==image||JSON.stringify(settings(after))!==JSON.stringify(originalSettings)){
   const next=settings(after),nextEnv=Object.fromEntries(after.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));
   fs.writeFileSync(path.join(dir,'runtime_difference.json'),JSON.stringify({envChangedKeys:[...new Set([...Object.keys(previous),...Object.keys(nextEnv)])].filter(k=>previous[k]!==nextEnv[k]),beforeMounts:originalSettings.mounts,afterMounts:next.mounts,beforePorts:originalSettings.ports,afterPorts:next.ports},null,2)+'\n');
   throw Error('Runtime settings changed unexpectedly');
  }
  let status;
  for(let n=0;n<20;n++){
   try{const r=await fetch('http://127.0.0.1:8706/api/data-room/batches',{headers:{'X-Demo-User':'statewide_admin'},signal:AbortSignal.timeout(20000)});if(r.ok){status=await r.json();break;}}catch{}
   await sleep(1000);
  }
  if(!Array.isArray(status?.batches))throw Error('Post-deploy batch history is not available');
  const receipt={deployed:true,image,previousImage:original.ImageName,applicationEnvironmentMountsPortsUnchanged:true,runtimeGeneratedHostnameExcluded:true,unrelatedBackendUnchanged:true,analyticsQueryUpdated:true,frontendChanged:true,batchHistoryAvailable:true,at:new Date().toISOString()};
  fs.writeFileSync(path.join(dir,'deployment.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }catch(e){
  if(changed){fs.writeFileSync(compose,before);up();}
  throw Error('Vector Groups deployment failed; previous application image restored. '+e.message);
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
