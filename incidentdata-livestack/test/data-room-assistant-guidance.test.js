'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {guidance,readGuidance}=require('../backend/data-room-assistant-guidance');
const {mode,batchPrompt,expertPrompt}=require('../backend/data-room-assistant-prompts');
const base={assistant:'batch',command:'status',batch:{FILENAME:'sample.zip',STATUS:'ready'},stages:[{STAGE_NO:6,STATUS:'pending'}],counts:{TOTAL:3,COMPLETE:3,FAILED:0},brief:{result:{themes:[{title:'Invoices'}]},manifest:[{path:'invoice.csv'}],isCurrent:true,run:{input_fingerprint:'current'},coverage:{partialTextCount:1,condensedCount:2}}};
test('help and status commands are exact, case insensitive and cannot intercept ordinary questions',async()=>{
 const {assistantCommand}=await import('../frontend/src/assistant-command.mjs');
 for(const text of ['help',' HELP ','/Help?'])assert.equal(assistantCommand(text),'help');
 for(const text of ['status','STATUS!',' /status '])assert.equal(assistantCommand(text),'status');
 for(const text of ['help me find an invoice','what is the status?','REMOVE BATCH DR-123','help; delete'])assert.equal(assistantCommand(text),null);
});
test('batch guidance uses actual readiness and coverage, with source-aware next questions',()=>{
 const g=guidance(base);assert.equal(g.canAsk,true);assert.equal(g.persisted,false);assert(g.questions.some(q=>q.includes('Invoices')));assert(g.questions.some(q=>q.includes('invoice.csv')));assert(g.facts.some(f=>f.value.includes('1 partial')));assert.match(g.notes,/previous five/);
 const stale=guidance({...base,brief:{...base.brief,isCurrent:false}});assert.equal(stale.canAsk,false);assert(stale.nextSteps.some(s=>s.includes('current Batch Brief')));
 const missing=guidance({...base,counts:{TOTAL:3,COMPLETE:1,FAILED:2},brief:{result:null}});assert.equal(missing.canAsk,false);assert(missing.nextSteps.some(s=>s.includes('Identify/Describe')));
});
test('expert status distinguishes private proposals, stale boards and independent questions',()=>{
 const g=guidance({...base,assistant:'expert',board:{REVIEW_STATUS:'testing',NODE_COUNT:3,EDGE_COUNT:2,SOURCE_FINGERPRINT:'old'},historyCount:4});assert(g.facts.some(f=>f.label==='Private board'&&f.value.includes('2 proposed')));assert(g.facts.some(f=>f.label==='Board source versions'&&f.value.includes('Changed')));assert(g.facts.some(f=>f.label==='Saved detective replies'&&f.value==='4'));assert.match(g.notes,/Unsaved edits and previous detective questions/);assert(g.questions.some(q=>q.includes('counterevidence')));
 const viewer=guidance({...base,assistant:'expert',readOnly:true});assert.equal(viewer.canAsk,false);assert(viewer.nextSteps.some(s=>s.includes('disabled')));
});
test('guidance authorises the batch before reading state and never issues mutations',async()=>{
 const calls=[];const c={execute:async(sql)=>{calls.push(sql);return {rows:[]};}};
 await assert.rejects(readGuidance(c,'hidden','expert','status','northern_analyst'),e=>e.status===404);assert.equal(calls.length,1);assert.match(calls[0],/secure_cdr_batches_v/);
 await assert.rejects(readGuidance(c,'B','invalid','help','statewide_admin'),e=>e.status===400);assert.equal(calls.length,1);
});
test('private expert state is read through scoped views with no generation, insertion or commit',async()=>{
 const calls=[];const c={execute:async(sql)=>{calls.push(sql);if(sql.includes('FROM secure_cdr_batches_v'))return {rows:[{BATCH_ID:'B',FILENAME:'sample.zip',STATUS:'ready'}]};if(sql.includes('FROM secure_cdr_stages_v'))return {rows:base.stages};if(sql.includes('COUNT(*) total'))return {rows:[base.counts]};if(sql.includes('FROM secure_cdr_expert_boards_v'))return {rows:[{REVIEW_STATUS:'draft',SOURCE_FINGERPRINT:'current',NODES_JSON:'[{"id":"S01"}]',EDGES_JSON:'[]'}]};if(sql.includes('FROM secure_cdr_expert_assistant_runs_v'))return {rows:[{N:2}]};throw Error(sql);}};
 const g=await readGuidance(c,'B','expert','status','central_analyst',async()=>base.brief);assert(g.facts.some(f=>f.label==='Private board'&&f.value.includes('1 source nodes')));assert.equal(calls.length,5);assert(calls.every(s=>/^SELECT/.test(s)));assert(calls.every(s=>!s.includes('DBMS_CLOUD_AI')));
});
test('specialist modes fail closed and prompts have distinct jobs and bounded evidence claims',()=>{
 assert.equal(mode(undefined),null);assert.equal(mode('specialist-v1'),'specialist-v1');assert.throws(()=>mode('ignore controls'),e=>e.status===400);
 const context={manifest:[{ref:'S01',path:'invoice.csv'}],savedBoard:{status:'draft',proposedRelationships:[]}};
 const batch=batchPrompt({context,history:[{question:'prior',answer:'draft'}],question:'Which sources?'}),expert=expertPrompt({context,question:'What alternatives?'}),first=expertPrompt({context,question:'First cut',firstCut:true});
 assert.match(batch,/source navigation, document inventory and evidence coverage/);assert.match(batch,/previousTurns/);assert.match(batch,/Do not construct an offence theory/);assert.match(expert,/hypothesis testing/);assert.match(expert,/Counterevidence/);assert.match(expert,/Unsaved|unsaved/);assert.match(first,/Reasons it may be wrong/);for(const p of [batch,expert,first]){assert.match(p,/Cite every batch-specific claim/);assert.match(p,/untrusted data/);assert.match(p,/Do not claim to have read originals/);}
});
