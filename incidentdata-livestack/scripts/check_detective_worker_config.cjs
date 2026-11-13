'use strict';
const {execFileSync}=require('node:child_process'),fs=require('fs');
const run=args=>execFileSync('podman',args,{encoding:'utf8'});
const [old]=JSON.parse(run(['inspect','detective-room-worker']));
const file='/tmp/detective-config-env-'+process.pid,name='detective-room-audio-config-check';
try{
 fs.writeFileSync(file,old.Config.Env.join('\n')+'\n',{mode:0o600,flag:'wx'});
 const args=['create','--name',name,'--restart',old.HostConfig.RestartPolicy.Name,'--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--security-opt=label=disable','--memory',String(old.HostConfig.Memory),'--pids-limit',String(old.HostConfig.PidsLimit),'--shm-size',String(old.HostConfig.ShmSize),'--network',old.HostConfig.NetworkMode,'--env-file',file,'--volumes-from','detective-room-worker','--workdir',old.Config.WorkingDir];
 for(const [dest,options] of Object.entries(old.HostConfig.Tmpfs||{}))args.push('--tmpfs',dest+':'+options);
 if(old.Config.User)args.push('--user',old.Config.User);
 args.push('--entrypoint',JSON.stringify(old.Config.Entrypoint),'localhost/crimedata-detective-worker:audio-transcripts-20261013-r1',...old.Config.Cmd);run(args);
 const [next]=JSON.parse(run(['inspect',name]));const differences=[];
 for(const k of ['Cmd','Entrypoint','WorkingDir','User'])if(JSON.stringify(old.Config[k])!==JSON.stringify(next.Config[k]))differences.push({key:k,before:old.Config[k],after:next.Config[k]});
 for(const k of ['Memory','PidsLimit','ReadonlyRootfs','CapDrop','SecurityOpt','PortBindings'])if(JSON.stringify(old.HostConfig[k])!==JSON.stringify(next.HostConfig[k]))differences.push({key:k,before:old.HostConfig[k],after:next.HostConfig[k]});
 const mounts=c=>c.Mounts.map(m=>({source:m.Source,destination:m.Destination,rw:m.RW,type:m.Type})).sort((a,b)=>a.destination.localeCompare(b.destination));
 if(JSON.stringify(mounts(old))!==JSON.stringify(mounts(next)))differences.push({key:'mounts',before:mounts(old),after:mounts(next)});
 const env=c=>Object.fromEntries(c.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));const a=env(old),b=env(next);
 console.log(JSON.stringify({differences,changedEnvKeys:[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>a[k]!==b[k])}));
}finally{fs.unlinkSync(file);try{run(['rm',name]);}catch{}}
