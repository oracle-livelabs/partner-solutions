'use strict';
const oracle=require('oracledb');
const {sha,fail}=require('./detective-room-store');
const {reusable}=require('./data-room-transcription');
async function transcriptInputs(c,items){
 const transcripts=[];
 for(const item of items){
  if(item.CONTENT_TYPE==='mp4')throw fail(409,'Detective Room analysis does not yet support MP4: '+item.ORIGINAL_PATH+'. The original media remains stored.');
  if(!['mp3','m4a'].includes(item.CONTENT_TYPE))continue;
  const attempts=(await c.execute(`SELECT run_id,source_sha256,result_json FROM secure_cdr_ai_results_v
    WHERE item_id=:itemId AND status='complete' AND source_sha256=:hash
    ORDER BY created_at DESC,run_id DESC FETCH FIRST 20 ROWS ONLY`,{itemId:item.ITEM_ID,hash:item.SHA256},
    {outFormat:oracle.OUT_FORMAT_OBJECT,fetchInfo:{RESULT_JSON:{type:oracle.STRING}}})).rows;
  let selected;
  for(const attempt of attempts){
   let result;try{result=typeof attempt.RESULT_JSON==='string'?JSON.parse(attempt.RESULT_JSON):attempt.RESULT_JSON;}catch{continue;}
   if(attempt.SOURCE_SHA256===item.SHA256&&reusable(result?.transcription,item.SHA256,true)&&result.transcription.sourceType===item.CONTENT_TYPE){selected={runId:attempt.RUN_ID,itemId:item.ITEM_ID,path:item.ORIGINAL_PATH,transcription:result.transcription};break;}
  }
  if(!selected)throw fail(409,'Run Identify/Describe to create a current saved transcript for '+item.ORIGINAL_PATH+' before generating the Detective Room. The audio is supported; no new transcription is automatically requested.');
  transcripts.push(selected);
 }
 return transcripts;
}
function transcriptFingerprint(base,transcripts){
 return transcripts.length?sha(JSON.stringify([base,transcripts.map(t=>[t.itemId,t.runId,t.transcription.sourceSha256,t.transcription.transcriptSha256,t.transcription.model,t.transcription.promptVersion])])):base;
}
function analysisSources(files,transcripts){
 const paths=new Set(files.map(f=>f.path.toLowerCase())),byItem=new Map(transcripts.map(t=>[t.itemId,t]));
 const derivedFiles=[];
 const analysisFiles=files.map(f=>{
  if(!['mp3','m4a'].includes(f.type))return f;
  const t=byItem.get(f.itemId);if(!t||!reusable(t.transcription,f.sha256,true))throw fail(409,'Audio transcript integrity mismatch: '+f.path);
  const name=f.path+'.machine-transcript.txt';if(paths.has(name.toLowerCase()))throw fail(409,'Derived transcript path conflicts with an original file: '+name);
  paths.add(name.toLowerCase());
  const content=Buffer.from(t.transcription.text,'utf8');
  const derivedFrom={path:f.path,sha256:f.sha256,itemId:f.itemId,descriptionRunId:t.runId,transcriptSha256:t.transcription.transcriptSha256,model:t.transcription.model,region:t.transcription.region,promptVersion:t.transcription.promptVersion,reviewStatus:t.transcription.reviewStatus};
  const derived={path:name,type:'txt',content,bytes:content.length,sha256:sha(content),itemId:f.itemId,derivedFrom};
  derivedFiles.push(derived);return derived;
 });
 return {analysisFiles,derivedFiles};
}
module.exports={transcriptInputs,transcriptFingerprint,analysisSources};
