'use strict';
const {parse}=require('csv-parse/sync');
const messages=require('./data-room-messages-model'),money=require('./data-room-money-model');
const {sha,fail}=require('./detective-room-store');
const short=(...v)=>sha(JSON.stringify(v)).slice(0,20);
const sourceLabel=s=>s.path+(s.pointer?' '+s.pointer:s.record?' · data record '+s.record:s.line?' · line '+s.line:'');
function smsExport(item,text){
 if(!/^\uFEFF?SMS CONVERSATION EXPORT\r?\n/.test(text))return null;
 const blocks=[...text.matchAll(/^\[([^|\]\r\n]+) \| (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))\] ([^\r\n]+)\r?\n/gm)];
 if(!blocks.length||blocks.length!==[...text.matchAll(/^\[/gm)].length)throw fail(422,'Malformed SMS export header; no partial conversation was imported.');
 const header=text.slice(0,blocks[0].index),ref=header.match(/^Export reference: ([^\r\n]+)\r?$/m)?.[1];
 const members=header.match(/^Participants: ([^\r\n]+)\r?$/m)?.[1];
 if(!ref||!members)throw fail(422,'SMS export needs an explicit reference and participants.');
 const declared=members.split(';').map(raw=>{
  const m=raw.trim().match(/^(.+?) \[([^\]\r\n]+)\]$/);
  if(!m)throw fail(422,'Unsupported SMS participant declaration.');
  return {name:messages.label(m[1]),reference:messages.label(m[2])};
 });
 const threadId=short(item.ITEM_ID,'sms',ref),src={itemId:item.ITEM_ID,path:item.ORIGINAL_PATH,sha256:item.SHA256,format:'txt'};
 const seen=new Set();
 const records=blocks.map((b,i)=>{
  const sourceMessageId=messages.label(b[1]),sender=messages.label(b[3]);
  if(seen.has(sourceMessageId)||!declared.some(p=>p.name===sender))throw fail(422,'Duplicate SMS ID or undeclared sender.');
  seen.add(sourceMessageId);
  const blockEnd=blocks[i+1]?.index??text.length,start=b.index+b[0].length;
  const body=text.slice(start,blockEnd).replace(/(?:\r?\n)+$/,'');
  if(!body.trim()||Buffer.byteLength(body)>32000)throw fail(422,'Invalid SMS message body.');
  const time=messages.timestamp(b[2].replace(' ','T'));time.original=b[2];
  return {id:short(item.ITEM_ID,'sms',sourceMessageId),threadId,sourceMessageId,sequence:i+1,sender,text:body,time,recipients:[],
   source:{...src,record:i+1,line:1+text.slice(0,b.index).split('\n').length-1,start,end:start+body.length,blockStart:b.index,blockEnd,offsetUnits:'UTF-16 code units; end exclusive'},raw:text.slice(b.index,blockEnd)};
 });
 return {threads:[{id:threadId,title:messages.label(ref),sourceThreadId:ref,declaredParticipants:declared.map(p=>p.name),source:{...src,line:1},metadata:{header,declaredParticipants:declared}}],messages:records};
}
function conversationJSON(item,obj){
 const threads=[],records=[];
 if(!Array.isArray(obj.conversations))throw fail(422,'conversations must be an array.');
 for(const [i,c] of obj.conversations.entries()){
  const id=short(item.ITEM_ID,i),names=c.participants;
  if(!Array.isArray(names)||!Array.isArray(c.messages)||!c.messages.length)throw fail(422,'A conversation needs explicit participants and messages.');
  const declared=names.map(n=>messages.label(n));
  const src={itemId:item.ITEM_ID,path:item.ORIGINAL_PATH,sha256:item.SHA256,pointer:'/conversations/'+i};
  threads.push({id,title:messages.label(c.title||c.conversation_id||('Conversation '+(i+1))),declaredParticipants:declared,source:src});
  for(const [j,m] of c.messages.entries()){
   const sender=messages.label(m.sender),text=m.body??m.text;
   if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>32000)throw fail(422,'Invalid message body.');
   // Do not silently invent recipients from a conversation's member list.
   const recipients=m.recipients??(m.recipient?[m.recipient]:[]);
   if(!Array.isArray(recipients))throw fail(422,'Invalid recipients.');
   records.push({id:short(item.ITEM_ID,i,j),threadId:id,sender,text,time:messages.timestamp(m.timestamp),recipients:recipients.map(n=>messages.label(n)),source:{...src,pointer:src.pointer+'/messages/'+j},raw:m});
  }
 }
 return {threads,messages:records};
}
function normalize(files){
 const result={threads:[],messages:[],records:[],transfers:[],photos:[],texts:[],coverage:[]};let textBytes=0;
 for(const [index,f] of files.entries()){
  const sourceId='S'+String(index+1).padStart(3,'0');
  const item={ITEM_ID:f.itemId||short(f.path),ORIGINAL_PATH:f.path,CONTENT_TYPE:f.type,CONTENT_BLOB:f.content,SHA256:f.sha256};
  f.sourceId=sourceId;
  if(['jpg','png'].includes(f.type)){result.photos.push({path:f.path,sourceId});result.coverage.push({sourceId,path:f.path,mode:'image',bytes:f.bytes});continue;}
  if(['mp3','m4a','mp4'].includes(f.type))throw fail(409,'Media must be prepared using a saved transcript before room analysis: '+f.path);
  textBytes+=f.bytes;
  if(textBytes>500000)throw fail(422,'First-release text analysis limit is 500,000 bytes. No partial room will be published.');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(f.content);
  result.texts.push({sourceId,path:f.path,text,derivedFrom:f.derivedFrom});
  let obj;if(f.type==='json')obj=JSON.parse(text);
  const parsed=obj?.conversations?conversationJSON(item,obj):(f.type==='txt'?smsExport(item,text):null)||messages.parseSource(item);
  if(!parsed.unsupported){result.threads.push(...parsed.threads);result.messages.push(...parsed.messages);}
  if(f.type==='csv'){
   const rows=parse(text,{bom:true,skip_empty_lines:true,max_record_size:64000});
   const headers=rows.shift()||[];
   if(new Set(headers.map(h=>h.trim().toUpperCase())).size!==headers.length)throw fail(422,'Duplicate CSV headers are not supported.');
   for(const [i,cells] of rows.entries())result.records.push({id:short(f.path,i),title:f.path+' · record '+(i+1),source:f.path+' · data record '+(i+1),fields:Object.fromEntries(headers.map((h,j)=>[h,cells[j]??''])),note:'Original CSV values; data record numbering excludes the header.'});
  }
  if(['json','csv'].includes(f.type)){
   const finance=money.parseSource(item);
   if(!finance.unsupported)result.transfers.push(...finance.transfers);
  }
  result.coverage.push({sourceId,path:f.path,mode:f.derivedFrom?'machine-transcript':'complete-text',derivedFrom:f.derivedFrom,bytes:f.bytes,structuredMessages:parsed.messages?.length||0,note:f.derivedFrom?'Unreviewed machine transcript of stored audio; character locators refer to transcript text, not audio timestamps. Speaker labels do not establish identity.':parsed.unsupported||'Source-anchored messages parsed'});
 }
 if(result.messages.length>200||result.threads.length>30||result.records.length>500||result.transfers.length>500||result.photos.length>30)throw fail(422,'Interactive first-release limits exceeded (200 messages, 30 threads/photos, 500 records/transfers). Split the batch; nothing was omitted or published.');
 result.money=money.summarize(result.transfers);
 const names=new Map();
 for(const t of result.threads){
  t.participants=[...new Set([...t.declaredParticipants,...result.messages.filter(m=>m.threadId===t.id).flatMap(m=>[m.sender,...m.recipients])])];
  for(const n of t.participants){if(!names.has(n))names.set(n,[]);names.get(n).push(sourceLabel(t.source));}
 }
 if(names.size>40)throw fail(422,'More than 40 named participants; split the batch.');
 result.people=[...names].map(([name,sourceRefs])=>({id:short(name),name,detail:'Name or handle recorded in source conversation membership; identity and involvement are not independently established.',sourceRefs}));
 return result;
}
module.exports={normalize,conversationJSON,smsExport,sourceLabel,short};
