const test=require('node:test'),assert=require('node:assert/strict');
const sharp=require('sharp');
const {bounds,createCandidates}=require('../backend/data-room-poi-candidates');
const {hash}=require('../backend/data-room-archive');
function fixture({hidden=false,changed=false,content=Buffer.from('A folder and financial records.'),type='txt',corrupt=false}={}){
 const queries=[],calls=[];
 const db=async(user,fn)=>fn({execute:async(sql,b)=>{
  queries.push({sql,b,user});
  if(sql.startsWith('SELECT item_id,original_path'))return {rows:hidden?[]:[{ITEM_ID:'I',ORIGINAL_PATH:'test.'+type,CONTENT_TYPE:type,SHA256:corrupt?'bad':hash(content),CONTENT_BLOB:content}]};
  if(sql.startsWith('SELECT run_id,result_json'))return {rows:[{RUN_ID:'D',RESULT_JSON:JSON.stringify({headline:'A scene',description:'Two people at a table.'})}]};
  if(sql.startsWith('SELECT item_id FROM'))return {rows:changed?[]:[{ITEM_ID:'I'}]};
  if(sql.startsWith('SELECT p.person_ref'))return {rows:[{PERSON_REF:'POI-TEST',DISPLAY_NAME:'Synthetic Test',ALIAS_NAME:'Test Alias',NARRATIVE_READY:1,VISUAL_READY:1}]};
  if(sql.startsWith('SELECT * FROM'))return {rows:[{PERSON_REF:'POI-TEST',DISPLAY_NAME:'Synthetic Test',SCORE:0.4}]};
  throw Error('Unexpected SQL');
 }});
 const embed={IMAGE_MODEL:'image-v1',NARRATIVE_MODEL:'text-v1',IMAGE_DIMENSIONS:2,NARRATIVE_DIMENSIONS:2,vectorLiteral:JSON.stringify,embedImage:async v=>{calls.push(v);return [1,0];},embedNarrative:async v=>{calls.push(v);return [1,0];}};
 return {search:createCandidates(db,embed),queries,calls};
}
test('region geometry rejects out-of-frame, nonnumeric and tiny crops',()=>{
 assert.deepEqual(bounds({x:0.1,y:0.2,width:0.4,height:0.5},100,100),{left:10,top:20,width:40,height:50});
 for(const b of [null,{x:-1,y:0,width:1,height:1},{x:0.9,y:0,width:0.2,height:1},{x:0,y:0,width:0.01,height:1},{x:'0',y:0,width:1,height:1}])assert.throws(()=>bounds(b,100,100),e=>e.status===400);
});
test('scope, read-only and checksums are checked before inference',async()=>{
 for(const [options,user,status] of [[{hidden:true},'analyst',404],[{},'read_only_viewer',403],[{corrupt:true},'analyst',409]]){
  const f=fixture(options);await assert.rejects(()=>f.search(user,'B','I',{mode:'narrative'}),e=>e.status===status);assert.equal(f.calls.length,0);
 }
});
test('narrative returns bounded source provenance and scoped, compatible POI ranking without writes',async()=>{
 const f=fixture({content:Buffer.from('a'.repeat(1800))}),r=await f.search('analyst','B','I',{mode:'narrative'});
 assert.equal(r.query.excerpt.length,1500);assert.equal(r.query.truncated,true);assert.equal(r.candidates[0].person_ref,'POI-TEST');assert.equal(r.status,'unreviewed_candidates');
 assert(f.queries.every(q=>q.sql.startsWith('SELECT')&&q.user==='analyst'));
 const ranking=f.queries.at(-1);assert.match(ranking.sql,/secure_persons_of_interest_v/);assert.match(ranking.sql,/e.embedding_model=:model/);assert.match(ranking.sql,/VECTOR_DIMENSION_COUNT/);assert.equal(ranking.b.model,'text-v1');assert.equal(ranking.b.dimensions,2);
});
test('source visibility is rechecked after inference',async()=>{
 const f=fixture({changed:true});await assert.rejects(()=>f.search('analyst','B','I',{mode:'narrative'}),e=>e.status===404);assert.equal(f.calls.length,1);
});
test('visual uses server-side crop from the checked original, not client bytes',async()=>{
 const content=await sharp({create:{width:100,height:80,channels:3,background:'#448899'}}).png().toBuffer();
 const f=fixture({content,type:'png'}),r=await f.search('analyst','B','I',{mode:'visual',region:{x:0.1,y:0.1,width:0.5,height:0.5},imageDataUrl:'untrusted client data'});
 assert.deepEqual(r.query.region,{left:10,top:8,width:50,height:40});assert.equal(r.sourceSha256,hash(content));assert.match(r.cropDataUrl,/^data:image\/png;base64,/);assert.match(f.queries.at(-1).sql,/reference_portrait/);
 const cropped=Buffer.from(r.cropDataUrl.split(',')[1],'base64');assert.equal(hash(cropped),r.query.cropSha256);assert.equal((await sharp(cropped).metadata()).width,50);
});
test('image narrative cites the saved description version',async()=>{
 const f=fixture({type:'png'}),r=await f.search('analyst','B','I',{mode:'narrative'});assert.equal(r.query.descriptionRunId,'D');assert.equal(r.query.basis,'saved_unreviewed_image_description');assert.deepEqual(r.explicitMentions,[]);assert.equal(r.mentionCoverage.charactersScanned,0);
});
test('literal mentions use original text beyond semantic excerpt and expose vector coverage',async()=>{
 const f=fixture({content:Buffer.from('x '.repeat(1000)+'Synthetic Test')}),r=await f.search('analyst','B','I',{mode:'narrative'});
 assert.equal(r.explicitMentions[0].quotes[0].quote,'Synthetic Test');assert.equal(r.explicitMentions[0].quotes[0].startCharacter,2000);assert.equal(r.catalogue.registered,1);assert.equal(r.catalogue.narrativeReady,1);
});
