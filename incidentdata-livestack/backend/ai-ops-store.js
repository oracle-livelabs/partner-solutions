'use strict';
const o=require('oracledb');
const telemetry=require('./ai-ops-telemetry');
const {OPERATIONS}=require('./ai-ops-registry');
async function workerCollector(){
 if(process.env.CDR_ROOM_ENABLED!=='1')return {state:'disabled'};
 try{const fs=require('node:fs/promises'),path=require('node:path'),file=path.join(process.env.CDR_ROOM_ROOT||'/var/lib/detective-room','worker.json');
  const value=JSON.parse(await fs.readFile(file,'utf8')),age=Date.now()-Date.parse(value.at);
  return {state:!Number.isFinite(age)||age<0||age>45000?'stale':value.collector?'reporting':'uninstrumented',at:value.at,collector:value.collector||null};
 }catch{return {state:'unavailable'};}
}
const COLUMNS='event_id,trace_id,actor,area,feature,kind,provider,model,batch_id,source_id,source_label,run_id,started_at,elapsed_ms,status,attempt,vectors,token_status,prompt_tokens,completion_tokens,reasoning_tokens,total_tokens';
const rows=async(c,sql,binds={})=>(await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT})).rows;
const lower=row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k.toLowerCase(),v]));
async function insert(c,e) {
  const binds={id:e.id,trace:e.traceId,actor:e.actor,area:e.area,feature:e.feature,kind:e.kind,provider:e.provider,
    model:e.model,batch:e.batchId,source:e.sourceId,label:e.sourceLabel,run:e.runId,at:e.startedAt,
    ms:e.elapsedMs,state:e.status,attempt:e.attempt,vectors:e.vectors,coverage:e.tokenStatus,
    input:e.promptTokens,output:e.completionTokens,reasoning:e.reasoningTokens,total:e.totalTokens,
    detail:{val:JSON.stringify(e.detail),type:o.CLOB}};
  try {await c.execute(`INSERT INTO ai_ops_events(${COLUMNS},detail_json) VALUES(:id,:trace,:actor,:area,:feature,:kind,:provider,:model,:batch,:source,:label,:run,FROM_TZ(TO_TIMESTAMP(:at,'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),'UTC'),:ms,:state,:attempt,:vectors,:coverage,:input,:output,:reasoning,:total,JSON(:detail))`,binds);}
  catch(e){if(e.errorNum!==1)throw e;}
}
async function persist(c,event) {
  const previousTimeout=c.callTimeout;
  try {c.callTimeout=2000;await insert(c,event);await c.commit();}
  finally {c.callTimeout=previousTimeout;}
}
function filters(user,query={}) {
  const days=Number(query.days ?? 30), page=Number(query.page ?? 1);
  if(![1,7,30,90].includes(days)||!Number.isSafeInteger(page)||page<1||page>100000)throw Object.assign(Error('Choose a valid date range and page.'),{status:400});
  const clauses=["(actor=:actor OR :actor='statewide_admin')","started_at >= SYSTIMESTAMP-NUMTODSINTERVAL(:days,'DAY')"],binds={actor:user,days};
  for(const [key,column,max] of [['area','area',80],['model','model',200],['kind','kind',30],['status','status',20],['batch','batch_id',100],['owner','actor',80],['coverage','token_status',25],['trace','trace_id',180]]) {
    if(query[key]){if(typeof query[key]!=='string'||query[key].length>max)throw Object.assign(Error('Invalid filter.'),{status:400});clauses.push(`${column}=:${key}`);binds[key]=query[key];}
  }
  if(query.operation){if(typeof query.operation!=='string'||!OPERATIONS.some(o=>o.id===query.operation))throw Object.assign(Error('Invalid operation.'),{status:400});clauses.push("JSON_VALUE(detail_json,'$.operationId')=:operation");binds.operation=query.operation;}
  return {where:clauses.join(' AND '),binds,page};
}
function createAiOps(db) {
  async function dashboard(user,query) {
    const {where,binds,page}=filters(user,query);
    return db(user,async c=>{
      const [summary,byArea,byModel,llmCoverage,trend,events,options,byOperation]=await Promise.all([
        rows(c,`SELECT COUNT(*) records,COUNT(CASE WHEN kind='llm' THEN 1 END) llm_calls,COUNT(CASE WHEN kind='native' THEN 1 END) native_invocations,COUNT(CASE WHEN kind='embedding' THEN 1 END) embedding_calls,COUNT(CASE WHEN kind='workflow' THEN 1 END) workflows,COUNT(CASE WHEN kind='historical' THEN 1 END) historical,
          NVL(SUM(total_tokens),0) reported_tokens,COUNT(CASE WHEN token_status='measured' THEN 1 END) measured,COUNT(CASE WHEN token_status='unavailable' THEN 1 END) unavailable,COUNT(CASE WHEN token_status='not_applicable' THEN 1 END) not_applicable,
          NVL(SUM(vectors),0) vectors,COUNT(CASE WHEN status='failed' THEN 1 END) failures,COUNT(CASE WHEN attempt>1 THEN 1 END) retries,ROUND(AVG(elapsed_ms)) average_ms,
          COUNT(CASE WHEN status='failed' AND kind IN ('llm','native','embedding') THEN 1 END) model_failures,
          COUNT(CASE WHEN status='failed' AND kind='workflow' THEN 1 END) workflow_failures,
          ROUND(AVG(CASE WHEN kind IN ('llm','native','embedding') THEN elapsed_ms END)) average_ai_ms,
          ROUND(AVG(CASE WHEN kind='workflow' THEN elapsed_ms END)) average_workflow_ms,
          NVL(SUM(CASE WHEN provider='Local' THEN total_tokens END),0) local_tokens,
          NVL(SUM(CASE WHEN provider<>'Local' THEN total_tokens END),0) provider_tokens,
          COUNT(CASE WHEN JSON_VALUE(detail_json,'$.operationId') IS NULL THEN 1 END) legacy_records
          FROM ai_ops_events WHERE ${where}`,binds),
        rows(c,`SELECT area label,COUNT(*) records,NVL(SUM(total_tokens),0) tokens,SUM(vectors) vectors,COUNT(CASE WHEN token_status='unavailable' THEN 1 END) unavailable FROM ai_ops_events WHERE ${where} GROUP BY area ORDER BY tokens DESC,records DESC`,binds),
        rows(c,`SELECT NVL(model,provider) label,COUNT(*) records,NVL(SUM(total_tokens),0) tokens,COUNT(CASE WHEN token_status='unavailable' THEN 1 END) unavailable FROM ai_ops_events WHERE ${where} GROUP BY NVL(model,provider) ORDER BY tokens DESC,records DESC`,binds),
        rows(c,`SELECT NVL(model,provider) label,token_status coverage,COUNT(*) records,NVL(SUM(total_tokens),0) tokens FROM ai_ops_events WHERE ${where} AND kind IN ('llm','native','historical') AND provider<>'None' GROUP BY NVL(model,provider),token_status ORDER BY token_status,label`,binds),
        rows(c,`SELECT TO_CHAR(SYS_EXTRACT_UTC(started_at),'YYYY-MM-DD') label,COUNT(*) records,NVL(SUM(total_tokens),0) tokens FROM ai_ops_events WHERE ${where} GROUP BY TO_CHAR(SYS_EXTRACT_UTC(started_at),'YYYY-MM-DD') ORDER BY label`,binds),
        rows(c,`SELECT ${COLUMNS} FROM ai_ops_events WHERE ${where} ORDER BY started_at DESC,event_id DESC OFFSET :skip ROWS FETCH NEXT 25 ROWS ONLY`,{...binds,skip:(page-1)*25}),
        rows(c,`SELECT DISTINCT area,model,batch_id,actor FROM ai_ops_events WHERE (actor=:actor OR :actor='statewide_admin') AND started_at>=SYSTIMESTAMP-NUMTODSINTERVAL(:days,'DAY')`,{actor:user,days:binds.days}),
        rows(c,`SELECT JSON_VALUE(detail_json,'$.operationId') operation_id,COUNT(*) records,COUNT(CASE WHEN status='failed' THEN 1 END) failures,MAX(started_at) last_seen FROM ai_ops_events WHERE ${where} GROUP BY JSON_VALUE(detail_json,'$.operationId')`,binds),
      ]);
      return {summary:lower(summary[0]),byArea:byArea.map(lower),byModel:byModel.map(lower),llmCoverage:llmCoverage.map(lower),trend:trend.map(lower),events:events.map(lower),page,pageSize:25,
        options:{areas:[...new Set(options.map(r=>r.AREA))].sort(),models:[...new Set(options.map(r=>r.MODEL).filter(Boolean))].sort(),batches:[...new Set(options.map(r=>r.BATCH_ID).filter(Boolean))].sort(),owners:[...new Set(options.map(r=>r.ACTOR))].sort()},
        scope:user==='statewide_admin'?'Stack-wide operational metadata; conversation content remains owner-only.':'Your recorded activity only.',
        collector:user==='statewide_admin'?{...telemetry.health,pendingNote:'Activity appears after its operation finishes.'}:null,
        workerCollector:user==='statewide_admin'?await workerCollector():null,
        operations:OPERATIONS.map(operation=>{const activity=byOperation.find(r=>r.OPERATION_ID===operation.id);return {...operation,records:activity?.RECORDS||0,failures:activity?.FAILURES||0,lastSeen:activity?.LAST_SEEN||null};}),
        coverage:[
          {area:'Visual & text vectors',state:'Tracking enabled',note:'Local CLIP/MiniLM operations: vectors, inputs and duration, not provider tokens. OCI embeddings: usage when returned. Updated loading scripts use the same collector.'},
          {area:'Ask Crime Data',state:'Partial token coverage',note:'V2 Select AI invocations and SQL-generation retries are recorded. Native provider tokens are unavailable to this app schema. Guided SQL uses no LLM.'},
          {area:'AI Agent Console',state:'Partial token coverage',note:'Native team invocations are recorded, not guessed internal LLM call counts. Saved conversations stay available in the Console. Guided workflows use no LLM.'},
          {area:'Crime Data Room',state:'Direct usage + native gaps',note:'Description/brief attempts, connections, batch chat, money reviews, Ask Detective and first-cut hunches are registered. Native tokens remain unavailable. Local vectors and workflow failures are separate.'},
          {area:'Detective Room publishing',state:'Worker capture',note:'Source chunks, image descriptions, overview attempts/retries and local speech synthesis are registered. Publication has a separate end-to-end outcome. Worker health is shown to administrators.'},
          {area:'Evidence Intelligence',state:'Native + vector capture',note:'Native Select AI/agent reviews include run, profile and citation validation; query-vector creation and request outcomes are separate. A profile name is not a model ID.'},
          {area:'Other stack activity',state:'Tracking enabled',note:'Incident OCI/Ollama calls and semantic-search embeddings are included. SDK-internal retries are not individually observable where enabled.'}],
        notes:['Reported tokens are a partial total, not a bill. Reasoning is shown separately but never added again to a provider total.',
          'Historical imports contain only saved evidence. No previous prompts, token counts or vector compute history are reconstructed.',
          'Native invocation counts are not individual internal LLM call counts. Local embedding activity is not cloud-token consumption.']};
    });
  }
  async function detail(user,id) {
    if(typeof id!=='string'||!/^[a-zA-Z0-9:_-]{1,180}$/.test(id))throw Object.assign(Error('Activity not found.'),{status:404});
    return db(user,async c=>{
      const result=await c.execute(`SELECT ${COLUMNS},JSON_SERIALIZE(detail_json RETURNING CLOB) detail FROM ai_ops_events WHERE event_id=:id AND (actor=:actor OR :actor='statewide_admin')`,{id,actor:user},{outFormat:o.OUT_FORMAT_OBJECT,fetchInfo:{DETAIL:{type:o.STRING}}});
      if(!result.rows.length)throw Object.assign(Error('Activity not found in your scope.'),{status:404});
      const {DETAIL,...row}=result.rows[0],detail=JSON.parse(DETAIL);
      if(row.ACTOR!==user){detail.prompt=null;detail.response=null;detail.error=null;detail.contentNotice='Conversation content is restricted to the user who ran this operation.';}
      return {event:lower(row),detail};
    });
  }
  function register(app) {
    const route=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e.status||503).json({error:e.status?e.message:'AI Opps is unavailable. Check that the AI Opps database setup has completed.'});}};
    app.get('/api/ai-ops',route(req=>dashboard(req.demoUser,req.query)));
    app.get('/api/ai-ops/events/:id',route(req=>detail(req.demoUser,req.params.id)));
  }
  return {dashboard,detail,register};
}
module.exports={insert,persist,filters,createAiOps};
