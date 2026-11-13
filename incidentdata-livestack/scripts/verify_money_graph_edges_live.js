'use strict';
// All fixture writes remain uncommitted and are rolled back. No live source,
// batch or snapshot is changed. Run only against the FU40 demo application.
const assert=require('node:assert/strict'),o=require('oracledb'),{randomUUID}=require('node:crypto');
const {createMoney}=require('../backend/data-room-money'),{digest}=require('../backend/data-room-money-model');
async function main(){
 if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected CRIME_DATA on FU40.');
 const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
 const query=async(sql,b={})=>(await c.execute(sql,b,{outFormat:o.OUT_FORMAT_OBJECT})).rows;
 const transaction={execute:c.execute.bind(c),executeMany:c.executeMany.bind(c),rollback:c.rollback.bind(c),commit:async()=>{}};
 Object.defineProperty(transaction,'callTimeout',{get:()=>c.callTimeout,set:v=>{c.callTimeout=v;}});
 const db=async(user,fn)=>{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});return fn(transaction);},money=createMoney(db),batchIds=[];
 async function fixture(owner,body){
  const id='DR-MONEY-TEST-'+randomUUID().slice(0,18),itemId=randomUUID().replace(/-/g,'');batchIds.push(id);
  const bytes=Buffer.from('transaction_id,date,from_account,to_account,amount,currency\n'+body);
  await c.execute("INSERT INTO cdr_batches(batch_id,filename,loaded_by,status,archive_bytes,headline) VALUES(:id,'money-rollback-test.zip',:owner,'ready',1,'Uncommitted money-flow test')",{id,owner});
  await c.execute("INSERT INTO cdr_items(item_id,batch_id,original_path,content_type,byte_count,sha256,content_blob,headline) VALUES(:itemId,:id,'transactions.csv','csv',:bytes,:sha,:content,'Uncommitted test')",{id,itemId,bytes:bytes.length,sha:digest(bytes),content:bytes});
  const run=await money.build(owner,id);return {id,runId:run.runId};
 }
 try{
  const a=await fixture('northern_analyst',[
   'T1,2026-09-11,A,B,0.10,AUD','T1,2026-09-11,A,B,0.10,AUD','T2,2026-09-12,B,C,0.30,AUD',
   'T3,2026-09-14,A,D,0.40,AUD','T4,2026-09-11,D,C,0.40,AUD',
   'T5,2026-09-12,B,E,0.20,USD','T6,2026-09-13,E,C,0.20,USD',
   'T7,2026-09-13,C,F,0.30,AUD','T8,2026-09-14,F,C,0.30,AUD',
  ].join('\n'));
  const b=await fixture('southern_analyst','H1,2026-09-11,A,HIDDEN,100,AUD\nH2,2026-09-12,HIDDEN,C,100,AUD');
  const read=await money.read('northern_analyst',a.id);assert.equal(read.transfers.length,9);assert.equal(read.summary.find(s=>s.currency==='AUD').hasCycle,true);assert.equal(read.summary.find(s=>s.currency==='AUD').repeatedPairs,1);
  const paths=await money.routes('northern_analyst',a.id,{from:'A',to:'C',currency:'AUD',maxHops:4});assert.equal(paths.routes.length,2);assert(paths.routes.every(r=>r.hops===2));assert(paths.routes.every(r=>r.transferIds.map(id=>read.transfers.find(t=>t.id===id).transactionId).join(',')==='T1,T2'));
  // Identical account references in another snapshot must not merge; hidden
  // intermediate vertices never enter a traversal, even without an endpoint ACL.
  const counts=await query('SELECT COUNT(*) n FROM GRAPH_TABLE(cdr_money_graph_v1 MATCH (a)-[e]->(b) COLUMNS(e.edge_key AS k))');assert.equal(counts[0].N,9);
  const hidden=await query("SELECT * FROM GRAPH_TABLE(cdr_money_graph_v1 MATCH (a)-[e]->(b) WHERE a.account_ref='HIDDEN' OR b.account_ref='HIDDEN' COLUMNS(e.edge_key AS k))");assert.equal(hidden.length,0);
  await assert.rejects(()=>money.read('northern_analyst',b.id),e=>e.status===404);
  const sourceKey=(await query("SELECT account_key FROM cdr_money_accounts WHERE run_id=:rid AND account_ref='A'",{rid:a.runId}))[0].ACCOUNT_KEY;
  const hiddenKey=(await query("SELECT account_key FROM cdr_money_accounts WHERE run_id=:rid AND account_ref='HIDDEN'",{rid:b.runId}))[0].ACCOUNT_KEY;
  await assert.rejects(()=>c.execute("INSERT INTO cdr_money_transfers(edge_key,run_id,transfer_id,from_key,to_key,amount,currency,event_day) VALUES(:k,:rid,:k,:f,:t,1,'AUD','2026-09-11')",{k:digest(randomUUID()),rid:a.runId,f:sourceKey,t:hiddenKey}),e=>e.errorNum===2291);
  // Verify the new child-row deletion order used by the existing batch-removal
  // endpoint, only on our known, uncommitted fixtures.
  for(const id of batchIds){
   assert(id.startsWith('DR-MONEY-TEST-'));
   for(const table of ['cdr_money_transfers','cdr_money_accounts'])await c.execute(`DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM ${table} WHERE run_id IN (SELECT run_id FROM cdr_money_runs WHERE batch_id=:id)`,{id});
   for(const table of ['cdr_money_runs','cdr_items','cdr_batches'])await c.execute(`DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM ${table} WHERE batch_id=:id`,{id});
   assert.equal((await query('SELECT COUNT(*) n FROM cdr_batches WHERE batch_id=:id',{id}))[0].N,0);
  }
  await c.rollback();console.log(JSON.stringify({duplicateRows:'two separate native routes',backwardDates:'excluded',mixedCurrencyRoutes:'excluded',cyclicTopology:'detected',crossBatchAccountMerge:'prevented',hiddenIntermediate:'not traversable',crossRunForeignKey:'enforced',batchRemovalDependencies:'passed',fixtureWrites:'all rolled back'}));
 }finally{await c.rollback();await c.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
