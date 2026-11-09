'use strict';
const o=require('oracledb'),{hash}=require('./data-room-archive');
const VERSION='cdr-people-photos-v1',models={IMAGE_MODEL:process.env.POI_IMAGE_EMBEDDING_MODEL||'Xenova/clip-vit-base-patch32',IMAGE_DIMENSIONS:512};
const rows=async(c,sql,binds={})=>(await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT})).rows;
async function catalogueFingerprint(c,embed=models){
 const refs=await rows(c,`SELECT p.person_ref,e.asset_ref,e.asset_sha256,e.embedding_model,TO_CHAR(e.created_at,'YYYY-MM-DD HH24:MI:SS.FF9') vector_created
 FROM secure_persons_of_interest_v p JOIN person_visual_embeddings e ON e.person_id=p.person_id
 WHERE e.asset_kind='reference_portrait' AND e.embedding_model=:model AND VECTOR_DIMENSION_COUNT(e.embedding)=:dimensions
 ORDER BY p.person_ref,e.asset_ref`,{model:embed.IMAGE_MODEL,dimensions:embed.IMAGE_DIMENSIONS});
 return hash(JSON.stringify([embed.IMAGE_MODEL,embed.IMAGE_DIMENSIONS,refs]));
}
function staleReason(search,sourceSha,fp,embed=models){
 if(search.SOURCE_SHA256!==sourceSha)return 'The original source changed. Compare a new region before reviewing.';
 if(search.VERSION!==VERSION)return 'This comparison uses an older workflow version.';
 if(search.CATALOGUE_FINGERPRINT!==fp)return 'The compatible portrait catalogue or its scope changed. Compare again before reviewing.';
 const snapshot=JSON.parse(search.RESULT_JSON);
 if(snapshot.model!==embed.IMAGE_MODEL||snapshot.dimensions!==embed.IMAGE_DIMENSIONS)return 'The visual embedding model changed. Compare again before reviewing.';
 return null;
}
module.exports={VERSION,catalogueFingerprint,staleReason};
