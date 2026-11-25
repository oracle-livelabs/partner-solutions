'use strict';
const o=require('oracledb');
(async()=>{if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected FU40 IncidentData.');const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});try{
 const tables=['cdr_batches','cdr_ai_runs','cdr_learn_runs','cdr_workspace_runs','cdr_money_ai_runs'],counts={};
 for(const table of tables){const states=table==='cdr_batches'?"'uploading','queued','processing'":"'queued','running'";counts[table]=(await c.execute(`SELECT COUNT(*) FROM ${table} WHERE status IN (${states})`)).rows[0][0];}
 console.log(JSON.stringify({activeWork:counts}));if(Object.values(counts).some(Boolean))throw Error('Wait for active Data Room work before redeploying.');
}finally{await c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
