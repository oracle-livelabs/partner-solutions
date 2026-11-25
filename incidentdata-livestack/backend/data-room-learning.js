'use strict';
const ops=require('./ai-ops-telemetry');
const crypto=require('node:crypto');
const oracledb=require('oracledb');
const ai=require('./data-room-learning-ai');
const {hash}=require('./data-room-archive');
const lower=r=>r?Object.fromEntries(Object.entries(r).map(([k,v])=>[k.toLowerCase(),v])):null;
const rows=async(c,sql,binds={},options={})=>(await c.execute(sql,binds,{outFormat:oracledb.OUT_FORMAT_OBJECT,...options})).rows;
const META='run_id,batch_id,requested_by,status,created_at,started_at,finished_at,updated_at,attempts,model_id,region,prompt_version,input_fingerprint,input_sha256,title,request_id,error_text';
const httpError=(status,message)=>Object.assign(new Error(message),{status});

async function currentSnapshot(c,id){
  const records=await rows(c,`SELECT i.item_id,i.original_path,i.content_type,i.sha256,r.run_id,r.result_json,r.model_id,r.prompt_version,r.created_at
    FROM secure_cdr_items_v i LEFT JOIN (
      SELECT a.*,ROW_NUMBER() OVER(PARTITION BY item_id ORDER BY created_at DESC,run_id DESC) rn
      FROM secure_cdr_ai_results_v a WHERE status='complete') r ON r.item_id=i.item_id AND r.rn=1
    WHERE i.batch_id=:id ORDER BY i.item_id`,{id},{fetchInfo:{RESULT_JSON:{type:oracledb.STRING}}});
  return ai.snapshot(records.map(r=>({itemId:r.ITEM_ID,path:r.ORIGINAL_PATH,type:r.CONTENT_TYPE,sha256:r.SHA256,
    descriptionRunId:r.RUN_ID,resultJson:r.RESULT_JSON,model:r.MODEL_ID,promptVersion:r.PROMPT_VERSION,createdAt:r.CREATED_AT})));
}
async function latestLearningRun(c,id){
  return lower((await rows(c,`SELECT ${META} FROM secure_cdr_learn_runs_v WHERE batch_id=:id ORDER BY created_at DESC,run_id DESC FETCH FIRST 1 ROW ONLY`,{id}))[0]);
}
async function learningDetail(c,id,runId){
  if(!(await rows(c,'SELECT batch_id FROM secure_cdr_batches_v WHERE batch_id=:id',{id})).length)throw httpError(404,'Batch not found in your authorised scope.');
  const history=(await rows(c,`SELECT ${META} FROM secure_cdr_learn_runs_v WHERE batch_id=:id ORDER BY created_at DESC,run_id DESC FETCH FIRST 20 ROWS ONLY`,{id})).map(lower);
  const selected=runId || history.find(r=>r.status==='complete')?.run_id || history[0]?.run_id;
  if(!selected)return {run:null,history,result:null,manifest:[],coverage:null,isCurrent:false};
  const r=(await rows(c,`SELECT ${META},input_json,result_json FROM secure_cdr_learn_runs_v WHERE batch_id=:id AND run_id=:runId`,{id,runId:selected},
    {fetchInfo:{INPUT_JSON:{type:oracledb.STRING},RESULT_JSON:{type:oracledb.STRING}}}))[0];
  if(!r)throw httpError(404,'Learning run not found in this batch and scope.');
  const input=JSON.parse(r.INPUT_JSON),storedResult=r.RESULT_JSON?JSON.parse(r.RESULT_JSON):null,result=r.STATUS==='complete'?storedResult:null;
  let isCurrent=false;
  try{isCurrent=(await currentSnapshot(c,id)).fingerprint===r.INPUT_FINGERPRINT && r.PROMPT_VERSION===ai.PROMPT_VERSION;}catch{/* incomplete/changed sources are explicitly marked stale */}
  const record=lower(r);delete record.input_json;delete record.result_json;
  return {run:record,history,result,generation:storedResult?.generation || null,manifest:input.manifest,coverage:input.coverage,isCurrent};
}

