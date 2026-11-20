'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ops=require('../backend/ai-ops-telemetry');
const {filters,createAiOps,insert,persist}=require('../backend/ai-ops-store');
const {structuredGenerate,DESCRIPTION_SCHEMA}=require('../backend/data-room-structured-ai');
test('provider totals are authoritative, reasoning is not added twice',()=>{
  const e=ops.makeEvent({kind:'llm',provider:'OCI GenAI',usage:{promptTokens:1207,completionTokens:393,totalTokens:2014,completionTokensDetails:{reasoningTokens:414}}});
  assert.equal(e.totalTokens,2014);assert.equal(e.reasoningTokens,414);assert.equal(e.tokenStatus,'measured');
});
test('unknown, zero and non-applicable usage remain distinct; dimensions are not tokens',()=>{
  assert.equal(ops.makeEvent({kind:'native',provider:'Oracle Select AI'}).tokenStatus,'unavailable');
  const e=ops.makeEvent({kind:'embedding',provider:'Local',dimensions:512,vectors:1});
  assert.equal(e.totalTokens,null);assert.equal(e.tokenStatus,'not_applicable');assert.equal(e.vectors,1);
  assert.equal(ops.makeEvent({kind:'workflow',provider:'None'}).tokenStatus,'not_applicable');
  assert.equal(ops.makeEvent({kind:'llm',usage:{totalTokens:0}}).tokenStatus,'measured');
  assert.equal(ops.makeEvent({kind:'llm',usage:{promptTokens:10,completionTokens:5}}).totalTokens,null);
  assert.equal(ops.makeEvent({usage:{totalTokens:-1}}).totalTokens,null);
  assert.equal(ops.makeEvent({usage:{totalTokens:'1024'}}).totalTokens,null);
});
test('concurrent request and nested source contexts do not leak',async()=>{
  const saved=[];ops.configure(async e=>saved.push(e));
  await Promise.all(['alice','bob'].map(actor=>ops.context({actor,traceId:actor,area:'Crime Data Room',batchId:`batch-${actor}`},()=>ops.context({sourceId:`file-${actor}`},()=>ops.track({kind:'embedding',provider:'Local'},async()=>{await Promise.resolve();return actor;},()=>({vectors:1}))))));
  await ops.flush();assert.equal(saved.length,2);for(const e of saved){assert.equal(e.traceId,e.actor);assert.equal(e.batchId,`batch-${e.actor}`);assert.equal(e.sourceId,`file-${e.actor}`);}ops.configure(null);
});
test('logging failure never alters success or masks the original failure',async()=>{
  const dropped=ops.health.dropped;ops.configure(async()=>{throw Error('sink offline');});
  const result={answer:'original'},error=Error('original provider failure');
  assert.equal(await ops.track({kind:'llm'},async()=>result),result);
  await assert.rejects(ops.track({kind:'llm'},async()=>{throw error;}),e=>e===error);
  await ops.flush();assert.equal(ops.health.dropped,dropped+2);ops.configure(null);
});
test('native wrappers preserve values, options, conversation and model gap',async()=>{
  const saved=[],result={rows:[{ANSWER:'Saved native answer'}]},options={fetchInfo:{ANSWER:{type:'string'}}};ops.configure(async e=>saved.push(e));
  const c={execute:async(sql,binds,opts)=>{assert.equal(opts,options);assert.equal(binds.prompt.val,'Original question');return result;}};
  assert.equal(await ops.nativeExecute(c,{feature:'Native test'},'SELECT RUN_TEAM', {prompt:{val:'Original question'},params:JSON.stringify({conversation_id:'owned-cid'}),team:'TEAM'},options),result);
  await ops.flush();assert.equal(saved[0].kind,'native');assert.equal(saved[0].tokenStatus,'unavailable');assert.equal(saved[0].detail.conversationId,'owned-cid');assert.equal(saved[0].detail.response.text,'Saved native answer');ops.configure(null);
});
test('structured retries record two measured attempts including validation failure',async()=>{
  const saved=[];ops.configure(async e=>saved.push(e));let calls=0;
  await ops.context({actor:'alice',area:'Crime Data Room',feature:'Batch Brief',runId:'run',traceId:'run'},()=>structuredGenerate({model:'google.gemini-2.5-flash',region:'test',system:'Original system',content:[{type:'TEXT',text:'Original source'},{type:'IMAGE',imageUrl:{url:'data:image/png;base64,AAAA'}}],schema:DESCRIPTION_SCHEMA,validate:JSON.parse},async()=>({opcRequestId:`request-${++calls}`,chatResult:{chatResponse:{usage:{totalTokens:100},choices:[{finishReason:'STOP',message:{content:[{type:'TEXT',text:calls===1?'broken':'{}'}]}}]}}})));
  await ops.flush();assert.equal(saved.length,2);assert.deepEqual(saved.map(e=>e.status),['failed','complete']);assert.deepEqual(saved.map(e=>e.attempt),[1,2]);assert.equal(saved.reduce((n,e)=>n+e.totalTokens,0),200);assert(!JSON.stringify(saved).includes('base64'));assert(saved[1].detail.prompt.text.includes('This is the final retry.'));assert(saved.every(e=>e.traceId==='run'));ops.configure(null);
});
test('HTTP failures are observed once with unavailable usage',async()=>{
  const saved=[];ops.configure(async e=>saved.push(e));
  await assert.rejects(structuredGenerate({model:'google.gemini',system:'test',content:[],schema:DESCRIPTION_SCHEMA,validate:JSON.parse},async()=>{throw Object.assign(Error('not exposed provider secret'),{statusCode:403});}));
  await ops.flush();assert.equal(saved.length,1);assert.equal(saved[0].status,'failed');assert.equal(saved[0].tokenStatus,'unavailable');assert(!saved[0].detail.error.text.includes('not exposed'));ops.configure(null);
});
test('excerpts are bounded and common secrets and images redacted',()=>{
  const e=ops.excerpt('password=abc api_key="xyz" Bearer abcd.efgh data:image/png;base64,AAAA '+'x'.repeat(13000));
  assert.equal(e.truncated,true);assert.equal(e.text.length,12000);assert(!e.text.includes('abc'));assert(!e.text.includes('xyz'));assert(!e.text.includes('AAAA'));assert(e.text.includes('[redacted]'));
});
test('filters remain bound and cannot widen a non-admin scope',()=>{
  const f=filters('alice',{owner:'bob',area:"' OR 1=1 --",trace:'trace',page:'2'});
  assert.equal(f.binds.actor,'alice');assert.equal(f.binds.owner,'bob');assert(!f.where.includes("' OR 1=1 --"));assert.equal(f.page,2);
  for(const q of [{days:0},{days:'abc'},{page:-1},{page:'NaN'},{area:['x']},{trace:'x'.repeat(181)}])assert.throws(()=>filters('alice',q),{status:400});
});
test('detail enforces owner scope and hides content from operational admin',async()=>{
  const detail={prompt:{text:'private question'},response:{text:'private answer'},error:{text:'private error'},usage:{totalTokens:5}};
  const queries=[];const store=createAiOps(async(user,fn)=>fn({execute:async(sql,binds)=>{queries.push({sql,binds});return {rows:user==='bob'?[]:[{EVENT_ID:'test',ACTOR:'alice',DETAIL:JSON.stringify(detail)}]};}}));
  assert.equal((await store.detail('alice','test')).detail.prompt.text,'private question');
  const admin=await store.detail('statewide_admin','test');assert.equal(admin.detail.prompt,null);assert.equal(admin.detail.response,null);assert.equal(admin.detail.error,null);assert.equal(admin.detail.usage.totalTokens,5);
  await assert.rejects(store.detail('bob','test'),{status:404});await assert.rejects(store.detail('alice',"' OR 1=1"),{status:404});
  assert(queries.every(q=>q.sql.includes("(actor=:actor OR :actor='statewide_admin')")));assert.equal(queries[2].binds.actor,'bob');
});
test('inserts preserve UTC time and JSON binds without altering a source transaction',async()=>{
  const event=ops.makeEvent({kind:'llm',startedAt:'2026-09-15T12:00:00.000Z'});
  await insert({execute:async(sql,binds)=>{assert(sql.includes('FROM_TZ'));assert.equal(binds.at,event.startedAt);assert.equal(typeof binds.detail.val,'string');assert(sql.includes('JSON(:detail)'));}},event);
  await insert({execute:async()=>{throw Object.assign(Error('duplicate'),{errorNum:1});}},event);
  await assert.rejects(insert({execute:async()=>{throw Object.assign(Error('other'),{errorNum:942});}},event),/other/);
});
test('collector restores pooled connection timeout after success and failure',async()=>{
  for(const fail of [false,true]){
    const c={callTimeout:180000,execute:async()=>{assert.equal(c.callTimeout,2000);if(fail)throw Error('sink failure');},commit:async()=>{assert.equal(c.callTimeout,2000);}};
    const operation=persist(c,ops.makeEvent({kind:'llm'}));
    if(fail)await assert.rejects(operation,/sink failure/);else await operation;
    assert.equal(c.callTimeout,180000,'Subsequent AI operations must retain their original timeout');
  }
});
