'use strict';
const assert=require('node:assert/strict'),o=require('oracledb');
const {createMoneyAgent,TOOLS,VERSION,TEAM,validateAnswer}=require('../backend/data-room-money-agent');
const batchId='DR-20260914-13f650e8-dfa8-450e';
(async()=>{
 if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected CRIME_DATA on FU40.');
 const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
 const rows=async(sql,b={},opts={})=>(await c.execute(sql,b,{outFormat:o.OUT_FORMAT_OBJECT,...opts})).rows;
 const db=async(user,fn)=>{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});return fn(c);};
 const state=async()=>({sources:await rows('SELECT item_id,sha256 FROM secure_cdr_items_v WHERE batch_id=:id ORDER BY item_id',{id:batchId}),money:await rows('SELECT run_id,fingerprint FROM secure_cdr_money_runs_v WHERE batch_id=:id ORDER BY run_id',{id:batchId}),messages:await rows('SELECT run_id,fingerprint FROM secure_cdr_msg_runs_v WHERE batch_id=:id ORDER BY run_id',{id:batchId}),stages:await rows('SELECT stage_no,status,detail FROM secure_cdr_stages_v WHERE batch_id=:id ORDER BY stage_no',{id:batchId}),workspace:await rows('SELECT run_id,status FROM secure_cdr_workspace_runs_v WHERE batch_id=:id ORDER BY run_id',{id:batchId})});
 try{
  await db('statewide_admin',async()=>{});const before=await state(),agent=createMoneyAgent(db);
  assert.equal((await rows('SELECT filename FROM secure_cdr_batches_v WHERE batch_id=:id',{id:batchId}))[0].FILENAME,'Suga_Scene4.zip');
  let review=await agent.detail('statewide_admin',batchId);
  if(process.argv.includes('--new')||!review.run||review.run.status==='failed'||review.run.version!==VERSION){
   const queued=await agent.queue('statewide_admin',batchId,{runId:before.money[0].RUN_ID,from:'SYN-AUD-001',to:'SYN-AUD-008',currency:'AUD',maxHops:4,question:'How does money reach Hartley? Explain all supported routes from VantaSys to Hartley, citing each original transaction. Distinguish the gross transfer volume from the amount received by Hartley.'});
   console.log(JSON.stringify({queued:queued.runId,nativeTeam:TEAM}));await agent.tick();review=await agent.detail('statewide_admin',batchId,queued.runId);
   const deadline=Date.now()+240000;while(['queued','running'].includes(review.run.status)&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,1000));review=await agent.detail('statewide_admin',batchId,queued.runId);}
  }
  assert.equal(review.run.status,'complete',review.run.error_text);assert.equal(review.stale,false);assert.equal(review.context.summary.counts.accounts,8);assert.equal(review.context.summary.counts.transfers,10);assert.equal(review.context.summary.grossVolume,'4500000.00');assert.equal(review.context.summary.sinkInflow,'1500000.00');assert.equal(review.context.routes.count,4);assert(review.context.routes.routes.every(r=>r.hops===3));assert.equal(review.context.routes.truncated,false);
  assert(TOOLS.every(tool=>review.toolEvents.some(e=>e.tool_name===tool)));
  validateAnswer(review.result.answer,review.context);
  for(const evidence of review.context.evidence)assert(review.result.answer.includes(evidence.ref),`Expected citation ${evidence.ref}`);
  assert.match(review.result.answer,/(?:four|4)\s+(?:distinct\s+|supported\s+|recorded\s+)?(?:three-hop\s+|3-hop\s+)?routes/i);
  for(const user of ['northern_analyst','read_only_viewer'])await assert.rejects(()=>agent.detail(user,batchId,review.run.run_id),e=>e.status===404);
  await db('statewide_admin',async()=>{});await c.execute('BEGIN DBMS_APPLICATION_INFO.SET_CLIENT_INFO(:rid); END;',{rid:review.run.run_id});
  for(const tool of TOOLS){const v=(await rows(`SELECT ${tool}(:rid) value FROM dual`,{rid:review.run.run_id},{fetchInfo:{VALUE:{type:o.STRING}}}))[0].VALUE;assert.match(v,/No authorised active request/);}
  await c.execute('BEGIN DBMS_APPLICATION_INFO.SET_CLIENT_INFO(NULL); END;');assert.deepEqual(await state(),before);
  console.log(JSON.stringify({runId:review.run.run_id,status:review.run.status,toolEvents:review.toolEvents,routeCount:review.context.routes.count,exactAmounts:'reconciled',sourceCitations:'all ten original transfers',hiddenUsers:'denied',closedRequestTools:'denied',sourceMoneyMessagesStagesWorkspace:'unchanged',answer:review.result.answer},null,2));
 }finally{await c.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
