'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const allowed=/^(OCI_GENAI_(REGION|MODEL)|CDR_(TEXT_MODEL|AUDIO_MODEL|IMAGE_MODEL|LEARNING_MODEL|ROOM_(MODEL|REGION|ENGINE|MODELS|RUNTIME_PACKAGE))|OLLAMA_MODEL|WATCH_PATTERN_EMBEDDING_(MODEL|DIMENSIONS))$/;
const containers=JSON.parse(execFileSync('podman',['inspect','policeadelaide_app-fu40_1','detective-room-worker'],{encoding:'utf8'}));
const result=containers.map(c=>({name:c.Name,image:c.ImageName,imageId:c.Image,configuration:Object.fromEntries(c.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}).filter(([k])=>allowed.test(k))),mounts:c.Mounts.map(m=>({source:m.Source,destination:m.Destination,type:m.Type,readWrite:m.RW})),memoryLimitBytes:c.HostConfig.Memory}));
fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log('Runtime inventory saved; credential/environment allowlist applied.');
