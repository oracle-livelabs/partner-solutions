'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),name='policeadelaide_app-fu40_1',image='localhost/incidentdata-livestack:person-links-20261020-r1';
const run=(args,opts={})=>execFileSync('podman',args,{encoding:'utf8',...opts}),inspect=()=>JSON.parse(run(['inspect',name]))[0];
const settings=c=>({env:c.Config.Env.filter(v=>!v.startsWith('HOSTNAME=')).sort(),mounts:c.Mounts.map(m=>({source:m.Source,destination:m.Destination,type:m.Type,rw:m.RW})).sort((a,b)=>a.destination.localeCompare(b.destination)),ports:c.HostConfig.PortBindings});
const hash=()=>run(['exec',name,'node','-e',"const fs=require('fs'),c=require('crypto'),skip=['photo-comparison-state.js','data-room-people-photos.js','detective-room-source.js','detective-room-associations.js','detective-room-store.js','detective-room-api.js'];console.log(c.createHash('sha256').update(JSON.stringify(fs.readdirSync('/app/backend').filter(f=>!skip.includes(f)).sort().map(f=>[f,c.createHash('sha256').update(fs.readFileSync('/app/backend/'+f)).digest('hex')]))).digest('hex'));"]).trim();
(async()=>{
 const old=inspect();assert.equal(old.ImageName,'localhost/incidentdata-livestack:city-evidence-core-20261020-r1');const previousHash=hash();
 const previous=Object.fromEntries(old.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));
 const env={...process.env,...Object.fromEntries(Object.entries(previous).filter(([k])=>/^(ORACLE_|OCI_|CDR_|APP_SCHEMA_|OLLAMA_|TRANSFORMERS_|WATCH_PATTERN_)/.test(k))),ADB_CONNECT_STRING:previous.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:previous.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:previous.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'};
 const file=path.join(ROOT,'compose.fu40.yml'),before=fs.readFileSync(file,'utf8');assert(before.includes('image: '+old.ImageName));
 const up=()=>run(['compose','-f','compose.fu40.yml','up','-d','--no-build','--no-deps','app-fu40'],{cwd:ROOT,env,timeout:120000});
 try{
  fs.writeFileSync(file,before.replace('image: '+old.ImageName,'image: '+image));up();assert.deepEqual(settings(inspect()),settings(old));assert.equal(hash(),previousHash,'Unrelated backend changed');
  let ready=false;for(let i=0;i<30;i++){try{const r=await fetch('http://127.0.0.1:8706/api/health',{signal:AbortSignal.timeout(5000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}assert(ready);
  console.log(JSON.stringify({deployed:true,image,previousImage:old.ImageName,runtimeSettingsUnchanged:true,unrelatedBackendUnchanged:true,frontendUnchanged:true,at:new Date().toISOString()},null,2));
 }catch(e){fs.writeFileSync(file,before);up();throw e;}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
