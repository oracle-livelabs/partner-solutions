'use strict';
// Explicitly removes only the sample batch previously selected for removal.
const o=require('oracledb'),assert=require('node:assert/strict');
(async()=>{const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,configDir:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
const id='DR-20260912-38be78f8-7a8c-448a';
const expected={cdr_data_products:1,cdr_agent_tool_events:3,cdr_batch_vectors:10,cdr_workspace_runs:4,cdr_chat_threads:2,cdr_ai_results:10,cdr_ai_runs:2,cdr_learn_runs:1,cdr_items:8,cdr_stages:7,cdr_batches:1,crime_incidents:0,incident_reports:0,evidence_items:0,persons_of_interest:0};
async function counts(){const result={};for(const t of Object.keys(expected))result[t]=(await c.execute(`SELECT /*+ NO_PARALLEL */ COUNT(*) FROM ${t}`)).rows[0][0];return result;}
try {
 const before=await counts();
 const response=await fetch('http://127.0.0.1:3001/api/data-room/batches/'+id,{method:'DELETE',headers:{'Content-Type':'application/json','X-Demo-User':'statewide_admin'},body:JSON.stringify({confirmation:id}),signal:AbortSignal.timeout(30000)});
 const body=await response.json();console.log(JSON.stringify({status:response.status,...body}));assert.equal(response.status,200);
 const after=await counts();for(const [t,n] of Object.entries(expected)){assert.equal(before[t]-after[t],n,t);console.log(t+': removed '+n);}
 const history=await (await fetch('http://127.0.0.1:3001/api/data-room/batches')).json();assert(!history.batches.some(b=>b.batch_id===id));
 console.log('PASS: complete removal, history refreshed, expected table counts verified.');
}finally{await c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
