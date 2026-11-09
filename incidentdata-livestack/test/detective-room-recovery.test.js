'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{validateRecovery}=require('../backend/detective-room-recovery');
function fixture(){const context={owner:'statewide_admin',batchId:'batch',fingerprint:'fingerprint',engine:'test'};return {job:{...context},previous:{...context,state:'FAILED'},failure:{stage:'Checking room controls, evidence links and mobile layouts'},verification:{batch_id:'batch',archive_sha256:'archive'},archiveSHA256:'archive',normal:{texts:[{sourceId:'S001',path:'source.txt',text:'Alice proposed a meeting.'}],photos:[]},analysis:{facts:[{id:'F1',sourceId:'S001',path:'source.txt',start:0,quote:'Alice proposed a meeting.',anchors:[{id:'S001-U0',start:0,quote:'Alice proposed a meeting.'}]}],people:[{name:'Alice',source:'source.txt',start:0,quote:'Alice proposed a meeting.'}],images:[],overview:[{factIds:['F1']}],questions:[{factIds:['F1']}],scenes:[{factIds:['F1']}],narrationMode:'source-grounded-template'}};}
test('operator recovery revalidates saved exact source quotes and references',()=>{const f=fixture();assert.equal(validateRecovery(f),f.analysis);});
test('annotation changes permit reuse only when the original analysis fingerprint still matches',()=>{
 const f=fixture();f.analysisFingerprint=f.previous.fingerprint;f.job.fingerprint='updated scenario annotations';assert.equal(validateRecovery(f),f.analysis);
 f.analysisFingerprint='different original evidence';assert.throws(()=>validateRecovery(f));
});
test('changed ownership, source fingerprint, archive or failure stage blocks reuse',()=>{for(const key of ['owner','batchId','fingerprint','engine']){const f=fixture();f.previous[key]='different';assert.throws(()=>validateRecovery(f));}for(const key of ['archiveSHA256','failure']){const f=fixture();if(key==='failure')f.failure.stage='Reading a source';else f[key]='different';assert.throws(()=>validateRecovery(f));}});
test('changed passages, name mentions, image bindings and fact references fail closed',()=>{
 for(const mutate of [f=>f.analysis.facts[0].anchors[0].start++,f=>f.analysis.people[0].name='Bob',f=>f.analysis.scenes[0].factIds=['F999'],f=>f.analysis.images=[{path:'foreign.png',sourceId:'S999'}]]){const f=fixture();mutate(f);assert.throws(()=>validateRecovery(f));}
});
