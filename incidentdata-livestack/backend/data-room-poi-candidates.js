'use strict';
const o=require('oracledb');
const sharp=require('sharp');
const embeddings=require('./embeddings');
const ops=require('./ai-ops-telemetry');
const {hash}=require('./data-room-archive');
const {catalogue,coverage,explicitMentions}=require('./poi-catalogue');
const fail=(status,message)=>Object.assign(Error(message),{status});
const rows=async(c,sql,binds={},options={})=>(await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT,...options})).rows;
function bounds(box,width,height){
 if(!box||!['x','y','width','height'].every(k=>typeof box[k]==='number'&&Number.isFinite(box[k]))||box.x<0||box.y<0||box.width<=0||box.height<=0||box.x+box.width>1.000001||box.y+box.height>1.000001)throw fail(400,'Select a region inside the image.');
 const left=Math.floor(box.x*width),top=Math.floor(box.y*height),right=Math.min(width,Math.ceil((box.x+box.width)*width)),bottom=Math.min(height,Math.ceil((box.y+box.height)*height));
 if(right-left<24||bottom-top<24)throw fail(400,'Select a region at least 24 pixels wide and high.');
 return {left,top,width:right-left,height:bottom-top};
}
function createCandidates(db,embed=embeddings){
 let active=0;
 return async function search(user,batchId,itemId,body={}){
  if(user==='read_only_viewer')throw fail(403,'This demo user cannot run POI candidate searches.');
  if(!['narrative','visual'].includes(body.mode))throw fail(400,'Choose narrative or visual search.');
  if(active>=2)throw fail(429,'Two POI searches are already running. Please try again shortly.');
  active++;
  try{
   const item=await db(user,async c=>(await rows(c,'SELECT item_id,original_path,content_type,sha256,content_blob FROM secure_cdr_items_v WHERE batch_id=:id AND item_id=:itemId',{id:batchId,itemId},{fetchInfo:{CONTENT_BLOB:{type:o.BUFFER}}}))[0]);
   if(!item)throw fail(404,'Source item not found in your batch scope.');
   if(hash(item.CONTENT_BLOB)!==item.SHA256)throw fail(409,'Source checksum mismatch.');
   const started=Date.now(),image=['png','jpg'].includes(item.CONTENT_TYPE);
   let vector,query,cropDataUrl,model,dimensions,mentionText=null,originalCharacters=0;
   if(body.mode==='visual'){
    if(!image)throw fail(400,'Select a PNG or JPEG scene.');
    if(item.CONTENT_BLOB.length>5*1024*1024)throw fail(400,'Visual comparison supports images up to 5 MiB.');
    const original=sharp(item.CONTENT_BLOB,{limitInputPixels:25000000}).rotate();
    // Apply EXIF orientation before interpreting the browser's displayed bounds.
    const normalized=await original.png().toBuffer({resolveWithObject:true});
    const region=bounds(body.region,normalized.info.width,normalized.info.height);
    const crop=await sharp(normalized.data).extract(region).resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).png().toBuffer();
    model=embed.IMAGE_MODEL;dimensions=embed.IMAGE_DIMENSIONS;
    vector=await ops.context({actor:user,area:'Crime Data Room',batchId,sourceId:itemId,sourceLabel:item.ORIGINAL_PATH},()=>embed.embedImage(new Blob([crop],{type:'image/png'})));
    cropDataUrl='data:image/png;base64,'+crop.toString('base64');
    query={basis:'manual_scene_region',region,coordinateSystem:'EXIF-oriented source pixels; left/top inclusive; width/height',imageWidth:normalized.info.width,imageHeight:normalized.info.height,cropSha256:hash(crop)};
   }else{
    let text,descriptionRunId=null;
    if(image){
     const saved=await db(user,async c=>(await rows(c,`SELECT run_id,result_json FROM secure_cdr_ai_results_v WHERE item_id=:itemId AND status='complete' AND source_sha256=:sha ORDER BY created_at DESC FETCH FIRST 1 ROW ONLY`,{itemId,sha:item.SHA256},{fetchInfo:{RESULT_JSON:{type:o.STRING}}}))[0]);
     if(!saved)throw fail(409,'Describe this image before searching its narrative.');
     const result=JSON.parse(saved.RESULT_JSON);text=`${result.headline}\n${result.description}`;descriptionRunId=saved.RUN_ID;
    }else {text=new TextDecoder('utf-8',{fatal:true}).decode(item.CONTENT_BLOB);mentionText=text.slice(0,24000);originalCharacters=text.length;}
    const excerpt=text.slice(0,1500);
    if(!excerpt.trim())throw fail(400,'The selected source has no searchable text.');
    query={basis:image?'saved_unreviewed_image_description':'original_text_excerpt',excerpt,startCharacter:0,endCharacter:excerpt.length,totalCharacters:text.length,truncated:text.length>excerpt.length,descriptionRunId,coverageNotice:'First 1,500 characters at most; the embedding tokenizer may truncate further. Similar topics do not establish a mention or identity.'};
    model=embed.NARRATIVE_MODEL;dimensions=embed.NARRATIVE_DIMENSIONS;vector=await ops.context({actor:user,area:'Crime Data Room',batchId,sourceId:itemId,sourceLabel:item.ORIGINAL_PATH},()=>embed.embedNarrative(excerpt));
   }
   if(vector.length!==dimensions||vector.some(v=>!Number.isFinite(v)))throw Error('Invalid query embedding.');
   const table=body.mode==='visual'?'person_visual_embeddings':'person_narrative_embeddings';
   // Both endpoints recheck source scope after inference. POIs always use DDS scope.
   const {candidates,profiles}=await db(user,async c=>{
    if(!(await rows(c,'SELECT item_id FROM secure_cdr_items_v WHERE batch_id=:id AND item_id=:itemId AND sha256=:sha',{id:batchId,itemId,sha:item.SHA256})).length)throw fail(404,'Source is no longer available in your scope.');
    const profiles=await catalogue(c,embed);
    const candidates=await rows(c,`SELECT * FROM (SELECT p.person_ref,p.display_name,p.portrait_asset_uri,p.portrait_alt_text,p.narrative_summary,
      ${body.mode==='visual'?'e.asset_ref,e.asset_sha256':'e.source_sha256'},e.embedding_model,
      1-VECTOR_DISTANCE(e.embedding,TO_VECTOR(:vector),COSINE) score,
      ROW_NUMBER() OVER(PARTITION BY p.person_id ORDER BY VECTOR_DISTANCE(e.embedding,TO_VECTOR(:vector),COSINE)) candidate_rank
      FROM ${table} e JOIN secure_persons_of_interest_v p ON p.person_id=e.person_id
      WHERE e.embedding_model=:model AND VECTOR_DIMENSION_COUNT(e.embedding)=:dimensions ${body.mode==='visual'?"AND e.asset_kind='reference_portrait'":''})
      WHERE candidate_rank=1 ORDER BY score DESC,person_ref FETCH FIRST 3 ROWS ONLY`,{vector:embed.vectorLiteral(vector),model,dimensions});
    return {candidates,profiles};
   });
   return {version:'cdr-poi-candidates-v2',batchId,itemId,path:item.ORIGINAL_PATH,sourceSha256:item.SHA256,mode:body.mode,query,cropDataUrl,model,dimensions,catalogue:coverage(profiles),explicitMentions:mentionText===null?[]:explicitMentions(mentionText,profiles),mentionCoverage:{basis:mentionText===null?'not_scanned_no_original_text':'original_text',charactersScanned:mentionText?.length||0,totalCharacters:originalCharacters,truncated:originalCharacters>(mentionText?.length||0)},elapsedMs:Date.now()-started,createdAt:new Date().toISOString(),candidates:candidates.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k.toLowerCase(),v]))),status:'unreviewed_candidates',notice:'Ranked similarity only—not identity confidence or a connection. Literal names/aliases are reported separately and do not verify identities. No graph links or POI records were changed. Results are session-only; download to retain them.'};
  }finally{active--;}
 };
}
function registerCandidates(router,db,route){
 const search=createCandidates(db);
 router.get('/batches/:id/poi-catalogue',route(async(req,res)=>res.json(await db(req.demoUser,async c=>{
  if(!(await rows(c,'SELECT batch_id FROM secure_cdr_batches_v WHERE batch_id=:id',{id:req.params.id})).length)throw fail(404,'Batch not found in your scope.');
  return coverage(await catalogue(c));
 }))));
 router.post('/batches/:id/items/:itemId/poi-candidates',route(async(req,res)=>res.json(await search(req.demoUser,req.params.id,req.params.itemId,req.body))));
}
module.exports={bounds,createCandidates,registerCandidates};
