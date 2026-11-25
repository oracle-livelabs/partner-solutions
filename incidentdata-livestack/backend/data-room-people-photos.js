'use strict';
const o=require('oracledb'),{randomUUID}=require('node:crypto');
const {hash}=require('./data-room-archive'),models=require('./embeddings');
const {createCandidates}=require('./data-room-poi-candidates'),{catalogue,coverage}=require('./poi-catalogue');
const {VERSION,catalogueFingerprint,staleReason}=require('./photo-comparison-state');
const LIMITS={searches:200,reviewCharacters:1000};
const fail=(status,message)=>Object.assign(Error(message),{status});
const rows=async(c,sql,binds={},options={})=>(await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT,...options})).rows;
const lower=r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k.toLowerCase(),v]));
const jsonOptions={fetchInfo:{RESULT_JSON:{type:o.STRING}}};
const writable=user=>{if(user==='read_only_viewer')throw fail(403,'The read-only demo user cannot save comparisons or review candidates.');};
async function visible(c,id){const b=(await rows(c,'SELECT status FROM secure_cdr_batches_v WHERE batch_id=:id',{id}))[0];if(!b)throw fail(404,'Batch not found in your authorised scope.');return b;}
async function lock(c,id){await visible(c,id);const b=(await rows(c,'SELECT status FROM cdr_batches WHERE batch_id=:id FOR UPDATE WAIT 5',{id}))[0];if(!b)throw fail(404,'Batch no longer exists.');if(b.STATUS!=='ready')throw fail(409,'Wait for batch ingestion to finish.');}
function validateReview(body={}){
 if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'Supply a review decision, reason and revision.');
 if(!['pending','accepted_demo','rejected','uncertain'].includes(body.decision))throw fail(400,'Choose a valid review decision.');
 if(!Number.isInteger(body.expectedRevision)||body.expectedRevision<0)throw fail(400,'The current review revision is required.');
 if(typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>LIMITS.reviewCharacters||Buffer.byteLength(body.reason)>4000)throw fail(400,'Give a review reason of 5–1,000 characters.');
 return {decision:body.decision,expectedRevision:body.expectedRevision,reason:body.reason.trim()};
}
async function source(c,id,itemId){return (await rows(c,'SELECT item_id,original_path,content_type,sha256,byte_count FROM secure_cdr_items_v WHERE batch_id=:id AND item_id=:iid',{id,iid:itemId}))[0];}
async function searchRow(c,id,sid){return (await rows(c,'SELECT search_id,batch_id,item_id,requested_by,version,source_sha256,catalogue_fingerprint,fingerprint,result_json,created_at FROM secure_cdr_photo_searches_v WHERE batch_id=:id AND search_id=:sid',{id,sid},jsonOptions))[0];}
async function photoCapability(c,batchId,items,batchStatus){
 const images=items.filter(i=>['png','jpg'].includes(i.CONTENT_TYPE)),hasNarratives=items.some(i=>['txt','json','csv'].includes(i.CONTENT_TYPE)),fp=await catalogueFingerprint(c);
 const saved=await rows(c,`SELECT s.search_id,s.item_id,s.version,s.source_sha256,s.catalogue_fingerprint,i.sha256 current_sha
 FROM secure_cdr_photo_searches_v s JOIN secure_cdr_items_v i ON i.item_id=s.item_id AND i.batch_id=s.batch_id WHERE s.batch_id=:id`,{id:batchId});
 const counts=(await rows(c,`SELECT COUNT(*) candidates,SUM(CASE WHEN decision='accepted_demo' THEN 1 ELSE 0 END) accepted,SUM(CASE WHEN decision='pending' THEN 1 ELSE 0 END) pending
 FROM secure_cdr_photo_candidates_v WHERE batch_id=:id`,{id:batchId}))[0];
 const stale=saved.filter(s=>s.VERSION!==VERSION||s.SOURCE_SHA256!==s.CURRENT_SHA||s.CATALOGUE_FINGERPRINT!==fp).length;
 const warnings=[];if(stale)warnings.push(`${stale} saved comparison${stale===1?' is':'s are'} stale; recompare before reviewing.`);
 if(images.some(i=>i.BYTE_COUNT>5*1024*1024))warnings.push('Some images exceed the 5 MiB visual comparison limit.');
 const reviewedPhotos=new Set(saved.map(s=>s.ITEM_ID)).size;
 return {id:'people_photos',title:'People & Photos',available:images.length>0||saved.length>0||hasNarratives,status:batchStatus!=='ready'?'waiting':stale?'stale':saved.length?'results':images.length||hasNarratives?'ready':'unavailable',
  analysisVersion:VERSION,counts:{photos:images.length,comparedPhotos:reviewedPhotos,regions:saved.length,candidates:counts.CANDIDATES,pending:counts.PENDING||0,accepted:counts.ACCEPTED||0},
  coverage:{recognisedSources:images.length,uncertainSources:0,sources:images.map(i=>({itemId:i.ITEM_ID,path:i.ORIGINAL_PATH,sha256:i.SHA256,bytes:i.BYTE_COUNT,discovery:'recognised'})),imported:[],skipped:[]},warnings,
  actions:{open:'people-photos',canBuild:batchStatus==='ready'},summary:!images.length&&hasNarratives?'Narrative context available · no photos':`${images.length} photos · ${saved.length} saved region${saved.length===1?'':'s'}`,
  notice:'Photo inventory only; no automatic person detection or identification. Saved candidates are not confirmed identities.'};
}
function createPeoplePhotos(db,embed=models,searchFn){
 const search=searchFn||createCandidates(db,embed);let active=0;
 return {
 async compare(user,batchId,itemId,body={}){
  writable(user);if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'Supply a scene region.');if(active>=2)throw fail(429,'Two saved photo comparisons are already running. Please try again shortly.');active++;
  try{
   const before=await db(user,async c=>{const b=await visible(c,batchId);if(b.STATUS!=='ready')throw fail(409,'Wait for batch ingestion to finish.');return catalogueFingerprint(c,embed);});
   // All scores, crop bytes, and provenance come from the authorised server-side search.
   // Client-supplied scores, identities and review decisions are never imported.
   const result=await search(user,batchId,itemId,{mode:'visual',region:body.region});
   const crop=Buffer.from(result.cropDataUrl.split(',')[1],'base64');
   if(hash(crop)!==result.query.cropSha256)throw fail(409,'Processed crop checksum mismatch.');
   return await db(user,async c=>{
    try{
     await lock(c,batchId);const original=await source(c,batchId,itemId),after=await catalogueFingerprint(c,embed);
     if(!original||original.SHA256!==result.sourceSha256||before!==after)throw fail(409,'The source or portrait catalogue changed during comparison. Please compare again.');
     const fp=hash(JSON.stringify([VERSION,itemId,result.sourceSha256,result.query.cropSha256,result.query.region,after]));
     const existing=(await rows(c,'SELECT search_id FROM secure_cdr_photo_searches_v WHERE batch_id=:id AND fingerprint=:fp',{id:batchId,fp}))[0];
     if(existing){await c.commit();return {searchId:existing.SEARCH_ID,reused:true};}
     const count=(await rows(c,'SELECT COUNT(*) n FROM cdr_photo_searches WHERE batch_id=:id',{id:batchId}))[0].N;
     if(count>=LIMITS.searches)throw fail(409,`This batch has reached its ${LIMITS.searches} saved-region limit.`);
     const sid=randomUUID(),snapshot={query:result.query,model:result.model,dimensions:result.dimensions,elapsedMs:result.elapsedMs,searchVersion:result.version};
     await c.execute(`INSERT INTO cdr_photo_searches(search_id,batch_id,item_id,requested_by,version,source_sha256,catalogue_fingerprint,fingerprint,result_json,crop_blob)
      VALUES(:sid,:id,:iid,:u,:version,:sha,:catalogueFp,:fp,:snapshot,:crop)`,{sid,id:batchId,iid:itemId,u:user,version:VERSION,sha:result.sourceSha256,catalogueFp:after,fp,snapshot:{val:JSON.stringify(snapshot),type:o.CLOB},crop:{val:crop,type:o.BLOB}});
     for(const [index,p] of result.candidates.entries()){
      if(!Number.isFinite(p.score)||p.score< -1.000001||p.score>1.000001||!p.asset_ref||!/^[a-f0-9]{64}$/.test(p.asset_sha256))throw fail(409,'Invalid vector candidate provenance.');
      const inserted=await c.execute(`INSERT INTO cdr_photo_candidates(candidate_id,search_id,person_ref,candidate_rank,score,asset_ref,reference_sha256)
       SELECT :cid,:sid,p.person_ref,:ranking,:score,:assetRef,:sha FROM secure_persons_of_interest_v p WHERE p.person_ref=:ref`,{cid:randomUUID(),sid,ref:p.person_ref,ranking:index+1,score:p.score,assetRef:p.asset_ref,sha:p.asset_sha256});
      if(inserted.rowsAffected!==1)throw fail(409,'Candidate scope changed. Please compare again.');
     }
     await c.commit();return {searchId:sid,reused:false};
    }catch(e){await c.rollback();if(e.errorNum===30006)throw fail(409,'This batch is busy. Try again shortly.');throw e;}
   });
  }finally{active--;}
 },
 async read(user,batchId){return db(user,async c=>{
  await visible(c,batchId);const fp=await catalogueFingerprint(c,embed);
  const photos=await rows(c,"SELECT item_id,original_path,content_type,sha256,byte_count FROM secure_cdr_items_v WHERE batch_id=:id AND content_type IN ('png','jpg') ORDER BY original_path,item_id",{id:batchId});
  const saved=await rows(c,'SELECT search_id,item_id,requested_by,version,source_sha256,catalogue_fingerprint,result_json,created_at FROM secure_cdr_photo_searches_v WHERE batch_id=:id ORDER BY created_at,search_id',{id:batchId},jsonOptions);
  const candidates=await rows(c,'SELECT * FROM secure_cdr_photo_candidates_v WHERE batch_id=:id ORDER BY search_id,candidate_rank',{id:batchId});
  const searches=saved.map(s=>({id:s.SEARCH_ID,itemId:s.ITEM_ID,sourceSha256:s.SOURCE_SHA256,createdBy:s.REQUESTED_BY,createdAt:s.CREATED_AT,version:s.VERSION,
   ...JSON.parse(s.RESULT_JSON),staleReason:staleReason(s,photos.find(i=>i.ITEM_ID===s.ITEM_ID)?.SHA256,fp,embed),
   candidates:candidates.filter(a=>a.SEARCH_ID===s.SEARCH_ID).map(lower)}));
  const edges=await rows(c,`SELECT * FROM GRAPH_TABLE(cdr_photo_graph_v1 MATCH (a IS photo_node)-[e IS photo_link]->(b IS photo_node)
   WHERE a.batch_id=:id AND e.batch_id=:id AND b.batch_id=:id
   COLUMNS(e.edge_key AS id,a.node_key AS source,b.node_key AS target,e.search_id AS search_id,e.edge_kind AS kind,e.candidate_id AS candidate_id,e.score AS score,e.decision AS decision))`,{id:batchId});
  // Reconcile native topology with the same scoped relational evidence; fail closed on mismatch.
  const expected=new Map();for(const s of searches){expected.set('source:'+s.id,['photo:'+s.itemId,'region:'+s.id,'source']);for(const a of s.candidates)expected.set(a.candidate_id,['region:'+s.id,'poi:'+batchId+':'+a.person_ref,a.decision]);}
  if(edges.length!==expected.size||new Set(edges.map(e=>e.ID)).size!==expected.size||edges.some(e=>{const x=expected.get(e.ID);return !x||x[0]!==e.SOURCE||x[1]!==e.TARGET||x[2]!==e.DECISION;}))throw fail(409,'The photo graph does not reconcile with its scoped comparisons. Refresh and retry.');
  return {version:VERSION,batchId,photos:photos.map(lower),searches,edges:edges.map(e=>({...lower(e),current:!searches.find(s=>s.id===e.SEARCH_ID)?.staleReason})),catalogue:coverage(await catalogue(c,embed)),limits:LIMITS,
   engine:'Oracle SQL Property Graph · CDR_PHOTO_GRAPH_V1 · GRAPH_TABLE',notice:'Visual similarity candidates for fictional demo review, not identity probabilities. Reviews do not change source images, POI profiles, declared cast links, the agent or Stage 7 products.'};
 });},
 async crop(user,batchId,sid){return db(user,async c=>{
  const r=(await rows(c,'SELECT crop_blob FROM secure_cdr_photo_searches_v WHERE batch_id=:id AND search_id=:sid',{id:batchId,sid},{fetchInfo:{CROP_BLOB:{type:o.BUFFER}}}))[0];
  if(!r)throw fail(404,'Saved region not found in your scope.');return r.CROP_BLOB;
 });},
 async history(user,batchId,cid){return db(user,async c=>{
  const a=(await rows(c,'SELECT candidate_id FROM secure_cdr_photo_candidates_v WHERE batch_id=:id AND candidate_id=:cid',{id:batchId,cid}))[0];if(!a)throw fail(404,'Candidate not found in your scope.');
  return (await rows(c,'SELECT * FROM secure_cdr_photo_reviews_v WHERE candidate_id=:cid ORDER BY revision DESC',{cid})).map(lower);
 });},
 async review(user,batchId,cid,body){writable(user);const value=validateReview(body);return db(user,async c=>{
  try{
   await lock(c,batchId);const candidate=(await rows(c,'SELECT * FROM secure_cdr_photo_candidates_v WHERE batch_id=:id AND candidate_id=:cid',{id:batchId,cid}))[0];
   if(!candidate)throw fail(404,'Candidate not found in your scope.');
   const saved=await searchRow(c,batchId,candidate.SEARCH_ID),original=await source(c,batchId,saved.ITEM_ID),stale=staleReason(saved,original?.SHA256,await catalogueFingerprint(c,embed),embed);
   if(stale)throw fail(409,stale);
   if(candidate.REVISION!==value.expectedRevision)throw fail(409,'Another review was saved. Refresh and inspect it before making a new decision.');
   if(value.decision==='accepted_demo'){
    // Check ALL candidates in the region, not just visible POIs; disclose no hidden identity.
    const accepted=(await rows(c,`SELECT COUNT(*) n FROM cdr_photo_candidates a JOIN cdr_photo_reviews r ON r.candidate_id=a.candidate_id
     WHERE a.search_id=:sid AND a.candidate_id<>:cid AND r.decision='accepted_demo' AND r.revision=(SELECT MAX(x.revision) FROM cdr_photo_reviews x WHERE x.candidate_id=a.candidate_id)`,{sid:candidate.SEARCH_ID,cid}))[0].N;
    if(accepted)throw fail(409,'This region already has an accepted-for-demo candidate. Resolve that review before accepting another.');
   }
   const rid=randomUUID();await c.execute(`INSERT INTO cdr_photo_reviews(review_id,candidate_id,revision,decision,reviewer,reason) VALUES(:rid,:cid,:revision,:decision,:reviewer,:reason)`,{rid,cid,revision:candidate.REVISION+1,decision:value.decision,reviewer:user,reason:value.reason});
   await c.commit();return {reviewId:rid,revision:candidate.REVISION+1,decision:value.decision};
  }catch(e){await c.rollback();if(e.errorNum===30006)throw fail(409,'This batch is busy. Try again shortly.');throw e;}
 });},
 };}
