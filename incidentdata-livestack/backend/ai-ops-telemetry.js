'use strict';
// Observability only. Never retries a model operation or changes its result.
const {AsyncLocalStorage} = require('node:async_hooks');
const {randomUUID} = require('node:crypto');
const path=require('node:path');
const {identify,requestOperation}=require('./ai-ops-registry');
const backgroundTrace=randomUUID();
const storage = new AsyncLocalStorage();
let writer, pending = new Set();
const health = {saved:0, dropped:0, lastFailureAt:null, enabledAt:new Date().toISOString()};
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
function redact(value) {
  return String(value ?? '').replace(/data:image\/[^;]+;base64,[a-z0-9+/=]+/gi, '[image omitted]')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[private key redacted]')
    .replace(/\bBearer\s+[a-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(/(["']?(?:password|api[_-]?key|secret|access[_-]?token|authorization)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, '$1[redacted]');
}
function excerpt(value, limit=12000) {
  if (value == null) return null;
  const text = redact(typeof value === 'string' ? value : JSON.stringify(value));
  return {text:text.slice(0,limit), truncated:text.length>limit, characters:text.length};
}
function usage(value, kind, provider) {
  const raw = value && typeof value === 'object' ? value : null;
  const promptTokens = finite(raw?.promptTokens), completionTokens = finite(raw?.completionTokens);
  const totalTokens = finite(raw?.totalTokens), reasoningTokens = finite(raw?.completionTokensDetails?.reasoningTokens);
  return {promptTokens,completionTokens,totalTokens,reasoningTokens,
    // Do not infer totals or add reasoning to provider totals a second time.
    tokenStatus:totalTokens !== null ? 'measured' : kind==='workflow' || (kind==='embedding' && provider==='Local') ? 'not_applicable' : 'unavailable'};
}
function context(meta, fn) { return storage.run({...storage.getStore(), ...meta}, fn); }
// Queue callbacks must not inherit the request that happened to wake the worker.
function jobContext(meta, fn) { return storage.run({...meta}, fn); }
function current() { return storage.getStore() || {}; }
function makeEvent(meta={}) {
  const base={...current(),...meta};
  const registered=identify(base);
  return {id:base.id || randomUUID(), traceId:base.traceId || backgroundTrace, actor:base.actor || 'background_job',
    area:base.area || 'Background jobs', feature:base.feature || registered?.feature || 'Model processing', kind:base.kind || 'llm',
    provider:base.provider || 'Unknown', model:base.model || null, batchId:base.batchId || null,
    sourceId:base.sourceId || null, sourceLabel:base.sourceLabel || (!base.actor?`Job: ${path.basename(require.main?.filename || 'standalone')}`:null), runId:base.runId || null,
    startedAt:base.startedAt || new Date().toISOString(), elapsedMs:finite(base.elapsedMs),
    status:base.status || 'complete', attempt:base.attempt || 1, vectors:finite(base.vectors) || 0,
    ...usage(base.usage,base.kind,base.provider),
    detail:{origin:base.origin || 'live', requestId:base.requestId || null, region:base.region || null,
      conversationId:base.conversationId || null, team:base.team || null, dimensions:base.dimensions || null,
      inputCount:finite(base.inputCount), inputCharacters:finite(base.inputCharacters),
      operationId:registered?.id || null, stage:base.stage || null, profile:base.profile || null,
      requestPath:base.requestPath || null, process:base.process || 'app',
      outputCount:finite(base.outputCount), audioSeconds:finite(base.audioSeconds),
      failurePhase:base.failurePhase || null, httpStatus:finite(base.httpStatus),
      usageBasis:base.provider==='Local'?'local_processing':base.kind==='workflow'?'not_applicable':'provider_reported_when_available',
      usage:base.usage || null, prompt:excerpt(base.prompt), response:excerpt(base.response), error:excerpt(base.error,2000),
      note:base.note || null, timingBasis:base.timingBasis || 'Measured operation duration'}};
}
function configure(fn) { writer=fn; }
function enableBackground() {
  if(writer || process.env.NODE_TEST_CONTEXT || !process.env.APP_SCHEMA_PASSWORD || !process.env.ORACLE_USER) return;
  // Standalone loaders have no Express context. Use a separate connection so
  // logging never commits or rolls back their source-data transaction.
  configure(async event=>{
    const o=require('oracledb'),{insert}=require('./ai-ops-store'),w=process.env.ORACLE_WALLET_LOCATION;
    const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,
      connectString:process.env.ORACLE_CONNECTION_STRING || process.env.ADB_CONNECT_STRING,
      ...(w?{walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD || process.env.ADB_WALLET_PASSWORD}: {})});
    try{c.callTimeout=2000;await insert(c,event);await c.commit();}finally{await c.close();}
  });
}
function failure() { health.dropped++; health.lastFailureAt=new Date().toISOString(); }
function record(meta) {
  if (!writer) return;
  if (pending.size >= 100) {failure();return;}
  let event;
  try {event=makeEvent(meta);} catch {failure();return;}
  // Bounded sink, independent of the source transaction. Errors never escape.
  const promise=Promise.resolve().then(()=>writer(event)).then(()=>{health.saved++;},()=>{failure();})
    .finally(()=>pending.delete(promise));
  pending.add(promise);
}
async function flush() { await Promise.all([...pending]); }
async function track(meta, fn, describe=value=>({response:typeof value==='string'?value:null}), validate) {
  const started=Date.now(), startedAt=new Date(started).toISOString();
  let details={},phase='execution';
  try {const result=await fn();try{details=describe(result)||{};}catch{}
    if(validate){phase='validation';await validate(result);}
    record({...meta,...details,startedAt,elapsedMs:Date.now()-started,status:'complete'});return result;
  } catch(error) {record({...meta,...details,startedAt,elapsedMs:Date.now()-started,status:'failed',failurePhase:phase,
    requestId:details.requestId||error.opcRequestId||error.requestId,httpStatus:error.statusCode,error:error.message});throw error;}
}
function nativeExecute(c,meta,sql,binds={},options={}) {
  const prompt=binds.prompt?.val ?? binds.prompt;
  let conversationId;try{conversationId=JSON.parse(binds.params || '{}').conversation_id;}catch{}
  return track({kind:'native',provider:'Oracle Select AI',prompt,team:binds.team,conversationId,profile:binds.profile||binds.profile_name,
    note:'Native invocation. Internal model-call count and token usage are not exposed to this application schema.',...meta},
    ()=>c.execute(sql,binds,options),r=>({response:r.rows?.[0]?.ANSWER ?? r.rows?.[0]?.GENERATED_SQL ?? null}),meta.validate);
}
function requestContext(req,res,next) {
  const p=req.path;
  const area=p.startsWith('/evidence-intelligence')?'Evidence Intelligence':p.startsWith('/data-room')?'IncidentData Room':p.startsWith('/ask')?'Ask IncidentData':
    /^\/(agents|agent-v2|case-readiness)/.test(p)?'AI Agent Console':p.startsWith('/persons')?'Person Intelligence':p.startsWith('/watched-patterns')?'Crime Pattern Signals':'Incident Intelligence';
  const batchId=p.match(/\/batches\/([^/]+)/)?.[1] || null;
  return jobContext({actor:req.demoUser,area,feature:p,requestPath:p,traceId:randomUUID(),batchId,
    sourceId:p.match(/\/items\/([^/]+)/)?.[1] || req.body?.itemId || req.body?.incidentRef || req.body?.evidenceRef || req.query?.personRef || null},()=>{
    const operation=requestOperation(req.method,p);
    if(operation) {
      const started=Date.now(), ctx={...current()};
      let finished=false;
      const finish=aborted=>{if(finished)return;finished=true;record({...ctx,operationId:operation.id,kind:'workflow',provider:'None',feature:operation.feature,
        startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,status:!aborted&&res.statusCode<400?'complete':'failed',httpStatus:res.statusCode,
        failurePhase:aborted?'client_disconnect':res.statusCode>=400?'request':null,
        note:operation.coverage+(aborted?'. Client disconnected; child processing may still finish.':'. Duration is end-to-end and must not be added to child durations.')});};
      res.once('finish',()=>finish(false));res.once('close',()=>finish(!res.writableFinished));
    }
    next();
  });
}
module.exports={context,jobContext,current,configure,enableBackground,record,track,nativeExecute,flush,makeEvent,usage,redact,excerpt,requestContext,health};
