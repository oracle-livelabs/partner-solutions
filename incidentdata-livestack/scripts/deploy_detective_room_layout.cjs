'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const image=process.argv[2]||'localhost/crimedata-detective-worker:record-label-layout-20261020-r1',name='detective-room-worker',candidate=name+'-layout-candidate',backup=process.argv[3]||name+'-before-record-label-20261020';
const run=args=>execFileSync('podman',args,{encoding:'utf8'}),inspect=n=>JSON.parse(run(['inspect',n]))[0];
const settings=c=>({config:Object.fromEntries(['Cmd','Entrypoint','WorkingDir','User'].map(k=>[k,c.Config[k]])),host:Object.fromEntries(['Memory','PidsLimit','ShmSize','ReadonlyRootfs','CapDrop','SecurityOpt','PortBindings','NetworkMode','RestartPolicy','Tmpfs'].map(k=>[k,c.HostConfig[k]])),env:c.Config.Env.filter(v=>!v.startsWith('HOSTNAME=')).sort(),mounts:c.Mounts.map(m=>({source:m.Source,destination:m.Destination,type:m.Type,rw:m.RW})).sort((a,b)=>a.destination.localeCompare(b.destination))});
(async()=>{
 const old=inspect(name);assert(['localhost/crimedata-detective-worker:citation-feedback-20261019-r2','localhost/crimedata-detective-worker:record-label-layout-20261020-r1','localhost/crimedata-detective-worker:record-label-recovery-20261020-r2'].includes(old.ImageName),'Unexpected worker image');
 const qa=JSON.parse(fs.readFileSync('/home/opc/livestack/detective-room/data/jobs/run-1792469860750-e4f4538e9d55/layout-check-output/room-validation.json'));assert.equal(qa.status,'passed');assert(qa.widths.includes(320));
 const jobs='/home/opc/livestack/detective-room/data/jobs';
 for(const dir of fs.readdirSync(jobs)){const file=path.join(jobs,dir,'job.json');if(fs.existsSync(file))assert(!['QUEUED','IN_PROGRESS'].includes(JSON.parse(fs.readFileSync(file)).state),'Wait for active generation');}
 const file='/tmp/detective-room-layout-env-'+process.pid;let created=false,renamed=false;
 try{
  fs.writeFileSync(file,old.Config.Env.join('\n')+'\n',{flag:'wx',mode:0o600});
  const args=['create','--name',candidate,'--restart',old.HostConfig.RestartPolicy.Name,'--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--security-opt=label=disable','--memory',String(old.HostConfig.Memory),'--pids-limit',String(old.HostConfig.PidsLimit),'--shm-size',String(old.HostConfig.ShmSize),'--network',old.HostConfig.NetworkMode,'--env-file',file,'--workdir',old.Config.WorkingDir];
  for(const mount of old.Mounts){assert.equal(mount.Type,'bind');args.push('--mount',`type=bind,source=${mount.Source},destination=${mount.Destination},ro=${!mount.RW}`);}
  for(const [dest,options] of Object.entries(old.HostConfig.Tmpfs||{}))args.push('--tmpfs',dest+':'+options);
  if(old.Config.User)args.push('--user',old.Config.User);
  args.push('--entrypoint',JSON.stringify(old.Config.Entrypoint),image,...old.Config.Cmd);run(args);created=true;run(['init',candidate]);
  assert.deepEqual(settings(inspect(candidate)),settings(old),'Worker settings changed');
  run(['stop','--time','30',name]);run(['rename',name,backup]);renamed=true;run(['rename',candidate,name]);run(['start',name]);
  assert(inspect(name).State.Running);assert.deepEqual(settings(inspect(name)),settings(old));
  console.log(JSON.stringify({deployed:true,image,previousContainer:backup,runtimeSettingsUnchanged:true,change:image.includes('person-links')?'Include declared fictional handles and saved scoped photo comparisons':image.includes('recovery')?'Wrap source record labels and support revalidated analysis recovery':'Wrap long source record labels within narrow viewports',validation:{widths:qa.widths,records:67,messages:96,files:18,videoSeconds:220.708333},at:new Date().toISOString()},null,2));
 }catch(e){
  if(renamed){try{run(['stop','--time','10',name]);run(['rename',name,candidate+'-failed']);}catch{}run(['rename',backup,name]);run(['start',name]);}
  else if(created)run(['rm',candidate]);throw e;
 }finally{fs.unlinkSync(file);}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
