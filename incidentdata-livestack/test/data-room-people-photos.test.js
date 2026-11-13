'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {VERSION,validateReview,staleReason,createPeoplePhotos,photoCapability}=require('../backend/data-room-people-photos');
const {hash}=require('../backend/data-room-archive');
const embed={IMAGE_MODEL:'test-model',IMAGE_DIMENSIONS:2};
test('review requires an explicit decision, reason and optimistic revision',()=>{
 assert.deepEqual(validateReview({decision:'accepted_demo',reason:'  Inspected fictional scene.  ',expectedRevision:0}),{decision:'accepted_demo',reason:'Inspected fictional scene.',expectedRevision:0});
 for(const body of [null,[],{},{decision:'confirmed_identity',reason:'Checked',expectedRevision:0},{decision:'pending',reason:'x',expectedRevision:0},{decision:'uncertain',reason:'A reason',expectedRevision:'1'},{decision:'rejected',reason:'x'.repeat(1001),expectedRevision:0}])assert.throws(()=>validateReview(body),e=>e.status===400);
});
test('source, catalogue and model changes disable review of historic comparisons',()=>{
 const saved={VERSION,SOURCE_SHA256:'sha',CATALOGUE_FINGERPRINT:'fp',RESULT_JSON:JSON.stringify({model:embed.IMAGE_MODEL,dimensions:2})};
 assert.equal(staleReason(saved,'sha','fp',embed),null);
 assert.match(staleReason(saved,'changed','fp',embed),/source changed/);
 assert.match(staleReason(saved,'sha','new',embed),/catalogue/);
 assert.match(staleReason({...saved,VERSION:'older'},'sha','fp',embed),/older/);
 assert.match(staleReason(saved,'sha','fp',{...embed,IMAGE_MODEL:'next-model'}),/model changed/);
});
test('read-only and hidden sources cannot start saved comparisons',async()=>{
 let searches=0,queries=0;const service=createPeoplePhotos(async(u,fn)=>fn({execute:async()=>{queries++;return {rows:[]};}}),embed,async()=>{searches++;});
 await assert.rejects(()=>service.compare('read_only_viewer','B','I',{}),e=>e.status===403);assert.equal(queries,0);
 await assert.rejects(()=>service.compare('analyst','B','I',{}),e=>e.status===404);assert.equal(searches,0);
 await assert.rejects(()=>service.review('read_only_viewer','B','I',{}),e=>e.status===403);
});
function fixture({failInsert=false,existing=false,changed=false}={}){
 const sql=[],crop=Buffer.from('controlled test crop'),sha=hash('source'),reference=hash('portrait');let commits=0,rollbacks=0,calls=0;
 const c={commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},execute:async(query,b)=>{sql.push({query,b});
  if(query.startsWith('SELECT status'))return {rows:[{STATUS:'ready'}]};
  if(query.startsWith('SELECT p.person_ref,e.asset_ref'))return {rows:[]};
  if(query.startsWith('SELECT item_id,original_path'))return {rows:[{ITEM_ID:'I',SHA256:changed?'changed':sha}]};
  if(query.startsWith('SELECT search_id FROM'))return {rows:existing?[{SEARCH_ID:'existing'}]:[]};
  if(query.startsWith('SELECT COUNT(*)'))return {rows:[{N:0}]};
  if(query.startsWith('INSERT INTO cdr_photo_candidates')&&failInsert)throw Error('Injected failure');
  if(query.startsWith('INSERT'))return {rowsAffected:1};throw Error('Unexpected query: '+query);
 }};
 const service=createPeoplePhotos(async(user,fn)=>fn(c),embed,async(user,batch,item,body)=>{calls++;assert.deepEqual(Object.keys(body).sort(),['mode','region']);assert.equal(body.mode,'visual');return {sourceSha256:sha,cropDataUrl:'data:image/png;base64,'+crop.toString('base64'),query:{cropSha256:hash(crop),region:{left:1,top:1,width:24,height:24}},model:embed.IMAGE_MODEL,dimensions:2,candidates:[{person_ref:'POI-TEST',score:.25,asset_ref:'REF',asset_sha256:reference}]};});
 return {service,sql,counters:()=>({commits,rollbacks,calls})};
}
test('saved candidates use only server results, stay pending, and deduplicate exact comparisons',async()=>{
 const f=fixture();await f.service.compare('analyst','B','I',{region:{x:0,y:0,width:1,height:1},score:1,decision:'accepted_demo',person_ref:'FORGED'});
 const insert=f.sql.find(s=>s.query.startsWith('INSERT INTO cdr_photo_candidates'));assert.equal(insert.b.score,.25);assert.equal(insert.b.ref,'POI-TEST');assert(!f.sql.some(s=>s.query.includes('INSERT INTO cdr_photo_reviews')));assert.equal(f.counters().commits,1);
 const duplicate=fixture({existing:true});assert.equal((await duplicate.service.compare('analyst','B','I',{})).reused,true);assert(!duplicate.sql.some(s=>s.query.startsWith('INSERT')));
});
test('failed persistence and changed sources leave no partial saved comparison',async()=>{
 for(const options of [{failInsert:true},{changed:true}]){const f=fixture(options);await assert.rejects(()=>f.service.compare('analyst','B','I',{}));assert.equal(f.counters().commits,0);assert.equal(f.counters().rollbacks,1);}
});
test('photo discovery counts inventory without inference or loading source BLOBs',async()=>{
 const sql=[],c={execute:async q=>{sql.push(q);if(q.includes('COUNT(*) candidates'))return {rows:[{CANDIDATES:0,PENDING:null,ACCEPTED:null}]};return {rows:[]};}};
 const result=await photoCapability(c,'B',[{ITEM_ID:'I',CONTENT_TYPE:'png',ORIGINAL_PATH:'scene.png',SHA256:'sha',BYTE_COUNT:42}],'ready');
 assert.equal(result.available,true);assert.equal(result.counts.photos,1);assert.equal(result.counts.regions,0);assert.equal(result.status,'ready');assert(sql.every(q=>q.startsWith('SELECT')&&!q.includes('GRAPH_TABLE')&&!q.includes('content_blob')));
});
