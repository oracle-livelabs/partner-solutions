'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'detective_audio_fix_20261013');
const app='policeadelaide_app-fu40_1',worker='detective-room-worker',backup='detective-room-worker-before-audio-20261013';
const image='localhost/incidentdata-livestack:detective-audio-20261013-r1',workerImage='localhost/crimedata-detective-worker:audio-transcripts-20261013-r1';
const run=(args,options={})=>execFileSync('podman',args,{encoding:'utf8',...options});
const inspect=name=>JSON.parse(run(['inspect',name]))[0];
const config=c=>({env:c.Config.Env.filter(v=>!v.startsWith('HOSTNAME=')).sort(),cmd:c.Config.Cmd,entrypoint:c.Config.Entrypoint,workingDir:c.Config.WorkingDir,user:c.Config.User,mounts:c.Mounts.map(m=>({source:m.Source,destination:m.Destination,rw:m.RW,type:m.Type})).sort((a,b)=>a.destination.localeCompare(b.destination)),memory:c.HostConfig.Memory,pids:c.HostConfig.PidsLimit,readOnly:c.HostConfig.ReadonlyRootfs,capDrop:c.HostConfig.CapDrop,security:c.HostConfig.SecurityOpt,ports:c.HostConfig.PortBindings});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const oldApp=inspect(app),oldWorker=inspect(worker);
 if(oldApp.ImageName!=='localhost/incidentdata-livestack:explain-signals-plsql-20261013-r1'||oldWorker.ImageName!=='localhost/crimedata-detective-worker:ai-ops-sweep-20260930')throw Error('Unexpected deployed image');
 for(const name of fs.readdirSync('/home/opc/livestack/detective-room/data/jobs')){
  const job=JSON.parse(fs.readFileSync('/home/opc/livestack/detective-room/data/jobs/'+name+'/job.json','utf8'));
  if(['QUEUED','IN_PROGRESS'].includes(job.state))throw Error('Generation in progress; do not restart its worker');
 }
 const appConfig=config(oldApp),workerConfig=config(oldWorker),compose=path.join(root,'compose.fu40.yml'),originalCompose=fs.readFileSync(compose,'utf8');
 fs.writeFileSync(path.join(dir,'before/compose.fu40.yml'),originalCompose);
 const previous=Object.fromEntries(oldApp.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));
 const appSettings=Object.fromEntries(Object.entries(previous).filter(([k])=>/^(ORACLE_|OCI_|CDR_|APP_SCHEMA_|OLLAMA_|TRANSFORMERS_|WATCH_PATTERN_)/.test(k)));
 const env={...process.env,...appSettings,ADB_CONNECT_STRING:previous.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:previous.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:previous.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'};
 const up=()=>run(['compose','-f','compose.fu40.yml','up','-d','--no-build','--no-deps','app-fu40'],{cwd:root,env});
 let appChanged=false,workerRenamed=false,newWorker=false;
 try{
  if(!originalCompose.includes('image: '+oldApp.ImageName))throw Error('Compose differs from running app');
  fs.writeFileSync(compose,originalCompose.replace('image: '+oldApp.ImageName,'image: '+image));appChanged=true;up();
  if(JSON.stringify(config(inspect(app)))!==JSON.stringify(appConfig))throw Error('App runtime changed unexpectedly');
  run(['stop','--time','30',worker]);run(['rename',worker,backup]);workerRenamed=true;
  const envFile=path.join('/tmp','detective-audio-env-'+process.pid);
  try{
   if(oldWorker.Config.Env.some(v=>/[\r\n]/.test(v)))throw Error('Multiline worker environment cannot be serialized');
   fs.writeFileSync(envFile,oldWorker.Config.Env.join('\n')+'\n',{mode:0o600,flag:'wx'});
   const args=['create','--name',worker,'--restart',oldWorker.HostConfig.RestartPolicy.Name,'--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--security-opt=label=disable','--memory',String(oldWorker.HostConfig.Memory),'--pids-limit',String(oldWorker.HostConfig.PidsLimit),'--shm-size',String(oldWorker.HostConfig.ShmSize),'--network',oldWorker.HostConfig.NetworkMode,'--env-file',envFile,'--workdir',oldWorker.Config.WorkingDir];
   for(const m of oldWorker.Mounts)args.push('--volume',m.Source+':'+m.Destination+':'+(m.RW?'rw':'ro'));
   for(const [dest,options] of Object.entries(oldWorker.HostConfig.Tmpfs||{}))args.push('--tmpfs',dest+':'+options);
   if(oldWorker.Config.User)args.push('--user',oldWorker.Config.User);
   args.push('--entrypoint',JSON.stringify(oldWorker.Config.Entrypoint),workerImage,...oldWorker.Config.Cmd);
   run(args);newWorker=true;
  }finally{try{fs.unlinkSync(envFile);}catch{}}
  run(['start',worker]);
  const clone=inspect(worker);if(JSON.stringify(config(clone))!==JSON.stringify(workerConfig)){
   const next=config(clone),differences=Object.keys(workerConfig).filter(k=>JSON.stringify(workerConfig[k])!==JSON.stringify(next[k])).map(k=>k==='env'?{key:k}:{key:k,before:workerConfig[k],after:next[k]});
   fs.writeFileSync(path.join(dir,'worker_runtime_difference.json'),JSON.stringify(differences,null,2)+'\n');
   throw Error('Worker runtime changed unexpectedly');
  }
  let status;
  for(let n=0;n<30;n++){
   try{const r=await fetch('http://127.0.0.1:8706/api/data-room/batches/DR-20261013-2f911298-c82f-4d50/room',{headers:{'X-Demo-User':'statewide_admin'},signal:AbortSignal.timeout(10000)});if(r.ok){status=await r.json();if(status.workerAvailable&&status.eligible)break;}}catch{}
   await delay(1000);
  }
  if(!status?.workerAvailable||!status?.eligible||!inspect(worker).State.Running)throw Error('Worker or transcript readiness failed');
  const receipt={deployed:true,image,workerImage,previousApp:oldApp.ImageName,previousWorker:oldWorker.ImageName,workerBackup:backup,appRuntimeUnchanged:true,workerRuntimeUnchanged:true,sourceArchiveUnchanged:true,failedRunPreserved:true,roomStatus:status,at:new Date().toISOString()};
  fs.writeFileSync(path.join(dir,'deployment.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }catch(e){
  if(newWorker){run(['stop','--time','10',worker]);run(['rm',worker]);}
  if(workerRenamed){run(['rename',backup,worker]);run(['start',worker]);}
  if(appChanged){fs.writeFileSync(compose,originalCompose);up();}
  throw Error('Audio deployment failed; prior containers restored. '+e.message);
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
