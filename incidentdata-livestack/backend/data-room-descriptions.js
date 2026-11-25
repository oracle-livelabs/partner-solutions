'use strict';
const crypto = require('node:crypto');
const ops=require('./ai-ops-telemetry');
const oracledb = require('oracledb');
const ai = require('./data-room-ai');
const transcription=require('./data-room-transcription');
const lower = row => row ? Object.fromEntries(Object.entries(row).map(([k,v])=>[k.toLowerCase(),v])) : null;
const rows = async(c, sql, binds={}, options={}) => (await c.execute(sql,binds,{outFormat:oracledb.OUT_FORMAT_OBJECT,...options})).rows;
const RUN_COLUMNS = 'run_id,batch_id,requested_by,status,created_at,started_at,finished_at,attempts,item_total,completed_count,failed_count,text_model,image_model,region,prompt_version,error_text';
const error = (status,message) => Object.assign(new Error(message),{status});

async function saveResult(c,binds) {
  await c.execute(`MERGE INTO cdr_ai_results r USING (SELECT :runId run_id,:itemId item_id FROM dual) s
    ON (r.run_id=s.run_id AND r.item_id=s.item_id)
    WHEN MATCHED THEN UPDATE SET status=:state,headline=:headline,result_json=:resultJson,error_text=:failure,request_id=:requestId
    WHEN NOT MATCHED THEN INSERT(run_id,item_id,source_sha256,status,headline,result_json,error_text,model_id,region,prompt_version,request_id)
    VALUES(:runId,:itemId,:sha,:state,:headline,:resultJson,:failure,:modelId,:region,:version,:requestId)`,binds);
}

async function batchDescriptions(c,id) {
  const run = lower((await rows(c,`SELECT ${RUN_COLUMNS} FROM secure_cdr_ai_runs_v WHERE batch_id=:id ORDER BY created_at DESC FETCH FIRST 1 ROW ONLY`,{id}))[0]);
  const descriptions = await rows(c,`SELECT item_id,status,headline,error_text,model_id,region,prompt_version,created_at,CASE WHEN JSON_EXISTS(result_json,'$.transcription.turns[0]' FALSE ON ERROR) THEN 1 ELSE 0 END transcript_dialogue_ready FROM (
    SELECT r.*,ROW_NUMBER() OVER(PARTITION BY r.item_id ORDER BY r.created_at DESC,r.run_id DESC) rn
    FROM secure_cdr_ai_results_v r JOIN secure_cdr_items_v i ON i.item_id=r.item_id WHERE i.batch_id=:id) WHERE rn=1`,{id});
  return { aiRun:run, descriptions:descriptions.map(lower) };
}
async function itemDescriptions(c,itemId,runId) {
  const result = await rows(c,`SELECT run_id,status,result_json,error_text,source_sha256,model_id,region,prompt_version,request_id,created_at
    FROM secure_cdr_ai_results_v WHERE item_id=:itemId ${runId?'AND run_id=:runId':''} ORDER BY created_at DESC,run_id DESC FETCH FIRST 20 ROWS ONLY`,{itemId,...(runId?{runId}:{})},{fetchInfo:{RESULT_JSON:{type:oracledb.STRING}}});
  return result.map(row=>{const r=lower(row);return {...r,result_json:r.result_json?JSON.parse(r.result_json):null};});
}

