'use strict';
// Isolated fixtures stay uncommitted, including build() commits intercepted
// below. Every fixture write is rolled back; no existing batch is edited.
const assert=require('node:assert/strict'),o=require('oracledb'),{randomUUID}=require('node:crypto');
const {createMessages}=require('../backend/data-room-messages'),{hash}=require('../backend/data-room-messages-model');
async function main(){
 if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected CRIME_DATA on FU40.');
 const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
 const rows=async(sql,b={})=>(await c.execute(sql,b,{outFormat:o.OUT_FORMAT_OBJECT})).rows;
 const transaction={execute:c.execute.bind(c),executeMany:c.executeMany.bind(c),commit:async()=>{},rollback:c.rollback.bind(c)};
 const db=async(user,fn)=>{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});return fn(transaction);};const service=createMessages(db),ids=[];
 async function fixture(owner,source){
  const id='DR-MSG-TEST-'+randomUUID().slice(0,18),itemId=randomUUID().replace(/-/g,''),content=Buffer.from(JSON.stringify(source));ids.push(id);
  await c.execute("INSERT INTO cdr_batches(batch_id,filename,loaded_by,status,archive_bytes,headline) VALUES(:id,'message-rollback-test.zip',:owner,'ready',1,'Uncommitted message test')",{id,owner});
  await c.execute("INSERT INTO cdr_items(item_id,batch_id,original_path,content_type,byte_count,sha256,content_blob,headline) VALUES(:itemId,:id,'conversation.json','json',:bytes,:sha,:content,'Uncommitted message test')",{id,itemId,bytes:content.length,sha:hash(content),content});
  const built=await service.build(owner,id),read=await service.read(owner,id);return {id,runId:built.runId,read};
 }
 try{
  const entries=Array.from({length:55},(_,i)=>({message_id:'DUPLICATE',sender:i%2?'Source B':'Source A',recipient:i%7===0?'Source B':undefined,timestamp:`2026-09-10T10:${String(i).padStart(2,'0')}:00Z`,text:i===52?'literal needle_% token':'Message '+i}));
  const a=await fixture('northern_analyst',{thread_id:'T',participants:['Source A','Source B'],messages:entries}),b=await fixture('southern_analyst',{thread_id:'T',participants:['Hidden Person'],messages:[{sender:'Hidden Person',text:'hidden needle_%'}]});
  const t=a.read.threads[0],first=await service.thread('northern_analyst',a.id,t.id,{q:'needle_%'}),second=await service.thread('northern_analyst',a.id,t.id,{q:'needle_%',page:2});
  assert.equal(first.total,55);assert.equal(first.messages.length,40);assert.equal(second.messages.length,15);assert.equal(first.matches.length,1);assert.equal(first.matches[0].position,53);assert.equal(first.matches[0].page,2);assert.equal(second.messages[12].text,'literal needle_% token');assert.equal(new Set([...first.messages,...second.messages].map(m=>m.id)).size,55);
  assert.equal((await service.read('northern_analyst',a.id,{q:'needle_%'})).matchCount,1);assert.equal(a.read.counts.directMessages,8);assert.equal(a.read.links.filter(e=>e.kind==='direct_message').length,8);
  await assert.rejects(()=>service.thread('northern_analyst',a.id,t.id,{page:3}),e=>e.status===400);await assert.rejects(()=>service.thread('northern_analyst',a.id,t.id,{runId:b.runId}),e=>e.status===404);await assert.rejects(()=>service.read('northern_analyst',b.id),e=>e.status===404);
  await db('northern_analyst',async()=>{});
  const hidden=await rows("SELECT * FROM GRAPH_TABLE(cdr_msg_graph_v1 MATCH (a)-[e]->(b) WHERE a.node_label='Hidden Person' COLUMNS(e.edge_key AS k))");assert.equal(hidden.length,0);
  assert.equal((await rows('SELECT COUNT(*) n FROM secure_cdr_msg_records_v'))[0].N,55);
  // Source order is the stable tie-breaker, while different explicit offsets
  // are compared as actual instants rather than as local clock strings.
  const temporal=await fixture('northern_analyst',{messages:[{sender:'Clock A',timestamp:'2026-09-10T10:00+10:00',text:'same instant first'},{sender:'Clock A',timestamp:'2026-09-10T00:00Z',text:'same instant second'},{sender:'Clock A',timestamp:'2026-09-09T23:00Z',text:'earliest'}]});
  const chronological=await service.thread('northern_analyst',temporal.id,temporal.read.threads[0].id);assert.deepEqual(chronological.messages.map(m=>m.sequence),[3,1,2]);
  const original=await service.thread('northern_analyst',temporal.id,temporal.read.threads[0].id,{order:'source'});assert.deepEqual(original.messages.map(m=>m.sequence),[1,2,3]);
  const missing=await fixture('northern_analyst',{messages:[{sender:'Unknown zone',timestamp:'2026-09-10T10:00',text:'unknown time zone'},{sender:'Unknown zone',text:'no timestamp'}]});
  const sourceOrder=await service.thread('northern_analyst',missing.id,missing.read.threads[0].id);assert.equal(sourceOrder.order,'source');await assert.rejects(()=>service.thread('northern_analyst',missing.id,missing.read.threads[0].id,{order:'time'}),e=>e.status===400);
  // Attempting to wire a message across runs is rejected by a composite FK.
  const f=(await rows("SELECT node_key FROM cdr_msg_nodes WHERE run_id=:rid AND node_kind='participant' FETCH FIRST 1 ROW ONLY",{rid:a.runId}))[0].NODE_KEY,to=(await rows("SELECT node_key FROM cdr_msg_nodes WHERE run_id=:rid AND node_kind='thread'",{rid:b.runId}))[0].NODE_KEY;
  await assert.rejects(()=>c.execute("INSERT INTO cdr_msg_links(edge_key,run_id,edge_ref,from_key,to_key,edge_kind,message_count) VALUES(:k,:rid,:k,:f,:t,'participation',1)",{k:hash(randomUUID()),rid:a.runId,f,t:to}),e=>e.errorNum===2291);
  for(const id of ids){assert(id.startsWith('DR-MSG-TEST-'));for(const table of ['cdr_msg_links','cdr_msg_records','cdr_msg_nodes'])await c.execute(`DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM ${table} WHERE run_id IN (SELECT run_id FROM cdr_msg_runs WHERE batch_id=:id)`,{id});for(const table of ['cdr_msg_runs','cdr_items','cdr_batches'])await c.execute(`DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM ${table} WHERE batch_id=:id`,{id});}
  await c.rollback();console.log(JSON.stringify({pagination:'40 + 15, no gaps or duplicates',literalSearchAndJump:'passed',directRecipients:'8 explicit messages',duplicateSourceIds:'preserved',clockOffsetsAndTies:'passed',missingTimes:'source order',crossBatchReaderAndGraphScope:'passed',crossRunForeignKey:'enforced',removalOrder:'passed',fixtureWrites:'all rolled back'}));
 }finally{await c.rollback();await c.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
