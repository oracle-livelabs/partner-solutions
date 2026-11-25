'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {searchWatchedPatterns}=require('../backend/watched-semantic-search');
const {signalVectorReadiness}=require('../backend/signal-vector-readiness');
const config={PATTERN_EMBEDDING_MODEL:'cohere.embed-v4.0',PATTERN_EMBEDDING_DIMENSIONS:2,vectorLiteral:JSON.stringify};
test('missing watch vectors produce a coverage error without a provider call',async()=>{
 let calls=0;
 await assert.rejects(searchWatchedPatterns({execute:async()=>({rows:[{PATTERNS:6,EMBEDDED:0}]})},{query:'invoice discrepancies'},{...config,embedPatternTexts:async()=>{calls++;}}),e=>e.status===503&&e.coverage.patterns===6&&/no compatible saved vectors/.test(e.message));
 assert.equal(calls,0);
});
test('partial watch coverage is explicit and ranking excludes incompatible models',async()=>{
 const queries=[];
 const c={execute:async(sql,binds)=>{queries.push({sql,binds});return{rows:queries.length===1?[{PATTERNS:6,EMBEDDED:4}]:[{PATTERN_CODE:'PAYMENT'}]};}};
 const result=await searchWatchedPatterns(c,{query:'invoice discrepancies',topK:3},{...config,embedPatternTexts:async(texts,type)=>{assert.deepEqual(texts,['invoice discrepancies']);assert.equal(type,'SEARCH_QUERY');return[[.1,.2]];}});
 assert.deepEqual(result.coverage,{patterns:6,embedded:4});assert.match(result.notice,/Only 4 of 6/);
 assert.match(queries[1].sql,/e.embedding_model=:model/);assert.match(queries[1].sql,/e.embedding IS NOT NULL/);
 assert.equal(queries[1].binds.model,'cohere.embed-v4.0');assert.equal(queries[1].binds.topK,3);
});
test('readiness distinguishes a complete live corpus from an incomplete selected snapshot',async()=>{
 let query;
 const result=await signalVectorReadiness({execute:async(sql,binds)=>{query={sql,binds};return{rows:[{LIVE_REPORTS:100,LIVE_REPORT_VECTORS:100,LIVE_WATCHES:6,LIVE_WATCH_VECTORS:6,SAVED_REPORTS:50,SAVED_REPORT_VECTORS:0,SAVED_WATCHES:6,SAVED_WATCH_VECTORS:0}]};}},6,'ACTIVE_CITY','cohere.embed-v4.0');
 assert.equal(result.live.ready,true);assert.equal(result.saved.ready,false);assert.match(result.notice,/0 of 50/);
 assert.deepEqual(query.binds,{pid:6,activeCode:'ACTIVE_CITY',model:'cohere.embed-v4.0'});
 assert.match(query.sql,/secure_crime_incidents_v/);assert.match(query.sql,/e.dataset_profile_id=w.dataset_profile_id/);
});
test('complete snapshot is ready; empty corpus is never called ready',async()=>{
 const make=row=>({execute:async()=>({rows:[row]})});
 const r=await signalVectorReadiness(make({SAVED_REPORTS:100,SAVED_REPORT_VECTORS:100,SAVED_WATCHES:6,SAVED_WATCH_VECTORS:6}),6,'ACTIVE_CITY','model');
 assert.equal(r.saved.ready,true);assert.equal(r.notice,null);assert.equal(r.live.ready,false);
});
