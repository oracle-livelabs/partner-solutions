'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8706',batch='DR-20261020-68ed95d9-8383-401c',headers={'X-Demo-User':'statewide_admin'};
(async()=>{
 const receipts=[];
 for(let run=1;run<=1;run++){
  console.log('Checking actual Alice Springs extraction '+run+'/1');
  const response=await fetch(base+'/api/data-room/batches/'+batch+'/people-mentioned',{method:'POST',headers,signal:AbortSignal.timeout(195000)}),body=await response.json();
  fs.writeFileSync('/tmp/alice-people-resilient-'+run+'.json',JSON.stringify(body,null,2));
  assert.equal(response.status,200,body.error);assert.equal(body.llm.model,'google.gemini-2.5-flash');assert(body.traceId);assert(body.people.length>0);assert.equal(body.usage.tokenStatus,'measured');
  let events=[];
  for(let n=0;n<12;n++){
   const r=await fetch(base+'/api/ai-ops?days=1&trace='+encodeURIComponent(body.traceId),{headers});assert(r.ok);events=(await r.json()).events;
   if(events.filter(e=>e.kind==='llm').length===body.usage.attempts&&events.some(e=>e.kind==='workflow'))break;
   await new Promise(r=>setTimeout(r,300));
  }
  const llm=events.filter(e=>e.kind==='llm'),outcomes=events.filter(e=>e.kind==='workflow');
  assert.equal(llm.length,body.usage.attempts);assert.equal(llm.reduce((n,e)=>n+e.total_tokens,0),body.usage.totalTokens);assert.equal(outcomes.length,1);assert.equal(outcomes[0].status,'complete');assert.equal(outcomes[0].token_status,'not_applicable');assert.equal(outcomes[0].total_tokens,null);
  assert(llm.every(e=>e.model===body.llm.model&&e.batch_id===batch));
  const receipt={run,batch,status:response.status,cards:body.people.length,mentions:body.mentionCount,sourceCheckWarnings:body.warnings?.length,llm:body.llm,usage:body.usage,traceId:body.traceId,aiOpsLlmRecords:llm.length,aiOpsOutcomeRecords:outcomes.length,providerTotalMatchesDashboard:true,workflowDoesNotDuplicateTokens:true,at:new Date().toISOString()};
  receipts.push(receipt);console.log(JSON.stringify(receipt));
 }
 fs.writeFileSync('docs/verification/people-resilient-20261028/live-verification.json',JSON.stringify(receipts,null,2)+'\n');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
