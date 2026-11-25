'use strict';
// Additive, idempotent setup. Reads existing audit/results; never replays AI.
require('dotenv').config();
const o=require('oracledb');
const {makeEvent}=require('../backend/ai-ops-telemetry');
const {insert}=require('../backend/ai-ops-store');
const ddl=[
 `CREATE TABLE ai_ops_events(event_id VARCHAR2(180) PRIMARY KEY,trace_id VARCHAR2(180) NOT NULL,actor VARCHAR2(80) NOT NULL,area VARCHAR2(80) NOT NULL,feature VARCHAR2(400) NOT NULL,kind VARCHAR2(30) NOT NULL CHECK(kind IN ('llm','native','embedding','workflow','historical')),provider VARCHAR2(80) NOT NULL,model VARCHAR2(200),batch_id VARCHAR2(100),source_id VARCHAR2(180),source_label VARCHAR2(1000),run_id VARCHAR2(180),started_at TIMESTAMP WITH TIME ZONE NOT NULL,elapsed_ms NUMBER,status VARCHAR2(20) NOT NULL,attempt NUMBER DEFAULT 1 NOT NULL,vectors NUMBER DEFAULT 0 NOT NULL,token_status VARCHAR2(25) NOT NULL CHECK(token_status IN ('measured','unavailable','not_applicable')),prompt_tokens NUMBER,completion_tokens NUMBER,reasoning_tokens NUMBER,total_tokens NUMBER,detail_json JSON NOT NULL)`,
 `CREATE INDEX ai_ops_actor_time_ix ON ai_ops_events(actor,started_at)`,
 `CREATE INDEX ai_ops_batch_time_ix ON ai_ops_events(batch_id,started_at)`,
 `CREATE TABLE ai_ops_import_state(import_id NUMBER PRIMARY KEY,cutoff_at VARCHAR2(30) NOT NULL,completed_at TIMESTAMP WITH TIME ZONE)`
];
async function setup(c) {
  for(const sql of ddl)try{await c.execute(sql);}catch(e){if(e.errorNum!==955)throw e;}
  // An old audit exchange can hide multiple Select AI retries. It is evidence
  // of a workflow, not an exact count of individual native invocations.
  await c.execute("UPDATE ai_ops_events SET kind='historical' WHERE event_id LIKE 'historical:audit:%' AND kind='native'");await c.commit();
  let state=(await c.execute('SELECT cutoff_at,completed_at FROM ai_ops_import_state WHERE import_id=1',[],{outFormat:o.OUT_FORMAT_OBJECT})).rows[0];
  if(!state){const cutoff=new Date().toISOString();await c.execute('INSERT INTO ai_ops_import_state(import_id,cutoff_at) VALUES(1,:cutoff)',{cutoff});await c.commit();state={CUTOFF_AT:cutoff};}
  if(state.COMPLETED_AT){console.log('AI Opps schema already ready; historical import already complete.');return;}
  const cutoff=state.CUTOFF_AT;
  const window=column=>`${column}<FROM_TZ(TO_TIMESTAMP(:cutoff,'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),'UTC') AND ${column}>=FROM_TZ(TO_TIMESTAMP(:cutoff,'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),'UTC')-INTERVAL '90' DAY`;
  const read=async sql=>(await c.execute(sql,{cutoff},{outFormat:o.OUT_FORMAT_OBJECT,fetchInfo:{RESULT_JSON:{type:o.STRING},PAYLOAD:{type:o.STRING}}})).rows;
  let count=0;
  const save=async meta=>{await insert(c,makeEvent({origin:'historical',timingBasis:'Saved record timestamp; exact call start was not retained',...meta}));count++;};
  for(const [label,sql] of [
    ['Identify & Describe',`SELECT r.*,a.batch_id,a.requested_by,i.original_path FROM cdr_ai_results r JOIN cdr_ai_runs a ON a.run_id=r.run_id JOIN cdr_items i ON i.item_id=r.item_id WHERE ${window('r.created_at')}`],
    ['Batch Brief',`SELECT r.* FROM cdr_learn_runs r WHERE r.result_json IS NOT NULL AND ${window('r.created_at')}`]]) {
    for(const r of await read(sql)){
      const result=JSON.parse(r.RESULT_JSON||'{}'),attempts=result.generation?.attempts || [];
      const source=r.ITEM_ID || 'batch';
      const base={traceId:r.RUN_ID,actor:r.REQUESTED_BY,area:'Crime Data Room',feature:label,provider:'OCI GenAI',model:r.MODEL_ID,region:r.REGION,
        batchId:r.BATCH_ID,runId:r.RUN_ID,sourceId:r.ITEM_ID,sourceLabel:r.ORIGINAL_PATH,startedAt:new Date(r.CREATED_AT).toISOString()};
      if(attempts.length)for(const a of attempts)await save({...base,...a,id:`historical:${r.RUN_ID}:${source}:${a.attempt}`,kind:'llm',response:a.attempt===attempts.length?result.description || result:null,note:'Imported saved generation attempt. The original prompt was not archived; earlier retry responses are unavailable.'});
      else await save({...base,id:`historical:${r.RUN_ID}:${source}`,kind:'historical',status:r.STATUS,error:r.ERROR_TEXT,response:result,note:'Saved AI result only. Original call count, prompts and token usage were not recorded.'});
    }
  }
  for(const [table,label] of [['cdr_workspace_runs',null],['cdr_money_ai_runs','Money Flow AI review']])for(const r of await read(`SELECT r.* FROM ${table} r WHERE r.native_conversation_id IS NOT NULL AND r.status IN ('complete','failed') AND ${window('r.created_at')}`)) {
    const result=JSON.parse(r.RESULT_JSON||'{}');
    await save({id:`historical:${table}:${r.RUN_ID}`,traceId:r.RUN_ID,actor:r.REQUESTED_BY,area:'Crime Data Room',feature:label || (r.KIND==='chat'?'Batch Assistant':'Connections AI review'),kind:'native',provider:'Oracle Select AI',batchId:r.BATCH_ID,runId:r.RUN_ID,startedAt:new Date(r.CREATED_AT).toISOString(),status:r.STATUS,prompt:r.QUESTION,response:result.answer || result.rawAnswer,conversationId:r.NATIVE_CONVERSATION_ID,team:result.team,error:r.ERROR_TEXT,note:'Historical native execution record. Internal model-call count and token usage are unavailable.'});
  }
  const actions=['agent_query','select_ai_v2_query','select_ai_agent_v2_run','case_readiness_brief_prepared','oci_genai_scoped_query','llm_scoped_query'];
  for(const r of await read(`SELECT action_id,user_name,action_type,created_at,JSON_SERIALIZE(payload RETURNING CLOB) payload FROM analyst_actions WHERE action_type IN (${actions.map(a=>`'${a}'`).join(',')}) AND ${window('created_at')}`)) {
    const p=JSON.parse(r.PAYLOAD),guided=['agent_query','case_readiness_brief_prepared'].includes(r.ACTION_TYPE),native=['select_ai_v2_query','select_ai_agent_v2_run'].includes(r.ACTION_TYPE),response=p.response;
    await save({id:`historical:audit:${r.ACTION_ID}`,traceId:p.historyThreadId || `audit:${r.ACTION_ID}`,actor:r.USER_NAME,area:r.ACTION_TYPE==='select_ai_v2_query'?'Ask Crime Data':/scoped_query/.test(r.ACTION_TYPE)?'Incident Intelligence':'AI Agent Console',feature:{agent_query:'Guided agent',select_ai_v2_query:'Ask IncidentData V2',select_ai_agent_v2_run:'Native Agent V2',case_readiness_brief_prepared:'Case-readiness review',oci_genai_scoped_query:'Incident OCI conversation',llm_scoped_query:'Incident local conversation'}[r.ACTION_TYPE],kind:guided?'workflow':'historical',provider:guided?'None':native?'Oracle Select AI':r.ACTION_TYPE==='oci_genai_scoped_query'?'OCI GenAI':'Local',model:p.model,status:p.historyStatus==='failed'?'failed':'complete',startedAt:new Date(r.CREATED_AT).toISOString(),prompt:p.question,response:response?.answer || response?.generatedSql,error:response?.error,conversationId:p.conversationId,team:p.team,sourceId:`audit:${r.ACTION_ID}`,elapsedMs:response?.elapsed,note:'Imported saved audit exchange. It is not a reconstructed per-model trace. Original token usage was not stored.'});
  }
  await c.execute('UPDATE ai_ops_import_state SET completed_at=SYSTIMESTAMP WHERE import_id=1');await c.commit();
  console.log(JSON.stringify({aiOpsReady:true,historicalRecords:count,cutoff,sourceData:'unchanged',modelCalls:0}));
}
if(require.main===module)(async()=>{
  if(process.env.ORACLE_USER!=='CRIME_DATA')throw Error('Run with the IncidentData application schema.');
  const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
  try{c.callTimeout=15000;await setup(c);}finally{await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup};
