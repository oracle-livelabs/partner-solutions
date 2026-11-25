'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
const oracle=require('oracledb'),yazl=require('yazl'),{createWriteStream}=require('node:fs');
const {createStore,atomic,sha}=require('./detective-room-store');
const {snapshot,fingerprint,visible,generationContext}=require('./detective-room-source');
const {normalize}=require('./detective-room-normalize');
const {createAuthor,authorCase,MODEL,REGION}=require('./detective-room-author');
const {compose,portraits,addNamedPeople}=require('./detective-room-compose');
const ops=require('./ai-ops-telemetry');
process.umask(0o077);
const resourceRoot=path.resolve(__dirname,'../detective-worker');
const runtimePackage=process.env.CDR_ROOM_RUNTIME_PACKAGE||path.resolve(__dirname,'../package.json');
async function command(program,args,cwd,timeout=600000){
 await new Promise((resolve,reject)=>{
  const child=spawn(program,args,{cwd,stdio:['ignore','pipe','pipe'],detached:true});
  let tail='',timedOut=false;
  const capture=b=>{tail=(tail+b.toString()).slice(-6000);};
  child.stdout.on('data',capture);child.stderr.on('data',capture);
  const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGKILL');}catch{}},timeout);
  child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('close',code=>{clearTimeout(timer);code===0&&!timedOut?resolve():reject(new Error((timedOut?'Stage deadline exceeded: ':'Stage failed: ')+path.basename(program)+' '+args.map(x=>path.basename(String(x))).join(' ')+'\n'+tail));});
 });
}
async function allFiles(root,rel=''){
 const result=[];
 for(const entry of await fs.readdir(path.join(root,rel),{withFileTypes:true})){
  const name=path.posix.join(rel,entry.name);
  if(entry.isSymbolicLink()||entry.name.startsWith('.'))throw Error('Unexpected symlink or hidden published file.');
  if(entry.isDirectory())result.push(...await allFiles(root,name));
  else if(entry.isFile())result.push(name);
  else throw Error('Unexpected published file type.');
 }
 return result.sort();
}
async function zip(output,files,target){
 await new Promise((resolve,reject)=>{
  const z=new yazl.ZipFile(),stream=createWriteStream(target,{flags:'wx',mode:0o600});
  z.outputStream.on('error',reject);stream.on('error',reject);stream.on('close',resolve);
  z.outputStream.pipe(stream);for(const file of files)z.addFile(path.join(output,file),file,{compress:!file.endsWith('.mp4')&&!file.endsWith('.zip')});
  z.end();
 });
 await command('unzip',['-tqq',target],path.dirname(target),60000);
}
async function produce(job,store,db){
 const directory=store.directory(job.id),stage=label=>store.update(job.id,{stage:label});
 const data=await db(job.owner,c=>snapshot(c,job.batchId));
 if(data.fingerprint!==job.fingerprint)throw Error('Source fingerprint changed after queueing; generate a new run.');
 const evidence=path.join(directory,'evidence'),source=path.join(evidence,'source');
 await fs.mkdir(source,{recursive:true,mode:0o700});
 await fs.writeFile(path.join(evidence,'batch.zip'),data.archive,{flag:'wx',mode:0o600});
 for(const f of data.files){const target=path.join(source,f.path);await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});await fs.writeFile(target,f.content,{flag:'wx',mode:0o600});}
 for(const f of data.derivedFiles){const target=path.join(source,f.path);await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});await fs.writeFile(target,f.content,{flag:'wx',mode:0o600});}
 await atomic(path.join(evidence,'verification.json'),{batch_id:job.batchId,archive_sha256:data.batch.ARCHIVE_SHA256,verified_files:data.files.map(f=>({path:f.path,sha256:f.sha256,bytes:f.bytes})),derived_transcripts:data.derivedFiles.map(f=>({path:f.path,sha256:f.sha256,bytes:f.bytes,derivedFrom:f.derivedFrom})),excluded_os_metadata:[],excludedMetadataCount:data.ignored});
 await atomic(path.join(directory,'header.json'),{results:[{items:[Object.fromEntries(Object.entries(data.batch).map(([k,v])=>[k.toLowerCase(),v]))]}]});
 let attemptNumber=0;
 await fs.mkdir(path.join(directory,'private-model-responses'),{mode:0o700});
 const normal=normalize(data.analysisFiles);
 let authored;
 if(job.recoverFrom){
  await stage('Rechecking saved analysis against the unchanged source batch');
  const previousDirectory=store.directory(job.recoverFrom.runId);
  const bytes=await fs.readFile(path.join(previousDirectory,'authoring.json'));
  if(sha(bytes)!==job.recoverFrom.authoringSha256)throw Error('Saved analysis changed after recovery was queued.');
  authored=require('./detective-room-recovery').validateRecovery({job,previous:await store.read(job.recoverFrom.runId),
   failure:JSON.parse(await fs.readFile(path.join(previousDirectory,'failure.json'),'utf8')),
   verification:JSON.parse(await fs.readFile(path.join(previousDirectory,'evidence/verification.json'),'utf8')),
   analysis:JSON.parse(bytes),normal,analysisFingerprint:data.analysisFingerprint,files:data.analysisFiles,archiveSHA256:sha(data.archive)});
 }else{
  const author=createAuthor(undefined,rec=>atomic(path.join(directory,'private-model-responses',String(++attemptNumber).padStart(3,'0')+'.json'),rec));
  try{authored=await authorCase(normal,data.analysisFiles,author,stage);}finally{author.close();}
 }
 await atomic(path.join(directory,'authoring.json'),authored);
 addNamedPeople(normal,authored);
 require('./detective-room-associations').applyPersonLinks(normal,data.associations);
 await stage('Resolving explicit catalogue portraits');
 const portraitProvenance=await db(job.owner,c=>portraits(c,normal.people,process.env.CDR_ROOM_PUBLIC_ROOT||path.resolve(__dirname,'../frontend/public'),path.join(directory,'portraits')));
 const build=path.join(directory,'video-build'),briefing=path.join(directory,'briefing'),output=path.join(directory,'output');
 const {room,video}=compose({job,snapshot:data,normal,authored,directory,briefingDir:briefing});
 await fs.mkdir(build);await fs.mkdir(briefing);
 const caseFile=path.join(directory,'video-case.json'),roomFile=path.join(directory,'room-case.json');
 await atomic(caseFile,video);await atomic(roomFile,room);
 const common=['--case',caseFile,'--build',build,'--out',briefing,'--runtime-package',runtimePackage];
 await stage('Rendering industrial briefing scenes');
 await command('node',[path.join(resourceRoot,'video/scripts/render.mjs'),...common],directory);
 await stage('Synthesising European-English voice · expressive pauses');
 await ops.track({operationId:'room.speech',feature:'Detective Room speech synthesis',kind:'workflow',provider:'Local',model:'Kokoro v1.0 ONNX',stage:'speech',inputCount:video.scenes.length,inputCharacters:video.scenes.reduce((n,s)=>n+String(s.narration||'').length,0),
  note:'Local speech synthesis process, including model loading. Not an LLM call or cloud-token usage; input text/audio are not retained in AI Opps.'},
  ()=>command('python',[path.join(resourceRoot,'video/scripts/synthesize.py'),'--case',caseFile,'--build',build,'--out',briefing,'--models',process.env.CDR_ROOM_MODELS||'/models'],directory),()=>({outputCount:video.scenes.length}));
 await stage('Encoding 1080p video, voiceover and captions');
 await command('python',[path.join(resourceRoot,'video/scripts/encode_linux.py'),'--build',build,'--out',briefing],directory);
 await command('node',[path.join(resourceRoot,'video/scripts/package.mjs'),...common],directory);
 await fs.writeFile(path.join(briefing,'README.md'),'# '+video.title+' — narrated case overview\n\nBatch: '+job.batchId+'\n\nOpen Case-Overview.html for chapters, transcript and source register. Keep the folder together. Voice is locally synthesised with the approved Kokoro French/British blend, not a human recording. OCI Maverick in Chicago supplies case analysis. A controlled spoken script combines that analysis with source counts and evidence qualifications; it is not the frozen pilot script.\n\nAI draft. Human factual, voice and visual acceptance is pending. Private Ask Detective conversations are excluded.\n');
 await stage('Checking video playback, captions and chapters');
 await command('node',[path.join(resourceRoot,'video/scripts/check.mjs'),...common],directory);
 const validation=JSON.parse(await fs.readFile(path.join(briefing,'validation.json'),'utf8'));
 if(validation.durationSeconds<120||validation.durationSeconds>240)throw Error('Briefing duration outside 2–4 minute requirement.');
 await command('ffmpeg',['-v','error','-xerror','-threads','2','-i',path.join(briefing,'Case-Overview.mp4'),'-f','null','-'],directory,180000);
 await stage('Building interactive Virtual Detective Room');
 await command('node',[path.join(resourceRoot,'room/scripts/build.mjs'),'--batch',job.batchId,'--case',roomFile,'--out',output,'--runtime-package',runtimePackage],directory);
 await stage('Checking room controls, evidence links and mobile layouts');
 await command('node',[path.join(resourceRoot,'room/scripts/check.mjs'),'--case',roomFile,'--out',output,'--build',path.join(directory,'room-qa'),'--runtime-package',runtimePackage],directory);
 await fs.copyFile(path.join(evidence,'batch.zip'),path.join(output,'Original-Evidence.zip'));
 await fs.writeFile(path.join(output,'README.md'),'# '+room.title+' — Virtual Detective Room\n\nBatch: '+job.batchId+'\nRun: '+job.id+'\n\nOpen Virtual-Detective-Room.html. In the app this is a hosted, access-scoped snapshot; after download it also runs offline. Extract the complete ZIP and keep the folder together. The briefing folder includes MP4, voiceover, captions, transcript and chapter player. Original-Evidence.zip is the unmodified source archive.\n\n'+room.disclaimer+'\n\nGeneration-Provenance.json records source hashes, checked quotes, coverage and provider details. No credentials, wallet or private Ask Detective material is included. Access to a downloaded copy is no longer controlled by the app. No live updates or collaborative editing are provided.\n');
 await atomic(path.join(output,'Generation-Provenance.json'),{
  batchId:job.batchId,run:job.id,engine:job.engine,archiveSHA256:data.batch.ARCHIVE_SHA256,archiveBytes:data.batch.ARCHIVE_BYTES,
  derivedTranscripts:data.derivedFiles.map(f=>({path:f.path,sha256:f.sha256,bytes:f.bytes,derivedFrom:f.derivedFrom})),
  model:MODEL,region:REGION,narrationMode:authored.narrationMode,sourceFingerprint:job.fingerprint,coverage:normal.coverage,portraits:portraitProvenance,
  ...(job.recoverFrom?{analysisRecovery:job.recoverFrom}:{}),
  associations:data.associations,analysisFingerprint:data.analysisFingerprint,
  calls:authored.calls,sourceClaims:authored.facts,sceneClaims:authored.scenes.map(({id,factIds})=>({id,factIds})),
  calculatedMoney:normal.money,ignoredMetadataCount:data.ignored,
  review:'Automated integrity, playback and layout checks passed. Human factual, voice and visual acceptance pending. AI draft, synthetic only.',
  exclusions:['private Ask Detective conversations, notes and theories','database credentials','wallet','raw prompts']
 });
 await stage('Packaging verified room and briefing ZIP');
 const files=await allFiles(output);
 await zip(output,files,path.join(directory,'package.zip'));
 // Recheck scope and source immediately before publication (batch may be removed).
 const current=await db(job.owner,async c=>{const batch=await visible(c,job.batchId);return {batch,...await generationContext(c,batch)};});
 if(current.fingerprint!==job.fingerprint||current.batch.STATUS!=='ready')throw Error('Source or saved transcript changed; generate a new run.');
 await atomic(path.join(directory,'publication.json'),{files,hashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,sha(await fs.readFile(path.join(output,f)))])))});
 await store.update(job.id,{state:'READY',stage:'Room and briefing ready · analyst review required',finishedAt:new Date().toISOString(),durationSeconds:validation.durationSeconds});
}
async function main(){
 if(process.env.CDR_ROOM_WORKER_LOCKED!=='1')throw Error('Start this worker through flock; see deployment instructions.');
 const store=createStore(process.env.CDR_ROOM_ROOT);await store.init();
 const modelRoot=process.env.CDR_ROOM_MODELS||'/models';
 for(const [file,digest] of [['kokoro-v1.0.onnx','beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a'],['voices-v1.0.bin','bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d']]){
  if(sha(await fs.readFile(path.join(modelRoot,file)))!==digest)throw Error('Approved voice model integrity check failed: '+file);
 }
 const env=process.env;
 const pool=await oracle.createPool({user:env.ORACLE_USER,password:env.APP_SCHEMA_PASSWORD,connectString:env.ORACLE_CONNECTION_STRING,
  ...(env.ORACLE_WALLET_LOCATION?{configDir:env.ORACLE_WALLET_LOCATION,walletLocation:env.ORACLE_WALLET_LOCATION,walletPassword:env.ORACLE_WALLET_PASSWORD}:{}),poolMin:0,poolMax:2,poolTimeout:30});
 // Telemetry uses independent write connections; evidence reads stay read-only.
 ops.enableBackground();
 async function db(user,fn){
  const c=await pool.getConnection();c.callTimeout=30000;
  try{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});await c.execute('SET TRANSACTION READ ONLY');return await fn(c);}
  finally{await c.rollback();await c.close();}
 }
 // Safe only because the process owns the exclusive, kernel-managed worker lock.
 for(const j of await store.list())if(j.state==='IN_PROGRESS')await store.update(j.id,{state:'FAILED',stage:'Interrupted worker run',error:'Worker restarted during generation. Generate again to retry.',finishedAt:new Date().toISOString()});
 let stop=false;process.on('SIGTERM',()=>{stop=true;});process.on('SIGINT',()=>{stop=true;});
 const beat=()=>store.heartbeat({collector:{...ops.health,pendingNote:'Detective worker; independent telemetry connections.'}});
 const heartbeat=setInterval(()=>beat().catch(()=>{stop=true;}),10000);
 try{
  await beat();
  while(!stop){
   const job=await store.claim();
   if(!job){await new Promise(r=>setTimeout(r,2500));continue;}
   try{await ops.jobContext({actor:job.owner,area:'Crime Data Room',batchId:job.batchId,runId:job.id,traceId:job.id,process:'detective-worker'},()=>ops.track({operationId:'room.publish',feature:'Detective Room publication outcome',kind:'workflow',provider:'None',stage:'publication',note:'End-to-end job outcome. Includes model, speech and rendering work; do not add this duration to child operations.'},()=>produce(job,store,db)));}
   catch(e){
    await atomic(path.join(store.directory(job.id),'failure.json'),{at:new Date().toISOString(),stage:(await store.read(job.id)).stage,message:String(e.message).slice(0,8000),code:e.code,serviceCode:e.serviceCode});
    await store.update(job.id,{state:'FAILED',stage:'Generation stopped before publication',error:e.status&&e.status<500?e.message:e.code==='MODEL_RESPONSE_INVALID'?'The AI response did not pass evidence-format checks after one corrective retry. No incomplete package was published. An operator can inspect this run’s diagnostics.':'Generation or validation failed. No incomplete package was published; an operator can inspect this run’s diagnostics.',finishedAt:new Date().toISOString()});
   }
  }
 }finally{clearInterval(heartbeat);await ops.flush();await fs.unlink(path.join(store.root,'worker.json')).catch(()=>{});await pool.close(5);}
}
if(require.main===module)main().catch(e=>{console.error('Detective worker stopped:',e.code||e.message);process.exitCode=1;});
module.exports={produce,command,allFiles,zip};
