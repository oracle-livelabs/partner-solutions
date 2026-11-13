'use strict';
// Rollback-only integration checks: no model calls or changes to source data.
const assert=require('node:assert/strict'),o=require('oracledb'),{randomUUID}=require('node:crypto');
const {insert,createAiOps}=require('../backend/ai-ops-store'),{makeEvent}=require('../backend/ai-ops-telemetry');
(async()=>{
  if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected FU40 IncidentData.');
  const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
  try{
    c.callTimeout=15000;const traceId=`test:${randomUUID()}`,actor='read_only_viewer',time=new Date().toISOString();
    const base={traceId,actor,area:'Ask Crime Data',startedAt:time,prompt:'Private test prompt',response:'Private test response'};
    const measured=makeEvent({...base,kind:'llm',provider:'OCI GenAI',model:'test',elapsedMs:100,usage:{promptTokens:1207,completionTokens:393,totalTokens:2014,completionTokensDetails:{reasoningTokens:414}}});
    await insert(c,measured);await insert(c,measured);
    await insert(c,makeEvent({...base,kind:'embedding',provider:'Local',vectors:1,dimensions:512,elapsedMs:200}));
    await insert(c,makeEvent({...base,kind:'native',provider:'Oracle Select AI',status:'failed',elapsedMs:300}));
    for(let i=0;i<26;i++)await insert(c,makeEvent({...base,kind:'workflow',provider:'None'}));
    const db=async(user,fn)=>{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:userName); END;',{userName:user});return fn(c);};
    const store=createAiOps(db),data=await store.dashboard(actor,{days:'1',trace:traceId});
    assert.equal(data.summary.records,29);assert.equal(data.summary.reported_tokens,2014);assert.equal(data.summary.llm_calls,1);assert.equal(data.summary.native_invocations,1);assert.equal(data.summary.vectors,1);assert.equal(data.summary.failures,1);assert.equal(data.summary.measured,1);assert.equal(data.summary.unavailable,1);assert.equal(data.summary.not_applicable,27);assert.equal(data.summary.average_ms,200);assert.equal(data.events.length,25);
    assert.equal((await store.dashboard(actor,{days:'1',trace:traceId,page:2})).events.length,4);
    assert.equal((await store.dashboard(actor,{days:'1',trace:traceId,kind:'embedding'})).summary.records,1);
    assert.equal((await store.dashboard('northern_analyst',{days:'1',trace:traceId,owner:actor})).summary.records,0);
    assert.equal((await store.dashboard('statewide_admin',{days:'1',trace:traceId})).summary.records,29);
    const detail=await store.detail(actor,measured.id);assert.equal(detail.event.started_at.toISOString(),time);assert.equal(detail.detail.prompt.text,'Private test prompt');assert.equal(detail.event.reasoning_tokens,414);
    assert.equal((await store.detail('statewide_admin',measured.id)).detail.prompt,null);
    await assert.rejects(store.detail('northern_analyst',measured.id),{status:404});
    const modern=`test:${randomUUID()}`;
    await insert(c,makeEvent({...base,traceId:modern,operationId:'room.speech',kind:'workflow',provider:'Local',model:'Kokoro v1.0 ONNX',elapsedMs:5000,inputCount:8,outputCount:8}));
    await insert(c,makeEvent({...base,traceId:modern,operationId:'incident.local',kind:'llm',provider:'Local',usage:{totalTokens:7},elapsedMs:100,status:'failed',attempt:2}));
    await insert(c,makeEvent({...base,traceId:modern,operationId:'incident.oci',kind:'llm',provider:'OCI GenAI',usage:{totalTokens:11},elapsedMs:200}));
    await insert(c,makeEvent({...base,traceId:modern,operationId:'request.outcome',kind:'workflow',provider:'None',status:'failed',elapsedMs:1000}));
    const updated=await store.dashboard(actor,{days:1,trace:modern});
    assert.equal(updated.summary.reported_tokens,18);assert.equal(updated.summary.local_tokens,7);assert.equal(updated.summary.provider_tokens,11);
    assert.equal(updated.summary.average_ai_ms,150);assert.equal(updated.summary.average_workflow_ms,3000);assert.equal(updated.summary.model_failures,1);assert.equal(updated.summary.workflow_failures,1);assert.equal(updated.summary.legacy_records,0);
    assert.equal(updated.operations.find(o=>o.id==='room.speech').records,1);assert.equal(updated.operations.find(o=>o.id==='incident.local').failures,1);
    assert.equal((await store.dashboard(actor,{days:1,trace:modern,operation:'room.speech'})).summary.records,1);
    assert.equal((await store.dashboard('northern_analyst',{days:1,trace:modern})).operations.some(o=>o.records),false);
    assert.equal((await store.dashboard('statewide_admin',{days:1,trace:modern})).summary.records,4);
    console.log(JSON.stringify({oracleJson:true,utcTimestamp:true,measuredVsUnknownVsNotApplicable:true,noDuplicateInsert:true,reasoningNotDoubleCounted:true,pagination:true,filters:true,userIsolation:true,adminContentRedacted:true,registeredOperationFilters:true,scopedCoverageCounts:true,cloudLocalSeparation:true,nonAdditiveDurations:true,fixtureRows:33,retention:'rolled back',modelCalls:0}));
  }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
