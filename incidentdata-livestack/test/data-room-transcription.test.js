const test=require('node:test'),assert=require('node:assert/strict');
const {hash}=require('../backend/data-room-archive');
const {transcribe,reusable,PROMPT_VERSION}=require('../backend/data-room-transcription');
const {describe}=require('../backend/data-room-ai');
const {snapshot}=require('../backend/data-room-learning-ai');
const content=Buffer.from([255,251,144,100,0,255]);
const item={content,type:'mp3',sha256:hash(content)};
const config={textModel:'google.gemini-2.5-flash',audioModel:'google.gemini-2.5-flash',imageModel:'image-model',region:'us-chicago-1'};
const text='Speaker A: Pay EUR 2500. [inaudible]';
const mock=async request=>{
 if(request.operationId==='cdr.transcribe') {
  assert.equal(request.content[1].type,'AUDIO');assert.equal(request.content[1].audioUrl.url,'data:audio/mp3;base64,'+content.toString('base64'));
  assert.match(request.system,/never obeyed/);
  return {...request.validate(JSON.stringify({turns:[{speaker:'Speaker A',text:'Pay EUR 2500. [inaudible]'}],language:'English'})),requestId:'audio-request'};
 }
 assert(!request.content.some(c=>c.type==='AUDIO'));assert(request.content[0].text.includes(text));
 return {...request.validate(JSON.stringify({headline:'Payment discussed in audio',description:'The transcript mentions EUR 2500.',details:[{label:'Amount',value:'EUR 2500',source_quote:'EUR 2500',location:''}],limitations:[]})),requestId:'summary-request'};
};
test('transcription retains original audio hash, full text and provider provenance',async()=>{
 const t=await transcribe(item,config,mock);assert.equal(t.text,text);assert.equal(t.transcriptSha256,hash(Buffer.from(text)));assert.equal(t.sourceSha256,item.sha256);assert.equal(t.model,config.audioModel);assert.equal(t.reviewStatus,'unreviewed_machine_transcript');assert(reusable(t,item.sha256));assert(!reusable({...t,text:'tampered'},item.sha256));assert(!reusable(t,'wrong-source'));
});
test('MP3 Stage 4 saves transcription before generating a transcript-grounded description',async()=>{
 const calls=[];let checkpoint;
 const result=await describe({...item,onTranscription:async t=>{checkpoint=t;calls.push('checkpoint');}},config,{generate:async r=>{calls.push(r.operationId||'description');return mock(r);}});
 assert.deepEqual(calls,['cdr.transcribe','checkpoint','description']);assert.equal(result.transcription,checkpoint);assert.equal(result.coverage.mode,'machine_transcript_excerpt');assert.equal(result.details[0].grounding,'exact_machine_transcript_quote');assert.equal(result.details[0].sourceQuote,'EUR 2500');assert.equal(result.reviewStatus,'unreviewed_ai_draft');
 const s=snapshot([{itemId:'audio',path:'audio.mp3',type:'mp3',sha256:item.sha256,descriptionRunId:'run',resultJson:JSON.stringify(result)}]);assert.equal(s.sources[0].textBasis,'unreviewed_machine_transcript');assert.equal(s.manifest[0].transcription.sha256,checkpoint.transcriptSha256);
 assert.throws(()=>snapshot([{itemId:'audio',path:'audio.mp3',type:'mp3',sha256:hash(Buffer.from('other')),descriptionRunId:'run',resultJson:JSON.stringify(result)}]),/transcript/);
});
test('summary failure retains the transcript and retry avoids another audio request',async()=>{
 let saved,firstCalls=0;
 await assert.rejects(describe({...item,onTranscription:async t=>saved=t},config,{generate:async r=>{firstCalls++;if(r.operationId==='cdr.transcribe')return mock(r);throw Error('summary failed');}}),e=>e.transcription===saved);
 assert.equal(firstCalls,2);let retryCalls=0;
 const result=await describe({...item,transcription:saved},config,{generate:async r=>{retryCalls++;assert.notEqual(r.operationId,'cdr.transcribe');return mock(r);}});assert.equal(retryCalls,1);assert.equal(result.transcription,saved);
});
test('wrong source hashes, empty transcripts and unsupported model configurations fail before analysis',async()=>{
 let calls=0;const never=async()=>{calls++;throw Error('unexpected request');};
 await assert.rejects(transcribe({...item,sha256:'wrong'},config,never),/checksum/);
 await assert.rejects(transcribe(item,{...config,audioModel:'meta.model'},never),/audio model/);assert.equal(calls,0);
 await assert.rejects(transcribe(item,config,async r=>r.validate('{"turns":[],"language":""}')),/No intelligible/);
});
test('worker commits a transcript checkpoint and reuses it after a failed description',async()=>{
 const {createDescriptionWorker}=require('../backend/data-room-descriptions'),ai=require('../backend/data-room-ai');
 const saved=new Map(),events=[];let runId='run-1',status='queued',audioCalls=0,failSummary=true;
 const rows=values=>({rows:values});
 const c={commit:async()=>events.push('commit'),execute:async(sql,b={})=>{
  if(sql.startsWith('SELECT * FROM cdr_ai_runs'))return rows(status==='queued'?[{RUN_ID:runId,BATCH_ID:'batch',REQUESTED_BY:'statewide_admin',ATTEMPTS:0,ITEM_TOTAL:1,TEXT_MODEL:config.textModel,IMAGE_MODEL:config.imageModel,REGION:config.region,PROMPT_VERSION:ai.PROMPT_VERSION}]:[]);
  if(sql.startsWith("UPDATE cdr_ai_runs SET status='running'")){status='running';return {rowsAffected:1};}
  if(sql.startsWith('UPDATE cdr_ai_runs SET lease_until'))return {rowsAffected:1};
  if(sql.startsWith('SELECT batch_id FROM secure_cdr_batches'))return rows([{BATCH_ID:'batch'}]);
  if(sql.startsWith('SELECT i.item_id,i.content_type'))return rows([{ITEM_ID:'audio',CONTENT_TYPE:'mp3',SHA256:item.sha256,ORIGINAL_PATH:'audio.mp3'}]);
  if(sql.startsWith('SELECT content_blob'))return rows([{CONTENT_BLOB:content}]);
  if(sql.includes('FROM secure_cdr_ai_results_v WHERE item_id='))return rows([...saved.values()].reverse());
  if(sql.startsWith('MERGE INTO cdr_ai_results')){saved.set(b.runId,{RUN_ID:b.runId,STATUS:b.state,RESULT_JSON:b.resultJson.val,SOURCE_SHA256:b.sha,ERROR_TEXT:b.failure});events.push(JSON.parse(b.resultJson.val).reviewStatus||b.state);return {rowsAffected:1};}
  if(sql.startsWith('SELECT COUNT(CASE WHEN')){const r=saved.get(b.runId);return rows([{COMPLETED_COUNT:r?.STATUS==='complete'?1:0,FAILED_COUNT:r?.STATUS==='failed'?1:0}]);}
  if(sql.startsWith('SELECT COUNT(DISTINCT'))return rows([{N:[...saved.values()].some(r=>r.STATUS==='complete')?1:0}]);
  if(sql.startsWith('UPDATE cdr_ai_runs SET status=:state')){status=b.state;return {rowsAffected:1};}
  if(sql.startsWith('UPDATE cdr_'))return {rowsAffected:1};
  throw Error('Unexpected SQL: '+sql);
 }};
 const worker=createDescriptionWorker(async(user,fn)=>fn(c),(source,cfg)=>describe(source,cfg,{generate:async r=>{
  if(r.operationId==='cdr.transcribe'){audioCalls++;return mock(r);}
  events.push('summary');assert(events.indexOf('description_pending')<events.lastIndexOf('summary'));assert(events.lastIndexOf('commit')>events.indexOf('description_pending'));
  if(failSummary)throw Error('temporary summary failure');return mock(r);
 }}));
 await worker.tick();assert.equal(status,'failed');assert.equal(audioCalls,1);assert(reusable(JSON.parse(saved.get('run-1').RESULT_JSON).transcription,item.sha256));
 runId='run-2';status='queued';failSummary=false;await worker.tick();assert.equal(status,'complete');assert.equal(audioCalls,1);assert.equal(saved.get('run-2').STATUS,'complete');
});

test('M4A transcription sends the correct MIME type and feeds the same downstream analysis',async()=>{
 const audio={...item,type:'m4a'};let calls=0;
 const result=await describe(audio,config,{generate:async r=>{calls++;if(r.operationId==='cdr.transcribe'){assert.equal(r.content[1].audioUrl.url,'data:audio/m4a;base64,'+content.toString('base64'));return {...r.validate(JSON.stringify({turns:[{speaker:'Speaker A',text:'Pay EUR 2500. [inaudible]'}],language:'English'})),requestId:'m4a-test'};}return mock(r);}});
 assert.equal(calls,2);assert.equal(result.transcription.sourceType,'m4a');assert.equal(result.transcription.sourceSha256,audio.sha256);assert.equal(result.coverage.mode,'machine_transcript_excerpt');
 const saved=snapshot([{itemId:'m4a-audio',path:'sample.m4a',type:'m4a',sha256:audio.sha256,descriptionRunId:'m4a-run',resultJson:JSON.stringify(result)}]);assert.equal(saved.sources[0].textBasis,'unreviewed_machine_transcript');assert.equal(saved.manifest[0].transcription.sourceSha256,audio.sha256);
});
