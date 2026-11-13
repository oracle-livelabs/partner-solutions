'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {createStore,publicJob,fail,ACTIVE}=require('./detective-room-store');
const {visible,fingerprint,generationContext}=require('./detective-room-source');
const {DEMO_USERS:USERS,canonicalDemoUser}=require('./demo-identity');
const enabled=()=>process.env.CDR_ROOM_ENABLED==='1';
function registerRoomPublication(router,db,route,injectedStore){
 let cached;const store=()=>injectedStore||(cached||=createStore(process.env.CDR_ROOM_ROOT));
 const requireEnabled=()=>{if(!enabled())throw fail(503,'Detective Room generation is not enabled on this deployment.');};
 function explicitUser(req){const u=canonicalDemoUser(req.header('x-demo-user'));if(!USERS.has(u)||u!==req.demoUser)throw fail(403,'An explicit recognised demo-user context is required.');return u;}
 const scope=(owner,id)=>db(owner,c=>visible(c,id)),prefix='/batches/:id/room';
 router.get(prefix,route(async(req,res)=>{
  if(!enabled())return res.json({enabled:false,state:'NOT_STARTED'});
  const owner=explicitUser(req),batch=await scope(owner,req.params.id),history=await store().list(owner,req.params.id);
  const latest=history[0],ready=history.find(j=>j.state==='READY');
  let context,generationIssue;
  if(batch.STATUS==='ready')try{context=await db(owner,c=>generationContext(c,batch));}catch(e){if(e.status!==409)throw e;generationIssue=e.message;}
  res.json({enabled:true,workerAvailable:await store().healthy(),state:latest?.state||'NOT_STARTED',latest:publicJob(latest,!!ready),ready:publicJob(ready),current:!!ready&&ready.fingerprint===context?.fingerprint,eligible:batch.STATUS==='ready'&&!generationIssue,generationIssue,estimate:'Allow around 10 minutes; larger batches may take longer.',security:'Synthetic demonstration only; demo-user selection is not production authentication.'});
 }));
 router.post(prefix,route(async(req,res)=>{
  requireEnabled();const owner=explicitUser(req);if(owner==='read_only_viewer')throw fail(403,'Read-only users cannot generate rooms.');
  const batch=await scope(owner,req.params.id);if(batch.STATUS!=='ready')throw fail(409,'Wait for the batch inventory to be ready.');
  if(req.body?.regenerate!==undefined&&typeof req.body.regenerate!=='boolean')throw fail(400,'regenerate must be boolean.');
  if(!await store().healthy())throw fail(503,'The room worker is unavailable; no new job was queued.');
  const context=await db(owner,c=>generationContext(c,batch));
  const r=await store().enqueue({owner,batch:req.params.id,fingerprint:context.fingerprint,analysisFingerprint:context.analysisFingerprint,regenerate:req.body?.regenerate===true});
  res.status(ACTIVE.has(r.job.state)?202:200).json({job:publicJob(r.job),reused:r.reused});
 }));
 const cookieName=run=>'cdr_room_'+run.replaceAll('-','_');
 const viewPath=(batch,run)=>'/api/data-room/batches/'+batch+'/room/runs/'+run+'/files';
 async function readyRun(owner,id,run){
  const j=await store().read(run).catch(e=>{if(e.code==='ENOENT')throw fail(404,'Room run not found.');throw e;});
  if(j.owner!==owner||j.batchId!==id)throw fail(404,'Room run not found in your scope.');
  await scope(owner,id); // Revokes access when the source batch is deleted/hidden.
  if(j.state!=='READY')throw fail(409,'This room has not passed publication checks.');return j;
 }
 // Browser subresources cannot attach X-Demo-User. Exchange explicit context for
 // a run-scoped HttpOnly cookie. No token in URLs, logs, ZIP or localStorage.
 router.post(prefix+'/runs/:run/access',route(async(req,res)=>{
  requireEnabled();const owner=explicitUser(req),j=await readyRun(owner,req.params.id,req.params.run);
  const payload=Buffer.from(JSON.stringify({owner,run:j.id,batch:j.batchId,expires:Date.now()+3600000})).toString('base64url');
  const signature=crypto.createHmac('sha256',await store().secret()).update(payload).digest('base64url'),base=viewPath(j.batchId,j.id);
  res.cookie(cookieName(j.id),payload+'.'+signature,{httpOnly:true,sameSite:'strict',secure:req.secure,path:base,maxAge:3600000});
  res.json({view:base+'/Virtual-Detective-Room.html',download:base+'/download.zip'});
 }));
 router.get(prefix+'/runs/:run/files/*',route(async(req,res)=>{
  requireEnabled();const name=cookieName(req.params.run);
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
  if(!token||token.length>2000)throw fail(401,'Open this room again from Data Room to renew access.');
  const [payload,signature,extra]=token.split('.');
  const expected=crypto.createHmac('sha256',await store().secret()).update(payload).digest('base64url');
  if(extra||!signature||signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw fail(401,'Invalid room access.');
  let a;try{a=JSON.parse(Buffer.from(payload,'base64url').toString());}catch{throw fail(401,'Invalid room access.');}
  if(!USERS.has(a.owner)||a.run!==req.params.run||a.batch!==req.params.id||!Number.isFinite(a.expires)||a.expires<Date.now())throw fail(401,'Room access expired.');
  const j=await readyRun(a.owner,req.params.id,req.params.run),file=req.params[0];
  res.set({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"});
  if(file==='download.zip'){res.attachment('Virtual-Detective-Room_'+j.batchId+'_'+j.id+'.zip');return res.sendFile(path.join(store().directory(j.id),'package.zip'));}
  const manifest=JSON.parse(await fs.readFile(path.join(store().directory(j.id),'publication.json'),'utf8'));
  if(!manifest.files.includes(file)||file.split('/').some(p=>p==='..'||p.startsWith('.'))||file.includes('\\'))throw fail(404,'Room file not found.');
  return res.sendFile(file,{root:path.join(store().directory(j.id),'output'),dotfiles:'deny'});
 }));
}
module.exports={registerRoomPublication};
