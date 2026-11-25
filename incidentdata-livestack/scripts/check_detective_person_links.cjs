'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const run=args=>execFileSync('podman',args,{encoding:'utf8',maxBuffer:4*1024*1024});
const old=JSON.parse(run(['inspect','detective-room-worker']))[0],file='/tmp/detective-person-links-env-'+process.pid,image='localhost/crimedata-detective-worker:person-links-20261020-r1',directory=process.argv[2]||'/data/previews/person-links-20261020-r1';
try{
 fs.writeFileSync(file,old.Config.Env.join('\n')+'\n',{mode:0o600,flag:'wx'});
 const args=['run','--rm','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--security-opt=label=disable','--memory=4g','--pids-limit=256','--shm-size=1g','--tmpfs','/tmp:rw,exec,size=1g,mode=1777','--network',old.HostConfig.NetworkMode,'--env-file',file];
 for(const m of old.Mounts)args.push('--mount',`type=bind,source=${m.Source},destination=${m.Destination},ro=${!m.RW}`);
 process.stdout.write(run([...args,'--entrypoint','node',image,'/app/scripts/preview_detective_room_person_links.cjs','run-1792469860750-e4f4538e9d55',directory]));
 for(const [script,extra] of [['build.mjs',['--batch','DR-20261020-68ed95d9-8383-401c']],['check.mjs',['--build',directory+'/qa']]])
  process.stdout.write(run([...args,'--entrypoint','node',image,'/app/detective-worker/room/scripts/'+script,'--case',directory+'/room-case.json','--out',directory+'/output','--runtime-package','/app/package.json',...extra]));
}finally{fs.unlinkSync(file);}
