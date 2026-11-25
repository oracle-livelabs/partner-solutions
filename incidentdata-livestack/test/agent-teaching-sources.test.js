'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {registerTeachingCases}=require('../backend/agent-teaching-sources');
test('teaching catalogue uses the trusted request identity and secured source view',async()=>{
 let handler,seen;registerTeachingCases({get:(path,h)=>{assert.equal(path,'/api/agent-v2/teaching-cases');handler=h;}},async(user,fn)=>{seen=user;return fn({execute:async sql=>{assert.match(sql,/FROM secure_agent_demo_sources_v/);assert(!/source_text/i.test(sql));return {rows:[{CASE_CODE:'GALLERY_REFUND_V1',SOURCE_COUNT:3}]};}});});
 const res={json(value){this.body=value;}};await handler({demoUser:'central_analyst'},res);assert.equal(seen,'central_analyst');assert.equal(res.body[0].SOURCE_COUNT,3);
});
test('catalogue errors expose no database or source content',async()=>{
 let handler;registerTeachingCases({get:(p,h)=>handler=h},async()=>{throw Error('private fixture details');});const res={status(n){this.code=n;return this;},json(value){this.body=value;}};await handler({demoUser:'northern_analyst'},res);assert.equal(res.code,503);assert.deepEqual(res.body,{error:'Teaching cases are unavailable.'});
});
