'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createStore,batchId,runId,sha,atomic,publicJob}=require('../backend/detective-room-store');
const {normalize}=require('../backend/detective-room-normalize');
const {createAuthor,object,authorCase,array,string}=require('../backend/detective-room-author');
const {compose,E}=require('../backend/detective-room-compose');
const {visible,fingerprint,snapshot}=require('../backend/detective-room-source');
const {registerRoomPublication}=require('../backend/detective-room-api');
const B='DR-20260925-4a92944f-9986-4202';
const header={BATCH_ID:B,STATUS:'ready',SYNTHETIC_ONLY:'Y',ARCHIVE_SHA256:'a'.repeat(64),ARCHIVE_BYTES:20,FILE_COUNT:1};
test('publisher is mounted after Ask Detective inside the batch component',async()=>{
 const jsx=await fs.readFile(path.join(__dirname,'../frontend/src/CrimeDataRoom.jsx'),'utf8');
 assert(jsx.indexOf('<DetectiveRoomPublisher')>jsx.indexOf('<SectionTitle letter="G"'));
 assert.equal(jsx.match(/<DetectiveRoomPublisher/g).length,1);
});
async function temporary(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'detective-room-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
const file=(name,text)=>{const content=Buffer.from(text);return {path:name,type:name.split('.').pop(),content,bytes:content.length,sha256:sha(content),itemId:name};};
test('strict identifiers reject traversal and unexpected keys',()=>{
 assert.equal(batchId(B),B);for(const v of ['../x','DR-20260925-abc',B+'/x'])assert.throws(()=>batchId(v));
 assert.throws(()=>runId('../job'));assert.throws(()=>createStore('relative'));
});
test('concurrent enqueue coalesces; regeneration preserves READY; failures immutable',async t=>{
 const s=createStore(await temporary(t));
 const result=await Promise.all(Array.from({length:8},()=>s.enqueue({owner:'statewide_admin',batch:B,fingerprint:'x'})));
 assert.equal(new Set(result.map(r=>r.job.id)).size,1);
 const j=await s.claim();assert.equal(j.state,'IN_PROGRESS');assert.equal(await s.claim(),null);
 await s.update(j.id,{state:'READY'});
 assert.equal((await s.enqueue({owner:j.owner,batch:B,fingerprint:'x'})).reused,true);
 const next=(await s.enqueue({owner:j.owner,batch:B,fingerprint:'x',regenerate:true})).job;
 assert.notEqual(next.id,j.id);await s.update(next.id,{state:'FAILED'});
 assert.equal((await s.read(j.id)).state,'READY');
 await assert.rejects(s.update(next.id,{state:'READY'}),/immutable/);
 assert.equal((await s.list('northern_analyst',B)).length,0);
});
test('heartbeat unavailable by default, ready only with fresh engine heartbeat',async t=>{
 const s=createStore(await temporary(t));await s.init();assert.equal(await s.healthy(),false);
 await s.heartbeat();assert.equal(await s.healthy(),true);
 await atomic(path.join(s.root,'worker.json'),{engine:'old',at:new Date().toISOString()});assert.equal(await s.healthy(),false);
});
test('read-only source queries bind batch and enforce synthetic scope',async()=>{
 const calls=[];const c={execute:async(sql,binds)=>{calls.push({sql,binds});return {rows:[header]};}};
 assert.equal(await visible(c,B),header);assert.equal(calls[0].binds.id,B);assert.match(calls[0].sql,/secure_cdr_batches_v/);
 await assert.rejects(visible({execute:async()=>({rows:[]})},B),{status:404});
 await assert.rejects(visible({execute:async()=>({rows:[{...header,SYNTHETIC_ONLY:'N'}]})},B),{status:403});
 assert.notEqual(fingerprint(header),fingerprint({...header,ARCHIVE_SHA256:'b'}));
});
test('corrupted original archive fails before parsing or publication',async()=>{
 let n=0;const c={execute:async()=>({rows:[n++?{ARCHIVE_BLOB:Buffer.from('bad')}:header]})};
 await assert.rejects(snapshot(c,B),/checksum or size/);
});
test('nested conversation adapter retains every message, original locator and explicit time',()=>{
 const n=normalize([file('messages.json',JSON.stringify({conversations:[{title:'Source thread',participants:['A','B'],messages:[{sender:'A',timestamp:'2026-09-20T10:01:00+09:30',body:'Hello'}, {sender:'B',body:'Reply without a timestamp'}]}]}))]);
 assert.equal(n.messages.length,2);assert.equal(n.threads.length,1);assert.equal(n.people.length,2);
 assert.equal(n.messages[0].source.pointer,'/conversations/0/messages/0');
 assert.equal(n.messages[0].time.original,'2026-09-20T10:01:00+09:30');
 assert.equal(n.messages[1].time.original,null);assert.deepEqual(n.messages[0].recipients,[]);
});
test('financial arithmetic preserves cents, unknown currency, all CSV rows and gross volume distinction',()=>{
 const n=normalize([file('money.csv','DATE,SENDER_ACCOUNT,RECEIVER_ACCOUNT,AMOUNT\n2026-09-20,A,B,0.10\n2026-09-21,B,C,0.20\n')]);
 assert.equal(n.records.length,2);assert.equal(n.money[0].grossVolume,'0.30');assert.equal(n.money[0].currency,'UNKNOWN');
 assert.equal(n.money[0].pairs.length,2);
});
test('narrative without financial records creates no invented flow',()=>{
 const n=normalize([file('case.txt','This is a synthetic training case with no financial records.')]);
 assert.deepEqual(n.money,[]);assert.equal(n.texts[0].text,'This is a synthetic training case with no financial records.');
});
const smsFixture='SMS CONVERSATION EXPORT\nExport reference: SMS-EXAMPLE\nParticipants: A [REF-A]; B [REF-B]\nTimezone: Europe/Brussels\n\n[SMS-001 | 2026-05-21 18:52:00+02:00] A\nFirst line.\nSecond line.\n\n[SMS-002 | 2026-05-21 18:55:00+02:00] B\nReply.\n';
test('explicit SMS export preserves every body, source ID, timestamp, offset and participant declaration',()=>{
 const n=normalize([file('messages/sms.txt',smsFixture)]);
 assert.equal(n.messages.length,2);assert.equal(n.threads.length,1);assert.equal(n.people.length,2);
 const m=n.messages[0];assert.equal(m.sourceMessageId,'SMS-001');assert.equal(m.text,'First line.\nSecond line.');
 assert.equal(m.time.original,'2026-05-21 18:52:00+02:00');assert.equal(m.time.utc,'2026-05-21T16:52:00.000Z');
 assert.equal(smsFixture.slice(m.source.start,m.source.end),m.text);assert.deepEqual(m.recipients,[]);
 assert.equal(n.threads[0].metadata.declaredParticipants[0].reference,'REF-A');
});
test('malformed, duplicate or undeclared SMS turns fail instead of publishing a partial extract',()=>{
 for(const s of [smsFixture.replace('2026-05-21 18:55:00+02:00','unknown time'),smsFixture.replace('SMS-002','SMS-001'),smsFixture.replace('] B\n','] Unknown\n')])assert.throws(()=>normalize([file('sms.txt',s)]));
});
test('SMS and JSON exports stay separate; overlapping source records are not silently deduplicated',()=>{
 const json=file('messages.json',JSON.stringify({participants:['A','B'],messages:[{sender:'A',text:'First line.',timestamp:'2026-05-21T18:52:00+02:00'}]}));
 const n=normalize([json,file('sms.txt',smsFixture)]);assert.equal(n.threads.length,2);assert.equal(n.messages.length,3);
});
test('unsupported size fails closed, not a truncated room',()=>{
 assert.throws(()=>normalize([file('case.txt','a'.repeat(500001))]),/limit/);
});
test('author retries invalid JSON once and caps output at 4000 tokens',async()=>{
 let calls=0;const author=createAuthor(async request=>{
  assert.equal(request.chatDetails.chatRequest.maxTokens,4000);
  assert.match(request.chatDetails.servingMode.modelId,/maverick/);
  return {chatResult:{chatResponse:{choices:[{finishReason:'stop',message:{content:[{type:'TEXT',text:++calls===1?'{}':'{"ok":true}'}]}}]}}};
 });
 const result=await author.generate('Test',v=>{assert.equal(v.ok,true);return v;});
 assert.equal(result.value.ok,true);assert.equal(calls,2);
});
test('OCI service failures are not automatically retried',async()=>{
 let calls=0;const a=createAuthor(async()=>{calls++;throw Object.assign(Error('denied'),{statusCode:403});});
 await assert.rejects(a.generate('Test',v=>v),/denied/);assert.equal(calls,1);
});
test('validation identifies the exact field, limit and observed length without changing data',()=>{
 const ids=Array.from({length:6},(_,i)=>'S001-U'+i);
 assert.throws(()=>array(ids,5,'facts[0].unitIds',1),/facts\[0\]\.unitIds must contain 1–5 items; received 6/);
 assert.equal(ids.length,6);
 assert.throws(()=>array([],5,'facts[1].unitIds',1),/received 0/);
 assert.throws(()=>array(null,5,'facts'),/facts must be an array/);
 assert.throws(()=>string('a'.repeat(221),220,'questions[0].text'),/questions\[0\]\.text.*220.*221/);
});
test('oversized citation sets receive actionable correction and preserve exact source anchors',async()=>{
 const source=file('case.txt','One.\nTwo.\nThree.\nFour.\nFive.\nSix.\n'),normal=normalize([source]);
 const ids=['S001-U0','S001-U5','S001-U10','S001-U17','S001-U23','S001-U29'];
 const invalid={facts:[{text:'The source lists six entries.',unitIds:Array.from({length:33},(_,i)=>ids[i%ids.length])}],people:[]};
 const corrected={facts:[{text:'The source lists the first three entries.',unitIds:ids.slice(0,3)},{text:'The source lists the final three entries.',unitIds:ids.slice(3)}],people:[]};
 let calls=0;const observed=[];
 const author=createAuthor(async request=>{
  const messages=request.chatDetails.chatRequest.messages;let value;
  if(++calls===1)value=invalid;
  else if(calls===2){
   assert.deepEqual(JSON.parse(messages[2].content[0].text),invalid);
   assert.match(messages[3].content[0].text,/facts\[0\]\.unitIds must contain 1–32 items; received 33/);
   assert.match(messages[3].content[0].text,/split or narrow the claim/);value=corrected;
  }else value={title:'Test',subtitle:'Synthetic list',focus:'Review the supplied list.',overview:[1,2,3].map(()=>({text:'Source entries.',factIds:['F1']})),questions:[1,2,3].map(()=>({text:'Verify context?',factIds:['F2']}))};
  return {chatResult:{chatResponse:{choices:[{finishReason:'stop',message:{content:[{type:'TEXT',text:JSON.stringify(value)}]}}]}}};
 },async record=>observed.push(record));
 const result=await authorCase(normal,[source],author,async()=>{});
 assert.equal(calls,3);assert.deepEqual(observed.map(r=>r.attempt),[1,2,1]);
 assert.equal(result.calls[0].attempts,2);assert.equal(result.facts.length,2);
 assert.deepEqual(result.facts.flatMap(f=>f.anchors.map(a=>a.id)),ids);
 for(const f of result.facts)for(const a of f.anchors)assert.equal(source.content.toString().slice(a.start,a.start+a.quote.length),a.quote);
});
test('six- and twelve-passage summaries retain all valid citations without a corrective retry',async()=>{
 const source=file('case.txt',Array.from({length:12},(_,i)=>'Source row '+i+'.\n').join('')),normal=normalize([source]);
 let offset=0;const ids=source.content.toString().split(/(?<=\n)/).map(line=>{const id='S001-U'+offset;offset+=line.length;return id;});
 let calls=0;const author=createAuthor(async request=>{
  const messages=request.chatDetails.chatRequest.messages;assert.equal(messages.length,2);
  const value=++calls===1?{facts:[{text:'Six source rows are listed.',unitIds:ids.slice(0,6)},{text:'Twelve source rows are listed.',unitIds:ids}],people:[]}:
   {title:'Test',subtitle:'Synthetic list',focus:'Review the source list.',overview:[1,2,3].map(()=>({text:'Source list.',factIds:['F1']})),questions:[1,2,3].map(()=>({text:'Verify context?',factIds:['F2']}))};
  return {chatResult:{chatResponse:{choices:[{message:{content:[{type:'TEXT',text:JSON.stringify(value)}]}}]}}};
 });
 const result=await authorCase(normal,[source],author,async()=>{});
 assert.equal(calls,2);assert.deepEqual(result.facts.map(f=>f.anchors.length),[6,12]);
 assert.deepEqual(result.facts[1].anchors.map(a=>a.id),ids);
 for(const f of result.facts)for(const a of f.anchors)assert.equal(source.content.toString().slice(a.start,a.start+a.quote.length),a.quote);
});
test('persistently invalid model replies fail closed after exactly one correction',async()=>{
 let calls=0;const a=createAuthor(async()=>{
  calls++;return {chatResult:{chatResponse:{choices:[{message:{content:[{type:'TEXT',text:'{"ids":[1,2,3,4,5,6]}'}]}}]}}};
 });
 await assert.rejects(a.generate('Test',v=>array(v.ids,5,'facts[0].unitIds',1)),e=>e.code==='MODEL_RESPONSE_INVALID'&&/received 6/.test(e.message));
 assert.equal(calls,2);
});
test('source extraction requests bounded structured output and still validates the returned evidence',async()=>{
 const source=file('payments.csv','sender,recipient,amount\nAster,Linden,3000\n'),normal=normalize([source]);let calls=0;
 const author=createAuthor(async request=>{
  const format=request.chatDetails.chatRequest.responseFormat;let value;
  if(++calls<=2){
   assert.equal(format.type,'JSON_SCHEMA');assert.equal(format.jsonSchema.isStrict,true);
   const schema=format.jsonSchema.schema;assert.equal(schema.properties.facts.maxItems,7);
   const ids=schema.properties.facts.items.properties.unitIds.items.enum;
   assert.deepEqual(ids,['S001-U0','S001-U24']);
   // Even a provider that ignores the schema cannot publish eight facts.
   value={facts:Array.from({length:calls===1?8:1},()=>({text:'The source lists a payment.',unitIds:[ids[1]]})),people:[]};
   if(calls===2)assert.match(request.chatDetails.chatRequest.messages[3].content[0].text,/facts must contain 0–7 items; received 8/);
  }else{
   assert.equal(format.type,'JSON_OBJECT');
   value={title:'Payment review',subtitle:'Synthetic source',focus:'Review the payment record.',overview:[1,2,3].map(()=>({text:'Payment listed.',factIds:['F1']})),questions:[1,2,3].map(()=>({text:'Verify context?',factIds:['F1']}))};
  }
  return {chatResult:{chatResponse:{choices:[{message:{content:[{type:'TEXT',text:JSON.stringify(value)}]}}]}}};
 });
 const result=await authorCase(normal,[source],author,async()=>{});
 assert.equal(result.calls[0].attempts,2);assert.equal(result.facts.length,1);
 assert.equal(result.facts[0].quote,'Aster,Linden,3000\n');
});
test('failed status only promises an earlier room when one exists, without rewriting history',()=>{
 for(const error of ['Generation or validation failed. Previous READY version is preserved.','Worker restarted during generation. Previous completed versions remain available. Generate again to retry.']){
  const j={state:'FAILED',error};
  assert.match(publicJob(j).error,/No completed room is available for this batch yet/);
  assert.doesNotMatch(publicJob(j).error,/preserved|Previous completed/);
  assert.match(publicJob(j,true).error,/Your previous completed room is still available/);
  assert.doesNotMatch(publicJob(j,true).error,/No completed room/);
  assert.equal(j.error,error);
 }
 assert.equal(publicJob({state:'READY'}).error,undefined);
});
test('status API uses only the current owner and batch history to describe failed-room availability',async t=>{
 process.env.CDR_ROOM_ENABLED='1';t.after(()=>delete process.env.CDR_ROOM_ENABLED);
 const routes=new Map(),router={get:(p,fn)=>routes.set('GET '+p,fn),post:()=>{}};
 let history=[{id:'failed',state:'FAILED',error:'Generation failed. Previous READY version is preserved.'}];
 const store={list:async(owner,batch)=>{assert.equal(owner,'statewide_admin');assert.equal(batch,B);return history;},healthy:async()=>true};
 registerRoomPublication(router,async(user,fn)=>fn({execute:async()=>({rows:[header]})}),fn=>fn,store);
 const request={params:{id:B},demoUser:'statewide_admin',header:()=> 'statewide_admin'};
 const response={json(v){this.value=v;}};
 await routes.get('GET /batches/:id/room')(request,response);
 assert.equal(response.value.ready,null);assert.match(response.value.latest.error,/No completed room/);
 history.push({id:'ready',state:'READY'});
 await routes.get('GET /batches/:id/room')(request,response);
 assert.equal(response.value.ready.id,'ready');assert.match(response.value.latest.error,/previous completed room is still available/);
});
test('only a whole-response JSON fence is accepted; malformed/trailing data is rejected',()=>{
 assert.deepEqual(object('```json\n{"a":1}\n```'),{a:1});
 assert.throws(()=>object('comment\n{"a":1}'));
 assert.throws(()=>object('```json\n{"a":1}\n``` extra'));
 assert.throws(()=>object('{"a":"unescaped "quote""}'));
});
test('source-unit citations copy original text and reject invented unit IDs',async()=>{
 const text='Mara Vega is named in this synthetic source.\nA meeting was proposed, not confirmed.\n';
 const source=file('case.txt',text),normal=normalize([source]);
 const author={generate:async(prompt,validate)=>{
  if(prompt.startsWith('Extract')){
   assert(prompt.includes('S001-U0'));
   validate({facts:[{text:'A name is recorded.',unitIds:['S001-U0']}],people:[{name:'Mara Vega',unitId:'S001-U0'}]});
   assert.throws(()=>validate({facts:[{text:'Unsupported.',unitIds:['invented']}],people:[]}),/Unknown source-unit/);
   return {value:{facts:[{text:'A name is recorded.',unitIds:['S001-U0']}],people:[{name:'Mara Vega',unitId:'S001-U0'}]},provenance:{model:'test'}};
  }
  if(prompt.startsWith('Write a concise'))return {value:validate({title:'Test',subtitle:'Synthetic evidence',focus:'Source-grounded test.',overview:[1,2,3].map(()=>({text:'Name recorded.',factIds:['F1']})),questions:[1,2,3].map(()=>({text:'Verify context?',factIds:['F1']}))}),provenance:{}};
  if(prompt.startsWith('Lightly edit')){
   const input=JSON.parse(prompt.slice(prompt.indexOf('\n')+1));
   input.scenes[0].narration='Synthetic '+input.scenes[0].narration;
   return {value:validate({case:input.case,scenes:input.scenes}),provenance:{}};
  }
  const id=prompt.match(/Write ONLY the (\w+) chapter/)[1];
  return {value:validate({id,title:'Test chapter',narration:Array(60).fill('Review').join(' ')+'.',factIds:['F1']}),provenance:{}};
 }};
 const result=await authorCase(normal,[source],author,async()=>{});
 assert.equal(result.facts[0].quote,'Mara Vega is named in this synthetic source.\n');
 assert.equal(result.facts[0].start,0);assert.equal(result.scenes.length,8);
 assert(result.scenes.some(s=>s.id==='timeline'));assert(!result.scenes.some(s=>s.id==='money'));
});
test('person citation retry identifies every mismatch and supplies only exact supporting units',async()=>{
 const source=file('case.txt','Mara Vega met Noah Kim.\nMara left.\n'),normal=normalize([source]);
 let calls=0;
 const author=createAuthor(async request=>{
  const messages=request.chatDetails.chatRequest.messages;let value;
  if(++calls===1)value={facts:[{text:'Two names are recorded.',unitIds:['S001-U0']}],people:[{name:'Mara Vega',unitId:'S001-U23'},{name:'Noah Kim',unitId:'S001-U23'},{name:'Invented Person',unitId:'S001-U0'}]};
  else if(calls===2){
   const feedback=messages[3].content[0].text;
   assert.match(feedback,/people\[0\].name "Mara Vega"/);
   assert.match(feedback,/people\[1\].name "Noah Kim"/);
   assert.match(feedback,/Existing units containing this exact name: S001-U0/);
   assert.match(feedback,/No supplied unit contains this exact name; omit this person/);
   value={facts:[{text:'Two names are recorded.',unitIds:['S001-U0']}],people:[{name:'Mara Vega',unitId:'S001-U0'},{name:'Noah Kim',unitId:'S001-U0'}]};
  }else value={title:'Test',subtitle:'Synthetic source',focus:'Review the source.',overview:[1,2,3].map(()=>({text:'Two names recorded.',factIds:['F1']})),questions:[1,2,3].map(()=>({text:'Verify context?',factIds:['F1']}))};
  return {chatResult:{chatResponse:{choices:[{finishReason:'stop',message:{content:[{type:'TEXT',text:JSON.stringify(value)}]}}]}}};
 });
 const result=await authorCase(normal,[source],author,async()=>{});
 assert.equal(calls,3);assert.equal(result.calls[0].attempts,2);
 assert.deepEqual(result.people.map(p=>p.name),['Mara Vega','Noah Kim']);
 for(const p of result.people)assert(p.quote.includes(p.name));
});
test('source HTML is escaped including attributes',()=>{
 assert.equal(E('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});
test('API rejects missing context, read-only writes, offline worker and cross-owner access',async t=>{
 process.env.CDR_ROOM_ENABLED='1';t.after(()=>delete process.env.CDR_ROOM_ENABLED);
 const s=createStore(await temporary(t)),routes=new Map(),router={get:(p,fn)=>routes.set('GET '+p,fn),post:(p,fn)=>routes.set('POST '+p,fn)};
 const route=fn=>fn,db=async(user,fn)=>fn({execute:async()=>({rows:[header]})});
 registerRoomPublication(router,db,route,s);
 const req=(user,body={})=>({params:{id:B},demoUser:user,header:()=>user,body,headers:{},secure:false});
 const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.value=v;return this;},cookie(...v){this.cookieValue=v;return this;}});
 const get=routes.get('GET /batches/:id/room'),post=routes.get('POST /batches/:id/room');
 await assert.rejects(get(req(undefined),response()),{status:403});
 await assert.rejects(post(req('read_only_viewer'),response()),{status:403});
 await assert.rejects(post(req('statewide_admin'),response()),{status:503});
 await s.heartbeat();const res=response();await post(req('statewide_admin'),res);assert.equal(res.statusCode,202);
 await s.update(res.value.job.id,{state:'READY'});
 const access=routes.get('POST /batches/:id/room/runs/:run/access'),other=req('northern_analyst');other.params.run=res.value.job.id;
 await assert.rejects(access(other,response()),{status:404});
 const own=req('statewide_admin');own.params.run=res.value.job.id;const ticket=response();await access(own,ticket);
 assert.equal(ticket.cookieValue[2].httpOnly,true);assert.equal(ticket.cookieValue[2].sameSite,'strict');
 assert(!ticket.value.view.includes('?'));
 const read=routes.get('GET /batches/:id/room/runs/:run/files/*');
 const bad={params:{...own.params,0:'Virtual-Detective-Room.html'},headers:{cookie:ticket.cookieValue[0]+'='+ticket.cookieValue[1]+'tampered'}};
 await assert.rejects(read(bad,response()),{status:401});
});
