'use strict';
const o=require('oracledb'),transcription=require('./data-room-transcription');
async function attachTranscripts(c,batchId,items){
 if(!items.some(i=>['mp3','m4a'].includes(i.CONTENT_TYPE)))return items;
 const result=await c.execute(`SELECT item_id,run_id,result_json FROM (
  SELECT i.item_id,r.run_id,r.result_json,ROW_NUMBER() OVER(PARTITION BY i.item_id ORDER BY r.created_at DESC,r.run_id DESC) rn
  FROM secure_cdr_ai_results_v r JOIN secure_cdr_items_v i ON i.item_id=r.item_id
  WHERE i.batch_id=:id AND i.content_type IN ('mp3','m4a') AND JSON_VALUE(r.result_json,'$.transcription.reviewStatus')='unreviewed_machine_transcript') WHERE rn=1`,{id:batchId},{outFormat:o.OUT_FORMAT_OBJECT,fetchInfo:{RESULT_JSON:{type:o.STRING}}});
 const saved=new Map(result.rows.map(r=>[r.ITEM_ID,r]));
 return items.map(item=>{const record=saved.get(item.ITEM_ID),t=record?JSON.parse(record.RESULT_JSON).transcription:null;
  return t&&transcription.reusable(t,item.SHA256)?{...item,TRANSCRIPT:t,TRANSCRIPT_RUN_ID:record.RUN_ID}:item;
 });
}
function sourceIdentity(item){return [item.ITEM_ID,item.SHA256,...(['mp3','m4a'].includes(item.CONTENT_TYPE)?[item.TRANSCRIPT?.transcriptSha256||null,item.TRANSCRIPT?.promptVersion||null]:[])];}
module.exports={attachTranscripts,sourceIdentity};
