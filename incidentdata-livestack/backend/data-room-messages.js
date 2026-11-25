'use strict';
const o=require('oracledb'),{randomUUID}=require('node:crypto');
const {VERSION,LIMITS,id:key,fail,normalize,analysisBytes}=require('./data-room-messages-model');
const {attachTranscripts,sourceIdentity}=require('./data-room-message-sources');
const {recordFailure,clearFailure}=require('./data-room-capabilities');
const rows=async(c,sql,binds={},options={})=>(await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT,...options})).rows;
const jsonOptions={fetchInfo:{RESULT_JSON:{type:o.STRING},MESSAGE_JSON:{type:o.STRING}}};
const clob=value=>({val:JSON.stringify(value),type:o.CLOB});
async function visible(c,id){const b=(await rows(c,'SELECT status FROM secure_cdr_batches_v WHERE batch_id=:id',{id}))[0];if(!b)throw fail(404,'Batch not found in your authorised scope.');return b;}
async function sources(c,id){return attachTranscripts(c,id,await rows(c,"SELECT item_id,original_path,content_type,sha256,byte_count FROM secure_cdr_items_v WHERE batch_id=:id AND content_type IN ('json','txt','csv','mp3','m4a') ORDER BY item_id",{id}));}
const fingerprint=items=>key(VERSION,items.map(sourceIdentity));
async function saved(c,id,runId){return (await rows(c,`SELECT run_id,version,fingerprint,created_at,result_json FROM secure_cdr_msg_runs_v WHERE batch_id=:id AND version IN ('cdr-messages-v1','cdr-messages-v2','cdr-messages-v3','cdr-messages-v4','cdr-messages-v5',:version) ${runId?'AND run_id=:rid':''} ORDER BY created_at DESC FETCH FIRST 1 ROW ONLY`,{id,version:VERSION,...(runId?{rid:runId}:{})},jsonOptions))[0];}
function searchTerm(value){if(value==null)return '';if(typeof value!=='string'||value.length>200)throw fail(400,'Search text must be at most 200 characters.');return value.trim();}
async function nativeGraph(c,runId,snapshot){
 const edges=await rows(c,`SELECT * FROM GRAPH_TABLE(cdr_msg_graph_v1
 MATCH (a IS conversation_node)-[e IS conversation_link]->(b IS conversation_node)
 WHERE a.run_id=:rid AND e.run_id=:rid AND b.run_id=:rid
 COLUMNS(e.edge_ref AS edge_ref,a.node_ref AS from_ref,b.node_ref AS to_ref,e.edge_kind AS edge_kind,e.message_count AS message_count))`,{rid:runId});
 const index=new Map(snapshot.links.map(e=>[e.id,e]));
 if(edges.length!==index.size||new Set(edges.map(e=>e.EDGE_REF)).size!==index.size||edges.some(e=>{const s=index.get(e.EDGE_REF);return !s||s.from!==e.FROM_REF||s.to!==e.TO_REF||s.kind!==e.EDGE_KIND||s.count!==e.MESSAGE_COUNT;}))throw fail(409,'The native conversation graph does not reconcile with its source snapshot. Check the messages migration.');
 return edges.map(e=>index.get(e.EDGE_REF));
}
function createMessages(db){return {
 async build(user,batchId){
  if(user==='read_only_viewer')throw fail(403,'The read-only demo user cannot build messages.');
  return db(user,async c=>{
   await visible(c,batchId);
   let buildFingerprint;
   try{
    const locked=(await rows(c,'SELECT status FROM cdr_batches WHERE batch_id=:id FOR UPDATE WAIT 5',{id:batchId}))[0];
    if(!locked)throw fail(404,'Batch no longer exists.');if(locked.STATUS!=='ready')throw fail(409,'Wait for batch ingestion to complete before building messages.');
    const items=await sources(c,batchId),fp=fingerprint(items);
    buildFingerprint=fp;
    const existing=(await rows(c,'SELECT run_id FROM secure_cdr_msg_runs_v WHERE batch_id=:id AND version=:version AND fingerprint=:fp',{id:batchId,version:VERSION,fp}))[0];
    if(existing){await clearFailure(c,batchId,'messages');await c.commit();return {runId:existing.RUN_ID,reused:true};}
    if(items.reduce((v,i)=>v+analysisBytes(i),0)>LIMITS.totalBytes)throw fail(422,'Text sources exceed the 8 MiB messages build limit.');
    const inputs=[];for(const item of items){
     if(analysisBytes(item)>LIMITS.sourceBytes)throw fail(422,`${item.ORIGINAL_PATH}: source exceeds the 2 MiB messages limit.`);
     const content=(await rows(c,'SELECT content_blob FROM secure_cdr_items_v WHERE batch_id=:id AND item_id=:itemId',{id:batchId,itemId:item.ITEM_ID},{fetchInfo:{CONTENT_BLOB:{type:o.BUFFER}}}))[0];if(!content)throw fail(409,'Source changed during the build.');inputs.push({...item,...content});
    }
    const {messages,...snapshot}=normalize(inputs),runId=randomUUID();
    await c.execute('INSERT INTO cdr_msg_runs(run_id,batch_id,requested_by,version,fingerprint,result_json) VALUES(:rid,:id,:usr,:version,:fp,:result)',{rid:runId,id:batchId,usr:user,version:VERSION,fp,result:clob(snapshot)});
    const nodes=[...snapshot.participants.map(p=>({id:p.id,kind:'participant',label:p.name})),...snapshot.threads.map(t=>({id:t.id,kind:'thread',label:t.title}))];
    await c.executeMany('INSERT INTO cdr_msg_nodes(node_key,run_id,node_ref,node_kind,node_label) VALUES(:k,:rid,:ref,:kind,:label)',nodes.map(n=>({k:key(runId,n.id),rid:runId,ref:n.id,kind:n.kind,label:n.label})));
    // CLOBs require explicit bind definitions for executeMany; single inserts
    // keep per-message provenance and variable bodies simple and bounded.
    for(const m of messages)await c.execute(`INSERT INTO cdr_msg_records(message_key,run_id,message_ref,thread_key,sender_key,source_item_id,source_sequence,sent_utc,body,message_json)
     VALUES(:k,:rid,:ref,:threadKey,:senderKey,:itemId,:seq,:utc,:body,:json)`,{k:key(runId,m.id),rid:runId,ref:m.id,threadKey:key(runId,m.threadId),senderKey:key(runId,m.senderId),itemId:m.source.itemId,seq:m.sequence,utc:m.time.utc,body:{val:m.text,type:o.CLOB},json:clob(m)});
    await c.executeMany('INSERT INTO cdr_msg_links(edge_key,run_id,edge_ref,from_key,to_key,edge_kind,message_key,message_count) VALUES(:k,:rid,:ref,:fromKey,:toKey,:kind,:messageKey,:count)',snapshot.links.map(e=>({k:key(runId,e.id),rid:runId,ref:e.id,fromKey:key(runId,e.from),toKey:key(runId,e.to),kind:e.kind,messageKey:e.messageId?key(runId,e.messageId):null,count:e.count})));
    await nativeGraph(c,runId,snapshot);await clearFailure(c,batchId,'messages');await c.commit();return {runId,reused:false};
   }catch(e){await c.rollback();if(e.errorNum===30006)throw fail(409,'This batch is busy. Try building messages again shortly.');await recordFailure(c,batchId,'messages',buildFingerprint,e);throw e;}
  });
 },
 async read(user,batchId,query={}){
  const q=searchTerm(query.q);
  return db(user,async c=>{
   await visible(c,batchId);const run=await saved(c,batchId);if(!run)return {run:null,limits:LIMITS};
   const snapshot=JSON.parse(run.RESULT_JSON),links=await nativeGraph(c,run.RUN_ID,snapshot);
   const matches=q?await rows(c,'SELECT thread_key,COUNT(*) n FROM secure_cdr_msg_records_v WHERE run_id=:rid AND INSTR(LOWER(body),LOWER(:q))>0 GROUP BY thread_key',{rid:run.RUN_ID,q}):[];
   const counts=new Map(matches.map(r=>[r.THREAD_KEY,r.N]));
   return {...snapshot,links,threads:snapshot.threads.map(t=>({...t,matchCount:q?(counts.get(key(run.RUN_ID,t.id))||0):null})),query:q,matchCount:q?matches.reduce((v,r)=>v+r.N,0):null,run:{id:run.RUN_ID,createdAt:run.CREATED_AT,version:run.VERSION,fingerprint:run.FINGERPRINT},stale:run.FINGERPRINT!==fingerprint(await sources(c,batchId)),engine:'Oracle SQL Property Graph · CDR_MSG_GRAPH_V1 · GRAPH_TABLE'};
  });
 },
 async thread(user,batchId,threadId,query={}){
  const q=searchTerm(query.q),page=Number(query.page||1),order=query.order||'auto';
  if(!Number.isInteger(page)||page<1||!['auto','source','time'].includes(order))throw fail(400,'Choose a valid page and message order.');
  return db(user,async c=>{
   await visible(c,batchId);const run=await saved(c,batchId,query.runId);if(!run)throw fail(404,'Conversation snapshot not found.');
   const snapshot=JSON.parse(run.RESULT_JSON),thread=snapshot.threads.find(t=>t.id===threadId);if(!thread)throw fail(404,'Conversation not found in this batch snapshot.');
   if(order==='time'&&!thread.chronological)throw fail(400,'Some timestamps or UTC offsets are missing. Use source order.');
   const mode=order==='auto'?(thread.chronological?'time':'source'):order,sort=mode==='time'?'sent_utc,source_sequence':'source_sequence',pages=Math.ceil(thread.messageCount/LIMITS.pageSize);
   if(page>pages)throw fail(400,'Message page is outside this conversation.');
   const binds={rid:run.RUN_ID,threadKey:key(run.RUN_ID,thread.id)};
   const records=await rows(c,`SELECT message_json FROM secure_cdr_msg_records_v WHERE run_id=:rid AND thread_key=:threadKey ORDER BY ${sort} OFFSET :offset ROWS FETCH NEXT ${LIMITS.pageSize} ROWS ONLY`,{...binds,offset:(page-1)*LIMITS.pageSize},jsonOptions);
   const matched=q?await rows(c,`SELECT message_ref,position FROM (SELECT message_ref,body,ROW_NUMBER() OVER(ORDER BY ${sort}) position FROM secure_cdr_msg_records_v WHERE run_id=:rid AND thread_key=:threadKey) WHERE INSTR(LOWER(body),LOWER(:q))>0 ORDER BY position`,{...binds,q}):[];
   return {runId:run.RUN_ID,thread,participants:snapshot.participants.filter(p=>thread.participantIds.includes(p.id)),messages:records.map(r=>JSON.parse(r.MESSAGE_JSON)),page,pages,pageSize:LIMITS.pageSize,total:thread.messageCount,order:mode,query:q,matches:matched.map(r=>({id:r.MESSAGE_REF,position:r.POSITION,page:Math.ceil(r.POSITION/LIMITS.pageSize)}))};
  });
 },
};}
function registerMessages(router,db,route){const messages=createMessages(db);
 router.post('/batches/:id/messages',route(async(req,res)=>res.json(await messages.build(req.demoUser,req.params.id))));
 router.get('/batches/:id/messages',route(async(req,res)=>res.json(await messages.read(req.demoUser,req.params.id,req.query))));
 router.get('/batches/:id/messages/threads/:threadId',route(async(req,res)=>res.json(await messages.thread(req.demoUser,req.params.id,req.params.threadId,req.query))));
 return messages;
}
module.exports={createMessages,registerMessages,nativeGraph,searchTerm};
