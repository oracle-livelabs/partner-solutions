'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {sha}=require('../backend/detective-room-store');
const {transcriptInputs,transcriptFingerprint,analysisSources}=require('../backend/detective-room-transcripts');
const {normalize}=require('../backend/detective-room-normalize');
const audio={ITEM_ID:'audio-1',ORIGINAL_PATH:'pack/audio.mp3',CONTENT_TYPE:'mp3',SHA256:sha(Buffer.from('audio'))};
function transcript(){const text='Speaker A: This is a training conversation.';return{sourceType:'mp3',sourceSha256:audio.SHA256,promptVersion:'cdr-transcribe-v2',reviewStatus:'unreviewed_machine_transcript',text,transcriptSha256:sha(Buffer.from(text)),model:'google.gemini-2.5-flash',turns:[{speaker:'Speaker A',text:'This is a training conversation.',start:11,end:text.length}]};}
const c=values=>({execute:async(sql,binds)=>{assert.match(sql,/secure_cdr_ai_results_v/);assert.equal(binds.itemId,'audio-1');return{rows:values.map(t=>({RUN_ID:'saved-run',SOURCE_SHA256:audio.SHA256,RESULT_JSON:JSON.stringify({transcription:t})}))};}});
test('audio preparation uses the checksum-matched saved transcript without transcription calls',async()=>{
 const inputs=await transcriptInputs(c([transcript()]),[audio]);assert.equal(inputs.length,1);assert.equal(inputs[0].runId,'saved-run');
 const original={path:audio.ORIGINAL_PATH,type:'mp3',content:Buffer.from('audio'),bytes:5,sha256:audio.SHA256,itemId:audio.ITEM_ID};
 const {analysisFiles,derivedFiles}=analysisSources([original],inputs);
 assert.equal(original.type,'mp3');assert.equal(original.content.toString(),'audio');assert.equal(derivedFiles.length,1);
 assert.equal(derivedFiles[0].derivedFrom.path,original.path);assert.equal(derivedFiles[0].sha256,transcript().transcriptSha256);
 const n=normalize(analysisFiles);assert.equal(n.texts[0].text,transcript().text);assert.equal(n.coverage[0].mode,'machine-transcript');assert.equal(n.messages.length,0);
});
test('missing, stale, tampered and non-neutral transcripts stop before model authoring',async()=>{
 for(const t of [null,{...transcript(),sourceSha256:'wrong'},{...transcript(),text:'tampered'},{...transcript(),turns:[{speaker:'Chris',text:'This is a training conversation.',start:11,end:42}]},{...transcript(),promptVersion:'cdr-transcribe-v1'}])await assert.rejects(transcriptInputs(c([t]),[audio]),e=>e.status===409&&/Identify\/Describe/.test(e.message));
});
test('raw media is never decoded as UTF-8 and unsupported MP4 is explicit',async()=>{
 assert.throws(()=>normalize([{path:'audio.mp3',type:'mp3',content:Buffer.from([255]),bytes:1}]),/saved transcript/);
 await assert.rejects(transcriptInputs(c([]),[{...audio,CONTENT_TYPE:'mp4'}]),/does not yet support MP4/);
});
test('derived transcript cannot overwrite an original and transcript changes invalidate the job fingerprint',()=>{
 const t={itemId:audio.ITEM_ID,runId:'r1',path:audio.ORIGINAL_PATH,transcription:transcript()};
 const f={path:audio.ORIGINAL_PATH,type:'mp3',itemId:audio.ITEM_ID,sha256:audio.SHA256};
 assert.throws(()=>analysisSources([f,{path:f.path+'.machine-transcript.txt',type:'txt'}],[t]),/conflicts/);
 assert.equal(transcriptFingerprint('base',[]),'base');
 assert.notEqual(transcriptFingerprint('base',[t]),transcriptFingerprint('base',[{...t,runId:'r2'}]));
});
