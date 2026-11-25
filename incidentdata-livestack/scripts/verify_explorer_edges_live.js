'use strict';
// Fixture writes stay in one uncommitted transaction and are rolled back.
const assert=require('node:assert/strict'),o=require('oracledb'),{randomUUID}=require('node:crypto');
const {createMoney}=require('../backend/data-room-money'),{digest}=require('../backend/data-room-money-model');
const {capabilitySummary,fingerprint}=require('../backend/data-room-capabilities');
const {createMoneyAgent,TOOLS,VERSION}=require('../backend/data-room-money-agent');
(async()=>{
 if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected CRIME_DATA on FU40.');
 const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
 const rows=async(sql,b={},opts={})=>(await c.execute(sql,b,{outFormat:o.OUT_FORMAT_OBJECT,...opts})).rows;
 const transaction={execute:c.execute.bind(c),executeMany:c.executeMany.bind(c),commit:async()=>{},rollback:()=>c.execute('ROLLBACK TO pilot_api')};Object.defineProperty(transaction,'callTimeout',{get:()=>c.callTimeout,set:v=>{c.callTimeout=v;}});
 const db=async(user,fn)=>{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});await c.execute('SAVEPOINT pilot_api');return fn(transaction);};
 const batchId='DR-EXPLORER-TEST-'+randomUUID().slice(0,18),owner='northern_analyst',items=[];
 async function item(type,text){const id=randomUUID().replace(/-/g,''),bytes=Buffer.from(text);await c.execute('INSERT INTO cdr_items(item_id,batch_id,original_path,content_type,byte_count,sha256,content_blob,headline) VALUES(:iid,:id,:sourcePath,:itemType,:byteCount,:sha,:sourceBody,:headline)',{iid:id,id:batchId,sourcePath:id+'.'+type,itemType:type,byteCount:bytes.length,sha:digest(bytes),sourceBody:bytes,headline:'Uncommitted capability test'});items.push({ITEM_ID:id,CONTENT_TYPE:type,SHA256:digest(bytes)});return id;}
 try{
  await c.execute("INSERT INTO cdr_batches(batch_id,filename,loaded_by,status,archive_bytes,headline) VALUES(:id,'explorer-rollback-test.zip',:owner,'ready',1,'Uncommitted explorer test')",{id:batchId,owner});
  const sourceId=await item('csv','date,from_account,to_account,amount,currency\n2026-09-11,A,B,12.30,AUD\n2026-09-12,B,C,12.30,AUD');
  await item('json','{"note":"messages mentioned in prose"}');
  let cap=await db(owner,t=>capabilitySummary(t,batchId));assert.equal(cap.capabilities[0].status,'ready');assert.equal(cap.capabilities[1].available,false);
  await item('json','{"messages":[{"sender":"A","text":"Hi"}]}');await item('txt','SYNTHETIC CONVERSATION\nThread: X\nParticipants: A, B\nDate: 15 September 2026\n\n10:00 — A:\nHi');
  cap=await db(owner,t=>capabilitySummary(t,batchId));assert.equal(cap.capabilities[1].coverage.recognisedSources,2);assert.equal(cap.capabilities[1].counts,null);
  const money=createMoney(db),built=await money.build(owner,batchId);cap=await db(owner,t=>capabilitySummary(t,batchId));assert.equal(cap.capabilities[0].status,'results');assert.deepEqual(cap.capabilities[0].counts,{accounts:3,transfers:2});
  await c.execute("INSERT INTO cdr_cap_failures(batch_id,capability,fingerprint,error_text) VALUES(:id,'money',:fp,'Test failure survives a new summary read')",{id:batchId,fp:cap.capabilities[0].sourceFingerprint});
  cap=await db(owner,t=>capabilitySummary(t,batchId));assert.equal(cap.capabilities[0].status,'needs_attention');await money.build(owner,batchId);cap=await db(owner,t=>capabilitySummary(t,batchId));assert.equal(cap.capabilities[0].status,'results');
  await assert.rejects(()=>db('southern_analyst',t=>capabilitySummary(t,batchId)),e=>e.status===404);
  const options={runId:built.runId,from:'A',to:'C',currency:'AUD',maxHops:4};let mode='complete',calls=0;
  const agent=createMoneyAgent(db,async(t,run)=>{calls++;if(mode==='throw')throw Error('Injected native failure');for(const tool of mode==='missing'?TOOLS.slice(0,2):TOOLS)await t.execute('INSERT INTO cdr_money_ai_events(run_id,tool_name) VALUES(:rid,:tool)',{rid:run.RUN_ID,tool});return mode==='bad_citation'?'Invented [T999].':'Gross transfer volume: 24.60 AUD\nInflow to selected destination: 12.30 AUD\nTwo recorded transfers [T001] and [T002].';});
  async function runReview(nextMode){mode=nextMode;const queued=await agent.queue(owner,batchId,options),token=randomUUID();await c.execute("UPDATE cdr_money_ai_runs SET status='running',lease_token=:token,lease_until=SYSTIMESTAMP+NUMTODSINTERVAL(600,'SECOND') WHERE run_id=:rid",{rid:queued.runId,token});const run=(await rows('SELECT run_id,batch_id,requested_by,version,fingerprint FROM cdr_money_ai_runs WHERE run_id=:rid',{rid:queued.runId}))[0];await agent.processRun({...run,TOKEN:token});return agent.detail(owner,batchId,queued.runId);}
  let review=await runReview('complete');assert.equal(review.run.status,'complete');assert.equal(review.toolEvents.length,3);assert.equal(review.context.routes.count,1);assert.equal(review.context.summary.grossVolume,'24.60');
  for(const other of ['southern_analyst','statewide_admin'])await assert.rejects(()=>agent.detail(other,batchId,review.run.run_id),e=>e.status===404);
  await assert.rejects(()=>agent.queue('read_only_viewer',batchId,options),e=>e.status===403);
  review=await runReview('throw');assert.equal(review.run.status,'failed');assert.match(review.run.error_text,/Injected native failure/);
  review=await runReview('missing');assert.equal(review.run.status,'failed');assert.match(review.run.error_text,/all three/);
  review=await runReview('bad_citation');assert.equal(review.run.status,'failed');assert.match(review.run.error_text,/unknown transaction/);
  const queued=await agent.queue(owner,batchId,options);await assert.rejects(()=>agent.queue(owner,batchId,options),e=>e.status===409);assert.equal((await agent.detail(owner,batchId,queued.runId)).run.status,'queued');
  await c.execute("UPDATE cdr_money_ai_runs SET status='failed' WHERE run_id=:rid",{rid:queued.runId});
  const originalSha=items.find(i=>i.ITEM_ID===sourceId).SHA256;await c.execute('UPDATE cdr_items SET sha256=:sha WHERE item_id=:iid',{sha:'f'.repeat(64),iid:sourceId});cap=await db(owner,t=>capabilitySummary(t,batchId));assert.equal(cap.capabilities[0].status,'stale');await assert.rejects(()=>agent.queue(owner,batchId,options),e=>e.status===409);assert.equal(calls,4);await c.execute('UPDATE cdr_items SET sha256=:sha WHERE item_id=:iid',{sha:originalSha,iid:sourceId});
  // Deletion dependency order, restricted to this known uncommitted fixture.
  assert(batchId.startsWith('DR-EXPLORER-TEST-'));
  await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_money_ai_events WHERE run_id IN (SELECT run_id FROM cdr_money_ai_runs WHERE batch_id=:id)',{id:batchId});
  for(const table of ['cdr_money_ai_runs','cdr_cap_failures'])await c.execute(`DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM ${table} WHERE batch_id=:id`,{id:batchId});
  for(const table of ['cdr_money_transfers','cdr_money_accounts'])await c.execute(`DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM ${table} WHERE run_id IN (SELECT run_id FROM cdr_money_runs WHERE batch_id=:id)`,{id:batchId});
  for(const table of ['cdr_money_runs','cdr_items','cdr_batches'])await c.execute(`DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM ${table} WHERE batch_id=:id`,{id:batchId});
  await c.rollback();assert.equal((await rows('SELECT COUNT(*) n FROM cdr_batches WHERE batch_id=:id',{id:batchId}))[0].N,0);
  console.log(JSON.stringify({discovery:'recognised / absent / ready / results / stale / failure',failureClearOnSuccess:'passed',privateReviewScope:'passed',nativeFailurePersistence:'passed',requiredToolEvents:'enforced',unknownCitations:'rejected',busyAndStaleRequests:'rejected',deletionDependencies:'passed',fixtureWrites:'all rolled back',nativeCalls:0}));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
