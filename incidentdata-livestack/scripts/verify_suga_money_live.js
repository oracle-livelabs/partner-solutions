'use strict';
// Scoped acceptance test. Creates/reuses only the SUGA money-flow snapshot.
// Sources, descriptions, agent results and operational tables are untouched.
const assert=require('node:assert/strict'),o=require('oracledb');
const {createMoney,pathSql}=require('../backend/data-room-money');
const {digest}=require('../backend/data-room-money-model');
const batchId='DR-20260914-13f650e8-dfa8-450e';
async function main(){
 if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected CRIME_DATA on FU40.');
 const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
 const rows=async(sql,binds={},options={})=>(await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT,...options})).rows;
 const db=async(user,fn)=>{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});return fn(c);};
 try{
  await db('statewide_admin',async()=>{});
  const batch=(await rows('SELECT filename FROM secure_cdr_batches_v WHERE batch_id=:id',{id:batchId}))[0];assert.equal(batch?.FILENAME,'Suga_Scene4.zip');
  const before=await rows('SELECT item_id,sha256 FROM secure_cdr_items_v WHERE batch_id=:id ORDER BY item_id',{id:batchId});
  const money=createMoney(db),built=await money.build('statewide_admin',batchId),read=await money.read('statewide_admin',batchId),s=read.summary[0];
  assert.equal(read.accounts.length,8);assert.equal(read.transfers.length,10);assert.equal(s.rootOutflow,'1500000.00');assert.equal(s.sinkInflow,'1500000.00');assert.equal(s.grossVolume,'4500000.00');assert.equal(s.split.length,1);assert.equal(s.convergence.length,3);assert.equal(s.equalIntermediates.length,6);assert.equal(s.hasCycle,false);assert.equal(read.stale,false);
  const query={runId:built.runId,from:'SYN-AUD-001',to:'SYN-AUD-008',currency:'AUD',maxHops:'4'};
  const paths=await money.routes('statewide_admin',batchId,query);assert.equal(paths.routes.length,4);assert(paths.routes.every(p=>p.hops===3));assert.equal(paths.truncated,false);
  const two=await money.routes('statewide_admin',batchId,{...query,maxHops:'2'});assert.equal(two.routes.length,0);
  await assert.rejects(()=>money.routes('statewide_admin',batchId,{...query,dateFrom:'2026-09-12'}),e=>e.status===400);
  const finalDay=await money.read('statewide_admin',batchId,{currency:'AUD',dateFrom:'2026-09-14'});assert.equal(finalDay.transfers.length,2);assert.equal(finalDay.summary[0].grossVolume,'1500000.00');
  const repeat=await money.build('statewide_admin',batchId);assert.equal(repeat.runId,built.runId);assert.equal(repeat.reused,true);
  for(const user of ['northern_analyst','read_only_viewer']){
   await assert.rejects(()=>money.read(user,batchId),e=>e.status===404);
   await assert.rejects(()=>money.routes(user,batchId,query),e=>e.status===404);
   // Direct native queries must also see zero edges/paths: scope is in the
   // graph's backing views, not only in the HTTP endpoint's final results.
   const count=await db(user,()=>rows('SELECT COUNT(*) n FROM GRAPH_TABLE(cdr_money_graph_v1 MATCH (a)-[e]->(b) COLUMNS(e.edge_key AS k))'));assert.equal(count[0].N,0);
   const hidden=await rows(pathSql(3),{rid:built.runId,currency:'AUD',dateFrom:'0001-01-01',dateTo:'9999-12-31',fromRef:query.from,toRef:query.to});assert.equal(hidden.length,0);
  }
  await db('statewide_admin',async()=>{});
  const after=await rows('SELECT item_id,sha256 FROM secure_cdr_items_v WHERE batch_id=:id ORDER BY item_id',{id:batchId});assert.deepEqual(after,before);
  const original=(await rows('SELECT content_blob,sha256 FROM secure_cdr_items_v WHERE batch_id=:id AND item_id=:itemId',{id:batchId,itemId:read.sources[0].itemId},{fetchInfo:{CONTENT_BLOB:{type:o.BUFFER}}}))[0];assert.equal(digest(original.CONTENT_BLOB),original.SHA256);
  // Compare NUMBER sums in Oracle with exact application arithmetic.
  const sum=(await rows("SELECT TO_CHAR(SUM(amount),'FM999999999999999999999999990D00','NLS_NUMERIC_CHARACTERS=''.,''') total FROM secure_cdr_money_transfers_v WHERE run_id=:rid",{rid:built.runId}))[0];assert.equal(sum.TOTAL,'4500000.00');
  console.log(JSON.stringify({batchId,runId:built.runId,reused:built.reused,accounts:8,transfers:10,rootOutflow:s.rootOutflow,sinkInflow:s.sinkInflow,grossVolume:s.grossVolume,routes:paths.routes.map(p=>({hops:p.hops,transactions:p.transferIds.map(id=>read.transfers.find(t=>t.id===id).transactionId)})),scopeChecks:'API and native GRAPH_TABLE denied for unrelated users',sourcesUnchanged:true,oracleNumberSum:sum.TOTAL},null,2));
 }finally{await c.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
