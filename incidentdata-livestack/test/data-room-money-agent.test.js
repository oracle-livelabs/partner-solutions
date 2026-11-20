'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {request,contextFor,validateAnswer,createMoneyAgent}=require('../backend/data-room-money-agent');
const base={runId:'00000000-0000-0000-0000-000000000000',from:'A',to:'B',currency:'AUD'};
test('pilot binds a saved selection and rejects unbounded or ambiguous inputs',()=>{
 const q=request(base);assert.equal(q.maxHops,4);assert.match(q.question,/selected start/);
 for(const extra of [{runId:'sql'},{from:'B'},{currency:''},{maxHops:5},{question:'x'.repeat(1001)},{question:{}},{from:'x'.repeat(201)},{dateFrom:'2026-09-14',dateTo:'2026-09-01'}])assert.throws(()=>request({...base,...extra}),e=>e.status===400);
});
test('agent context retains exact deterministic amounts, route IDs and source locators',()=>{
 const source={itemId:'i',path:'transfers.csv',record:2,sha256:'checksum'},tx={id:'tx',amount:'9007199254740993.10',date:'2026-09-14',currency:'AUD',from:'A',to:'B',source};
 const data={run:{id:base.runId,version:'cdr-money-v1'},filters:{currency:'AUD'},transfers:[tx],accounts:[{id:'A',labels:['Sender']},{id:'B',labels:['Receiver']}],summary:[{accountCount:2,transferCount:1,currency:'AUD',grossVolume:tx.amount,rootOutflow:tx.amount,sinkInflow:tx.amount,accounts:[]}],sources:[source],skipped:[]};
 const paths={routes:[{id:'route',transferIds:['tx'],hops:1}],truncated:false,maxHops:4};const result=contextFor(data,paths,base);
 assert.equal(result.summary.grossVolume,tx.amount);assert.deepEqual(result.evidence[0].source,source);assert.equal(result.routes.routes[0].id,'route');assert.deepEqual(result.routes.routes[0].sourceRefs,['T001']);assert.equal(result.routes.count,1);assert.match(result.cautions.join(' '),/not probabilities/);
});
test('citations canonicalise known transaction refs and reject invented or missing references',()=>{
 const context={evidence:[{ref:'T001'},{ref:'T002'}]};assert.equal(validateAnswer('Recorded transfer [T1].',context),'Recorded transfer [T001].');assert.equal(validateAnswer('Account T999 appears in [T1].',context),'Account T999 appears in [T001].');assert.throws(()=>validateAnswer('Claim [T999].',context),/unknown/);assert.throws(()=>validateAnswer('No sources.',context),/citations/);assert.throws(()=>validateAnswer('',context),/empty/);
});
test('read-only and hidden requests cannot start a native review or read its context',async()=>{
 const queries=[],c={execute:async(sql)=>{queries.push(sql);return {rows:[]};}};const agent=createMoneyAgent(async(u,fn)=>fn(c));
 await assert.rejects(()=>agent.queue('read_only_viewer','hidden',base),e=>e.status===403);assert.equal(queries.length,0);
 await assert.rejects(()=>agent.queue('northern_analyst','hidden',base),e=>e.status===404);
 await assert.rejects(()=>agent.detail('northern_analyst','hidden',base.runId),e=>e.status===404);assert(queries.every(q=>q.includes('secure_cdr_batches_v')));
});
test('a cited answer with invented per-route totals is rejected',()=>{
 const context={evidence:[{ref:'T001'}],summary:{grossVolume:'4500000.00',destinationInflow:'1500000.00',currency:'AUD'}};
 const valid='Gross transfer volume: 4500000.00 AUD\nInflow to selected destination: 1500000.00 AUD\nRecorded transfer [T001].';
 assert.equal(validateAnswer(valid,context),valid);assert.throws(()=>validateAnswer(valid+'\nRoute 1 gross volume: 450000.00 AUD.',context),/unsupported/);assert.throws(()=>validateAnswer(valid.replace('4500000.00','1500000.00'),context),/exact gross/);assert.throws(()=>validateAnswer(valid.replaceAll('AUD','USD'),context),/exact gross/);
});
