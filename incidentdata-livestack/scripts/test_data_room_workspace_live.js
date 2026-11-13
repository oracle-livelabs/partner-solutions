'use strict';
const assert=require('node:assert/strict');
const base=process.env.DATA_ROOM_TEST_URL||'http://127.0.0.1:8706';
const id=process.argv.find(s=>s.startsWith('--batch='))?.slice(8);
async function request(p,user='statewide_admin',method='GET',body){const r=await fetch(base+'/api/data-room'+p,{method,headers:{'X-Demo-User':user,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
async function poll(p,done){for(let i=0;i<240;i++){const r=await request(p);assert.equal(r.status,200);if(done(r.body))return r.body;if(i%15===0)console.log('Waiting for ADB workspace run');await new Promise(r=>setTimeout(r,2000));}throw Error('Workspace run exceeded test deadline. Check the saved run before retrying.');}
(async()=>{
  assert(id&&process.argv.includes('--run-synthetic-tests'),'Pass --run-synthetic-tests --batch=<existing synthetic sample>.');
  for(let attempt=0;attempt<20;attempt++){try{const r=await request('/batches');if(r.status===200)break;}catch{}if(attempt===19)throw Error('App did not become ready.');await new Promise(r=>setTimeout(r,1000));}
  const path=`/batches/${id}`,before=await request(path);
  assert.equal(before.body.batch.filename,'crime-data-room-synthetic-sample.zip');assert.equal(before.body.items.length,8);assert.equal(before.body.stages[4].status,'complete');
  for(const user of ['northern_analyst','southern_analyst','central_analyst','read_only_viewer']){
    assert.equal((await request(path+'/workspace',user)).status,404);
    assert.equal((await request(path+'/connections',user,'POST')).status,user==='read_only_viewer'?403:404);
    assert.equal((await request(path+'/conversations',user)).status,404);
  }
  const queued=await request(path+'/connections','statewide_admin','POST');assert.equal(queued.status,202,JSON.stringify(queued.body));
  const duplicate=await request(path+'/connections','statewide_admin','POST');assert.equal(duplicate.body.runId,queued.body.runId);
  const workspace=await poll(path+'/workspace',d=>['complete','failed'].includes(d.run?.status));
  assert.equal(workspace.run.status,'complete',workspace.run.error_text);assert(workspace.isCurrent);
  assert.equal(new Set(workspace.result.toolEvents.map(e=>e.tool_name)).size,3);
  assert.equal(workspace.result.manifest.length,8);assert.equal(workspace.result.graph.edges.filter(e=>e.kind==='declared_cast').length,4);
  const product=await request(path+'/products','statewide_admin','POST');assert.equal(product.status,200,JSON.stringify(product.body));
  const repeated=await request(path+'/products','statewide_admin','POST');assert.equal(repeated.body.productId,product.body.productId);
  const exported=await request(path+`/products/${product.body.productId}/review.json`);assert.equal(exported.body.connectionRunId,workspace.run.run_id);
  assert.equal((await request(path+`/products/${product.body.productId}/review.json`,'northern_analyst')).status,404);
  const thread=await request(path+'/conversations','statewide_admin','POST',{title:'Workspace live verification'});assert.equal(thread.status,201);
  const chatPath=path+'/conversations/'+thread.body.threadId;
  assert.equal((await request(chatPath,'northern_analyst')).status,404);
  for(const question of ['What is in this batch? Cite the source references.','Which of those files are images? Use the same source references.']){
    const turn=await request(chatPath+'/messages','statewide_admin','POST',{question});assert.equal(turn.status,202);
    const saved=await poll(chatPath,d=>{const t=d.turns.find(t=>t.run_id===turn.body.runId);return ['complete','failed'].includes(t?.status);});
    const answer=saved.turns.find(t=>t.run_id===turn.body.runId);assert.equal(answer.status,'complete',answer.error_text);assert(answer.result.answer);assert(answer.result.nativeConversationId);
  }
  const reopened=await request(chatPath);assert.equal(reopened.body.turns.length,2);
  const after=(await request(path)).body;assert.equal(after.stages.filter(s=>s.status==='complete').length,7);
  assert.equal(after.batch.archive_sha256,before.body.batch.archive_sha256);
  for(const item of after.items)assert.equal(item.sha256,before.body.items.find(i=>i.item_id===item.item_id).sha256);
  console.log(JSON.stringify({batchId:id,completedStages:7,connectionRun:workspace.run.run_id,graphNodes:workspace.result.graph.nodes.length,graphEdges:workspace.result.graph.edges.length,nativeTools:workspace.result.toolEvents.map(e=>e.tool_name),productId:product.body.productId,conversationId:thread.body.threadId,savedChatTurns:2,originalChecksums:'unchanged',scopeChecks:'passed'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
