'use strict';
// Builds/reuses only SUGA's imported conversation snapshot. No AI calls.
const assert=require('node:assert/strict'),o=require('oracledb');
const {createMessages}=require('../backend/data-room-messages'),{hash}=require('../backend/data-room-messages-model');
const batchId='DR-20260914-13f650e8-dfa8-450e';
async function main(){
 if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected CRIME_DATA on FU40.');
 const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
 const rows=async(sql,b={},opts={})=>(await c.execute(sql,b,{outFormat:o.OUT_FORMAT_OBJECT,...opts})).rows;
 const db=async(user,fn)=>{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});return fn(c);};
 const state=async()=>({sources:await rows('SELECT item_id,sha256 FROM secure_cdr_items_v WHERE batch_id=:id ORDER BY item_id',{id:batchId}),money:await rows('SELECT run_id,fingerprint FROM secure_cdr_money_runs_v WHERE batch_id=:id ORDER BY run_id',{id:batchId}),stages:await rows('SELECT stage_no,status,detail FROM secure_cdr_stages_v WHERE batch_id=:id ORDER BY stage_no',{id:batchId}),workspace:await rows('SELECT run_id,status FROM secure_cdr_workspace_runs_v WHERE batch_id=:id ORDER BY run_id',{id:batchId})});
 try{
  await db('statewide_admin',async()=>{});assert.equal((await rows('SELECT filename FROM secure_cdr_batches_v WHERE batch_id=:id',{id:batchId}))[0]?.FILENAME,'Suga_Scene4.zip');
  const before=await state(),messages=createMessages(db),built=await messages.build('statewide_admin',batchId),read=await messages.read('statewide_admin',batchId);
  assert.deepEqual(read.counts,{threads:2,participants:4,messages:28,participations:5,directMessages:0});assert.equal(read.stale,false);assert.equal(read.links.length,5);assert.equal(read.sources.length,2);assert.equal(read.skipped.length,2);
  assert.deepEqual(Object.fromEntries(read.participants.map(p=>[p.name,p.sentCount])),{'George Horner':3,'Julian Cross':14,'Tony Kapoor':3,'Vivienne Hartley':8});
  for(const thread of read.threads){
   const result=await messages.thread('statewide_admin',batchId,thread.id,{runId:built.runId});assert.equal(result.order,'time');assert.equal(result.messages.length,thread.messageCount);
   const source=(await rows('SELECT content_blob,sha256 FROM secure_cdr_items_v WHERE batch_id=:id AND item_id=:itemId',{id:batchId,itemId:thread.source.itemId},{fetchInfo:{CONTENT_BLOB:{type:o.BUFFER}}}))[0];assert.equal(hash(source.CONTENT_BLOB),source.SHA256);
   const text=new TextDecoder('utf-8',{ignoreBOM:true}).decode(source.CONTENT_BLOB);
   for(const m of result.messages){if(m.source.format==='json'){const original=JSON.parse(text).messages[m.source.record-1];assert.deepEqual(m.raw,original);assert.equal(m.text,original.text);}else{assert.equal(text.slice(m.source.start,m.source.end),m.text);assert.equal(text.slice(m.source.blockStart,m.source.blockEnd),m.raw);}assert.equal(m.time.zone,'UTC+10:00');}
  }
  const second=read.threads.find(t=>t.sourceThreadId==='SUGA-CHAT-002'),searched=await messages.read('statewide_admin',batchId,{q:'do not represent me as having agreed'});assert.equal(searched.matchCount,1);assert.equal(searched.threads.find(t=>t.id===second.id).matchCount,1);
  const conversation=await messages.thread('statewide_admin',batchId,second.id,{runId:built.runId,q:'do not represent me as having agreed'});assert.equal(conversation.messages.length,16);assert.equal(conversation.matches.length,1);assert.equal(conversation.messages.find(m=>m.id===conversation.matches[0].id).sender,'Vivienne Hartley');assert.equal(conversation.matches[0].position,14);
  const reused=await messages.build('statewide_admin',batchId);assert.equal(reused.runId,built.runId);assert.equal(reused.reused,true);
  for(const user of ['northern_analyst','read_only_viewer']){
   await assert.rejects(()=>messages.read(user,batchId,{q:'SUGA'}),e=>e.status===404);await assert.rejects(()=>messages.thread(user,batchId,second.id,{runId:built.runId}),e=>e.status===404);
   const count=await db(user,()=>rows('SELECT COUNT(*) n FROM GRAPH_TABLE(cdr_msg_graph_v1 MATCH (a)-[e]->(b) COLUMNS(e.edge_key AS k))'));assert.equal(count[0].N,0);
   const records=await rows('SELECT COUNT(*) n FROM secure_cdr_msg_records_v WHERE run_id=:rid',{rid:built.runId});assert.equal(records[0].N,0);
  }
  await db('statewide_admin',async()=>{});assert.deepEqual(await state(),before);
  console.log(JSON.stringify({batchId,runId:built.runId,reused:built.reused,...read.counts,threadMessages:read.threads.map(t=>({thread:t.sourceThreadId,messages:t.messageCount})),searchWithContext:'passed',jsonPointers:'passed',textOffsets:'passed',timeZones:'passed',nativeGraphAndReaderScope:'passed',moneySourcesStagesAndWorkspace:'unchanged'},null,2));
 }finally{await c.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
