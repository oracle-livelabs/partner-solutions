'use strict';
// Swap app-fu40 to the frontend-only image that adds the Activity Center session-context SQL.
// Same safeguards as deploy_explain_signal_plsql.cjs; restores the previous image on any failure.
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'explain_activity_sql_context_20261108');
const container='policeadelaide_app-fu40_1',image='localhost/incidentdata-livestack:explain-activity-sql-20261108-r2',expectedPrevious='localhost/incidentdata-livestack:explain-activity-sql-20261108-r1';
const run=(args,options={})=>execFileSync('podman',args,{encoding:'utf8',...options});
const inspect=()=>JSON.parse(run(['inspect',container]))[0];
const backendHash=()=>run(['exec',container,'node','-e',"const fs=require('fs'),c=require('crypto');const files=fs.readdirSync('/app/backend').sort();console.log(c.createHash('sha256').update(JSON.stringify(files.map(f=>[f,c.createHash('sha256').update(fs.readFileSync('/app/backend/'+f)).digest('hex')]))).digest('hex'));" ]).trim();
const settings=c=>({env:c.Config.Env.filter(v=>!v.startsWith('HOSTNAME=')).sort(),mounts:c.Mounts.map(m=>({source:m.Source,destination:m.Destination,type:m.Type,rw:m.RW})).sort((a,b)=>a.destination.localeCompare(b.destination)),ports:c.HostConfig.PortBindings});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const activeProfile=async()=>(await (await fetch('http://127.0.0.1:8706/api/setup/profiles',{headers:{'X-Demo-User':'statewide_admin'},signal:AbortSignal.timeout(20000)})).json()).activeProfileCode;
(async()=>{
 const beforeProfile=await activeProfile();if(!beforeProfile)throw Error('Could not read active profile before deploy');
 run(['exec','-i',container,'node'],{input:fs.readFileSync(path.join(root,'scripts/check_data_room_idle.js'))});
 const original=inspect();if(original.ImageName!==expectedPrevious)throw Error('Unexpected current image '+original.ImageName);
 const originalSettings=settings(original),originalBackendHash=backendHash();
 const previous=Object.fromEntries(original.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));
 const appSettings=Object.fromEntries(Object.entries(previous).filter(([key])=>/^(ORACLE_|OCI_|CDR_|APP_SCHEMA_|OLLAMA_|TRANSFORMERS_|WATCH_PATTERN_)/.test(key)));
 const env={...process.env,...appSettings,ADB_CONNECT_STRING:previous.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:previous.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:previous.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'};
 const compose=path.join(root,'compose.fu40.yml'),before=fs.readFileSync(compose,'utf8');
 if(!before.includes('image: '+original.ImageName))throw Error('Compose image differs from running image');
 fs.mkdirSync(path.join(dir,'before'),{recursive:true});fs.writeFileSync(path.join(dir,'before/compose.fu40.yml'),before);
 const up=()=>run(['compose','-f','compose.fu40.yml','up','-d','--no-build','--no-deps','app-fu40'],{cwd:root,env,stdio:'pipe'});
 let changed=false;
 try{
  fs.writeFileSync(compose,before.replace('image: '+original.ImageName,'image: '+image));changed=true;up();
  const after=inspect();if(backendHash()!==originalBackendHash)throw Error('Backend changed unexpectedly');
  if(after.ImageName!==image||JSON.stringify(settings(after))!==JSON.stringify(originalSettings))throw Error('Runtime settings changed unexpectedly');
  let html;
  for(let n=0;n<30;n++){try{const r=await fetch('http://127.0.0.1:8706/',{signal:AbortSignal.timeout(20000)});if(r.ok){html=await r.text();break;}}catch{}await sleep(1000);}
  if(!html)throw Error('App did not respond on 8706');
  const scripts=[...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map(m=>m[1]);let found=false;
  for(const s of scripts){const t=await (await fetch('http://127.0.0.1:8706'+s)).text();if(t.includes('compare with the activity cards')){found=true;break;}}
  if(!found)throw Error('Served bundle lacks the new Activity Center example');
  const status=await activeProfile();
  if(status!==beforeProfile)throw Error('Active profile changed from '+beforeProfile+' to '+status);
  const receipt={deployed:true,image,previousImage:original.ImageName,applicationEnvironmentMountsPortsUnchanged:true,runtimeGeneratedHostnameExcluded:true,backendUnchanged:true,frontendChanged:true,servedBundleVerified:true,activeProfileCode:status,at:new Date().toISOString()};
  fs.writeFileSync(path.join(dir,'deployment.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }catch(e){
  if(changed){fs.writeFileSync(compose,before);up();}
  throw Error('Explain deployment failed; previous application image restored. '+e.message);
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
