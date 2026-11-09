'use strict';
const o=require('oracledb'),embed=require('./embeddings');
async function catalogue(c,models=embed){
 const r=await c.execute(`SELECT p.person_ref,p.display_name,p.alias_name,p.portrait_asset_uri,p.portrait_alt_text,
  CASE WHEN EXISTS(SELECT 1 FROM person_narrative_embeddings n WHERE n.person_id=p.person_id AND n.embedding_model=:textModel AND VECTOR_DIMENSION_COUNT(n.embedding)=:textDims) THEN 1 ELSE 0 END narrative_ready,
  CASE WHEN EXISTS(SELECT 1 FROM person_visual_embeddings v WHERE v.person_id=p.person_id AND v.asset_kind='reference_portrait' AND v.embedding_model=:imageModel AND VECTOR_DIMENSION_COUNT(v.embedding)=:imageDims) THEN 1 ELSE 0 END visual_ready
  FROM secure_persons_of_interest_v p ORDER BY p.person_ref`,{textModel:models.NARRATIVE_MODEL,textDims:models.NARRATIVE_DIMENSIONS,imageModel:models.IMAGE_MODEL,imageDims:models.IMAGE_DIMENSIONS},{outFormat:o.OUT_FORMAT_OBJECT});
 return r.rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k.toLowerCase(),v])));
}
function coverage(profiles){return {registered:profiles.length,narrativeReady:profiles.filter(p=>p.narrative_ready===1).length,visualReady:profiles.filter(p=>p.visual_ready===1).length,profiles};}
function explicitMentions(text,profiles){
 const result=[];
 for(const p of profiles){
  const full=String(p.display_name||'').trim(),alias=String(p.alias_name||'').trim();
  const variants=[...new Set([full,alias].filter(s=>s.length>=3))].sort((a,b)=>b.length-a.length);
  const quotes=[];
  for(const term of variants){
   const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   const pattern=new RegExp('(?<![\\p{L}\\p{N}_])'+escaped+'(?![\\p{L}\\p{N}_])','giu');
   for(const m of text.matchAll(pattern)){
    if(quotes.some(q=>m.index>=q.startCharacter&&m.index<q.endCharacter)||quotes.length>=8)continue;
    const ambiguous=profiles.filter(other=>[other.display_name,other.alias_name].some(n=>String(n||'').toLowerCase()===term.toLowerCase())).length>1;
    quotes.push({quote:m[0],startCharacter:m.index,endCharacter:m.index+m[0].length,matchType:term===full?'registered_name':'registered_alias',ambiguous});
   }
  }
  if(quotes.length)result.push({person_ref:p.person_ref,display_name:p.display_name,portrait_asset_uri:p.portrait_asset_uri,quotes,basis:'literal_original_text_not_identity_verification'});
 }
 return result;
}
module.exports={catalogue,coverage,explicitMentions};
