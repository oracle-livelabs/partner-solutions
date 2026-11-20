'use strict';
// Operator-only recovery; no browser endpoint accepts analysis-reuse pointers.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createStore,atomic,sha}=require('../backend/detective-room-store');
async function main(){
 const id=process.argv[2];assert(id,'Supply the original layout-failed run ID');
 const store=createStore(process.env.CDR_ROOM_ROOT),previous=await store.read(id),directory=store.directory(id);
 assert.equal(previous.state,'FAILED');assert.equal(JSON.parse(await fs.readFile(path.join(directory,'failure.json'))).stage,'Checking room controls, evidence links and mobile layouts');
 const authoringSha256=sha(await fs.readFile(path.join(directory,'authoring.json')));
 const {connect}=require('./evidence-intelligence/connection.cjs'),{generationContext,visible}=require('../backend/detective-room-source');
 const c=await connect();let context;try{await c.execute('SET TRANSACTION READ ONLY');context=await generationContext(c,await visible(c,previous.batchId));}finally{await c.rollback();await c.close();}
 const result=await store.locked(async()=>{
  const history=await store.list(previous.owner,previous.batchId);assert(!history.some(j=>['QUEUED','IN_PROGRESS'].includes(j.state)),'Batch already has active work');
  const space=await fs.statfs(store.root);assert(space.bavail*space.bsize>=4*1024**3,'Insufficient generation storage');
  const runId='run-'+Date.now()+'-'+require('node:crypto').randomBytes(6).toString('hex');
  const job={id:runId,batchId:previous.batchId,owner:previous.owner,fingerprint:context.fingerprint,analysisFingerprint:context.analysisFingerprint,engine:previous.engine,state:'QUEUED',stage:'Waiting to recover checked analysis',createdAt:new Date().toISOString(),review:'AI draft — analyst review required',recoverFrom:{runId:id,authoringSha256}};
  await fs.mkdir(store.directory(runId),{mode:0o700});await atomic(path.join(store.directory(runId),'job.json'),job);return job;
 });
 console.log(JSON.stringify({id:result.id,batchId:result.batchId,state:result.state,recoverFrom:result.recoverFrom.runId}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
