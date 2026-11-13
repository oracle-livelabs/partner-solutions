const test=require('node:test');
const assert=require('node:assert/strict');
const {createLearningWorker}=require('../backend/data-room-learning');
const ai=require('../backend/data-room-learning-ai');
const {hash}=require('../backend/data-room-archive');

function fixture({visible=true,stage4='complete',generate}={}){
 const state={runs:[],stage5:'pending',calls:0,visible,records:[{ITEM_ID:'00000000000000000000000000000001',ORIGINAL_PATH:'record.txt',CONTENT_TYPE:'txt',SHA256:hash(Buffer.from('source')),
   RUN_ID:'description-1',MODEL_ID:'test-model',PROMPT_VERSION:'test-v1',CREATED_AT:'2026-09-12T00:00:00Z',RESULT_JSON:JSON.stringify({headline:'Training record',description:'An invoice summary.',details:[],limitations:[],coverage:{truncated:false},reviewStatus:'unreviewed_ai_draft'})}]};
 const c={commit:async()=>{},execute:async(sql,b={})=>{
   const s=sql.replace(/\s+/g,' ').trim(),r=state.runs.find(x=>x.RUN_ID===b.runId);
   if(s.startsWith('SELECT batch_id,status,file_count'))return {rows:state.visible?[{BATCH_ID:'B',STATUS:'ready',FILE_COUNT:1}]:[]};
   if(s.includes('FOR UPDATE'))return {rows:[]};
   if(s.startsWith('SELECT run_id,status FROM cdr_learn_runs'))return {rows:state.runs.filter(x=>['queued','running'].includes(x.STATUS)).slice(0,1)};
   if(s.startsWith('SELECT status FROM secure_cdr_stages_v'))return {rows:[{STATUS:stage4}]};
   if(s.startsWith('SELECT i.item_id'))return {rows:state.records};
   if(s.startsWith('SELECT run_id FROM secure_cdr_learn_runs_v'))return {rows:state.runs.filter(x=>x.STATUS==='complete'&&x.INPUT_FINGERPRINT===b.fingerprint&&x.PROMPT_VERSION===b.version).slice(0,1)};
   if(s.startsWith('INSERT INTO cdr_learn_runs')){state.runs.push({RUN_ID:b.runId,BATCH_ID:b.id,REQUESTED_BY:b.usr,STATUS:'queued',ATTEMPTS:0,MODEL_ID:b.modelId,REGION:b.region,PROMPT_VERSION:b.version,INPUT_FINGERPRINT:b.fingerprint,INPUT_SHA256:b.inputHash,INPUT_JSON:b.inputJson.val});return {rowsAffected:1};}
   if(s.includes("FROM cdr_learn_runs WHERE status='queued'"))return {rows:state.runs.filter(x=>x.STATUS==='queued').slice(0,1).map(x=>({...x}))};
   if(s.startsWith("UPDATE cdr_learn_runs SET status='running'")){if(!r||r.STATUS!=='queued')return {rowsAffected:0};r.STATUS='running';r.TOKEN=b.token;r.ATTEMPTS++;return {rowsAffected:1};}
   if(s.startsWith('UPDATE cdr_learn_runs SET lease_until'))return {rowsAffected:r?.STATUS==='running'&&r.TOKEN===b.token?1:0};
   if(s.startsWith('SELECT batch_id FROM secure_cdr_batches_v'))return {rows:state.visible?[{BATCH_ID:'B'}]:[]};
   if(s.startsWith('SELECT input_json FROM secure_cdr_learn_runs_v'))return {rows:r?[r]:[]};
   if(s.startsWith("UPDATE cdr_learn_runs SET status='complete'")){r.STATUS='complete';r.RESULT_JSON=b.resultJson.val;return {rowsAffected:1};}
   if(s.startsWith("UPDATE cdr_learn_runs SET status='failed'")){r.STATUS='failed';r.ERROR_TEXT=b.failure;if(b.diagnostics?.val)r.RESULT_JSON=b.diagnostics.val;r.REQUEST_ID=b.requestId;return {rowsAffected:1};}
   if(s.startsWith('UPDATE cdr_stages')){state.stage5=s.match(/status='([^']+)'/)?.[1];return {rowsAffected:1};}
   if(s.startsWith('UPDATE cdr_batches SET headline'))return {rowsAffected:1};
   throw new Error(`Unexpected test SQL: ${s}`);
 }};
 const result=input=>({...ai.validate(JSON.stringify({title:'Training batch',overview:[{text:'An invoice summary is supplied.',source_ids:['S01']}],themes:[{title:'Invoice',summary:'A saved description concerns an invoice.',source_ids:['S01']}],review_questions:[]}),input),requestId:'test-only-request'});
 const worker=createLearningWorker(async(user,fn)=>fn(c),async(input,pinned)=>{state.calls++;return generate?generate(input,pinned,state,result):result(input);});
 const finish=async()=>{for(let i=0;i<100;i++){if(state.runs.length&&state.runs.every(r=>!['queued','running'].includes(r.STATUS)))return;await new Promise(resolve=>setImmediate(resolve));}throw new Error('Mock worker did not finish');};
 return {state,worker,finish};
}
test('read-only, hidden and undescribed batches cannot start learning',async()=>{
 await assert.rejects(fixture().worker.queue('B','read_only_viewer'),e=>e.status===403);
 await assert.rejects(fixture({visible:false}).worker.queue('B','northern_analyst'),e=>e.status===404);
 await assert.rejects(fixture({stage4:'failed'}).worker.queue('B','statewide_admin'),e=>e.status===409);
});
test('learning persists one source-pinned brief; active and completed requests reuse it',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 const f=fixture({generate:async(input,pinned,state,result)=>{await gate;return result(input);}});
 const first=await f.worker.queue('B','statewide_admin'),second=await f.worker.queue('B','statewide_admin');
 assert.equal(first.runId,second.runId);release();await f.finish();
 assert.equal(f.state.runs[0].STATUS,'complete');assert.equal(f.state.stage5,'complete');assert.equal(f.state.calls,1);
 const third=await f.worker.queue('B','statewide_admin');assert.equal(third.runId,first.runId);assert.equal(third.reused,true);assert.equal(f.state.calls,1);
 const input=JSON.parse(f.state.runs[0].INPUT_JSON);assert.equal(input.manifest[0].descriptionRunId,'description-1');
});
test('failed synthesis remains retryable without changing source descriptions',async()=>{
 const f=fixture({generate:async(input,pinned,state,result)=>{if(state.calls===1)throw new Error('Learning model returned invalid JSON. Retry the brief.');return result(input);}});
 const before=JSON.stringify(f.state.records);await f.worker.queue('B','statewide_admin');await f.finish();
 assert.equal(f.state.runs[0].STATUS,'failed');assert.equal(f.state.stage5,'failed');
 await f.worker.queue('B','statewide_admin');await f.finish();assert.equal(f.state.runs[1].STATUS,'complete');assert.equal(f.state.runs[0].STATUS,'failed');
 assert.equal(JSON.stringify(f.state.records),before);assert.equal(f.state.calls,2);
});
test('source changes during inference prevent a stale result from being committed',async()=>{
 const f=fixture({generate:async(input,pinned,state,result)=>{state.records[0].RUN_ID='changed-description-version';return result(input);}});
 await f.worker.queue('B','statewide_admin');await f.finish();assert.equal(f.state.runs[0].STATUS,'failed');assert.match(f.state.runs[0].ERROR_TEXT,/changed/);
 assert.equal(f.state.runs[0].RESULT_JSON,undefined);assert.equal(f.state.stage5,'failed');
});
test('failed synthesis retains generation diagnostics without manufacturing a brief',async()=>{
 const generation={attempts:[{attempt:1,status:'failed',finishReason:'length'}]};
 const f=fixture({generate:async()=>{throw Object.assign(new Error('Output truncated'),{generation,requestId:'failed-request'});}});
 await f.worker.queue('B','statewide_admin');await f.finish();
 const stored=JSON.parse(f.state.runs[0].RESULT_JSON);
 assert.deepEqual(stored.generation,generation);assert.equal(stored.reviewStatus,'generation_failed');assert.equal(stored.title,undefined);assert.equal(f.state.runs[0].REQUEST_ID,'failed-request');
});
