'use strict';
// Private durable filesystem queue; the worker also holds an OS flock.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const ENGINE='detective-room-1.0.4',ACTIVE=new Set(['QUEUED','IN_PROGRESS']);
const fail=(status,message)=>Object.assign(new Error(message),{status});
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function batchId(v){if(!/^DR-\d{8}-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}$/.test(v||''))throw fail(400,'Invalid Batch ID.');return v;}
function runId(v){if(!/^run-\d{13}-[a-f0-9]{12}$/.test(v||''))throw fail(400,'Invalid room run.');return v;}
async function atomic(file,value){
 const tmp=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp',h=await fs.open(tmp,'wx',0o600);
 try{await h.writeFile(JSON.stringify(value,null,2));await h.sync();}finally{await h.close();}
 await fs.rename(tmp,file);
}
function createStore(root){
 if(!path.isAbsolute(root||''))throw Error('CDR_ROOM_ROOT must be an absolute private directory.');
 const jobs=path.join(root,'jobs'),init=()=>fs.mkdir(jobs,{recursive:true,mode:0o700});
 const directory=id=>path.join(jobs,runId(id));
 const read=async id=>JSON.parse(await fs.readFile(path.join(directory(id),'job.json'),'utf8'));
 async function list(owner,batch){
  await init();const result=[];
  for(const name of await fs.readdir(jobs)){
   if(!/^run-\d{13}-[a-f0-9]{12}$/.test(name))continue;
   let j;try{j=await read(name);}catch(e){if(e.code==='ENOENT')continue;throw e;}
   if((!owner||j.owner===owner)&&(!batch||j.batchId===batch))result.push(j);
  }
  return result.sort((a,b)=>b.id.localeCompare(a.id));
 }
 async function locked(fn){
  await init();const lock=path.join(root,'.queue-lock');
  // No network/rendering inside this short lock. Never steal a lock on a timer.
  for(let n=0;;n++){try{await fs.mkdir(lock,{mode:0o700});break;}catch(e){if(e.code!=='EEXIST')throw e;if(n===30)throw fail(503,'Room queue busy. A persistent lock needs operator recovery.');await new Promise(r=>setTimeout(r,30));}}
  try{return await fn();}finally{await fs.rmdir(lock);}
 }
 async function enqueue({owner,batch,fingerprint,analysisFingerprint,regenerate=false}){
  batchId(batch);
  return locked(async()=>{
   const history=await list(owner,batch),active=history.find(j=>ACTIVE.has(j.state));
   if(active)return {job:active,reused:true};
   const ready=history.find(j=>j.state==='READY'&&j.fingerprint===fingerprint&&j.engine===ENGINE);
   if(ready&&!regenerate)return {job:ready,reused:true};
   const space=await fs.statfs(root);
   if(space.bavail*space.bsize<4*1024**3)throw fail(507,'Room storage has less than 4 GiB free. An operator must review retention before another run.');
   if((await list()).filter(j=>ACTIVE.has(j.state)).length>=10)throw fail(429,'Room queue has 10 pending jobs.');
   const id='run-'+Date.now()+'-'+crypto.randomBytes(6).toString('hex');
   const job={id,batchId:batch,owner,fingerprint,...(analysisFingerprint?{analysisFingerprint}:{}),engine:ENGINE,state:'QUEUED',stage:'Waiting for the media worker',createdAt:new Date().toISOString(),review:'AI draft — analyst review required'};
   await fs.mkdir(directory(id),{mode:0o700});await atomic(path.join(directory(id),'job.json'),job);
   return {job,reused:false};
  });
 }
 async function update(id,patch){return locked(async()=>{
  const j=await read(id);if(!ACTIVE.has(j.state))throw Error('Completed runs are immutable.');
  const next={...j,...patch,id:j.id,batchId:j.batchId,owner:j.owner,updatedAt:new Date().toISOString()};
  await atomic(path.join(directory(id),'job.json'),next);return next;
 });}
 async function claim(){return locked(async()=>{
  const j=(await list()).reverse().find(j=>j.state==='QUEUED');if(!j)return null;
  Object.assign(j,{state:'IN_PROGRESS',stage:'Verifying source archive',startedAt:new Date().toISOString()});
  await atomic(path.join(directory(j.id),'job.json'),j);return j;
 });}
 const heartbeat=(metadata={})=>atomic(path.join(root,'worker.json'),{...metadata,engine:ENGINE,at:new Date().toISOString()});
 async function healthy(){try{const h=JSON.parse(await fs.readFile(path.join(root,'worker.json'),'utf8'));return h.engine===ENGINE&&Date.now()-Date.parse(h.at)<45000;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
 async function secret(){await init();const f=path.join(root,'access.key');try{await fs.writeFile(f,crypto.randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}const key=await fs.readFile(f);if(key.length!==32)throw fail(503,'Access key is not ready. Retry shortly.');return key;}
 return {root,jobs,init,directory,read,list,enqueue,update,claim,heartbeat,healthy,secret,locked};
}
function publicJob(j,hasReady=false){
 if(!j)return null;
 const result=Object.fromEntries(['id','batchId','state','stage','createdAt','startedAt','finishedAt','updatedAt','error','review','durationSeconds','engine'].map(k=>[k,j[k]]));
 if(j.state==='FAILED'){
  // Correct legacy wording at the presentation boundary; completed job records stay immutable.
  const reason=(j.error||'Generation stopped before publication.').replace(/ Previous READY version is preserved\.| Previous completed versions remain available\./g,'');
  result.error=reason+(hasReady?' Your previous completed room is still available.':' No completed room is available for this batch yet.');
 }
 return result;
}
module.exports={createStore,publicJob,atomic,batchId,runId,fail,sha,ENGINE,ACTIVE};
