'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {definitions,discover,describe,fingerprint,capabilitySummary}=require('../backend/data-room-capabilities');
const money=require('../backend/data-room-money-model'),messages=require('../backend/data-room-messages-model');
const item=(type,text,extra={})=>({ITEM_ID:'source',ORIGINAL_PATH:'source.'+type,CONTENT_TYPE:type,PREFIX:Buffer.from(text),SHA256:'source-sha',BYTE_COUNT:Buffer.byteLength(text),...extra});
const csv='TDATE,SENDER_ACCOUNT,RECEIVER_ACCOUNT,AMOUNT,CURRENCY\n2026-09-01,A,B,1,AUD';
test('discovery uses supported content signatures, not extensions or prose mentions',()=>{
 assert.deepEqual(discover(item('csv',csv)),{money:'recognised',messages:'none',travel:'none'});
 assert.deepEqual(discover(item('csv','sender_ref,recipient_ref,message,sent_at\nA,B,Hello,2026-09-01')),{money:'none',messages:'recognised',travel:'none'});
 assert.equal(discover(item('csv','person,departure,arrival,origin,destination\nA,2026-09-01T10:00:00Z,2026-09-01T11:00:00Z,One,Two')).travel,'recognised');
 assert.equal(discover(item('txt','SYNTHETIC CONVERSATION\nThread: DEMO')).messages,'recognised');
 assert.equal(discover(item('txt','An email mentioned a conversation and messages.')).messages,'none');
 assert.equal(discover(item('json','{"note":"messages"}',{JSON_VALID:1,HAS_MESSAGES:0})).messages,'none');
 assert.equal(discover(item('json','',{JSON_VALID:1,HAS_MESSAGES:1})).messages,'recognised');
 assert.equal(discover(item('json','{"conversations":[{"messages":[{"sender":"Mara Vega","body":"Hi"}]}]}',{JSON_VALID:1,HAS_MESSAGES:1})).messages,'recognised');
 assert.equal(discover(item('json','{"payments":[{"payer":"A","payee":"B","amount":"1.00","date":"2026-09-01"}]}',{JSON_VALID:1,HAS_MESSAGES:0})).money,'recognised');
 assert.equal(discover(item('csv','payment_reference,posting_date,debit_account,credit_account,transaction_amount\nPAY-1,A,B,C,1.00')).money,'recognised');
 assert.equal(discover(item('json','{"paymentTransactions":[{"posting_date":"2026-09-01","originator_account":"A","recipient_account":"B","payment_value":"1.00"}]}',{JSON_VALID:1,HAS_MESSAGES:0})).money,'recognised');
});
test('uncertain, malformed, oversized and duplicate headers are not silently hidden',()=>{
 assert.equal(discover(item('csv','"unfinished')).money,'check');
 assert.equal(discover(item('csv',csv.replace('CURRENCY','AMOUNT'))).money,'check');
 assert.equal(discover(item('json','',{JSON_VALID:0})).messages,'check');
 assert.equal(discover(item('json','',{BYTE_COUNT:3*1024*1024})).messages,'check');
 assert.equal(discover(item('csv','a'.repeat(32767),{BYTE_COUNT:40000})).money,'check');
});
test('dated TXT discovery depends on date/speaker content and not a message filename',()=>{
 const text='05 Jul 2025 – 18:42\n\nalpha68:\nHello.\n\nbeta66:\nHi.';
 for(const name of ['Red_Dirt_Jul2025.txt','anything.txt'])assert.equal(discover(item('txt','\uFEFF'+text.replace(/\n/g,'\r\n'),{ORIGINAL_PATH:name})).messages,'recognised');
 assert.equal(discover(item('txt',text.replace('alpha68:', 'alpha68 → beta66:'))).messages,'recognised');
 assert.equal(discover(item('txt','05 Jul 2025 – 18:42\n\nA narrative without speaker blocks.',{ORIGINAL_PATH:'messages.txt'})).messages,'none');
 assert.equal(discover(item('txt',text.replace('05 Jul','31 Feb'))).messages,'recognised'); // validation is performed at build time
});
test('WhatsApp and Boat bracketed transcripts enable Messages without relying on filenames',()=>{
 for(const text of ['[Jan 5, 2023, 7:15 PM]\nBigJulie: Hello.','**WhatsApp Conversation: Example (one) and Other (two)**  \r\n*(Group: Private)*\r\n\r\n**[May 15, 2023, 8:45 PM]**  \r\n**one:** Hello.'])assert.equal(discover(item('txt',text)).messages,'recognised');
 assert.equal(discover(item('txt','Narrative: a WhatsApp Conversation was mentioned.')).messages,'none');
});
test('discovery fingerprints exactly match existing analysis versions and source order',()=>{
 const items=[item('csv',csv),item('json','',{ITEM_ID:'second',SHA256:'two'})];
 assert.equal(fingerprint('money',items),money.digest(JSON.stringify([money.VERSION,[['source','source-sha'],['second','two']]])));
 assert.equal(fingerprint('messages',items),messages.id(messages.VERSION,[['source','source-sha'],['second','two']]));
});
test('saved counts, stale snapshots, failures and no-source states are explicit',()=>{
 const def=definitions[0],items=[item('csv',csv)],fp=fingerprint('money',items),saved={id:'run',version:money.VERSION,fingerprint:fp,counts:{accounts:8,transfers:10},coverage:{sources:[],skipped:[]}};
 let cap=describe(def,items,saved,null,'ready');assert.equal(cap.status,'results');assert.equal(cap.summary,'10 transactions · 8 accounts');assert.equal(cap.available,true);
 assert.equal(describe(def,items,{...saved,fingerprint:'old'},null,'ready').status,'stale');
 cap=describe(def,items,saved,{FINGERPRINT:fp,ERROR_TEXT:'Build failed',FAILED_AT:'now'},'ready');assert.equal(cap.status,'needs_attention');assert.equal(cap.failure.message,'Build failed');
 assert.equal(describe(def,items,saved,{FINGERPRINT:'old',ERROR_TEXT:'old'},'ready').status,'results');
 assert.equal(describe(def,items,null,null,'ready').status,'ready');assert.equal(describe(def,items,null,null,'processing').status,'waiting');
 cap=describe(def,[],null,null,'ready');assert.equal(cap.status,'unavailable');assert.equal(cap.available,false);assert.equal(cap.counts,null);
});
test('a narrative text skipped by Messages stays in coverage without an alarming tile warning',()=>{
 const items=[item('txt','Narrative only.',{ITEM_ID:'narrative',ORIGINAL_PATH:'Scene2b_Drug/narrative.txt'}),item('json','',{ITEM_ID:'messages',ORIGINAL_PATH:'Scene2b_Drug/messages.json',HAS_MESSAGES:1,JSON_VALID:1})];
 const saved={id:'run',version:messages.VERSION,fingerprint:fingerprint('messages',items),counts:{threads:3,messages:12,participants:5},coverage:{sources:[],skipped:[{itemId:'narrative',path:'Scene2b_Drug/narrative.txt',reason:'No supported conversation format'}]}};
 const cap=describe(definitions[1],items,saved,null,'ready');
 assert.equal(cap.status,'results');assert.equal(cap.summary,'3 conversations · 12 messages');
 assert.equal(cap.coverage.skipped.length,1);assert.deepEqual(cap.warnings,[]);
});
test('endpoint checks authorised batch before source or snapshot lookups',async()=>{
 const queries=[],c={execute:async(sql)=>{queries.push(sql);return {rows:[]};}};
 await assert.rejects(()=>capabilitySummary(c,'hidden'),e=>e.status===404);assert.equal(queries.length,1);assert.match(queries[0],/secure_cdr_batches_v/);
});
test('authorised capability discovery checks nested conversation arrays in Oracle JSON',async()=>{
 const marker=Error('Source query reached'),c={execute:async(sql)=>{
  if(sql.includes("'$.conversations[*].messages'"))throw marker;
  return {rows:[{BATCH_ID:'B',FILENAME:'Scene2b_Drug.zip',STATUS:'ready'}]};
 }};
 await assert.rejects(()=>capabilitySummary(c,'B'),e=>e===marker);
});
test('SMS CSV aliases are discovered and audio transcript changes invalidate message snapshots',()=>{
 const {discover,fingerprint}=require('../backend/data-room-capabilities');
 const csv={ITEM_ID:'sms',SHA256:'csv-hash',CONTENT_TYPE:'csv',PREFIX:Buffer.from('message_id,conversation_id,timestamp,sender,recipient,text\n'),BYTE_COUNT:100};assert.equal(discover(csv).messages,'recognised');
 const audio={ITEM_ID:'audio',SHA256:'audio-hash',CONTENT_TYPE:'mp3',BYTE_COUNT:6000000};assert.equal(discover(audio).messages,'check');
 const before=fingerprint('messages',[csv,audio]);const after=fingerprint('messages',[csv,{...audio,TRANSCRIPT:{transcriptSha256:'new-transcript',promptVersion:'cdr-transcribe-v2'}}]);assert.notEqual(before,after);
});
