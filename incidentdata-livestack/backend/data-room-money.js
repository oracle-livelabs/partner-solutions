'use strict';
const o=require('oracledb');
const {randomUUID}=require('node:crypto');
const {VERSION,LIMITS,digest,fail,normalize,summarize,filters,filtered}=require('./data-room-money-model');
const {recordFailure,clearFailure}=require('./data-room-capabilities');
const rows=async(c,sql,binds={},options={})=>(await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT,...options})).rows;
const jsonOptions={fetchInfo:{RESULT_JSON:{type:o.STRING}}};
const clob=value=>({val:JSON.stringify(value),type:o.CLOB});
const key=(run,id)=>digest(JSON.stringify([run,id]));
const nameKey=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase();
function accountCoverage(snapshot){
 const coverage=new Map(snapshot.accounts.map(a=>[a.id,new Map((a.sources||[]).map(s=>[s.itemId,s]))]));
 for(const t of snapshot.transfers)for(const id of [t.from,t.to])coverage.get(id)?.set(t.source.itemId,{itemId:t.source.itemId,path:t.source.path});
 return snapshot.accounts.map(a=>({...a,sources:[...(coverage.get(a.id)?.values()||[])].sort((x,y)=>x.path.localeCompare(y.path))}));
}
function poiMatches(accounts,people){
 const names=new Map();for(const p of people)for(const name of [p.DISPLAY_NAME,p.ALIAS_NAME]){const key=nameKey(name);if(key){if(!names.has(key))names.set(key,[]);names.get(key).push({personRef:p.PERSON_REF,displayName:p.DISPLAY_NAME});}}
 return accounts.map(a=>({...a,poiMatches:[...new Map(a.labels.flatMap(label=>names.get(nameKey(label))||[]).map(p=>[p.personRef,p])).values()]}));
}
async function visible(c,id){const b=(await rows(c,'SELECT batch_id,status FROM secure_cdr_batches_v WHERE batch_id=:id',{id}))[0];if(!b)throw fail(404,'Batch not found in your authorised scope.');return b;}
async function sources(c,id){return rows(c,"SELECT item_id,original_path,sha256,byte_count,content_type FROM secure_cdr_items_v WHERE batch_id=:id AND content_type IN ('csv','json') ORDER BY item_id",{id});}
const fingerprint=items=>digest(JSON.stringify([VERSION,items.map(i=>[i.ITEM_ID,i.SHA256])]));
async function saved(c,id,runId){return (await rows(c,`SELECT run_id,version,fingerprint,created_at,result_json FROM secure_cdr_money_runs_v WHERE batch_id=:id AND version=:version ${runId?'AND run_id=:runId':''} ORDER BY created_at DESC FETCH FIRST 1 ROW ONLY`,{id,version:VERSION,...(runId?{runId}:{})},jsonOptions))[0];}
async function graphTransfers(c,run,snapshot){
 const edges=await rows(c,`SELECT * FROM GRAPH_TABLE(cdr_money_graph_v1
 MATCH (a IS money_account)-[e IS money_transfer]->(b IS money_account)
 WHERE a.run_id=:rid AND e.run_id=:rid AND b.run_id=:rid
 COLUMNS(e.transfer_id AS transfer_id,a.account_ref AS from_ref,b.account_ref AS to_ref))`,{rid:run});
 const index=new Map(snapshot.transfers.map(t=>[t.id,t]));
 if(edges.length!==index.size||new Set(edges.map(e=>e.TRANSFER_ID)).size!==index.size||edges.some(e=>!index.has(e.TRANSFER_ID)||index.get(e.TRANSFER_ID).from!==e.FROM_REF||index.get(e.TRANSFER_ID).to!==e.TO_REF))throw fail(409,'The native money graph does not reconcile with its source snapshot. Rebuild or check the money-flow migration.');
 return edges.map(e=>index.get(e.TRANSFER_ID)).sort((a,b)=>a.date.localeCompare(b.date)||a.source.path.localeCompare(b.source.path)||a.source.record-b.source.record);
}
// Fixed, allow-listed hop count; all user values are binds. Every intermediate
// vertex and edge is constrained to this run as well as the graph's scoped views.
function pathSql(hops){
 if(!Number.isInteger(hops)||hops<1||hops>LIMITS.maxHops)throw fail(400,'Invalid hop count.');
 const nodes=Array.from({length:hops+1},(_,i)=>`a${i}`),edges=Array.from({length:hops},(_,i)=>`e${i}`);
 const pattern=`(a0 IS money_account)${edges.map((e,i)=>`-[${e} IS money_transfer]->(a${i+1} IS money_account)`).join('')}`;
 const where=[...nodes.map(n=>`${n}.run_id=:rid`),...edges.flatMap(e=>[`${e}.run_id=:rid`,`${e}.currency=:currency`,`${e}.event_day>=:dateFrom`,`${e}.event_day<=:dateTo`]),'a0.account_ref=:fromRef',`a${hops}.account_ref=:toRef`];
 for(let i=1;i<hops;i++)where.push(`e${i}.event_day>=e${i-1}.event_day`);
 // Simple routes only. Circular topology is reported separately, without
// pretending to trace specific fungible funds around a loop.
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)where.push(`${nodes[i]}.account_key<>${nodes[j]}.account_key`);
 return `SELECT * FROM GRAPH_TABLE(cdr_money_graph_v1 MATCH ${pattern} WHERE ${where.join(' AND ')} COLUMNS(${edges.map((e,i)=>`${e}.transfer_id AS tx${i}`).join(',')})) FETCH FIRST ${LIMITS.routes+1} ROWS ONLY`;
}
function createMoney(db){
 return {
  async build(user,id){
   if(user==='read_only_viewer')throw fail(403,'The read-only demo user cannot build money flows.');
   return db(user,async c=>{
    await visible(c,id);
    let buildFingerprint;
    try{
     const locked=(await rows(c,'SELECT status FROM cdr_batches WHERE batch_id=:id FOR UPDATE WAIT 5',{id}))[0];
     if(!locked)throw fail(404,'Batch no longer exists.');
     if(locked.STATUS!=='ready')throw fail(409,'Wait for batch ingestion to complete before building money flows.');
     const items=await sources(c,id),fp=fingerprint(items);
     buildFingerprint=fp;
     const existing=(await rows(c,'SELECT run_id FROM secure_cdr_money_runs_v WHERE batch_id=:id AND version=:version AND fingerprint=:fp',{id,version:VERSION,fp}))[0];
     if(existing){await clearFailure(c,id,'money');await c.commit();return {runId:existing.RUN_ID,reused:true};}
     const inputs=[];
     for(const item of items){
      if(item.BYTE_COUNT>LIMITS.csvBytes)throw fail(422,`${item.ORIGINAL_PATH}: CSV exceeds the 2 MiB money-flow limit.`);
      const content=(await rows(c,'SELECT content_blob FROM secure_cdr_items_v WHERE batch_id=:id AND item_id=:itemId',{id,itemId:item.ITEM_ID},{fetchInfo:{CONTENT_BLOB:{type:o.BUFFER}}}))[0];
      if(!content)throw fail(409,'Source changed during the build.');inputs.push({...item,...content});
     }
     const snapshot=normalize(inputs),runId=randomUUID();
     await c.execute('INSERT INTO cdr_money_runs(run_id,batch_id,requested_by,version,fingerprint,result_json) VALUES(:rid,:id,:usr,:version,:fp,:result)',{rid:runId,id,usr:user,version:VERSION,fp,result:clob(snapshot)});
     await c.executeMany('INSERT INTO cdr_money_accounts(account_key,run_id,account_ref) VALUES(:k,:rid,:ref)',snapshot.accounts.map(a=>({k:key(runId,a.id),rid:runId,ref:a.id})));
     await c.executeMany(`INSERT INTO cdr_money_transfers(edge_key,run_id,transfer_id,from_key,to_key,amount,currency,event_day)
      VALUES(:k,:rid,:tid,:fromKey,:toKey,TO_NUMBER(:amount,'999999999999999999999999D999999','NLS_NUMERIC_CHARACTERS=''.,'''),:currency,:eventDay)`,snapshot.transfers.map(t=>({k:key(runId,t.id),rid:runId,tid:t.id,fromKey:key(runId,t.from),toKey:key(runId,t.to),amount:t.amount,currency:t.currency,eventDay:t.date})));
     await graphTransfers(c,runId,snapshot);
     await clearFailure(c,id,'money');await c.commit();return {runId,reused:false};
    }catch(e){await c.rollback();if(e.errorNum===30006)throw fail(409,'This batch is busy. Try building money flows again shortly.');await recordFailure(c,id,'money',buildFingerprint,e);throw e;}
   });
  },
  async read(user,id,query={}){
   const f=filters(query);
   return db(user,async c=>{
    await visible(c,id);const run=await saved(c,id);
    if(!run)return {run:null,limits:LIMITS};
    const snapshot=JSON.parse(run.RESULT_JSON),all=await graphTransfers(c,run.RUN_ID,snapshot),transfers=filtered(all,f),ids=new Set(transfers.flatMap(t=>[t.from,t.to]));
    const people=await rows(c,'SELECT person_ref,display_name,alias_name FROM secure_persons_of_interest_v');const accounts=poiMatches(accountCoverage(snapshot),people).filter(a=>ids.has(a.id));
    return {...snapshot,accounts,transfers,summary:summarize(transfers),currencies:[...new Set(all.map(t=>t.currency))].sort(),totalTransferCount:all.length,filters:f,run:{id:run.RUN_ID,createdAt:run.CREATED_AT,version:run.VERSION,fingerprint:run.FINGERPRINT},stale:run.FINGERPRINT!==fingerprint(await sources(c,id)),engine:'Oracle SQL Property Graph · CDR_MONEY_GRAPH_V1 · GRAPH_TABLE'};
   });
  },
  async routes(user,id,query={}){
   const f=filters(query),hops=Number(query.maxHops||LIMITS.maxHops),from=String(query.from||''),to=String(query.to||'');
   if(!f.currency||!from||!to||from===to||!Number.isInteger(hops)||hops<1||hops>LIMITS.maxHops)throw fail(400,'Choose distinct start/end accounts, a currency and 1–4 maximum hops.');
   return db(user,async c=>{
    await visible(c,id);const run=await saved(c,id,query.runId);
    if(!run)throw fail(404,'Money-flow snapshot not found.');
    const snapshot=JSON.parse(run.RESULT_JSON),eligible=filtered(snapshot.transfers,f),ids=new Set(eligible.flatMap(t=>[t.from,t.to]));
    if(!ids.has(from)||!ids.has(to))throw fail(400,'Choose accounts in the selected currency/date window.');
    const eligibleIds=new Set(eligible.map(t=>t.id)),result=[];let truncated=false;
    const previousTimeout=c.callTimeout;c.callTimeout=10000;
    try{
     for(let n=1;n<=hops;n++){
      const found=await rows(c,pathSql(n),{rid:run.RUN_ID,currency:f.currency,dateFrom:f.dateFrom||'0001-01-01',dateTo:f.dateTo||'9999-12-31',fromRef:from,toRef:to});
      for(const row of found){const transferIds=Array.from({length:n},(_,i)=>row[`TX${i}`]);if(transferIds.some(t=>!eligibleIds.has(t)))throw fail(409,'Route does not reconcile with the selected source window.');if(result.length===LIMITS.routes){truncated=true;break;}result.push({id:digest(transferIds.join(':')),transferIds,hops:n});}
      if(truncated)break;
     }
    }finally{c.callTimeout=previousTimeout;}
    return {runId:run.RUN_ID,routes:result,truncated,maxHops:hops,limit:LIMITS.routes,filters:f,from,to,basis:'Simple directed transaction routes with non-decreasing calendar dates. Same-day ordering and continuity of specific funds are not established.'};
   });
  },
 };
}
function registerMoney(router,db,route){
 const money=createMoney(db);
 router.get('/batches/:id/money-flows',route(async(req,res)=>res.json(await money.read(req.demoUser,req.params.id,req.query))));
 router.post('/batches/:id/money-flows',route(async(req,res)=>res.json(await money.build(req.demoUser,req.params.id))));
 router.get('/batches/:id/money-flows/routes',route(async(req,res)=>res.json(await money.routes(req.demoUser,req.params.id,req.query))));
 return money;
}
module.exports={createMoney,registerMoney,pathSql,graphTransfers};
