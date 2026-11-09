'use strict';
// Explicit opt-in: one OCI batch-brief inference on the named existing synthetic sample if needed.
const assert=require('node:assert/strict');
const {hash}=require('../backend/data-room-archive');
const base=process.env.DATA_ROOM_TEST_URL||'http://127.0.0.1:8706';
const id=process.argv.find(v=>v.startsWith('--batch='))?.slice(8);
async function request(path,user='statewide_admin',method='GET'){
  const r=await fetch(`${base}/api/data-room${path}`,{method,headers:{'X-Demo-User':user}});
  return {status:r.status,body:await r.json()};
}
(async()=>{
  assert(process.argv.includes('--run-synthetic-tests')&&id,'Pass --run-synthetic-tests --batch=<synthetic sample Batch ID>.');
  const before=(await request(`/batches/${id}`)).body;
  assert.equal(before.batch.filename,'crime-data-room-synthetic-sample.zip');assert.equal(before.items.length,8);
  assert.equal(before.stages[3].status,'complete');
  const originalDescriptions=new Map();
  for(const i of before.items){const d=(await request(`/batches/${id}/items/${i.item_id}`)).body;originalDescriptions.set(i.item_id,JSON.stringify(d.aiAttempts));}
  for(const usr of ['northern_analyst','southern_analyst','central_analyst','read_only_viewer']){
    assert.equal((await request(`/batches/${id}/learning`,usr)).status,404);
    assert.equal((await request(`/batches/${id}/learn`,usr,'POST')).status,usr==='read_only_viewer'?403:404);
  }
  const started=await request(`/batches/${id}/learn`,'statewide_admin','POST');assert.equal(started.status,202);
  const duplicate=await request(`/batches/${id}/learn`,'statewide_admin','POST');assert.equal(duplicate.body.runId,started.body.runId);
  let after;
  for(let i=0;i<100;i++){
    after=(await request(`/batches/${id}`)).body;
    if(['complete','failed'].includes(after.learningRun?.status))break;
    if(i%10===0)console.log(JSON.stringify({learning:after.learningRun?.status}));
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert.equal(after.learningRun.status,'complete',after.learningRun.error_text);
  const saved=(await request(`/batches/${id}/learning`)).body;
  assert.equal(saved.run.run_id,started.body.runId);assert(saved.isCurrent);assert.equal(saved.coverage.itemCount,8);
  assert.equal(saved.coverage.originalFilesRescanned,false);assert.equal(saved.manifest.length,8);assert(saved.run.request_id);
  assert.equal(saved.result.reviewStatus,'unreviewed_ai_draft');assert.equal(after.stages[4].status,'complete');
  assert.equal(after.stages.slice(0,5).filter(s=>s.status==='complete').length,5);assert.equal(after.stages.filter(s=>s.status==='not_enabled').length,0);
  const allowed=new Set(saved.manifest.map(s=>s.ref));
  for(const entry of [...saved.result.overview,...saved.result.themes,...saved.result.reviewQuestions])assert(entry.sourceIds.length&&entry.sourceIds.every(ref=>allowed.has(ref)));
  assert.equal(after.batch.archive_sha256,before.batch.archive_sha256);
  for(const item of after.items){
    assert.equal(item.sha256,before.items.find(i=>i.item_id===item.item_id).sha256);
    const path=`/batches/${id}/items/${item.item_id}`,d=(await request(path)).body;
    assert.equal(JSON.stringify(d.aiAttempts),originalDescriptions.get(item.item_id));
    const manifest=saved.manifest.find(s=>s.itemId===item.item_id);
    assert.equal(manifest.sourceSha256,item.sha256);
    const exact=(await request(`${path}?descriptionRunId=${manifest.descriptionRunId}`)).body;
    assert.equal(exact.aiAttempts.length,1);assert.equal(exact.aiAttempts[0].run_id,manifest.descriptionRunId);
    assert.equal(hash(Buffer.from(JSON.stringify(exact.aiAttempts[0].result_json))),manifest.descriptionSha256);
    assert.equal((await request(`${path}?descriptionRunId=${manifest.descriptionRunId}`,'northern_analyst')).status,404);
  }
  assert.equal((await request(`/batches/${id}/learning?runId=00000000-0000-0000-0000-000000000000`)).status,404);
  const again=await request(`/batches/${id}/learn`,'statewide_admin','POST');assert.equal(again.body.runId,started.body.runId);assert.equal(again.body.reused,true);
  console.log(JSON.stringify({batchId:id,runId:saved.run.run_id,title:saved.result.title,sources:8,completedStages:5,sourceReferences:'batch-scoped and version-pinned',originalsAndDescriptions:'unchanged',duplicateAndCompletedReuse:'passed',scopeAcrossFiveUsers:'passed',coverage:saved.coverage},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
