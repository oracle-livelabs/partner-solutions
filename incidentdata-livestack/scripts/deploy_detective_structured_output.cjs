'use strict';
// Update only the fu_edge worker; retain the stopped previous container for rollback.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),name='detective-room-worker',image='localhost/crimedata-detective-worker:structured-output-20261022-r2';
const previousImage='localhost/crimedata-detective-worker:person-links-20261020-r1',candidate=name+'-structured-output-candidate',backup=name+'-before-structured-output-20261022';
const run=args=>execFileSync('podman',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}),inspect=n=>JSON.parse(run(['inspect',n]))[0];
const settings=c=>({config:Object.fromEntries(['Cmd','Entrypoint','WorkingDir','User'].map(k=>[k,c.Config[k]])),host:Object.fromEntries(['Memory','PidsLimit','ShmSize','ReadonlyRootfs','CapDrop','CapAdd','SecurityOpt','PortBindings','NetworkMode','RestartPolicy','Tmpfs','CpuPeriod','CpuQuota','CpuShares','CpusetCpus','CpusetMems','Privileged','GroupAdd','Devices','Ulimits'].map(k=>[k,c.HostConfig[k]])),environmentSha256:crypto.createHash('sha256').update(JSON.stringify(c.Config.Env.filter(v=>!v.startsWith('HOSTNAME=')).sort())).digest('hex'),mounts:c.Mounts.map(m=>({source:m.Source,destination:m.Destination,type:m.Type,rw:m.RW})).sort((a,b)=>a.destination.localeCompare(b.destination))});
const manifestScript=`const fs=require('fs'),p=require('path'),c=require('crypto');const sha=b=>c.createHash('sha256').update(b).digest('hex');function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):[p.join(d,e.name)]);}const files=walk('/app/backend').sort();console.log(JSON.stringify({author:sha(fs.readFileSync('/app/backend/detective-room-author.js')),authProvider:fs.existsSync('/app/backend/oci-auth-provider.js')?sha(fs.readFileSync('/app/backend/oci-auth-provider.js')):null,other:sha(JSON.stringify(files.filter(f=>!['detective-room-author.js','oci-auth-provider.js'].includes(p.basename(f))).map(f=>[f,sha(fs.readFileSync(f))])))}));`;
const expected=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'backend/detective-room-author.js'))).digest('hex');
const expectedProvider=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'backend/oci-auth-provider.js'))).digest('hex');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const old=inspect(name);assert.equal(old.ImageName,previousImage,'Unexpected worker image');assert(old.State.Running,'Existing worker is not running');
 const mount=old.Mounts.find(m=>m.Destination==='/data');assert(mount&&mount.RW&&mount.Source==='/home/opc/livestack/detective-room/data');
 const idle=()=>{for(const d of fs.readdirSync(path.join(mount.Source,'jobs'))){const f=path.join(mount.Source,'jobs',d,'job.json');if(fs.existsSync(f))assert(!['QUEUED','IN_PROGRESS'].includes(JSON.parse(fs.readFileSync(f)).state),'Wait for active generation to finish');}};
 idle();
 const before=JSON.parse(run(['exec',name,'node','-e',manifestScript]));
 const after=JSON.parse(run(['run','--rm','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--entrypoint=node',image,'-e',manifestScript]));
 assert.equal(after.author,expected,'Candidate does not contain the committed author fix');assert.equal(after.authProvider,expectedProvider,'Authentication helper is missing or differs');assert.equal(after.other,before.other,'Unrelated worker backend changed');
 assert(old.Config.Env.every(v=>!/[\r\n]/.test(v)),'Multiline environment cannot be serialized');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'incidentdata-worker-update-')),envFile=path.join(temp,'runtime.env');let created=false,renamed=false,installed=false;
 try{
  fs.writeFileSync(envFile,old.Config.Env.join('\n')+'\n',{mode:0o600,flag:'wx'});
  const args=['create','--name',candidate,'--restart',old.HostConfig.RestartPolicy.Name,'--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--security-opt=label=disable','--memory',String(old.HostConfig.Memory),'--pids-limit',String(old.HostConfig.PidsLimit),'--shm-size',String(old.HostConfig.ShmSize),'--network',old.HostConfig.NetworkMode,'--env-file',envFile,'--workdir',old.Config.WorkingDir];
  for(const m of old.Mounts){assert.equal(m.Type,'bind');args.push('--mount',`type=bind,source=${m.Source},destination=${m.Destination},ro=${!m.RW}`);}
  for(const [dest,options]of Object.entries(old.HostConfig.Tmpfs||{}))args.push('--tmpfs',dest+':'+options);
  for(const u of old.HostConfig.Ulimits||[])args.push('--ulimit',u.Name.replace(/^RLIMIT_/,'').toLowerCase()+'='+u.Soft+':'+u.Hard);
  if(old.Config.User)args.push('--user',old.Config.User);
  args.push('--entrypoint',JSON.stringify(old.Config.Entrypoint),image,...old.Config.Cmd);run(args);created=true;run(['init',candidate]);
  assert.deepEqual(settings(inspect(candidate)),settings(old),'Worker runtime settings changed');idle();
  run(['stop','--time','30',name]);run(['rename',name,backup]);renamed=true;run(['rename',candidate,name]);installed=true;const started=Date.now();run(['start',name]);
  let heartbeat;
  for(let i=0;i<45;i++){
   assert(inspect(name).State.Running,'Updated worker stopped');
   try{heartbeat=JSON.parse(fs.readFileSync(path.join(mount.Source,'worker.json')));if(Date.parse(heartbeat.at)>=started)break;}catch{}
   await delay(1000);
  }
  assert(heartbeat&&Date.parse(heartbeat.at)>=started,'Updated worker heartbeat did not arrive');
  assert.deepEqual(settings(inspect(name)),settings(old));
  const live=JSON.parse(run(['exec',name,'node','-e',manifestScript]));assert.equal(live.author,expected);assert.equal(live.authProvider,expectedProvider);assert.equal(live.other,before.other);
  const health=await fetch('http://127.0.0.1:8706/api/health',{signal:AbortSignal.timeout(15000)});assert(health.ok);assert.equal((await health.json()).status,'healthy');
  console.log(JSON.stringify({deployed:true,image,previousImage,backupContainer:backup,sourceFix:'31f463c',authorSha256:expected,authProviderSha256:expectedProvider,unrelatedWorkerBackendUnchanged:true,runtimeSettingsUnchanged:true,heartbeat:heartbeat.at,applicationHealth:'healthy',fullRoomVideoAcceptance:'pending',at:new Date().toISOString()},null,2));
 }catch(error){
  if(installed){try{run(['stop','--time','10',name]);run(['rm',name]);}catch{}}
  else if(created){try{run(['rm','-f',candidate]);}catch{}}
  if(renamed){run(['rename',backup,name]);run(['start',name]);}
  // Podman errors can include runtime arguments; keep credentials out of output.
  throw new Error(error instanceof assert.AssertionError?error.message:'Worker update failed; previous container restored when available');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
