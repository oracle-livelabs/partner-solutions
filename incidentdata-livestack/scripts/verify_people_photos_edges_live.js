'use strict';
// All fixture changes are uncommitted and rolled back. No model calls.
const assert=require('node:assert/strict'),o=require('oracledb'),sharp=require('sharp'),{randomUUID}=require('node:crypto');
const {createPeoplePhotos,VERSION}=require('../backend/data-room-people-photos'),embed=require('../backend/embeddings'),{hash}=require('../backend/data-room-archive');
(async()=>{
 if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected CRIME_DATA on FU40.');
 const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
 const rows=async(sql,b={},opts={})=>(await c.execute(sql,b,{outFormat:o.OUT_FORMAT_OBJECT,...opts})).rows;
 const proxy={execute:c.execute.bind(c),commit:async()=>{},rollback:()=>c.execute('ROLLBACK TO photo_api')};
 const db=async(user,fn)=>{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});await c.execute('SAVEPOINT photo_api');return fn(proxy);};
 const batchId='DR-PHOTO-TEST-'+randomUUID().slice(0,18),itemId=randomUUID().replace(/-/g,''),owner='northern_analyst';
 try{
  await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  await c.execute("INSERT INTO cdr_batches(batch_id,filename,loaded_by,status,archive_bytes,headline) VALUES(:id,'photo-rollback-test.zip',:owner,'ready',1,'Uncommitted People Photos test')",{id:batchId,owner});
  const bytes=await sharp({create:{width:48,height:48,channels:3,background:'#778899'}}).png().toBuffer(),sha=hash(bytes);
  await c.execute("INSERT INTO cdr_items(item_id,batch_id,original_path,content_type,byte_count,sha256,content_blob,headline) VALUES(:iid,:id,'fixture.png','png',:bytes,:sha,:blob,'Uncommitted photo test')",{iid:itemId,id:batchId,bytes:bytes.length,sha,blob:bytes});
  await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");
  const refs=await rows(`SELECT p.person_ref,e.asset_ref,e.asset_sha256 FROM secure_persons_of_interest_v p JOIN person_visual_embeddings e ON e.person_id=p.person_id WHERE e.asset_kind='reference_portrait' ORDER BY p.person_ref FETCH FIRST 3 ROWS ONLY`);assert.equal(refs.length,3);
  let searchCalls=0;
  const mockSearch=async(u,id,iid,body)=>{searchCalls++;assert.deepEqual(Object.keys(body).sort(),['mode','region']);return {version:'test-search',sourceSha256:sha,cropDataUrl:'data:image/png;base64,'+bytes.toString('base64'),query:{cropSha256:sha,region:{left:0,top:0,width:48,height:48},imageWidth:48,imageHeight:48},model:embed.IMAGE_MODEL,dimensions:embed.IMAGE_DIMENSIONS,candidates:refs.map((r,i)=>({person_ref:r.PERSON_REF,asset_ref:r.ASSET_REF,asset_sha256:r.ASSET_SHA256,score:.8-i*.1}))};};
  const photos=createPeoplePhotos(db,embed,mockSearch),body={region:{x:0,y:0,width:1,height:1},score:1,decision:'accepted_demo'};
  let built=await photos.compare('statewide_admin',batchId,itemId,body),result=await photos.read('statewide_admin',batchId);
  assert.equal(result.searches.length,1);assert.equal(result.searches[0].version,VERSION);assert.equal(result.searches[0].staleReason,null);assert.equal(result.searches[0].candidates.length,3);assert.equal(result.edges.length,4);assert(result.searches[0].candidates.every(p=>p.decision==='pending'));
  assert.equal(hash(await photos.crop(owner,batchId,built.searchId)),sha);
  assert.equal((await photos.compare('statewide_admin',batchId,itemId,body)).reused,true);
  const [first,second]=result.searches[0].candidates;
  const reviewBody={decision:'accepted_demo',expectedRevision:0,reason:'Automated rollback fixture only; not a human identification.'};
  await photos.review('statewide_admin',batchId,first.candidate_id,reviewBody);
  result=await photos.read('statewide_admin',batchId);assert.equal(result.edges.filter(e=>e.decision==='accepted_demo').length,1);
  await assert.rejects(()=>photos.review('statewide_admin',batchId,first.candidate_id,reviewBody),e=>e.status===409);
  await assert.rejects(()=>photos.review('statewide_admin',batchId,second.candidate_id,reviewBody),e=>e.status===409);
  await photos.review('statewide_admin',batchId,first.candidate_id,{decision:'rejected',expectedRevision:1,reason:'Automated reversal fixture; original review is retained.'});
  assert.equal((await photos.history('statewide_admin',batchId,first.candidate_id)).length,2);
  await photos.review('statewide_admin',batchId,second.candidate_id,{...reviewBody,decision:'uncertain'});
  for(const method of [()=>photos.read('southern_analyst',batchId),()=>photos.crop('southern_analyst',batchId,built.searchId),()=>photos.history('southern_analyst',batchId,first.candidate_id),()=>photos.crop(owner,'other-batch',built.searchId)])await assert.rejects(method,e=>e.status===404);
  await assert.rejects(()=>photos.compare('read_only_viewer',batchId,itemId,body),e=>e.status===403);await assert.rejects(()=>photos.review('read_only_viewer',batchId,first.candidate_id,reviewBody),e=>e.status===403);
  const northern=await photos.read(owner,batchId),allowed=await rows('SELECT person_ref FROM secure_persons_of_interest_v');assert(northern.searches[0].candidates.every(p=>allowed.some(r=>r.PERSON_REF===p.person_ref)));assert.equal(northern.edges.length,1+northern.searches[0].candidates.length);
  await c.execute('UPDATE cdr_items SET sha256=:sha WHERE item_id=:iid',{sha:'f'.repeat(64),iid:itemId});
  assert.match((await photos.read('statewide_admin',batchId)).searches[0].staleReason,/source changed/);
  await assert.rejects(()=>photos.review('statewide_admin',batchId,first.candidate_id,{...reviewBody,expectedRevision:2}),e=>e.status===409);
  await c.execute('UPDATE cdr_items SET sha256=:sha WHERE item_id=:iid',{sha,iid:itemId});
  await c.execute('UPDATE cdr_photo_searches SET catalogue_fingerprint=:fp WHERE search_id=:sid',{fp:'f'.repeat(64),sid:built.searchId});
  await assert.rejects(()=>photos.review('statewide_admin',batchId,first.candidate_id,{...reviewBody,expectedRevision:2}),e=>e.status===409&&/catalogue/.test(e.message));
  // Exercise the same dependency order as the batch-removal endpoint, fixture only.
  assert(batchId.startsWith('DR-PHOTO-TEST-'));
  await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_photo_reviews WHERE candidate_id IN (SELECT a.candidate_id FROM cdr_photo_candidates a JOIN cdr_photo_searches s ON s.search_id=a.search_id WHERE s.batch_id=:id)',{id:batchId});
  await c.execute('DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM cdr_photo_candidates WHERE search_id IN (SELECT search_id FROM cdr_photo_searches WHERE batch_id=:id)',{id:batchId});
  for(const table of ['cdr_photo_searches','cdr_items','cdr_batches'])await c.execute(`DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ FROM ${table} WHERE batch_id=:id`,{id:batchId});
  await c.rollback();assert.equal((await rows('SELECT COUNT(*) n FROM cdr_batches WHERE batch_id=:id',{id:batchId}))[0].N,0);
  console.log(JSON.stringify({nativeGraph:'four exact, scoped edges',scores:'server-only; pending by default',deduplication:'passed',reviewHistory:'append-only',concurrentRevision:'rejected',conflictingAcceptance:'rejected',sourceAndCatalogueStaleness:'passed',batchAndPoiScope:'passed',readOnly:'denied',deletionOrder:'passed',fixtureWrites:'all rolled back',modelCalls:0,stubSearchCalls:searchCalls}));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
