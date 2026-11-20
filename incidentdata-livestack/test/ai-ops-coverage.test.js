'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const ops=require('../backend/ai-ops-telemetry'),{OPERATIONS,requestOperation}=require('../backend/ai-ops-registry');
async function capture(fn){const events=[];ops.configure(async e=>events.push(e));try{await fn(events);await ops.flush();return events;}finally{await ops.flush();ops.configure(null);}}
const response=(raw='{}',total=10)=>({opcRequestId:'provider-request',chatResult:{chatResponse:{usage:{promptTokens:4,completionTokens:6,totalTokens:total},choices:[{finishReason:'STOP',message:{content:[{type:'TEXT',text:raw}]}}]}}});
test('registry identifiers are unique and live model boundaries are enumerated',()=>{
 assert.equal(new Set(OPERATIONS.map(o=>o.id)).size,OPERATIONS.length);
 const files=fs.readdirSync(path.join(__dirname,'../backend')).filter(f=>f.endsWith('.js'));
 const direct=files.filter(f=>/\bclient\.(chat|embedText)\(/.test(fs.readFileSync(path.join(__dirname,'../backend',f),'utf8'))).sort();
 assert.deepEqual(direct,['data-room-structured-ai.js','detective-room-author.js','incident-ai.js','pattern-embeddings.js']);
 const native=files.filter(f=>/DBMS_CLOUD_AI(?:_AGENT)?\.(?:RUN_TEAM|GENERATE)\b/.test(fs.readFileSync(path.join(__dirname,'../backend',f),'utf8'))).sort();
 assert.deepEqual(native,['agent-console-routes.js','data-room-expert.js','data-room-money-agent.js','data-room-workspace.js','evidence-intelligence.js','server.js']);
 for(const f of [...direct,...native])assert.match(fs.readFileSync(path.join(__dirname,'../backend',f),'utf8'),/ops\.(record|track|nativeExecute)/,f+' must use the collector');
});
test('validation failures retain measured usage and original errors exactly once',async()=>{
 const original=Error('Rejected citation');const events=await capture(async()=>{
  await assert.rejects(ops.track({feature:'Incident OCI GenAI',kind:'llm',provider:'OCI GenAI'},async()=>response(),r=>({usage:r.chatResult.chatResponse.usage,requestId:r.opcRequestId}),()=>{throw original;}),e=>e===original);
 });assert.equal(events.length,1);assert.equal(events[0].totalTokens,10);assert.equal(events[0].status,'failed');assert.equal(events[0].detail.failurePhase,'validation');assert.equal(events[0].detail.operationId,'incident.oci');
});
test('queue contexts discard unrelated actor/source/feature from the waking request',async()=>{
 await ops.context({actor:'alice',sourceId:'alice-file',feature:'private request',batchId:'alice-batch'},()=>ops.jobContext({actor:'bob',batchId:'bob-batch',traceId:'job'},async()=>{
  assert.equal(ops.current().sourceId,undefined);assert.equal(ops.current().feature,undefined);assert.equal(ops.current().actor,'bob');
 }));
});
test('HTTP workflow outcomes are scoped, recorded once, and dashboard reads are silent',async()=>{
 assert.equal(requestOperation('GET','/ai-ops'),null);assert.equal(requestOperation('GET','/data-room/batches/b/room'),null);
 assert.equal(requestOperation('POST','/data-room/batches/b/expert/first-cut').id,'request.outcome');
 assert.equal(requestOperation('POST','/data-room/batches/b/room'),null,'enqueue is not a completed workflow');
 const events=await capture(async()=>{
  const res=Object.assign(new EventEmitter(),{statusCode:502,writableFinished:true});
  ops.requestContext({method:'POST',path:'/watched-patterns/semantic-search',demoUser:'alice',body:{query:'not archived'},query:{}},res,()=>assert.equal(ops.current().area,'Crime Pattern Signals'));
  res.emit('finish');res.emit('close');
  const closed=Object.assign(new EventEmitter(),{statusCode:200,writableFinished:false});
  ops.requestContext({method:'POST',path:'/ask-v2',demoUser:'bob',body:{}},closed,()=>{});closed.emit('close');closed.emit('finish');
 });assert.equal(events.length,2);assert(events.every(e=>e.status==='failed'&&e.kind==='workflow'&&e.tokenStatus==='not_applicable'));assert.equal(events[0].actor,'alice');assert.equal(events[1].detail.failurePhase,'client_disconnect');assert.equal(events[0].detail.prompt,null);
});
test('Detective Room measures validation retries, stage, source and all provider totals',async()=>{
 const {createAuthor}=require('../backend/detective-room-author');let calls=0;
 const events=await capture(()=>ops.jobContext({actor:'alice',area:'Crime Data Room',batchId:'b',runId:'r',traceId:'r'},async()=>{
  const author=createAuthor(async()=>response(++calls===1?'bad':'{"ok":true}',calls*10));
  const result=await author.generate('Source text',v=>v,[{type:'IMAGE',imageUrl:{url:'data:image/png;base64,SECRETIMAGE'}}],{operationId:'room.image',feature:'Detective Room image description',sourceId:'source',sourceLabel:'photo.png'});
  assert.equal(result.value.ok,true);
 }));assert.equal(events.length,2);assert.deepEqual(events.map(e=>[e.attempt,e.status]),[[1,'failed'],[2,'complete']]);assert.equal(events.reduce((n,e)=>n+e.totalTokens,0),30);assert(events.every(e=>e.actor==='alice'&&e.batchId==='b'&&e.runId==='r'&&e.sourceId==='source'));assert(!JSON.stringify(events).includes('SECRETIMAGE'));assert(events[1].detail.prompt.text.includes('Correct the previous JSON response'));
});
test('Detective Room HTTP/truncation failures retain evidence and do not create automatic retries',async()=>{
 const {createAuthor}=require('../backend/detective-room-author');
 const events=await capture(async()=>{
  await assert.rejects(createAuthor(async()=>{throw Object.assign(Error('HTTP failure'),{statusCode:429,opcRequestId:'request-failed'});}).generate('source',v=>v));
  const truncated=response('partial');truncated.chatResult.chatResponse.choices[0].finishReason='MAX_TOKENS';
  await assert.rejects(createAuthor(async()=>truncated).generate('source',v=>v),/exceeded/);
 });assert.equal(events.length,2);assert.equal(events[0].detail.requestId,'request-failed');assert.equal(events[0].tokenStatus,'unavailable');assert.equal(events[1].totalTokens,10);assert.equal(events[1].detail.response.text,'partial');
});
test('Ask Detective records profile/conversation and rejects bad citations within native telemetry',async()=>{
 const {nativeAnswer}=require('../backend/data-room-expert');
 const events=await capture(()=>ops.context({actor:'alice',area:'Crime Data Room',batchId:'b',feature:'Detective first-cut hunch'},async()=>{
  assert.equal(await nativeAnswer({execute:async()=>({rows:[{ANSWER:'Supported [S1]'}]})},'private prompt','conversation',[{ref:'S1'}]),'Supported [S1]');
  await assert.rejects(nativeAnswer({execute:async()=>({rows:[{ANSWER:'Invalid [S9]'}]})},'private prompt','conversation',[{ref:'S1'}]),/unknown source/);
 }));assert.equal(events.length,2);assert.equal(events[0].model,null);assert.equal(events[0].detail.profile,'CDR_CRIME_DETECTIVE_V1');assert.equal(events[0].detail.operationId,'cdr.first-cut');assert.equal(events[1].status,'failed');assert.equal(events[1].detail.failurePhase,'validation');assert.equal(events[1].tokenStatus,'unavailable');
});
test('incident helpers preserve SQL/answer stages and retry numbers without cloud calls',async()=>{
 const {createIncidentAi}=require('../backend/incident-ai');let closed=0;
 const ai=createIncidentAi({fetchImpl:async()=>({ok:true,json:async()=>({response:'SELECT 1 FROM dual',prompt_eval_count:5,eval_count:2})}),config:()=>({provider:{},compartmentId:'test',region:'test',model:'test'}),clientFactory:()=>({chat:async()=>response('rejected output',15),close:()=>closed++})});
 const events=await capture(async()=>{
  await ai.ollamaGenerate('sql','system',{stage:'sql'});await ai.ollamaGenerate('fix','system',{stage:'sql',attempt:2});await ai.ollamaGenerate('answer','system',{stage:'answer'});
  await assert.rejects(ai.ociGenAiGenerate('sql',100,{stage:'sql',validate:()=>{throw Error('SQL not approved');}}),/not approved/);
 });assert.equal(events.length,4);assert.deepEqual(events.slice(0,3).map(e=>[e.attempt,e.detail.stage]),[[1,'sql'],[2,'sql'],[1,'answer']]);assert.equal(events[0].totalTokens,7);assert.equal(events[0].detail.usageBasis,'local_processing');assert.equal(events[3].totalTokens,15);assert.equal(events[3].status,'failed');assert.equal(closed,1);
});
test('malformed OCI vectors fail telemetry validation while retaining provider usage',async()=>{
 const {embedPatternTexts,PATTERN_EMBEDDING_DIMENSIONS:n}=require('../backend/pattern-embeddings');
 const events=await capture(async()=>{
  const client={embedText:async()=>({opcRequestId:'vector-request',embedTextResult:{embeddings:[[1,2]],usage:{totalTokens:3}}})};
  await assert.rejects(embedPatternTexts(['text'],'SEARCH_QUERY',{client,compartmentId:'test'}),/Unexpected/);
  client.embedText=async()=>({embedTextResult:{embeddings:[Array(n).fill(.1)],usage:{totalTokens:0}}});assert.equal((await embedPatternTexts(['text'],'SEARCH_DOCUMENT',{client,compartmentId:'test'})).length,1);
 });assert.equal(events[0].status,'failed');assert.equal(events[0].vectors,0);assert.equal(events[0].totalTokens,3);assert.equal(events[1].vectors,1);assert.equal(events[1].tokenStatus,'measured');assert(events.every(e=>e.detail.prompt===null));
});
test('local speech remains non-LLM with no invented tokens',()=>{
 const event=ops.makeEvent({operationId:'room.speech',kind:'workflow',provider:'Local',model:'Kokoro v1.0 ONNX',inputCount:8,inputCharacters:3200,outputCount:8});
 assert.equal(event.kind,'workflow');assert.equal(event.tokenStatus,'not_applicable');assert.equal(event.totalTokens,null);assert.equal(event.detail.outputCount,8);assert.equal(event.feature,'Detective Room speech synthesis');
});

test('people extraction request outcomes have their own non-LLM measurement',()=>{
 const operation=requestOperation('POST','/data-room/batches/B/people-mentioned');
 assert.equal(operation.id,'cdr.people.outcome');assert.equal(operation.kind,'workflow');
 assert.equal(requestOperation('GET','/data-room/batches/B/people-mentioned'),null);
 const event=ops.makeEvent({operationId:operation.id,kind:'workflow',provider:'None'});
 assert.equal(event.tokenStatus,'not_applicable');assert.equal(event.totalTokens,null);
});
