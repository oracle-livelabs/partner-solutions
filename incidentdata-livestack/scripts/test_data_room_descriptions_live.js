'use strict';
// Explicitly invokes paid OCI inference only for the named, already-stored synthetic sample.
const assert=require('node:assert/strict');
const base=process.env.DATA_ROOM_TEST_URL||'http://127.0.0.1:8706';
const id=process.argv.find(v=>v.startsWith('--batch='))?.slice(8);
async function request(path,user='statewide_admin',method='GET') {
  const r=await fetch(`${base}/api/data-room${path}`,{method,headers:{'X-Demo-User':user}});
  return {status:r.status,body:await r.json()};
}
(async()=>{
  assert(process.argv.includes('--run-synthetic-tests')&&id,'Pass --run-synthetic-tests --batch=<stored synthetic sample Batch ID>.');
  const before=(await request(`/batches/${id}`)).body;
  assert.equal(before.batch.filename,'crime-data-room-synthetic-sample.zip');assert.equal(before.items.length,8);
  assert.equal((await request(`/batches/${id}/describe`,'read_only_viewer','POST')).status,403);
  assert.equal((await request(`/batches/${id}/describe`,'northern_analyst','POST')).status,404);
  let started=null;
  if(before.items.some(i=>i.ai?.status!=='complete')) {
    started=await request(`/batches/${id}/describe`,'statewide_admin','POST');assert.equal(started.status,202);
    const duplicate=await request(`/batches/${id}/describe`,'statewide_admin','POST');assert.equal(duplicate.body.runId,started.body.runId);
  }
  let after,previous='';
  for(let i=0;i<240;i++) {
    after=(await request(`/batches/${id}`)).body;
    const progress=JSON.stringify({status:after.aiRun?.status,complete:after.aiRun?.completed_count,failed:after.aiRun?.failed_count});
    if(progress!==previous){console.log(progress);previous=progress;}
    if(['complete','failed'].includes(after.aiRun?.status)) break;
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(after.aiRun.status!=='complete') console.log(JSON.stringify(after.items.filter(i=>i.ai?.status==='failed').map(i=>({path:i.original_path,error:i.ai.error_text}))));
  assert.equal(after.aiRun.status,'complete');assert.equal(after.stages[3].status,'complete');
  assert.equal(after.items.filter(i=>i.ai?.status==='complete').length,8);
  assert.equal(after.batch.archive_sha256,before.batch.archive_sha256);
  for(const item of after.items) {
    assert.equal(item.sha256,before.items.find(i=>i.item_id===item.item_id).sha256);
    const prior=before.items.find(i=>i.item_id===item.item_id);
    if(prior.ai?.status==='complete') assert.deepEqual(item.ai,prior.ai,'A targeted retry must not replace a successful description.');
    const path=`/batches/${id}/items/${item.item_id}`;
    const d=(await request(path)).body,latest=d.aiAttempts[0],result=latest.result_json;
    assert.equal(latest.source_sha256,item.sha256);assert.equal(result.reviewStatus,'unreviewed_ai_draft');
    assert.equal(result.model,latest.model_id);assert(latest.request_id);assert(result.headline);
    assert.equal((await request(path,'northern_analyst')).status,404);
    if(!['png','jpg'].includes(item.content_type)) for(const field of result.details) assert.equal(d.text_preview.slice(field.startCharacter,field.endCharacter),field.sourceQuote);
  }
  assert.equal((await request(`/batches/${id}/describe`,'statewide_admin','POST')).status,409);
  console.log(JSON.stringify({batchId:id,describedItems:8,completedStages:after.stages.filter(s=>s.status==='complete').length,models:[...new Set(after.items.map(i=>i.ai.model_id))],sourceChecksums:'unchanged',scope:'passed',duplicateRun:'idempotent while active',sourceQuotes:'verified',runId:after.aiRun.run_id},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