function registerPeoplePhotos(router,db,route){
 const boundedDb=(user,fn)=>db(user,async c=>{const prior=c.callTimeout;c.callTimeout=15000;try{await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');return await fn(c);}finally{c.callTimeout=prior;}});
 const photos=createPeoplePhotos(boundedDb);
 router.get('/batches/:id/people-photos',route(async(req,res)=>res.json(await photos.read(req.demoUser,req.params.id))));
 router.post('/batches/:id/items/:itemId/photo-comparisons',route(async(req,res)=>res.json(await photos.compare(req.demoUser,req.params.id,req.params.itemId,req.body))));
 router.get('/batches/:id/people-photos/:searchId/crop',route(async(req,res)=>res.set('Cache-Control','no-store').type('png').send(await photos.crop(req.demoUser,req.params.id,req.params.searchId))));
 router.get('/batches/:id/photo-candidates/:candidateId/reviews',route(async(req,res)=>res.json({reviews:await photos.history(req.demoUser,req.params.id,req.params.candidateId)})));
 router.post('/batches/:id/photo-candidates/:candidateId/reviews',route(async(req,res)=>res.json(await photos.review(req.demoUser,req.params.id,req.params.candidateId,req.body))));
 return photos;
}
module.exports={VERSION,LIMITS,validateReview,staleReason,catalogueFingerprint,photoCapability,createPeoplePhotos,registerPeoplePhotos};