function createDescriptionWorker(db, generate=ai.describe) {
  let busy=false,timer;
  async function queue(id,user) {
    if(user==='read_only_viewer') throw error(403,'The read-only demo user cannot run AI descriptions.');
    const result=await db(user,async c=>{
      const b=(await rows(c,'SELECT batch_id,status,file_count FROM secure_cdr_batches_v WHERE batch_id=:id',{id}))[0];
      if(!b) throw error(404,'Batch not found in your authorised scope.');
      await c.execute('SELECT batch_id FROM cdr_batches WHERE batch_id=:id FOR UPDATE',{id});
      const active=(await rows(c,`SELECT run_id,status FROM cdr_ai_runs WHERE batch_id=:id AND status IN ('queued','running')`,{id}))[0];
      if(active) return {runId:active.RUN_ID,status:active.STATUS};
      if(b.STATUS!=='ready') throw error(409,'Finish inventory ingestion before running Identify/Describe.');
      const pending=(await rows(c,`SELECT COUNT(*) n FROM secure_cdr_items_v i WHERE i.batch_id=:id AND NOT EXISTS (
        SELECT 1 FROM secure_cdr_ai_results_v r WHERE r.item_id=i.item_id AND r.status='complete' AND (i.content_type NOT IN ('mp3','m4a') OR JSON_VALUE(r.result_json,'$.transcription.promptVersion')=:transcriptVersion))`,{id,transcriptVersion:transcription.PROMPT_VERSION}))[0].N;
      if(!pending) {
        const s=(await rows(c,'SELECT status FROM secure_cdr_stages_v WHERE batch_id=:id AND stage_no=4',{id}))[0];
        if(!b.FILE_COUNT || s?.STATUS==='complete') throw error(409,'All content items already have AI descriptions.');
        // Recover a failed finalisation after all per-item results committed.
        // A zero-item run repairs the stage without repeating any OCI calls.
      }
      const config=ai.modelConfig(),runId=crypto.randomUUID();
      await c.execute(`INSERT INTO cdr_ai_runs(run_id,batch_id,requested_by,status,item_total,text_model,image_model,region,prompt_version)
        VALUES(:runId,:id,:usr,'queued',:total,:textModel,:imageModel,:region,:version)`,{
        runId,id,usr:user,total:pending,textModel:config.textModel,imageModel:config.imageModel,region:config.region,version:config.promptVersion});
      await c.execute(`UPDATE cdr_stages SET status='pending',started_at=NULL,finished_at=NULL,detail=:detail WHERE batch_id=:id AND stage_no=4`,{id,detail:`Queued ${pending} item descriptions with OCI GenAI`});
      await c.commit();return {runId,status:'queued'};
    });
    void tick();return result;
  }
  async function owned(run,fn) {
    return db(run.REQUESTED_BY,async c=>{
      const lock=await c.execute(`UPDATE cdr_ai_runs SET lease_until=SYSTIMESTAMP+NUMTODSINTERVAL(120,'SECOND'),updated_at=SYSTIMESTAMP
        WHERE run_id=:runId AND lease_token=:token AND status='running'`,{runId:run.RUN_ID,token:run.TOKEN});
      if(!lock.rowsAffected) throw new Error('Description worker lease superseded.');
      // Scope is rechecked for every persisted step and source read, not only when enqueued.
      if(!(await rows(c,'SELECT batch_id FROM secure_cdr_batches_v WHERE batch_id=:id',{id:run.BATCH_ID})).length) throw new Error('Batch no longer visible in the requesting user scope.');
      const result=await fn(c);await c.commit();return result;
    });
  }
  async function progress(c,run) {
    const counts=(await rows(c,`SELECT COUNT(CASE WHEN status='complete' THEN 1 END) completed_count,COUNT(CASE WHEN status='failed' THEN 1 END) failed_count FROM cdr_ai_results WHERE run_id=:runId`,{runId:run.RUN_ID}))[0];
    await c.execute('UPDATE cdr_ai_runs SET completed_count=:done,failed_count=:failed WHERE run_id=:runId',{runId:run.RUN_ID,done:counts.COMPLETED_COUNT,failed:counts.FAILED_COUNT});
    await c.execute(`UPDATE cdr_stages SET detail=:detail WHERE batch_id=:id AND stage_no=4`,{id:run.BATCH_ID,detail:`This run: ${counts.COMPLETED_COUNT} described, ${counts.FAILED_COUNT} failed, ${run.ITEM_TOTAL} requested`});
    return counts;
  }
  async function processRun(run) {
    const started=Date.now();let failedRun=false,failureMessage;
    try {
      if(run.PROMPT_VERSION!==ai.PROMPT_VERSION) throw new Error('Prompt version changed since this run was queued. Retry with the current version.');
      const items=await owned(run,async c=>{
        await c.execute(`UPDATE cdr_stages SET status='running',started_at=COALESCE(started_at,SYSTIMESTAMP),finished_at=NULL,detail='Reading batch-scoped content for OCI descriptions' WHERE batch_id=:id AND stage_no=4`,{id:run.BATCH_ID});
        // A resumed run skips both its already-failed and completed items; a new retry run picks up failures.
        return rows(c,`SELECT i.item_id,i.content_type,i.sha256,i.original_path FROM secure_cdr_items_v i WHERE i.batch_id=:id
          AND NOT EXISTS(SELECT 1 FROM secure_cdr_ai_results_v r WHERE r.item_id=i.item_id AND ((r.status='complete' AND (i.content_type NOT IN ('mp3','m4a') OR JSON_VALUE(r.result_json,'$.transcription.promptVersion')=:transcriptVersion)) OR r.run_id=:runId)) ORDER BY i.original_path`,{id:run.BATCH_ID,runId:run.RUN_ID,transcriptVersion:transcription.PROMPT_VERSION});
      });
      for(const item of items) {
        const source=await owned(run,async c=>(await rows(c,`SELECT content_blob FROM secure_cdr_items_v WHERE item_id=:itemId AND batch_id=:id AND sha256=:sha`,{
          itemId:item.ITEM_ID,id:run.BATCH_ID,sha:item.SHA256},{fetchInfo:{CONTENT_BLOB:{type:oracledb.BUFFER}}}))[0]);
        if(!source) throw new Error('Source item no longer matches its recorded checksum.');
        let result=null,failure=null,failedGeneration=null,failedRequestId=null,savedTranscript=null;
        if(['mp3','m4a'].includes(item.CONTENT_TYPE)) {
          const attempts=await owned(run,c=>itemDescriptions(c,item.ITEM_ID));
          savedTranscript=attempts.map(a=>a.result_json?.transcription).find(t=>transcription.reusable(t,item.SHA256,true))||null;
        }
        const onTranscription=async value=>{
          savedTranscript=value;
          // Commit the transcript before summarising it. A retry can reuse it
          // even if summarisation fails or the worker stops afterwards.
          await owned(run,c=>saveResult(c,{runId:run.RUN_ID,itemId:item.ITEM_ID,sha:item.SHA256,state:'failed',headline:null,
            resultJson:{val:JSON.stringify({transcription:value,reviewStatus:'description_pending'}),type:oracledb.CLOB},failure:'Transcript saved; description pending.',
            modelId:run.TEXT_MODEL,region:run.REGION,version:run.PROMPT_VERSION,requestId:value.requestId||null}));
        };
        try { result=await ops.context({actor:run.REQUESTED_BY,area:'Crime Data Room',feature:'Identify & Describe',traceId:run.RUN_ID,runId:run.RUN_ID,batchId:run.BATCH_ID,sourceId:item.ITEM_ID,sourceLabel:item.ORIGINAL_PATH},()=>generate({content:source.CONTENT_BLOB,type:item.CONTENT_TYPE,sha256:item.SHA256,transcription:savedTranscript,onTranscription}, {
          textModel:run.TEXT_MODEL,imageModel:run.IMAGE_MODEL,region:run.REGION,promptVersion:run.PROMPT_VERSION})); }
        catch(e) { failure=String(e.message).slice(0,450); savedTranscript=e.transcription||savedTranscript; failedGeneration=e.generation?{generation:e.generation,reviewStatus:'generation_failed'}:null; failedRequestId=e.requestId || null; console.error(`Data Room description ${run.RUN_ID}/${item.ITEM_ID}: ${failure}`); }
        await owned(run,async c=>{
          await saveResult(c,{
            runId:run.RUN_ID,itemId:item.ITEM_ID,sha:item.SHA256,state:failure?'failed':'complete',headline:result?.headline||null,
            resultJson:{val:result?JSON.stringify(result):savedTranscript||failedGeneration?JSON.stringify({...failedGeneration,transcription:savedTranscript}):null,type:oracledb.CLOB},failure,
            modelId:['png','jpg'].includes(item.CONTENT_TYPE)?run.IMAGE_MODEL:run.TEXT_MODEL,region:run.REGION,version:run.PROMPT_VERSION,requestId:result?.requestId||failedRequestId});
          await progress(c,run);
        });
      }
      await owned(run,async c=>{
        const counts=await progress(c,run),failed=counts.FAILED_COUNT>0;
        failedRun=failed;
        const complete=(await rows(c,`SELECT COUNT(DISTINCT r.item_id) n FROM secure_cdr_ai_results_v r JOIN secure_cdr_items_v i ON i.item_id=r.item_id WHERE i.batch_id=:id AND r.status='complete'`,{id:run.BATCH_ID}))[0].N;
        const detail=failed?`${complete} items have AI descriptions; ${counts.FAILED_COUNT} failed in this run. Retry unfinished items.`:`${complete} items described. AI drafts require analyst review; no identities or graph links inferred.`;
        await c.execute(`UPDATE cdr_stages SET status=:state,finished_at=SYSTIMESTAMP,detail=:detail WHERE batch_id=:id AND stage_no=4`,{id:run.BATCH_ID,state:failed?'failed':'complete',detail});
        await c.execute(`UPDATE cdr_ai_runs SET status=:state,finished_at=SYSTIMESTAMP,error_text=:failure,lease_token=NULL,lease_until=NULL WHERE run_id=:runId`,{runId:run.RUN_ID,state:failed?'failed':'complete',failure:failed?detail:null});
      });
    } catch(e) {
      failedRun=true;failureMessage=e.message;
      console.error('Data Room description run interrupted:',e.message);
      try {await owned(run,async c=>{
        await c.execute(`UPDATE cdr_ai_runs SET status='failed',finished_at=SYSTIMESTAMP,error_text='Description run interrupted. Retry unfinished items.',lease_token=NULL,lease_until=NULL WHERE run_id=:runId`,{runId:run.RUN_ID});
        await c.execute(`UPDATE cdr_stages SET status='failed',finished_at=SYSTIMESTAMP,detail='Description run interrupted. Original files and completed descriptions are retained.' WHERE batch_id=:id AND stage_no=4`,{id:run.BATCH_ID});
      });} catch(leaseError) {console.error('Description failure state:',leaseError.message);}
    }finally{ops.record({operationId:'cdr.describe.outcome',feature:'Description run outcome',kind:'workflow',provider:'None',actor:run.REQUESTED_BY,area:'Crime Data Room',batchId:run.BATCH_ID,runId:run.RUN_ID,traceId:run.RUN_ID,startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,status:failedRun?'failed':'complete',error:failureMessage,note:'Run outcome. Provider attempts are separate; successful descriptions remain available when other items fail.'});}
  }
  async function tick() {
    if(busy)return;busy=true;
    try {
      const run=await db('statewide_admin',async c=>{
        const r=(await rows(c,`SELECT * FROM cdr_ai_runs WHERE status='queued' OR (status='running' AND lease_until<SYSTIMESTAMP) ORDER BY created_at FETCH FIRST 1 ROW ONLY`))[0];
        if(!r)return null;
        if(r.ATTEMPTS>=3){
          const exhausted=await c.execute(`UPDATE cdr_ai_runs SET status='failed',error_text='Automatic recovery limit reached. Retry unfinished items.',finished_at=SYSTIMESTAMP WHERE run_id=:runId AND (status='queued' OR (status='running' AND lease_until<SYSTIMESTAMP))`,{runId:r.RUN_ID});
          if(exhausted.rowsAffected) await c.execute(`UPDATE cdr_stages SET status='failed',detail='Automatic recovery limit reached. Retry unfinished items.',finished_at=SYSTIMESTAMP WHERE batch_id=:id AND stage_no=4`,{id:r.BATCH_ID});
          await c.commit();return null;
        }
        const token=crypto.randomUUID();
        const claim=await c.execute(`UPDATE cdr_ai_runs SET status='running',lease_token=:token,lease_until=SYSTIMESTAMP+NUMTODSINTERVAL(120,'SECOND'),attempts=attempts+1,started_at=COALESCE(started_at,SYSTIMESTAMP),updated_at=SYSTIMESTAMP WHERE run_id=:runId AND (status='queued' OR (status='running' AND lease_until<SYSTIMESTAMP))`,{runId:r.RUN_ID,token});
        await c.commit();return claim.rowsAffected?{...r,TOKEN:token}:null;
      });
      if(run) await ops.jobContext({actor:run.REQUESTED_BY,area:'Crime Data Room',batchId:run.BATCH_ID,runId:run.RUN_ID,traceId:run.RUN_ID},()=>processRun(run));
    } catch(e){console.error('Description queue unavailable:',e.message);}
    finally{busy=false;}
  }
  return {queue,tick,start(){if(!timer){timer=setInterval(tick,2500);timer.unref();void tick();}},stop(){clearInterval(timer);timer=null;}};
}
module.exports={createDescriptionWorker,batchDescriptions,itemDescriptions};
