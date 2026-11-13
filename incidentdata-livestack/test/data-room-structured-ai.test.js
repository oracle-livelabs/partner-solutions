const test=require('node:test'),assert=require('node:assert/strict');
const {structuredGenerate,DESCRIPTION_SCHEMA,responseFormat}=require('../backend/data-room-structured-ai');
const opts={model:'google.gemini-2.5-flash',region:'test',system:'Return JSON',content:[],schema:DESCRIPTION_SCHEMA,validate:JSON.parse};
const response=(raw,finishReason='STOP')=>({opcRequestId:'test-id',chatResult:{chatResponse:{usage:{completionTokens:12},choices:[{finishReason,message:{content:[{type:'TEXT',text:raw}]}}]}}});
test('strict schema is sent and finish reason, usage and provenance survive',async()=>{let request;const r=await structuredGenerate(opts,async q=>{request=q;return response('{"ok":true}');});assert.equal(request.chatDetails.chatRequest.responseFormat.type,'JSON_SCHEMA');assert.equal(r.generation.attempts[0].usage.completionTokens,12);assert.equal(r.requestId,'test-id');});
test('truncation retries once with larger token budget, even if JSON parses',async()=>{let calls=0;const r=await structuredGenerate(opts,async()=>response('{"ok":true}',++calls===1?'length':'STOP'));assert.equal(calls,2);assert.equal(r.generation.attempts[0].status,'failed');assert.equal(r.generation.attempts[1].maxTokens,8192);});
test('invalid JSON is bounded to two attempts and carries failure diagnostics',async()=>{let calls=0;await assert.rejects(()=>structuredGenerate(opts,async()=>{calls++;return response('invalid');}),e=>e.generation.attempts.length===2 && !!e.generation.attempts[1].outputSha256);assert.equal(calls,2);});
test('source validation failures cannot bypass local validation',async()=>{await assert.rejects(()=>structuredGenerate({...opts,validate:()=>{throw Error('Quote absent from source');}},async()=>response('{}')),/Quote absent/);});
test('an exact-quote failure makes the bounded retry prefer no details over a fabricated citation',async()=>{
  let calls=0;const systems=[];
  const result=await structuredGenerate({...opts,validate:raw=>{if(++calls===1)throw Error('Model quoted text that is not present in the supplied source. Retry this item.');return JSON.parse(raw);}},async request=>{
    systems.push(request.chatDetails.chatRequest.messages[0].content[0].text);
    return response('{}');
  });
  assert.equal(result.generation.attempts.length,2);
  assert.match(systems[1],/previous response was rejected because a text source_quote/);
  assert.match(systems[1],/empty "details" array/);
});
test('HTTP access and parameter errors are not retried',async()=>{let calls=0;await assert.rejects(()=>structuredGenerate(opts,async()=>{calls++;throw Object.assign(Error('private provider details'),{statusCode:400,serviceCode:'InvalidParameter'});}),/HTTP 400/);assert.equal(calls,1);});
test('Meta baseline retains prompt-only contract while Gemini and Grok use schemas',()=>{assert.equal(responseFormat('meta.llama',DESCRIPTION_SCHEMA),undefined);assert.equal(responseFormat('xai.grok-4.6',DESCRIPTION_SCHEMA).type,'JSON_SCHEMA');});
test('Meta retry remains within the OCI 4096-token cap',async()=>{let calls=0;const r=await structuredGenerate({...opts,model:'meta.llama-4-maverick-17b-128e-instruct-fp8'},async q=>{assert.equal(q.chatDetails.chatRequest.maxTokens,4096);return response(++calls===1?'invalid':'{}');});assert.equal(r.generation.attempts.length,2);});
test('image field failures receive image-specific bounded retry guidance while validation stays enforced',async()=>{
 const {prepare,validateOutput}=require('../backend/data-room-ai'),{hash}=require('../backend/data-room-archive');
 const content=Buffer.from('image'),p=prepare({content,sha256:hash(content),type:'png'}),systems=[];
 const detail={label:'Caption',value:'FICTIONAL TRAINING SCENE',source_quote:'FICTIONAL TRAINING SCENE',location:'Bottom centre'};
 const output={headline:'A captioned image',description:'A fictional scene.',details:[detail],limitations:[]};
 const r=await structuredGenerate({...opts,validate:raw=>validateOutput(raw,p)},async req=>{
  systems.push(req.chatDetails.chatRequest.messages[0].content[0].text);
  return response(JSON.stringify({...output,details:[{...detail,source_quote:systems.length===1?detail.source_quote:''}]}));
 });
 assert.equal(r.generation.attempts.length,2);assert.equal(r.details[0].grounding,'unverified_visual_observation');
 assert.match(systems[1],/previous IMAGE response/);assert.match(systems[1],/even for captions/);assert.match(systems[1],/non-empty visual location/);
 assert.doesNotMatch(systems[1],/text source_quote was not an exact substring/);
});
test('text retry restricts citations to verified excerpts without promoting source data to system instructions',async()=>{
 const {prepare,validateOutput}=require('../backend/data-room-ai'),{hash}=require('../backend/data-room-archive');
 const content=Buffer.from('{"text":"Work first. Friday after six.","other":"Six thirty works."}');
 const p=prepare({content,sha256:hash(content),type:'json'}),requests=[];
 const detail=q=>({label:'Time',value:q,source_quote:q,location:''});
 const output=details=>JSON.stringify({headline:'Meeting discussion',description:'Participants discuss a time.',details,limitations:[]});
 const r=await structuredGenerate({...opts,content:p.content,validate:raw=>validateOutput(raw,p)},async req=>{
  requests.push(req.chatDetails.chatRequest);
  return response(output(requests.length===1?[detail('Six thirty works.'),detail('"text":"Friday after six."')]:[detail('Six thirty works.')]));
 });
 assert.equal(r.generation.attempts.length,2);
 assert.deepEqual(requests[1].responseFormat.jsonSchema.schema.properties.details.items.properties.source_quote.enum,['Six thirty works.']);
 assert.doesNotMatch(requests[1].messages[0].content[0].text,/Six thirty works/);
 assert.match(requests[1].messages[1].content.at(-1).text,/Six thirty works/);
 assert.equal(content.toString().slice(r.details[0].startCharacter,r.details[0].endCharacter),'Six thirty works.');
 assert.equal(DESCRIPTION_SCHEMA.properties.details.items.properties.source_quote.enum,undefined);
});
test('text retry with no verified quotes requires empty details and still rejects invented quotes',async()=>{
 const {prepare,validateOutput}=require('../backend/data-room-ai'),{hash}=require('../backend/data-room-archive');
 const content=Buffer.from('Friday after six.'),p=prepare({content,sha256:hash(content),type:'txt'});
 const output=JSON.stringify({headline:'Time',description:'A time.',details:[{label:'Time',value:'Sunday',source_quote:'Sunday',location:''}],limitations:[]});
 let calls=0;
 await assert.rejects(()=>structuredGenerate({...opts,validate:raw=>validateOutput(raw,p)},async req=>{
  if(++calls===2)assert.equal(req.chatDetails.chatRequest.responseFormat.jsonSchema.schema.properties.details.maxItems,0);
  return response(output);
 }),/not present/);
 assert.equal(calls,2);
});

test('people extraction can reserve room for Gemini reasoning without changing other operations',async()=>{
 let request;
 await structuredGenerate({...opts,operationId:'cdr.people.mentioned',maxTokens:32768,maxTokenCap:32768},async q=>{request=q;return response('{}');});
 assert.equal(request.chatDetails.chatRequest.maxTokens,32768);
 await structuredGenerate({...opts,maxTokens:32768},async q=>{request=q;return response('{}');});
 assert.equal(request.chatDetails.chatRequest.maxTokens,8192);
 await structuredGenerate({...opts,model:'meta.llama',maxTokens:32768,maxTokenCap:32768},async q=>{request=q;return response('{}');});
 assert.equal(request.chatDetails.chatRequest.maxTokens,4096);
});
