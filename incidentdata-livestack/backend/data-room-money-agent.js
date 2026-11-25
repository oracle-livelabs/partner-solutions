'use strict';
const ops=require('./ai-ops-telemetry');
const o=require('oracledb'),{randomUUID}=require('node:crypto');
const {createMoney}=require('./data-room-money'),{fail,filters,digest,units,VERSION:MONEY_VERSION}=require('./data-room-money-model');
const VERSION='cdr-money-agent-v2',PROFILE='CDR_WORKSPACE_AI_V1',TEAM='CDR_MONEY_REVIEW_V2';
const TOOLS=['CDR_MONEY_SUMMARY_V1','CDR_MONEY_ROUTES_V1','CDR_MONEY_EVIDENCE_V1'];
const rows=async(c,sql,binds={},options={})=>(await (/DBMS_CLOUD_AI(?:_AGENT)?\.(?:RUN_TEAM|GENERATE)/.test(sql)?ops.nativeExecute(c,{feature:'Money Flow AI review',profile:PROFILE},sql,binds,{outFormat:o.OUT_FORMAT_OBJECT,...options}):c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT,...options}))).rows;
const jsonOptions={fetchInfo:{CONTEXT_JSON:{type:o.STRING},RESULT_JSON:{type:o.STRING},RAW_ANSWER:{type:o.STRING}}};
const clob=value=>({val:JSON.stringify(value),type:o.CLOB});
const lower=row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k.toLowerCase(),v]));
async function visible(c,id){const b=(await rows(c,'SELECT status FROM secure_cdr_batches_v WHERE batch_id=:id',{id}))[0];if(!b)throw fail(404,'Batch not found in your authorised scope.');return b;}
async function sourceFingerprint(c,id){const items=await rows(c,"SELECT item_id,sha256 FROM secure_cdr_items_v WHERE batch_id=:id AND content_type='csv' ORDER BY item_id",{id});return digest(JSON.stringify([MONEY_VERSION,items.map(i=>[i.ITEM_ID,i.SHA256])]));}
function request(body={}){
 if(typeof body.runId!=='string'||!/^[a-f0-9-]{36}$/.test(body.runId))throw fail(400,'Choose a saved money-flow snapshot.');
 const f=filters(body),maxHops=Number(body.maxHops||4);
 if(!f.currency||typeof body.from!=='string'||typeof body.to!=='string'||!body.from||!body.to||body.from===body.to||Buffer.byteLength(body.from)>200||Buffer.byteLength(body.to)>200||!Number.isInteger(maxHops)||maxHops<1||maxHops>4)throw fail(400,'Choose distinct start/end accounts, a currency and 1–4 maximum hops.');
 if(body.question!=null&&(typeof body.question!=='string'||body.question.trim().length>1000))throw fail(400,'Use a question of at most 1,000 characters.');
 return {...f,runId:body.runId,from:body.from,to:body.to,maxHops,question:body.question?.trim()||'Explain the recorded money flows between the selected start and end accounts. Describe each supported route and cite its original transactions. Explain the limits of what these records establish.'};
}
function contextFor(data,routes,selection){
 const refs=new Map(data.transfers.map((t,i)=>[t.id,`T${String(i+1).padStart(3,'0')}`]));
 const evidence=data.transfers.map(t=>({ref:refs.get(t.id),transferId:t.id,transactionId:t.transactionId,date:t.date,from:t.from,to:t.to,fromLabel:t.fromLabel,toLabel:t.toLabel,amount:t.amount,currency:t.currency,source:t.source}));
 const s=data.summary[0];
 if(!s)throw fail(409,'No transfers in this selected window.');
 const summary={capability:'money',analysisVersion:data.run.version,snapshot:data.run,filters:data.filters,counts:{accounts:s.accountCount,transfers:s.transferCount},currency:s.currency,rootOutflow:s.rootOutflow,sinkInflow:s.sinkInflow,grossVolume:s.grossVolume,roots:s.roots,sinks:s.sinks,split:s.split,convergence:s.convergence,onward:s.onward,hasCycle:s.hasCycle,accounts:data.accounts.map(a=>({...a,...s.accounts.find(n=>n.id===a.id)})),coverage:{sources:data.sources,skipped:data.skipped},selection};
 summary.destinationInflow=s.accounts.find(a=>a.id===selection.to)?.inflow||'0.00';
 const routeData={...routes,routes:routes.routes.map((r,i)=>({...r,label:`Route ${i+1}`,sourceRefs:r.transferIds.map(id=>refs.get(id))})),count:routes.routes.length};
 const context={summary,routes:routeData,evidence,cautions:['Route counts are not probabilities of money laundering.','Shared transfers occur in multiple routes; do not sum routes as separate funds.','Equal intermediary inflow/outflow does not prove continuity of the same money.','Dates do not establish ordering within a day.','Party labels are source assertions, not verified account ownership, POI identity or guilt.','Gross transfer volume includes onward movement; it is not distinct money.']};
 if(Buffer.byteLength(JSON.stringify(context))>160000)throw fail(422,'This selection exceeds the pilot context limit. Narrow the date/currency window.');
 return context;
}
function validateAnswer(value,context){
 if(typeof value!=='string'||!value.trim()||value.length>20000)throw Error('The money agent returned an empty or oversized answer.');
 const allowed=new Map(context.evidence.map(e=>[Number(e.ref.slice(1)),e.ref]));let citations=0;
 const answer=value.replace(/\[T(\d+)\]/g,(ref,n)=>{const canonical=allowed.get(Number(n));if(!canonical)throw Error('The money agent returned an unknown transaction reference.');return `[${canonical}]`;});
 answer.replace(/\[T\d{3}\]/g,()=>{citations++;return '';});
 if(context.evidence.length&&!citations)throw Error('The money agent did not provide clickable transaction citations. Retry the request.');
 // References alone do not validate a financial explanation. Require the two
 // exact, labelled facts; reject any additional conflicting "gross volume"
 // claim (there is no per-route gross/allocated-funds metric in these tools).
 if(context.summary){
  const facts=[['Gross transfer volume',context.summary.grossVolume],['Inflow to selected destination',context.summary.destinationInflow||context.summary.accounts.find(a=>a.id===context.summary.selection.to)?.inflow]];
  for(const [label,expected] of facts){const found=answer.match(new RegExp(label+':\\s*(\\d[\\d,]*(?:\\.\\d{1,6})?)\\s+([A-Z]{3}|UNKNOWN)\\b','i'));if(!found||found[2].toUpperCase()!==context.summary.currency||units(found[1].replaceAll(',',''))!==units(expected))throw Error(`The money agent did not return the exact ${label.toLowerCase()} fact. Retry the review.`);}
  for(const match of answer.matchAll(/\bgross(?:\s+transfer)?\s+volume\b[^\n]{0,80}?(\d[\d,]*(?:\.\d{1,6})?)/gi))if(units(match[1].replaceAll(',',''))!==units(context.summary.grossVolume))throw Error('The money agent added an unsupported gross-volume or per-route total. Retry the review.');
 }
 return answer;
}
async function generate(c,run,context){
 c.callTimeout=180000;await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');
 const conversation=(await rows(c,'SELECT DBMS_CLOUD_AI.CREATE_CONVERSATION(:attrs) id FROM dual',{attrs:JSON.stringify({title:'Money Flow pilot '+run.RUN_ID,retention_days:7,conversation_length:5})}))[0].ID;
 await c.execute('UPDATE cdr_money_ai_runs SET native_conversation_id=:cid WHERE run_id=:rid AND lease_token=:token',{rid:run.RUN_ID,token:run.TOKEN,cid:conversation});await c.commit();
 await c.execute('BEGIN DBMS_APPLICATION_INFO.SET_CLIENT_INFO(:rid); END;',{rid:run.RUN_ID});
 try{
  return (await rows(c,'SELECT DBMS_CLOUD_AI_AGENT.RUN_TEAM(team_name=>:team,user_prompt=>:prompt,params=>:params) answer FROM dual',{
   team:TEAM,prompt:`Review request ${run.RUN_ID}. Call CDR_MONEY_SUMMARY_V1, CDR_MONEY_ROUTES_V1 and CDR_MONEY_EVIDENCE_V1 with p_request_id=${run.RUN_ID}. The requested question and selection are in the summary tool. Explain only these saved results. Cite transactions individually as [T001].`,params:JSON.stringify({conversation_id:conversation})},{fetchInfo:{ANSWER:{type:o.STRING}}}))[0].ANSWER;
 }finally{await c.execute('BEGIN DBMS_APPLICATION_INFO.SET_CLIENT_INFO(NULL); DBMS_CLOUD_AI.CLEAR_CONVERSATION_ID; END;');}
}
function createMoneyAgent(db,generateAnswer=generate){
 let busy=false,timer;
 async function queue(user,batchId,body){
  if(user==='read_only_viewer')throw fail(403,'The read-only demo user cannot start an AI review.');const selection=request(body);
  const result=await db(user,async c=>{
   await visible(c,batchId);
   try{
    const b=(await rows(c,'SELECT status FROM cdr_batches WHERE batch_id=:id FOR UPDATE WAIT 5',{id:batchId}))[0];if(!b||b.STATUS!=='ready')throw fail(409,'Wait for batch ingestion to finish.');
    const active=(await rows(c,"SELECT run_id FROM cdr_money_ai_runs WHERE batch_id=:id AND status IN ('queued','running') FETCH FIRST 1 ROW ONLY",{id:batchId}))[0];if(active)throw fail(409,'A Money Flow agent review is already in progress for this batch.');
    const money=createMoney(async(u,fn)=>fn(c)),data=await money.read(user,batchId,selection);
    if(!data.run||data.run.id!==selection.runId||data.stale)throw fail(409,'The selected money snapshot is no longer current. Refresh or rebuild money flows first.');
    const paths=await money.routes(user,batchId,selection),context=contextFor(data,paths,selection),runId=randomUUID();
    await c.execute("INSERT INTO cdr_money_ai_runs(run_id,batch_id,money_run_id,requested_by,version,fingerprint,status,question,context_json) VALUES(:rid,:id,:mid,:usr,:version,:fp,'queued',:question,:context)",{rid:runId,id:batchId,mid:data.run.id,usr:user,version:VERSION,fp:data.run.fingerprint,question:selection.question,context:clob(context)});
    await c.commit();return {runId,status:'queued'};
   }catch(e){await c.rollback();if(e.errorNum===30006)throw fail(409,'This batch is busy. Try again shortly.');throw e;}
  });
  return result;
 }
 async function detail(user,batchId,runId){if(runId!=null&&(typeof runId!=='string'||!/^[a-f0-9-]{36}$/.test(runId)))throw fail(400,'Choose a valid money-agent review ID.');return db(user,async c=>{
  await visible(c,batchId);
  const run=(await rows(c,`SELECT run_id,money_run_id,status,version,fingerprint,question,error_text,created_at,finished_at,native_conversation_id,context_json,result_json FROM secure_cdr_money_ai_runs_v WHERE batch_id=:id ${runId?'AND run_id=:rid':''} ORDER BY created_at DESC FETCH FIRST 1 ROW ONLY`,{id:batchId,...(runId?{rid:runId}:{})},jsonOptions))[0];
  if(!run){if(runId)throw fail(404,'Money agent review not found in your scope.');return {run:null};}
  const {CONTEXT_JSON,RESULT_JSON,...meta}=run;
  const events=await rows(c,'SELECT tool_name,created_at FROM secure_cdr_money_ai_events_v WHERE run_id=:rid ORDER BY created_at',{rid:run.RUN_ID});
  return {run:lower(meta),context:JSON.parse(CONTEXT_JSON),result:run.STATUS==='complete'&&RESULT_JSON?JSON.parse(RESULT_JSON):null,toolEvents:events.map(lower),stale:run.FINGERPRINT!==await sourceFingerprint(c,batchId)};
 });}
 async function processRun(run){
  let raw,failure;const started=Date.now();
  try{
   await db(run.REQUESTED_BY,async c=>{
    const row=(await rows(c,"SELECT context_json FROM secure_cdr_money_ai_runs_v WHERE run_id=:rid AND status='running' AND lease_token=:token",{rid:run.RUN_ID,token:run.TOKEN},jsonOptions))[0];if(!row)throw Error('Review lease is no longer active.');
    if(run.VERSION!==VERSION||run.FINGERPRINT!==await sourceFingerprint(c,run.BATCH_ID))throw Error('Money sources or pilot version changed. Start a new review.');
    const context=JSON.parse(row.CONTEXT_JSON);raw=await generateAnswer(c,run,context);
    const events=await rows(c,'SELECT tool_name FROM secure_cdr_money_ai_events_v WHERE run_id=:rid',{rid:run.RUN_ID});
    if(!TOOLS.every(name=>events.some(e=>e.TOOL_NAME===name)))throw Error('The native money agent did not call all three required tools. Retry the review.');
    const answer=validateAnswer(raw,context);
    if(run.FINGERPRINT!==await sourceFingerprint(c,run.BATCH_ID))throw Error('Money sources changed during the review. Start a new request.');
    const result={answer,team:TEAM,profile:PROFILE,version:VERSION,reviewStatus:'unreviewed_ai_draft',basis:'Native ADB agent explains the same deterministic snapshot and Oracle GRAPH_TABLE route results used by the Money Flow workspace.'};
    await c.execute("UPDATE cdr_money_ai_runs SET status='complete',result_json=:result,raw_answer=:rawAnswer,finished_at=SYSTIMESTAMP,lease_until=NULL,lease_token=NULL WHERE run_id=:rid AND lease_token=:token AND status='running'",{rid:run.RUN_ID,token:run.TOKEN,result:clob(result),rawAnswer:{val:raw,type:o.CLOB}});await c.commit();
   });
  }catch(e){failure=e;console.error('Money Flow agent review',run.RUN_ID,e.message);await db(run.REQUESTED_BY,async c=>{await c.execute("UPDATE cdr_money_ai_runs SET status='failed',error_text=:error,raw_answer=:rawAnswer,finished_at=SYSTIMESTAMP,lease_until=NULL,lease_token=NULL WHERE run_id=:rid AND lease_token=:token AND status='running'",{rid:run.RUN_ID,token:run.TOKEN,error:String(e.message||'Money agent review failed.').slice(0,1800),rawAnswer:{val:typeof raw==='string'?raw:null,type:o.CLOB}});await c.commit();}).catch(err=>console.error('Could not save Money Flow agent failure status:',err.message));}
  finally{ops.record({operationId:'cdr.money.outcome',feature:'Money Flow review outcome',kind:'workflow',provider:'None',actor:run.REQUESTED_BY,area:'Crime Data Room',batchId:run.BATCH_ID,runId:run.RUN_ID,traceId:run.RUN_ID,startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,status:failure?'failed':'complete',error:failure?.message,note:'End-to-end review, including mandatory tool calls and exact-amount/citation validation; no additional model call.'});}
 }
 async function tick(){
  if(busy)return;busy=true;
  try{
   const run=await db('statewide_admin',async c=>{
    await c.execute("UPDATE cdr_money_ai_runs SET status='failed',error_text='Execution interrupted. Start a new request; no automatic replay.',finished_at=SYSTIMESTAMP,lease_until=NULL,lease_token=NULL WHERE status='running' AND lease_until<SYSTIMESTAMP");
    const r=(await rows(c,"SELECT run_id,batch_id,requested_by,version,fingerprint FROM cdr_money_ai_runs WHERE status='queued' ORDER BY created_at FETCH FIRST 1 ROW ONLY"))[0];if(!r){await c.commit();return null;}
    const token=randomUUID(),claim=await c.execute("UPDATE cdr_money_ai_runs SET status='running',lease_token=:token,lease_until=SYSTIMESTAMP+NUMTODSINTERVAL(600,'SECOND') WHERE run_id=:rid AND status='queued'",{rid:r.RUN_ID,token});await c.commit();return claim.rowsAffected?{...r,TOKEN:token}:null;
   });if(run)await ops.jobContext({actor:run.REQUESTED_BY,area:'Crime Data Room',batchId:run.BATCH_ID,runId:run.RUN_ID,traceId:run.RUN_ID},()=>processRun(run));
  }catch(e){console.error('Money agent queue:',e.errorNum||e.message);}finally{busy=false;}
 }
 return {queue,detail,tick,processRun,start(){if(!timer){timer=setInterval(tick,2500);timer.unref();void tick();}},stop(){clearInterval(timer);timer=null;}};
}
function registerMoneyAgent(router,db,route){const worker=createMoneyAgent(db);router.post('/batches/:id/money-agent',route(async(req,res)=>res.status(202).json(await worker.queue(req.demoUser,req.params.id,req.body))));router.get('/batches/:id/money-agent',route(async(req,res)=>res.json(await worker.detail(req.demoUser,req.params.id,req.query.runId))));return worker;}
module.exports={VERSION,PROFILE,TEAM,TOOLS,request,contextFor,validateAnswer,createMoneyAgent,registerMoneyAgent};