function createLearningWorker(db,generate=ai.generate){
  let busy=false,timer;
  async function queue(id,user){
    if(user==='read_only_viewer')throw httpError(403,'The read-only demo user cannot run batch learning.');
    const result=await db(user,async c=>{
      const b=(await rows(c,'SELECT batch_id,status,file_count FROM secure_cdr_batches_v WHERE batch_id=:id',{id}))[0];
      if(!b)throw httpError(404,'Batch not found in your authorised scope.');
      await c.execute('SELECT batch_id FROM cdr_batches WHERE batch_id=:id FOR UPDATE',{id});
      const active=(await rows(c,`SELECT run_id,status FROM cdr_learn_runs WHERE batch_id=:id AND status IN ('queued','running')`,{id}))[0];
      if(active)return {runId:active.RUN_ID,status:active.STATUS,reused:true};
      const s=(await rows(c,'SELECT status FROM secure_cdr_stages_v WHERE batch_id=:id AND stage_no=4',{id}))[0];
      if(b.STATUS!=='ready'||s?.STATUS!=='complete')throw httpError(409,'Complete Identify/Describe for this batch before running Learn-what-is-there.');
      let input;try{input=await currentSnapshot(c,id);}catch(e){throw httpError(409,e.message);}
      if(input.manifest.length!==b.FILE_COUNT)throw httpError(409,'Inventory changed. Recheck the batch before learning.');
      const existing=(await rows(c,`SELECT run_id FROM secure_cdr_learn_runs_v WHERE batch_id=:id AND status='complete' AND input_fingerprint=:fingerprint AND prompt_version=:version ORDER BY created_at DESC FETCH FIRST 1 ROW ONLY`,{id,fingerprint:input.fingerprint,version:ai.PROMPT_VERSION}))[0];
      if(existing){
        await c.execute(`UPDATE cdr_stages SET status='complete',detail='Existing brief reused; descriptions unchanged',finished_at=COALESCE(finished_at,SYSTIMESTAMP) WHERE batch_id=:id AND stage_no=5`,{id});
        await c.commit();return {runId:existing.RUN_ID,status:'complete',reused:true};
      }
      const pinned=ai.config(),runId=crypto.randomUUID(),inputJson=JSON.stringify(input);
      await c.execute(`INSERT INTO cdr_learn_runs(run_id,batch_id,requested_by,status,model_id,region,prompt_version,input_fingerprint,input_sha256,input_json)
        VALUES(:runId,:id,:usr,'queued',:modelId,:region,:version,:fingerprint,:inputHash,:inputJson)`,{
        runId,id,usr:user,modelId:pinned.model,region:pinned.region,version:pinned.promptVersion,fingerprint:input.fingerprint,
        inputHash:hash(Buffer.from(inputJson)),inputJson:{val:inputJson,type:oracledb.CLOB}});
      await c.execute(`UPDATE cdr_stages SET status='pending',started_at=NULL,finished_at=NULL,detail=:detail WHERE batch_id=:id AND stage_no=5`,{id,detail:`Queued a batch brief from ${input.manifest.length} saved descriptions`});
      await c.commit();return {runId,status:'queued',reused:false};
    });
    void tick();return result;
  }
  async function owned(run,fn){
    return db(run.REQUESTED_BY,async c=>{
      const lock=await c.execute(`UPDATE cdr_learn_runs SET lease_until=SYSTIMESTAMP+NUMTODSINTERVAL(120,'SECOND'),updated_at=SYSTIMESTAMP WHERE run_id=:runId AND lease_token=:token AND status='running'`,{runId:run.RUN_ID,token:run.TOKEN});
      if(!lock.rowsAffected)throw new Error('Learning worker lease superseded.');
      if(!(await rows(c,'SELECT batch_id FROM secure_cdr_batches_v WHERE batch_id=:id',{id:run.BATCH_ID})).length)throw new Error('Batch is no longer visible in the requesting user scope.');
      const result=await fn(c);await c.commit();return result;
    });
  }
  async function processRun(run){
    const started=Date.now();let failure;
    try{
      if(run.PROMPT_VERSION!==ai.PROMPT_VERSION)throw new Error('Learning prompt changed since this run was queued. Retry with the current version.');
      const input=await owned(run,async c=>{
        const stored=(await rows(c,'SELECT input_json FROM secure_cdr_learn_runs_v WHERE run_id=:runId',{runId:run.RUN_ID},{fetchInfo:{INPUT_JSON:{type:oracledb.STRING}}}))[0];
        if(!stored || hash(Buffer.from(stored.INPUT_JSON))!==run.INPUT_SHA256)throw new Error('Learning input integrity check failed.');
        const snapshot=JSON.parse(stored.INPUT_JSON),current=await currentSnapshot(c,run.BATCH_ID);
        if(current.fingerprint!==run.INPUT_FINGERPRINT)throw new Error('Source descriptions changed. Retry learning with the current sources.');
        await c.execute(`UPDATE cdr_stages SET status='running',started_at=COALESCE(started_at,SYSTIMESTAMP),finished_at=NULL,detail='Generating a source-linked Batch Brief with OCI GenAI' WHERE batch_id=:id AND stage_no=5`,{id:run.BATCH_ID});
        return snapshot;
      });
      const result=await ops.context({actor:run.REQUESTED_BY,area:'Crime Data Room',feature:'Batch Brief',traceId:run.RUN_ID,runId:run.RUN_ID,batchId:run.BATCH_ID},()=>generate(input,{model:run.MODEL_ID,region:run.REGION,promptVersion:run.PROMPT_VERSION}));
      await owned(run,async c=>{
        if((await currentSnapshot(c,run.BATCH_ID)).fingerprint!==run.INPUT_FINGERPRINT)throw new Error('Source descriptions changed while learning. Retry with the current sources.');
        await c.execute(`UPDATE cdr_learn_runs SET status='complete',result_json=:resultJson,title=:title,request_id=:requestId,
          finished_at=SYSTIMESTAMP,error_text=NULL,lease_token=NULL,lease_until=NULL WHERE run_id=:runId`,{
          runId:run.RUN_ID,resultJson:{val:JSON.stringify(result),type:oracledb.CLOB},title:result.title,requestId:result.requestId||null});
        await c.execute(`UPDATE cdr_stages SET status='complete',finished_at=SYSTIMESTAMP,detail=:detail WHERE batch_id=:id AND stage_no=5`,{id:run.BATCH_ID,detail:`Batch Brief saved from ${input.manifest.length} descriptions. AI draft; no relationships created.`});
        await c.execute('UPDATE cdr_batches SET headline=:headline,updated_at=SYSTIMESTAMP WHERE batch_id=:id',{id:run.BATCH_ID,headline:`${input.manifest.length} items · ${result.title} · AI draft brief`});
      });
    }catch(e){
      failure=e;
      console.error(`Data Room learning ${run.RUN_ID}:`,e.message);
      const safe= e.generation || /Learning|learning|Source descriptions|OCI|Batch is no longer/.test(e.message)?e.message.slice(0,450):'Learning run interrupted. Retry the brief; original files and descriptions are retained.';
      try{await owned(run,async c=>{
        await c.execute(`UPDATE cdr_learn_runs SET status='failed',finished_at=SYSTIMESTAMP,error_text=:failure,result_json=:diagnostics,request_id=:requestId,lease_token=NULL,lease_until=NULL WHERE run_id=:runId`,{runId:run.RUN_ID,failure:safe,diagnostics:{val:e.generation?JSON.stringify({generation:e.generation,reviewStatus:'generation_failed'}):null,type:oracledb.CLOB},requestId:e.requestId || null});
        await c.execute(`UPDATE cdr_stages SET status='failed',finished_at=SYSTIMESTAMP,detail=:failure WHERE batch_id=:id AND stage_no=5`,{id:run.BATCH_ID,failure:safe});
      });}catch(leaseError){console.error('Learning failure state:',leaseError.message);}
    }finally{ops.record({operationId:'cdr.brief.outcome',feature:'Batch Brief outcome',kind:'workflow',provider:'None',actor:run.REQUESTED_BY,area:'Crime Data Room',batchId:run.BATCH_ID,runId:run.RUN_ID,traceId:run.RUN_ID,startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,status:failure?'failed':'complete',error:failure?.message,note:'End-to-end brief outcome, including source freshness and persistence. Provider attempts are recorded separately.'});}
  }
  async function tick(){
    if(busy)return;busy=true;
    try{
      const run=await db('statewide_admin',async c=>{
        const r=(await rows(c,`SELECT ${META} FROM cdr_learn_runs WHERE status='queued' OR (status='running' AND lease_until<SYSTIMESTAMP) ORDER BY created_at FETCH FIRST 1 ROW ONLY`))[0];
        if(!r)return null;
        if(r.ATTEMPTS>=3){
          const updated=await c.execute(`UPDATE cdr_learn_runs SET status='failed',finished_at=SYSTIMESTAMP,error_text='Automatic learning recovery limit reached. Retry the brief.' WHERE run_id=:runId AND (status='queued' OR (status='running' AND lease_until<SYSTIMESTAMP))`,{runId:r.RUN_ID});
          if(updated.rowsAffected)await c.execute(`UPDATE cdr_stages SET status='failed',finished_at=SYSTIMESTAMP,detail='Automatic learning recovery limit reached. Retry the brief.' WHERE batch_id=:id AND stage_no=5`,{id:r.BATCH_ID});
          await c.commit();return null;
        }
        const token=crypto.randomUUID();
        const claim=await c.execute(`UPDATE cdr_learn_runs SET status='running',lease_token=:token,lease_until=SYSTIMESTAMP+NUMTODSINTERVAL(120,'SECOND'),attempts=attempts+1,started_at=COALESCE(started_at,SYSTIMESTAMP),updated_at=SYSTIMESTAMP
          WHERE run_id=:runId AND (status='queued' OR (status='running' AND lease_until<SYSTIMESTAMP))`,{runId:r.RUN_ID,token});
        await c.commit();return claim.rowsAffected?{...r,TOKEN:token}:null;
      });
      if(run)await ops.jobContext({actor:run.REQUESTED_BY,area:'Crime Data Room',batchId:run.BATCH_ID,runId:run.RUN_ID,traceId:run.RUN_ID},()=>processRun(run));
    }catch(e){console.error('Learning queue unavailable:',e.message);}
    finally{busy=false;}
  }
  return {queue,tick,start(){if(!timer){timer=setInterval(tick,2500);timer.unref();void tick();}},stop(){clearInterval(timer);timer=null;}};
}
module.exports={createLearningWorker,latestLearningRun,learningDetail,currentSnapshot};
