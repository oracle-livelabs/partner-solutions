'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {hash,normalize,parseSource,timestamp}=require('../backend/data-room-messages-model');
const {createMessages,searchTerm}=require('../backend/data-room-messages');
const item=(text,type='json',name='source')=>({ITEM_ID:name,ORIGINAL_PATH:name+'.'+type,CONTENT_TYPE:type,SHA256:hash(Buffer.from(text)),CONTENT_BLOB:Buffer.from(text)});
const bracketed='WhatsApp Conversation: Example One (one) and Example Two (two)\n(Group: Private Chat - Started May 15, 2023)\n\n[May 15, 2023, 12:05 AM]\none: Hello 🙂.\nA second line with a colon: kept.\n\n[May 15, 2023, 12:10 PM]\ntwo: It’s a reply.\n';
test('bracketed chat logs preserve bodies, source offsets, local dates and explicit header labels',()=>{
 for(const original of [bracketed,bracketed.replaceAll('\n','\r\n'),'\uFEFF'+bracketed,bracketed.replace('one: Hello','**one:** Hello').replace('[May 15, 2023, 12:05 AM]','**[May 15, 2023, 12:05 AM]**  ')]){
  const n=normalize([item(original,'txt')]);assert.equal(n.messages.length,2);assert.equal(n.participants.length,2);assert.equal(n.counts.directMessages,0);
  assert.equal(n.messages[0].time.local,'2023-05-15T00:05');assert.equal(n.messages[1].time.local,'2023-05-15T12:10');assert.equal(n.messages[0].time.original,'May 15, 2023, 12:05 AM');assert.equal(n.messages[0].time.utc,null);assert.equal(n.threads[0].chronological,false);
  assert.deepEqual(n.threads[0].recordedDates,['2023-05-15']);assert.equal(n.participants[0].sourceLabels[0].name,'Example One');
  for(const m of n.messages){assert.equal(original.slice(m.source.start,m.source.end),m.text);assert.equal(original.slice(m.source.blockStart,m.source.blockEnd),m.raw);assert.equal(original.slice(0,m.source.start).split('\n').length,m.source.bodyLineStart);assert.equal(original.slice(0,m.source.end-1).split('\n').length,m.source.lineEnd);}
 }
});
test('Boat-style headerless logs and fully bold WhatsApp headers work without merging source handles',()=>{
 const boat='[Jan 5, 2023, 7:15 PM]\nBigJulie: Hello Clarko.\n\n[Jan 5, 2023, 7:40 PM]\nClarko: Meet tomorrow.';
 const bold=bracketed.replace(/^WhatsApp[^\n]+/m,m=>'**'+m+'**  ').replace(/^\(Group:[^\n]+/m,m=>'*'+m+'*  ');
 const n=normalize([item(boat,'txt','boat'),item(bold,'txt','chat')]);assert.equal(n.messages.length,4);assert.equal(n.participants.length,4);assert.equal(n.counts.directMessages,0);
 assert(!n.participants.some(p=>p.name==='Example One'));assert.equal(n.messages[0].time.local,'2023-01-05T19:15');
});
test('bracketed imports reject malformed dates or missing speakers without losing part of an exchange',()=>{
 for(const input of [bracketed.replace('[May 15','[February 30'),bracketed.replace('12:05','13:05'),bracketed.replace('12:05','0:05'),bracketed.replace('[May 15','[Smarch 15'),bracketed.replace('12:10 PM','bad clock'),bracketed.replace('two: It’s a reply.','No sender here'),bracketed+'\n[May 15, 2023, 4:15 PM]\n',bracketed.replace('[May 15, 2023, 12:10 PM]','[May 15, 2023, 12:10 PM')])assert.throws(()=>normalize([item(input,'txt')]),e=>e.status===422);
});
const dated='05 Jul 2025 – 18:42\n\nalpha68:\nFirst 🙂 line.\nSecond line.\n\nbeta66:\nUnderstood.\n\n03 October 2025 — 08:22\n\nbeta66 → gamma58:\nPrivate viewing.\n\ngamma58:\nAcknowledged.\n';
test('dated speaker blocks make one pack per file with section dates, explicit recipients and exact provenance',()=>{
 for(const input of [dated,dated.replace(/\n/g,'\r\n'),'\uFEFF'+dated,'\n'+dated]){
  const n=normalize([item(input,'txt','Red_Dirt_Jul2025'),item(input,'txt','renamed')]);
  assert.deepEqual(n.counts,{threads:2,participants:3,messages:8,participations:6,directMessages:2});
  assert.equal(n.threads[0].metadata.sections.length,2);assert.equal(n.threads[0].chronological,false);
  assert.equal(n.messages[0].time.original,null);assert.equal(n.messages[0].section.time.original,'2025-07-05T18:42');assert.equal(n.messages[0].section.time.utc,null);
  assert.deepEqual(n.messages[2].recipients,['gamma58']);assert.deepEqual(n.messages[3].recipients,[]);
  for(const m of n.messages){assert.equal(input.slice(m.source.start,m.source.end),m.text);assert.equal(input.slice(m.source.blockStart,m.source.blockEnd),m.raw);assert.equal(input.slice(0,m.source.start).split('\n').length,m.source.bodyLineStart);assert.equal(input.slice(0,m.source.end-1).split('\n').length,m.source.lineEnd);}
  assert.equal(n.messages[0].text,'First 🙂 line.'+(input.includes('\r\n')?'\r\n':'\n')+'Second line.');
 }
 assert.deepEqual(normalize([item(dated.replace('→','->'),'txt')]).messages[2].recipients,['gamma58']);
});
test('dated conversations reject malformed dates, empty blocks and empty sections atomically',()=>{
 for(const input of [dated.replace('05 Jul','31 Feb'),dated.replace('18:42','25:42'),dated.replace('Jul','Smarch'),dated.replace('Private viewing.',''),dated+'\n04 Oct 2025 – 09:00\n',dated.replace('03 October 2025 — 08:22','03 October 2025 — invalid')])assert.throws(()=>normalize([item(input,'txt')]),e=>e.status===422);
 assert(parseSource(item('Report about messages.\n\nWitness:\nSaw a vehicle.','txt','messages')).unsupported);
 assert(parseSource(item('05 Jul 2025 – 18:42\n\nObserved two people at a gallery.','txt')).unsupported);
});
const json=(messages,extra={})=>JSON.stringify({thread_id:'T1',participants:['Julian Cross','Tony Kapoor','George Horner'],messages,...extra});
const text='SYNTHETIC CONVERSATION\nThread: T2\nParticipants: Julian Cross and Vivienne Hartley\nDate: 10 September 2026\nTime zone: AEST (UTC+10)\n\n20:14 — Julian Cross:\nFirst line.\nSecond line.\n\n20:16 — Vivienne Hartley:\nThen do not represent me as having agreed.';
test('JSON and TXT form source-participant/thread graphs without inferred direct messages',()=>{
 const n=normalize([item(json([{sender:'Julian Cross',timestamp:'2026-09-08T18:40:00+10:00',text:'Hello.'},{sender:'Tony Kapoor',text:'No agreement.'},{sender:'George Horner',text:'Understood.'}]),'json','one'),item(text,'txt','two')]);
 assert.deepEqual(n.counts,{threads:2,participants:4,messages:5,participations:5,directMessages:0});assert.equal(n.links.length,5);assert.equal(n.participants.find(p=>p.name==='Julian Cross').threadIds.length,2);assert.equal(n.threads[0].chronological,false);assert.equal(n.threads[1].chronological,true);
 assert.equal(n.messages[0].source.pointer,'/messages/0');assert.equal(n.messages[0].time.utc,'2026-09-08T08:40:00.000Z');assert.equal(n.messages[4].text,'Then do not represent me as having agreed.');
});
test('nested conversation JSON preserves separate threads, bodies, timestamps and source pointers',()=>{
 const source=JSON.stringify({classification:'MESSAGING CONTENT',format:'WhatsApp-style conversation export',timezone:'Australia/Adelaide',conversations:[
  {conversation_id:'MSG-001',title:'Mara Vega / Darnell Price',participants:['Mara Vega','Darnell Price'],messages:[
   {message_id:'MSG-001-01',timestamp:'2026-08-17T10:14:00+09:30',sender:'Mara Vega',body:'Are you near the market?'},
   {message_id:'MSG-001-02',timestamp:'2026-08-17T10:17:00+09:30',sender:'Darnell Price',body:'Yes.'}]},
  {conversation_id:'MSG-002',title:'Elias Grant / Tessa Rowe',participants:['Elias Grant','Tessa Rowe'],messages:[
   {message_id:'MSG-002-01',timestamp:'2026-08-18T16:08:00+09:30',sender:'Elias Grant',body:'Have you read the notes?'}]}]});
 const n=normalize([item(source,'json','scene2b')]);
 assert.deepEqual(n.counts,{threads:2,participants:4,messages:3,participations:4,directMessages:0});
 assert.deepEqual(n.threads.map(t=>t.sourceThreadId),['MSG-001','MSG-002']);
 assert.equal(n.threads[0].metadata.timezone,'Australia/Adelaide');
 assert.equal(n.messages[0].text,'Are you near the market?');
 assert.equal(n.messages[0].time.utc,'2026-08-17T00:44:00.000Z');
 assert.equal(n.messages[0].source.pointer,'/conversations/0/messages/0');
 assert.equal(n.messages[0].source.bodyPointer,'/conversations/0/messages/0/body');
 assert.equal(n.messages[2].source.pointer,'/conversations/1/messages/0');
 assert.equal(n.messages[0].raw.body,n.messages[0].text);
 assert.notEqual(n.threads[0].id,n.threads[1].id);
 for(const bad of [{...JSON.parse(source),conversations:[{conversation_id:'MSG-001',messages:[{sender:'Mara Vega',body:'Okay.'},{sender:'Darnell Price',body:12}]}]},
  {...JSON.parse(source),conversations:[{conversation_id:'MSG-001',messages:[]}]},
  {...JSON.parse(source),conversations:[{conversation_id:'MSG-001',messages:[{sender:'Mara Vega',body:'Okay.',timestamp:'invalid'}]}]}])
  assert.throws(()=>normalize([item(JSON.stringify(bad),'json','bad')]),e=>e.status===422);
});
test('source participant IDs and SMS export preserve Brussels messages without inferred recipients',()=>{
 const group={conversation_id:'EQF-OPERATIONS-2026',conversation_title:'Quarter Forum | operations',timezone:'Europe/Brussels',participants:[{person_id:'POI-FNET-ELIAS',display_name:'Elias Grant'},{person_id:'POI-FNET-MARA',display_name:'Mara Vega'}],messages:[
  {message_id:'GM-001',sent_at:'2026-05-15T17:42:00+02:00',sender_id:'POI-FNET-ELIAS',text:'The first instalment reached Aster.'},
  {message_id:'GM-002',sent_at:'2026-05-15T17:46:00+02:00',sender_id:'POI-FNET-MARA',text:'Bring the binder.'}]};
 const sms='SMS CONVERSATION EXPORT\nExport reference: BRU-SMS-001\nParticipants: Elias Grant [POI-FNET-ELIAS]; Mara Vega [POI-FNET-MARA]\nTimezone: Europe/Brussels (UTC+02:00 for every message below)\nExported: 2026-06-18 10:35:00+02:00\n\n[SMS-001 | 2026-05-21 18:52:00+02:00] Mara Vega\nHas the caterer been paid?\n\n[SMS-002 | 2026-05-21 18:55:00+02:00] Elias Grant\nYes, the payment went at 18:40.\n';
 const n=normalize([item(JSON.stringify(group),'json','group'),item(sms,'txt','sms')]);
 assert.deepEqual(n.counts,{threads:2,participants:2,messages:4,participations:4,directMessages:0});
 assert.deepEqual(n.threads.map(t=>t.title),['Quarter Forum | operations','BRU-SMS-001']);
 assert.equal(n.messages[0].sender,'Elias Grant');assert.equal(n.messages[0].sourceSenderId,'POI-FNET-ELIAS');
 assert.equal(n.messages[0].source.pointer,'/messages/0');assert.equal(n.messages[0].time.utc,'2026-05-15T15:42:00.000Z');
 assert.equal(n.messages[2].time.original,'2026-05-21 18:52:00+02:00');assert.equal(n.messages[2].time.utc,'2026-05-21T16:52:00.000Z');
 for(const m of n.messages.filter(m=>m.source.format==='txt')){assert.equal(sms.slice(m.source.start,m.source.end),m.text);assert.equal(sms.slice(m.source.blockStart,m.source.blockEnd),m.raw);}
 assert.throws(()=>normalize([item(JSON.stringify({...group,messages:[{sender_id:'UNKNOWN',text:'Hello.'}]}),'json','bad')]),e=>e.status===422);
 assert.throws(()=>normalize([item(sms.replace('Elias Grant\nYes,','Unknown Person\nYes,'),'txt','bad')]),e=>e.status===422);
 assert.throws(()=>normalize([item(sms.replace('[SMS-002 |','[SMS-002 :'),'txt','bad')]),e=>e.status===422);
});
test('TXT body offsets and raw blocks exactly reproduce UTF-8-decoded source with CRLF, emoji and BOM',()=>{
 for(const input of [text,text.replace(/\n/g,'\r\n'),'\uFEFF'+text.replace('First line.','First 🙂 line.')]){
  const n=normalize([item(input,'txt')]);for(const m of n.messages){assert.equal(input.slice(m.source.start,m.source.end),m.text);assert.equal(input.slice(m.source.blockStart,m.source.blockEnd),m.raw);assert.equal(input.slice(0,m.source.start).split('\n').length,m.source.bodyLineStart);}
  assert.equal(n.messages[0].source.lineStart,7);assert.equal(n.messages[0].time.zone,'UTC+10:00');assert.equal(n.messages[0].time.sourceZone,'AEST (UTC+10)');
 }
});
test('unrecorded or ambiguous zones and missing times are not assigned the server timezone',()=>{
 const n=normalize([item(text.replace('AEST (UTC+10)','AEST'),'txt')]);assert.equal(n.messages[0].time.utc,null);assert.equal(n.threads[0].chronological,false);
 assert.equal(timestamp(null).precision,'not_recorded');assert.equal(timestamp('2026-09-10T10:00').utc,null);
 assert.equal(timestamp('2026-09-10T10:00-00:00').utc,null);
 for(const value of ['2026-02-29T12:00Z','2026-09-10T25:00Z','2026-09-10T10:99Z','2026-09-10T10:00+14:30','not a date'])assert.throws(()=>timestamp(value));
});
test('CSV retains exact directed recipients and provisional thread grouping',()=>{
 const csv='message_id,sent_at,sender_ref,recipient_ref,message\nM1,2026-09-10T10:00:00Z,0001,0002,"Hi,\nthere."\nM1,2026-09-10T10:00:00Z,0002,0001,Reply';
 const n=normalize([item(csv,'csv')]);assert.equal(n.counts.directMessages,2);assert.equal(n.counts.threads,1);assert.equal(n.links.filter(e=>e.kind==='direct_message').length,2);assert.equal(n.messages[0].sender,'0001');assert.equal(n.messages[0].text,'Hi,\nthere.');assert.equal(n.messages[1].source.record,2);assert.match(n.threads[0].grouping,/Provisional/);assert.notEqual(n.messages[0].id,n.messages[1].id);
});
test('duplicate message IDs remain distinct and ambiguous replies are not resolved',()=>{
 const n=normalize([item(json([{message_id:'X',sender:'Julian Cross',text:'Same'},{message_id:'X',sender:'Julian Cross',text:'Same'},{sender:'Tony Kapoor',text:'Reply',reply_to:'X'}]))]);
 assert.equal(new Set(n.messages.map(m=>m.id)).size,3);assert.equal(n.messages[2].replyToSourceId,'X');assert.equal(n.messages[2].replyToId,null);
 const resolved=normalize([item(json([{message_id:'X',sender:'Julian Cross',text:'First'},{sender:'Tony Kapoor',text:'Reply',reply_to:'X'}]))]);assert.equal(resolved.messages[1].replyToId,resolved.messages[0].id);
});
test('same source thread ID in different files does not merge threads; surnames/handles never fuzzy-merge',()=>{
 const n=normalize([item(json([{sender:'Clara Thornhill',text:'Hello'}],{participants:['Clara Thornhill']}),'json','one'),item(json([{sender:'Roger Thornhill',text:'Hello'},{sender:'thorny58',text:'Hi'}],{participants:[]}),'json','two')]);assert.equal(n.threads.length,2);assert.equal(n.participants.length,3);assert.notEqual(n.threads[0].id,n.threads[1].id);
});
test('participant display labels come from parsed declarations, not arbitrary JSON metadata',()=>{
 const n=normalize([item(json([{sender:'one',text:'Hello'}],{participants:[],declaredLabels:[{name:'Claimed identity',handle:'one'}]}))]);
 assert.deepEqual(n.participants[0].sourceLabels,[]);assert.equal(n.participants[0].name,'one');
 const groups=bracketed.replace('Example One (one) and Example Two (two)','Example One (one), Example Two (two), Mention Only (three)');
 const parsed=normalize([item(groups,'txt')]);assert.equal(parsed.participants.length,2);assert.equal(parsed.participants.find(p=>p.name==='two').sourceLabels[0].name,'Example Two');
});
test('unsupported narratives are reported, while malformed recognised messages fail atomically',()=>{
 const good=item(text,'txt','good'),n=normalize([good,item('Narrative only.','txt','story'),item('{"transactions":[]}','json','ledger')]);assert.equal(n.skipped.length,2);
 for(const bad of [item(json([{sender:'',text:'x'}])),item(json([{sender:'Julian Cross',text:12}])),item(text.replace('20:16','25:16'),'txt'),item(text.replace('20:14','9:14'),'txt'),item(text.replace('Vivienne Hartley:\nThen','Someone Else:\nThen'),'txt')])assert.throws(()=>normalize([good,bad]),e=>e.status===422);
 assert.throws(()=>parseSource({...good,SHA256:'wrong'}),e=>e.status===409);
});
test('HTML-looking message bodies and whitespace remain data, not markup or rewritten text',()=>{
 const body='  <img src=x onerror=alert(1)>\n  Hello & goodbye.  ';
 const n=normalize([item(json([{sender:'Julian Cross',text:body}]))]);assert.equal(n.messages[0].text,body);assert.equal(n.messages[0].raw.text,body);
});
test('limits reject oversized bodies, too many messages and invalid search input',()=>{
 assert.throws(()=>normalize([item(json([{sender:'Julian Cross',text:'x'.repeat(32001)}]))]),e=>e.status===422);
 assert.throws(()=>normalize([item(json(Array.from({length:2001},()=>({sender:'Julian Cross',text:'x'}))))]),e=>e.status===422);
 assert.throws(()=>normalize([item('sender_ref,recipient_ref,message,sent_at\n'+Array.from({length:2001},()=> 'A,B,x,2026-09-10T10:00Z').join('\n'),'csv')]),e=>e.status===422);
 assert.throws(()=>searchTerm('x'.repeat(201)),e=>e.status===400);assert.throws(()=>searchTerm({q:'x'}),e=>e.status===400);assert.equal(searchTerm(' %_ '),'%_');
});
test('read-only builds and hidden graph, search and reader requests are denied before data access',async()=>{
 const calls=[],m=createMessages(async(user,fn)=>fn({execute:async(sql)=>{calls.push(sql);return {rows:[]};}}));
 await assert.rejects(()=>m.build('read_only_viewer','B'),e=>e.status===403);assert.equal(calls.length,0);
 await assert.rejects(()=>m.build('northern_analyst','B'),e=>e.status===404);await assert.rejects(()=>m.read('northern_analyst','B',{q:'agreed'}),e=>e.status===404);await assert.rejects(()=>m.thread('northern_analyst','B','T'),e=>e.status===404);assert(calls.every(q=>q.includes('secure_cdr_batches_v')));
});
test('SMS export CSV aliases preserve exact rows, explicit recipients and conversation IDs',()=>{
 const csv='message_id,conversation_id,timestamp,sender,recipient,text\r\nGM-001,GM-SMS-20260712,2026-07-12T21:06:12+09:30,Gianni,Maria,"You still up?"\r\nGM-002,GM-SMS-20260712,2026-07-12T21:06:31+09:30,Maria,Gianni,"It\'s nine, Gianni."';
 const n=normalize([item(csv,'csv','sms')]);assert.equal(n.threads.length,1);assert.equal(n.threads[0].sourceThreadId,'GM-SMS-20260712');assert.equal(n.messages.length,2);assert.equal(n.messages[0].sender,'Gianni');assert.equal(n.messages[0].recipients[0],'Maria');assert.equal(n.messages[0].raw.text,'You still up?');assert.equal(n.messages[0].time.original,'2026-07-12T21:06:12+09:30');assert.equal(n.messages[0].source.record,1);
 assert.throws(()=>normalize([item('sender,sender_ref,recipient,text,timestamp\nA,X,B,Hello,2026-07-12T21:06:12+09:30','csv')]),/Ambiguous/);
});
test('MP3 turns are separate conversations with transcript provenance, not inferred messages or identities',()=>{
 const {PROMPT_VERSION}=require('../backend/data-room-transcription');
 const body=Buffer.from([255,251,144,100]),speaker='Speaker A',value='Hello, Maria.',transcriptText=speaker+': '+value;
 const make=key=>({ITEM_ID:key,ORIGINAL_PATH:key+'.mp3',CONTENT_TYPE:'mp3',SHA256:hash(body),CONTENT_BLOB:body,TRANSCRIPT_RUN_ID:'saved-description',TRANSCRIPT:{text:transcriptText,turns:[{speaker,text:value,start:speaker.length+2,end:transcriptText.length}],sourceSha256:hash(body),transcriptSha256:hash(Buffer.from(transcriptText)),promptVersion:PROMPT_VERSION,model:'test-model',reviewStatus:'unreviewed_machine_transcript'}});
 const n=normalize([make('audio-one'),make('audio-two')]);assert.equal(n.threads.length,2);assert.equal(n.participants.length,2);assert.notEqual(n.messages[0].senderId,n.messages[1].senderId);assert.equal(n.counts.directMessages,0);assert.equal(n.messages[0].time.utc,null);assert.equal(n.threads[0].chronological,false);assert.equal(n.messages[0].source.format,'mp3-transcript');assert.equal(n.messages[0].source.descriptionRunId,'saved-description');assert.equal(transcriptText.slice(n.messages[0].source.start,n.messages[0].source.end),n.messages[0].text);assert.equal(n.messages[0].sender,'Speaker A');
 const missing=make('missing');delete missing.TRANSCRIPT;assert.equal(normalize([item(json([{sender:'A',text:'Hi'}])),missing]).skipped.length,1);
 const stale=make('stale');stale.TRANSCRIPT.text='tampered';assert.equal(normalize([item(json([{sender:'A',text:'Hi'}])),stale]).skipped.length,1);
});

test('M4A dialogue preserves audio provenance and does not decode binary data as messages',()=>{
 const {PROMPT_VERSION}=require('../backend/data-room-transcription');
 const body=Buffer.from([255,0,254]),text='Speaker A: Hello.';
 const audio={ITEM_ID:'m4a',ORIGINAL_PATH:'sample.m4a',CONTENT_TYPE:'m4a',CONTENT_BLOB:body,SHA256:hash(body),TRANSCRIPT_RUN_ID:'m4a-run',TRANSCRIPT:{text,turns:[{speaker:'Speaker A',text:'Hello.',start:11,end:text.length}],sourceSha256:hash(body),transcriptSha256:hash(Buffer.from(text)),promptVersion:PROMPT_VERSION,model:'test',reviewStatus:'unreviewed_machine_transcript'}};
 const n=normalize([audio]);assert.equal(n.messages[0].source.format,'m4a-transcript');assert.equal(n.messages[0].source.descriptionRunId,'m4a-run');assert.equal(n.threads[0].source.format,'m4a-transcript');assert.equal(n.messages[0].text,'Hello.');assert.equal(n.counts.directMessages,0);
});
