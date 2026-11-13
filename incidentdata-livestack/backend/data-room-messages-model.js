'use strict';
const {createHash}=require('node:crypto');
const {parse}=require('csv-parse/sync');
const VERSION='cdr-messages-v6';
const LIMITS={sourceBytes:2*1024*1024,totalBytes:8*1024*1024,messages:2000,threads:40,participants:60,nodes:80,links:2500,bodyBytes:32000,pageSize:40};
const hash=value=>createHash('sha256').update(value).digest('hex');
const id=(...parts)=>hash(JSON.stringify(parts));
const fail=(status,message)=>Object.assign(Error(message),{status});
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
function label(value,field='Participant'){
 if(typeof value!=='string'||!value.trim()||Buffer.byteLength(value)>300||/[\x00-\x1f\x7f]/.test(value))throw Error(`${field} must be a non-empty string of at most 300 bytes without control characters.`);
 return value.trim().normalize('NFC');
}
function date(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'0001-01-01'||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('Invalid calendar date.');
 return value;
}
function timestamp(value){
 if(value==null||value==='')return {original:null,utc:null,zone:'Not recorded',precision:'not_recorded'};
 if(typeof value!=='string'||value.length>80)throw Error('Timestamp must be an ISO date/time string.');
 const m=value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/);
 if(!m)throw Error('Timestamp must be ISO YYYY-MM-DDTHH:mm[:ss[.sss]] with an optional explicit offset.');
 date(m[1]);if(+m[2]>23||+m[3]>59||+(m[4]||0)>59)throw Error('Invalid clock time.');
 const zone=m[6]||null;if(zone&&zone!=='Z'){const [h,min]=zone.slice(1).split(':').map(Number);if(h>14||min>59||h===14&&min!==0)throw Error('Invalid UTC offset.');}
 const knownZone=zone&&zone!=='-00:00';
 return {original:value,utc:knownZone?new Date(value).toISOString():null,zone:zone==='Z'?'UTC':knownZone?`UTC${zone}`:'Not recorded',precision:m[5]?'millisecond':m[4]?'second':'minute'};
}
function source(item,locator){return {itemId:item.ITEM_ID,path:item.ORIGINAL_PATH,sha256:item.SHA256,...(item.TRANSCRIPT?{transcriptSha256:item.TRANSCRIPT.transcriptSha256,descriptionRunId:item.TRANSCRIPT_RUN_ID,reviewStatus:'unreviewed_machine_transcript'}:{}),...locator};}
function message(item,threadRef,sequence,fields,locator){
 const sender=label(fields.sender),text=fields.text;
 if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>LIMITS.bodyBytes)throw Error('Message body must be non-empty text of at most 32,000 bytes.');
 const recipients=fields.recipients==null?[]:Array.isArray(fields.recipients)?fields.recipients:[fields.recipients];
 if(recipients.length>LIMITS.participants)throw Error('Too many explicit recipients.');
 const messageId=id(item.ITEM_ID,threadRef,sequence),senderId=fields.participantScope?id('participant',sender,fields.participantScope):id('participant',sender);
 return {id:messageId,threadId:threadRef,sequence,sender,senderId,text,time:timestamp(fields.timestamp),recipients:[...new Set(recipients.map(v=>label(v,'Recipient')))],sourceMessageId:fields.messageId==null?null:label(fields.messageId,'Message ID'),replyToSourceId:fields.replyTo==null?null:label(fields.replyTo,'Reply reference'),source:source(item,locator),raw:fields.raw};
}
function jsonSource(item,text){
 const obj=JSON.parse(text);
 if(obj&&typeof obj==='object'&&!Array.isArray(obj)&&own(obj,'conversations'))return jsonConversationsSource(item,obj);
 if(!obj||Array.isArray(obj)||typeof obj!=='object'||!own(obj,'messages'))return {unsupported:'No top-level messages array'};
 if(!Array.isArray(obj.messages)||!obj.messages.length)throw Error('The messages field must be a non-empty array.');
 if(obj.messages.some(m=>m&&typeof m==='object'&&own(m,'sender_id')))return jsonReferencedSource(item,obj);
 if(obj.messages.length>LIMITS.messages)throw Error('Message count exceeds the 2,000-message limit.');
 const declaredId=obj.thread_id==null?null:label(obj.thread_id,'Thread ID'),threadId=id(item.ITEM_ID,declaredId||'source');
 const declared=obj.participants==null?[]:obj.participants;if(!Array.isArray(declared))throw Error('Participants must be an array of names or handles.');
 const participants=[...new Set(declared.map(v=>label(v)))];
 const messages=obj.messages.map((m,i)=>{
  try{if(!m||typeof m!=='object'||Array.isArray(m))throw Error('Message must be an object.');
   if(own(m,'recipients')&&own(m,'recipient'))throw Error('Use either recipient or recipients, not both.');
   return message(item,threadId,i+1,{sender:m.sender,text:m.text,timestamp:m.timestamp,recipients:m.recipients??m.recipient,messageId:m.message_id,replyTo:m.reply_to,raw:m},{format:'json',pointer:`/messages/${i}`,bodyPointer:`/messages/${i}/text`,record:i+1});
  }catch(e){throw Error(`JSON /messages/${i}: ${e.message}`);}
 });
 return {threads:[{id:threadId,sourceThreadId:declaredId,title:obj.title==null?declaredId||item.ORIGINAL_PATH:label(obj.title,'Thread title'),grouping:declaredId?'Source-declared thread; kept separate per file':'Provisional grouping by source file',declaredParticipants:participants,source:source(item,{format:'json',pointer:''}),metadata:Object.fromEntries(Object.entries(obj).filter(([k])=>k!=='messages'))}],messages};
}
function jsonReferencedSource(item,obj){
 if(!Array.isArray(obj.messages)||!obj.messages.length)throw Error('The messages field must be a non-empty array.');
 if(obj.messages.length>LIMITS.messages)throw Error('Message count exceeds the 2,000-message limit.');
 if(!Array.isArray(obj.participants)||!obj.participants.length)throw Error('Referenced messages require a non-empty participants array.');
 const participants=new Map();
 for(const [i,p] of obj.participants.entries()){
  if(!p||typeof p!=='object'||Array.isArray(p))throw Error(`JSON /participants/${i}: Participant must be an object.`);
  const ref=label(p.person_id,'Participant ID'),name=label(p.display_name,'Participant name');
  if(participants.has(ref))throw Error(`JSON /participants/${i}: Duplicate participant ID.`);
  participants.set(ref,name);
 }
 if(new Set(participants.values()).size!==participants.size)throw Error('Participant display names must be unique within this source conversation.');
 const declaredId=obj.conversation_id==null?null:label(obj.conversation_id,'Conversation ID'),threadId=id(item.ITEM_ID,declaredId||'source');
 const messages=obj.messages.map((m,i)=>{
  try{
   if(!m||typeof m!=='object'||Array.isArray(m))throw Error('Message must be an object.');
   const senderId=label(m.sender_id,'Sender ID'),sender=participants.get(senderId);
   if(!sender)throw Error('Sender ID is absent from the declared participants.');
   const parsed=message(item,threadId,i+1,{sender,text:m.text,timestamp:m.sent_at,recipients:[],messageId:m.message_id,raw:m},{format:'json',pointer:`/messages/${i}`,bodyPointer:`/messages/${i}/text`,record:i+1});
   parsed.sourceSenderId=senderId;return parsed;
  }catch(e){throw Error(`JSON /messages/${i}: ${e.message}`);}
 });
 return {threads:[{id:threadId,sourceThreadId:declaredId,title:obj.conversation_title==null?declaredId||item.ORIGINAL_PATH:label(obj.conversation_title,'Conversation title'),grouping:'Source-declared conversation with participant IDs; kept separate per file',declaredParticipants:[...new Set(participants.values())],source:source(item,{format:'json',pointer:''}),metadata:Object.fromEntries(Object.entries(obj).filter(([k])=>k!=='messages'))}],messages};
}
function jsonConversationsSource(item,obj){
 if(!Array.isArray(obj.conversations)||!obj.conversations.length)throw Error('The conversations field must be a non-empty array.');
 if(obj.conversations.length>LIMITS.threads)throw Error('Conversation count exceeds the 40-thread limit.');
 const threads=[],messages=[];
 for(const [i,conversation] of obj.conversations.entries()){
  const pointer=`/conversations/${i}`;
  try{
   if(!conversation||typeof conversation!=='object'||Array.isArray(conversation))throw Error('Conversation must be an object.');
   if(!Array.isArray(conversation.messages)||!conversation.messages.length)throw Error('Messages must be a non-empty array.');
   if(messages.length+conversation.messages.length>LIMITS.messages)throw Error('Message count exceeds the 2,000-message limit.');
   const declaredId=conversation.conversation_id==null?null:label(conversation.conversation_id,'Conversation ID');
   const threadId=id(item.ITEM_ID,'conversation',i,declaredId);
   const declared=conversation.participants==null?[]:conversation.participants;
   if(!Array.isArray(declared))throw Error('Participants must be an array of names or handles.');
   const participants=[...new Set(declared.map(v=>label(v)))];
   threads.push({id:threadId,sourceThreadId:declaredId,title:conversation.title==null?declaredId||`${item.ORIGINAL_PATH} #${i+1}`:label(conversation.title,'Conversation title'),grouping:declaredId?'Source-declared conversation; kept separate within file':'Conversation grouped by source array position',declaredParticipants:participants,source:source(item,{format:'json',pointer}),metadata:{...Object.fromEntries(Object.entries(obj).filter(([k])=>k!=='conversations')),...Object.fromEntries(Object.entries(conversation).filter(([k])=>k!=='messages'))}});
   for(const [j,m] of conversation.messages.entries()){
    try{
     if(!m||typeof m!=='object'||Array.isArray(m))throw Error('Message must be an object.');
     if(own(m,'recipients')&&own(m,'recipient'))throw Error('Use either recipient or recipients, not both.');
     messages.push(message(item,threadId,j+1,{sender:m.sender,text:m.body,timestamp:m.timestamp,recipients:m.recipients??m.recipient,messageId:m.message_id,replyTo:m.reply_to,raw:m},{format:'json',pointer:`${pointer}/messages/${j}`,bodyPointer:`${pointer}/messages/${j}/body`,record:j+1}));
    }catch(e){throw Error(`messages/${j}: ${e.message}`);}
   }
  }catch(e){throw Error(`JSON ${pointer}: ${e.message}`);}
 }
 return {threads,messages};
}
const sectionPattern=/^(\d{1,2}) ([A-Za-z]+) (\d{4})\s+[–—-]\s+(\d{1,2}:\d{2})$/;
const speakerPattern=/^([^:\r\n→]+?)(?:\s*(?:→|->)\s*([^:\r\n→]+?))?:$/;
const bracketHeader=/^(?:\*\*)?\[([^\]\r\n]+)\](?:\*\*)?[\t ]*$/;
const bracketDate=/^([A-Za-z]+) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))? (AM|PM)$/i;
const inlineSpeaker=/^(?:\*\*([^*:\r\n]+):\*\*|([^*:\r\n]+):)[\t ]*/;
const undecorate=value=>value.trim().replace(/^\*{1,2}(.*?)\*{1,2}$/, '$1');
function textFormat(text){
 if(/^(?:\uFEFF)?SYNTHETIC CONVERSATION\r?\n/.test(text))return 'structured';
 if(/^(?:\uFEFF)?SMS CONVERSATION EXPORT\r?\n/.test(text))return 'sms-export';
 const lines=text.replace(/^\uFEFF/,'').trimStart().split(/\r?\n/);
 // A declared export heading also exposes malformed dates for validation.
 // Do not classify narrative mentions or filenames as conversations.
 if(/^WhatsApp Conversation:/.test(undecorate(lines[0]||'')))return 'bracketed';
 if(bracketHeader.test(lines[0]||'')&&inlineSpeaker.test(lines.slice(1).find(l=>l.trim())||''))return 'bracketed';
 if(sectionPattern.test(lines[0]?.trim())&&speakerPattern.test(lines.slice(1).find(l=>l.trim())?.trim()||''))return 'dated';
 return null;
}
function smsExportSource(item,text){
 const header=text.match(/^(?:\uFEFF)?SMS CONVERSATION EXPORT\r?\nExport reference: ([^\r\n]+)\r?\nParticipants: ([^\r\n]+)\r?\nTimezone: ([^\r\n]+)\r?\nExported: ([^\r\n]+)\r?\n\r?\n/);
 if(!header)throw Error('SMS export header is incomplete or malformed.');
 const declared=header[2].split(';').map((entry,i)=>{
  const match=entry.trim().match(/^(.+?) \[([^\]\r\n]+)\]$/);
  if(!match)throw Error(`SMS participant ${i+1} must declare a name and source ID.`);
  return {name:label(match[1]),id:label(match[2],'Participant ID')};
 });
 if(new Set(declared.map(p=>p.id)).size!==declared.length||new Set(declared.map(p=>p.name)).size!==declared.length)throw Error('SMS export has duplicate participants.');
 const threadRef=label(header[1],'Export reference'),threadId=id(item.ITEM_ID,threadRef);
 const pattern=/^\[([^|\]\r\n]+) \| (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))\] ([^\r\n]+)\r?\n/gm;
 const matches=[...text.matchAll(pattern)];
 if(!matches.length)throw Error('SMS export contains no message blocks.');
 if(matches.length>LIMITS.messages)throw Error('Message count exceeds the 2,000-message limit.');
 const lineAt=offset=>text.slice(0,offset).split('\n').length;
 const messages=matches.map((m,i)=>{
  const blockEnd=matches[i+1]?.index??text.length,start=m.index+m[0].length;
  const body=text.slice(start,blockEnd).replace(/(?:\r?\n)+$/,''),end=start+body.length;
  if(!declared.some(p=>p.name===m[3]))throw Error(`SMS message ${i+1}: sender is absent from the declared participants.`);
  if(/^\[[^\r\n]+\]\s+[^\r\n]+/m.test(body))throw Error(`SMS message ${i+1}: unrecognised message header; no partial conversation was imported.`);
  const parsed=message(item,threadId,i+1,{sender:m[3],text:body,timestamp:m[2].replace(' ','T'),messageId:m[1].trim(),raw:text.slice(m.index,blockEnd)},
   {format:'txt',record:i+1,lineStart:lineAt(m.index),lineEnd:lineAt(Math.max(start,end-1)),bodyLineStart:lineAt(start),start,end,blockStart:m.index,blockEnd,offsetUnits:'UTF-16 code units; end exclusive'});
  parsed.time.original=m[2];return parsed;
 });
 return {threads:[{id:threadId,sourceThreadId:threadRef,title:threadRef,grouping:'Source-declared SMS conversation; one thread per file',declaredParticipants:declared.map(p=>p.name),source:source(item,{format:'txt',start:0,end:text.length,lineStart:1,lineEnd:lineAt(text.length)}),metadata:{format:'sms-export',header:text.slice(0,header[0].length),timezone:header[3],exportedAt:header[4],participants:declared}}],messages};
}
function bracketedTextSource(item,text){
 const lines=[];let offset=0;
 for(const raw of text.split(/(?<=\n)/)){lines.push({text:raw.replace(/\r?\n$/,''),start:offset,end:offset+raw.length});offset+=raw.length;}
 const threadId=id(item.ITEM_ID,'bracketed-source'),messages=[];let pending=null,bodyStart=null,bodyLine=null,title=null;
 const prelude=[],declaredLabels=[];
 const flush=end=>{
  if(!pending)return;
  if(bodyStart===null)throw Error(`Timestamp at line ${pending.line+1} has no speaker and message.`);
  const body=text.slice(bodyStart,end).replace(/(?:\r?\n)+$/,''),bodyEnd=bodyStart+body.length;
  const m=message(item,threadId,messages.length+1,{sender:pending.sender,text:body,raw:text.slice(lines[pending.line].start,end)},
   {format:'txt',record:messages.length+1,lineStart:pending.line+1,lineEnd:bodyLine+text.slice(bodyStart,Math.max(bodyStart,bodyEnd-1)).split('\n').length,bodyLineStart:bodyLine+1,start:bodyStart,end:bodyEnd,blockStart:lines[pending.line].start,blockEnd:end,offsetUnits:'UTF-16 code units; end exclusive'});
  m.time=pending.time;messages.push(m);pending=null;bodyStart=null;
  if(messages.length>LIMITS.messages)throw Error('Message count exceeds the 2,000-message limit.');
 };
 for(const [i,line]of lines.entries()){
  const value=line.text.replace(/^\uFEFF/,''),header=value.match(bracketHeader);
  if(header){
   flush(line.start);const parts=header[1].match(bracketDate);
   if(!parts)throw Error(`Unsupported bracketed timestamp at line ${i+1}; expected Month D, YYYY, h:mm AM/PM.`);
   const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
   const month=months.findIndex(m=>m===parts[1].toLowerCase()||m.slice(0,3)===parts[1].toLowerCase())+1,hour=Number(parts[4]);
   if(hour<1||hour>12)throw Error(`Invalid 12-hour clock at line ${i+1}.`);
   const local=`${parts[3]}-${String(month).padStart(2,'0')}-${parts[2].padStart(2,'0')}T${String(hour%12+(parts[7].toUpperCase()==='PM'?12:0)).padStart(2,'0')}:${parts[5]}${parts[6]?':'+parts[6]:''}`;
   const time={...timestamp(local),original:header[1],local};pending={line:i,time};continue;
  }
  if(/^\s*(?:\*\*)?\[[A-Za-z]+\s+\d/.test(value))throw Error(`Malformed bracketed timestamp at line ${i+1}; no partial conversation was imported.`);
  if(!pending){
   if(!value.trim())continue;
   const clean=undecorate(value);
   if(!messages.length&&!title&&/^WhatsApp Conversation:/.test(clean)){
    title=label(clean.slice('WhatsApp Conversation:'.length),'Conversation title');prelude.push(value);
    // Only fully structured, explicitly declared name(handle) pairs are labels.
    const pairs=[...title.matchAll(/([^(),]+?)\s*\(([^()]+)\)(?:,\s*|\s+and\s+|$)/g)];
    if(pairs.map(p=>p[0]).join('')===title)for(const p of pairs)declaredLabels.push({name:label(p[1]),handle:label(p[2]),source:source(item,{format:'txt',lineStart:i+1,lineEnd:i+1,start:line.start,end:line.start+line.text.length})});
   }else if(!messages.length&&title&&/^\(Group:.*\)$/.test(clean))prelude.push(value);
   else throw Error(`Unrecognised conversation header at line ${i+1}.`);
  }else if(bodyStart===null){
   if(!value.trim())continue;
   const speaker=value.match(inlineSpeaker);if(!speaker)throw Error(`Expected Sender: message after timestamp at line ${i+1}.`);
   pending.sender=label(speaker[1]||speaker[2]);bodyLine=i;bodyStart=line.start+speaker[0].length;
   if(bodyStart===line.start+line.text.length){bodyStart=line.end;bodyLine=i+1;}
  }
 }
 flush(text.length);if(!messages.length)throw Error('Bracketed conversation has no messages.');
 return {threads:[{id:threadId,sourceThreadId:null,title:title||item.ORIGINAL_PATH.split('/').pop(),grouping:'Conversation grouped by source file; participants taken from recorded speakers',declaredParticipants:[],declaredLabels,source:source(item,{format:'txt',start:0,end:text.length,lineStart:1,lineEnd:lines.length}),metadata:{format:'bracketed-chat',header:prelude.join('\n')}}],messages};
}
function datedTextSource(item,text){
 const lines=[];let offset=0;
 for(const raw of text.split(/(?<=\n)/)){lines.push({text:raw.replace(/\r?\n$/,'').replace(/^\uFEFF/,''),start:offset,end:offset+raw.length});offset+=raw.length;}
 const threadId=id(item.ITEM_ID,'dated-source'),messages=[],sections=[];
 let section=null,pending=null;
 const flush=end=>{
  if(!pending)return;
  const start=lines[pending.line].end,body=text.slice(start,end).replace(/(?:\r?\n)+$/,'');
  const bodyEnd=start+body.length;
  const m=message(item,threadId,messages.length+1,{sender:pending.sender,recipients:pending.recipient?[pending.recipient]:[],text:body,raw:text.slice(lines[pending.line].start,end)},
   {format:'txt',record:messages.length+1,lineStart:pending.line+1,lineEnd:pending.line+1+text.slice(lines[pending.line].start,Math.max(start,bodyEnd-1)).split('\n').length-1,bodyLineStart:pending.line+2,start,end:bodyEnd,blockStart:lines[pending.line].start,blockEnd:end,offsetUnits:'UTF-16 code units; end exclusive'});
  m.section=section;messages.push(m);pending=null;
  if(messages.length>LIMITS.messages)throw Error('Message count exceeds the 2,000-message limit.');
 };
 for(const [i,line] of lines.entries()){
  const value=line.text.trim(),parts=value.match(sectionPattern);
  if(parts){
   flush(line.start);
   if(section&&!messages.some(m=>m.section.index===section.index))throw Error('Dated conversation section has no messages.');
   const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
   const month=months.findIndex(m=>m===parts[2].toLowerCase()||m.slice(0,3)===parts[2].toLowerCase())+1;
   const time=timestamp(`${parts[3]}-${String(month).padStart(2,'0')}-${parts[1].padStart(2,'0')}T${parts[4].padStart(5,'0')}`);
   section={index:sections.length+1,header:value,time,source:source(item,{format:'txt',lineStart:i+1,lineEnd:i+1,start:line.start,end:line.end})};sections.push(section);continue;
  }
  const speaker=value.match(speakerPattern);
  // Only standalone headers at block boundaries are structural. Ordinary
  // colon-bearing prose inside a message stays untouched.
  if(speaker&&(i===0||!lines[i-1].text.trim()||!pending)){
   flush(line.start);if(!section)throw Error('Speaker block is missing its date section.');
   pending={line:i,sender:label(speaker[1]),recipient:speaker[2]?label(speaker[2]):null};continue;
  }
  if(value&&!pending)throw Error(`Unrecognised conversation header at line ${i+1}; no partial conversation was imported.`);
  if(value&&/^\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/.test(value)&&/[:–—]/.test(value))throw Error(`Malformed date section at line ${i+1}.`);
 }
 flush(text.length);
 if(!messages.length||!messages.some(m=>m.section.index===section?.index))throw Error('Dated conversation section has no messages.');
 return {threads:[{id:threadId,sourceThreadId:null,title:item.ORIGINAL_PATH.split('/').pop(),grouping:'Message pack grouped by source file; dated sections retained in source order',declaredParticipants:[],source:source(item,{format:'txt',start:0,end:text.length,lineStart:1,lineEnd:lines.length}),metadata:{format:'dated-speaker-blocks',sections}}],messages};
}
function textSource(item,text){
 const format=textFormat(text);
 if(format==='sms-export')return smsExportSource(item,text);
 if(format==='bracketed')return bracketedTextSource(item,text);
 if(format==='dated')return datedTextSource(item,text);
 if(format!=='structured')return {unsupported:'No supported structured or dated speaker-block conversation (plain text is not inferred)'};
 const matches=[...text.matchAll(/^(\d{2}:\d{2})(?:\s+[—–-]\s+)([^\r\n]+):\r?\n/gm)];
 if(!matches.length)throw Error('Structured conversation has no timed speaker blocks.');
 if(matches.length>LIMITS.messages)throw Error('Message count exceeds the 2,000-message limit.');
 if([...text.matchAll(/^\d{1,2}:\d{2}[^\r\n]*:\r?$/gm)].length!==matches.length)throw Error('Unrecognised timed speaker header; no partial conversation was imported.');
 if([...text.matchAll(/^Thread:/gm)].length!==1)throw Error('Structured TXT supports one declared thread per file.');
 const header=text.slice(0,matches[0].index),get=name=>header.match(new RegExp('^'+name+':[^\\S\\r\\n]*(.*)$','m'))?.[1].replace(/\r$/,'');
 const threadName=label(get('Thread'),'Thread ID'),threadId=id(item.ITEM_ID,threadName),declared=get('Participants');
 if(!declared)throw Error('Structured text requires a Participants header.');
 const participants=[...new Set(declared.split(/,\s*|\s+and\s+/).map(v=>label(v)))];
 const rawDate=get('Date')||'',rawZone=get('Time zone')||null;
 const parts=rawDate.match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/),months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const day=parts?`${parts[3]}-${String(months.indexOf(parts[2].toLowerCase())+1).padStart(2,'0')}-${parts[1].padStart(2,'0')}`:rawDate;date(day);
 // Use only an explicit numeric offset. An abbreviation alone is not enough
 // to infer a zone or daylight-saving rule for arbitrary source material.
 let zone='';if(rawZone){const z=rawZone.match(/UTC([+-])(\d{1,2})(?::(\d{2}))?/);if(z)zone=`${z[1]}${z[2].padStart(2,'0')}:${z[3]||'00'}`;else if(/^UTC$/.test(rawZone))zone='Z';}
 const lineStarts=[0];for(const newline of text.matchAll(/\n/g))lineStarts.push(newline.index+1);
 const lineAt=offset=>{let lo=0,hi=lineStarts.length;while(lo<hi){const mid=(lo+hi)>>>1;if(lineStarts[mid]<=offset)lo=mid+1;else hi=mid;}return lo;};
 const messages=matches.map((m,i)=>{
  const blockEnd=matches[i+1]?.index??text.length,start=m.index+m[0].length;
  const body=text.slice(start,blockEnd).replace(/(?:\r?\n)+$/,'');
  // A malformed speaker header must not quietly become part of a preceding
  // body. Unsupported shapes fail as a whole instead of losing records.
  if(/^\d{1,2}:\d{2}.*[—–].*:/m.test(body))throw Error(`Unrecognised speaker header in block ${i+1}.`);
  const end=start+body.length;
  const parsed=message(item,threadId,i+1,{sender:m[2],text:body,timestamp:`${day}T${m[1]}${zone}`,raw:text.slice(m.index,blockEnd)},{format:'txt',record:i+1,lineStart:lineAt(m.index),lineEnd:lineAt(Math.max(start,end-1)),bodyLineStart:lineAt(start),start,end,blockStart:m.index,blockEnd,offsetUnits:'UTF-16 code units; end exclusive'});
  parsed.time.sourceZone=rawZone;return parsed;
 });
 const unlisted=messages.filter(m=>!participants.includes(m.sender));if(unlisted.length)throw Error('A speaker does not match the declared Participants header.');
 return {threads:[{id:threadId,sourceThreadId:threadName,title:threadName,grouping:'Source-declared thread; kept separate per file',declaredParticipants:participants,source:source(item,{format:'txt',start:0,end:header.length,lineStart:1,lineEnd:lineAt(header.length)}),metadata:{header,date:rawDate,timeZone:rawZone}}],messages};
}
function csvColumns(keys){
 const result={};for(const [field,aliases] of Object.entries({sender:['sender_ref','sender'],recipient:['recipient_ref','recipient'],text:['message','text'],timestamp:['sent_at','timestamp']})){
  const found=aliases.filter(a=>keys.includes(a));if(!found.length)return null;if(found.length>1)throw Error('Ambiguous message CSV columns: '+aliases.join('/'));result[field]=found[0];
 }
 const threads=['thread_id','conversation_id'].filter(a=>keys.includes(a));if(threads.length>1)throw Error('Ambiguous thread_id/conversation_id columns.');result.thread=threads[0]||null;return result;
}
function transcriptSource(item){
 const t=item.TRANSCRIPT;
 if(!t||!require('./data-room-transcription').reusable(t,item.SHA256,true))return {unsupported:'Run Stage 4 Identify/Describe to save a speaker-turn MP3/M4A transcript.'};
 const threadId=id(item.ITEM_ID,'audio-transcript'),messages=t.turns.map((turn,i)=>message(item,threadId,i+1,{sender:turn.speaker,text:turn.text,participantScope:item.ITEM_ID,raw:t.text.slice(turn.start-turn.speaker.length-2,turn.end)},
  {format:item.CONTENT_TYPE+'-transcript',record:i+1,start:turn.start,end:turn.end,blockStart:turn.start-turn.speaker.length-2,blockEnd:turn.end,offsetUnits:'UTF-16 machine transcript characters; end exclusive'}));
 return {threads:[{id:threadId,sourceThreadId:null,title:item.ORIGINAL_PATH.split('/').pop()+' · Audio transcript',participantScope:item.ITEM_ID,grouping:'Unreviewed machine transcript; neutral speaker labels are specific to this audio, not verified identities',declaredParticipants:[],source:source(item,{format:item.CONTENT_TYPE+'-transcript'}),metadata:{format:item.CONTENT_TYPE+'-transcript',language:t.language,model:t.model,reviewStatus:t.reviewStatus}}],messages};
}
function analysisBytes(item){return ['mp3','m4a'].includes(item.CONTENT_TYPE)?Buffer.byteLength(item.TRANSCRIPT?.text||''):item.BYTE_COUNT??item.CONTENT_BLOB?.length??0;}
function csvSource(item,text){
 const records=parse(text,{bom:true,skip_empty_lines:true,max_record_size:64000});if(!records.length)return {unsupported:'Empty CSV'};
 const headers=records.shift(),keys=headers.map(h=>h.trim().toLowerCase());
 const columns=csvColumns(keys);if(!columns)return {unsupported:'No supported sender/recipient/text/timestamp or sender_ref/recipient_ref/message/sent_at columns'};
 if(records.length>LIMITS.messages)throw Error('Message count exceeds the 2,000-message limit.');
 if(new Set(keys).size!==keys.length)throw Error('Duplicate CSV column names.');
 const threads=new Map(),messages=[];
 for(const [i,cells] of records.entries()){
  try{
   const row=Object.fromEntries(keys.map((k,j)=>[k,cells[j]])),sender=label(row[columns.sender]),recipient=label(row[columns.recipient],'Recipient'),declaredId=columns.thread&&row[columns.thread]?label(row[columns.thread],'Thread ID'):null;
   const pair=[...new Set([sender,recipient])].sort(),threadId=id(item.ITEM_ID,declaredId?['declared',declaredId]:['pair',pair]);
   if(!threads.has(threadId))threads.set(threadId,{id:threadId,sourceThreadId:declaredId,title:declaredId||pair.join(' ↔ '),grouping:declaredId?'Source-declared thread; kept separate per file':'Provisional grouping by source file and exact participant pair',declaredParticipants:[],source:source(item,{format:'csv'}),metadata:{columns:headers}});
   const sequence=messages.filter(m=>m.threadId===threadId).length+1;
   messages.push(message(item,threadId,sequence,{sender,text:row[columns.text],timestamp:row[columns.timestamp],recipients:[recipient],messageId:row.message_id||null,replyTo:row.reply_to||null,raw:Object.fromEntries(headers.map((k,j)=>[k,cells[j]]))},{format:'csv',record:i+1}));
  }catch(e){throw Error(`CSV data record ${i+1}: ${e.message}`);}
 }
 if(!messages.length)throw Error('Message CSV contains no records.');return {threads:[...threads.values()],messages};
}
function parseSource(item){
 if(analysisBytes(item)>LIMITS.sourceBytes)throw fail(422,`${item.ORIGINAL_PATH}: source exceeds the 2 MiB messages limit.`);
 if(hash(item.CONTENT_BLOB)!==item.SHA256)throw fail(409,`${item.ORIGINAL_PATH}: source checksum mismatch.`);
 if(['mp3','m4a'].includes(item.CONTENT_TYPE))return transcriptSource(item);
 try{const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(item.CONTENT_BLOB),body=text.replace(/^\uFEFF/,'');
  // TXT offsets must refer to the exact decoded source, including any BOM.
  if(item.CONTENT_TYPE==='txt')return textSource(item,text);
  if(item.CONTENT_TYPE==='json')return jsonSource(item,body);
  if(item.CONTENT_TYPE==='csv')return csvSource(item,body);
  return {unsupported:'Not a supported message source type'};
 }catch(e){throw fail(422,`${item.ORIGINAL_PATH}: ${e.message}`);}
}
function normalize(items){
 const threads=[],messages=[],sources=[],skipped=[];let bytes=0;
 for(const item of items){bytes+=analysisBytes(item);if(bytes>LIMITS.totalBytes)throw fail(422,'Text sources exceed the 8 MiB messages build limit.');
  const parsed=parseSource(item);if(parsed.unsupported){skipped.push({itemId:item.ITEM_ID,path:item.ORIGINAL_PATH,reason:parsed.unsupported});continue;}
  threads.push(...parsed.threads);messages.push(...parsed.messages);sources.push(source(item,{messages:parsed.messages.length,threads:parsed.threads.length}));
  if(messages.length>LIMITS.messages||threads.length>LIMITS.threads)throw fail(422,'Messages view supports at most 2,000 messages and 40 threads per batch. No partial snapshot was saved.');
 }
 if(!messages.length)throw fail(422,'No supported conversations found. Use structured JSON messages or conversations, SMS or bracketed chat TXT, structured conversation TXT, or sender/recipient message CSV.');
 const participants=new Map(),memberships=[],direct=[];
 const ensure=(name,scope)=>{const key=scope?id('participant',name,scope):id('participant',name);if(!participants.has(key))participants.set(key,{id:key,name,threadIds:[],sentCount:0,receivedCount:0});return participants.get(key);};
 for(const t of threads){
  const ownMessages=messages.filter(m=>m.threadId===t.id),names=[...new Set([...t.declaredParticipants,...ownMessages.flatMap(m=>[m.sender,...m.recipients])])];
  t.messageCount=ownMessages.length;t.participantIds=names.map(n=>ensure(n,t.participantScope).id);t.chronological=ownMessages.every(m=>m.time.utc);t.firstTime=(t.chronological?[...ownMessages].sort((a,b)=>a.time.utc.localeCompare(b.time.utc)||a.sequence-b.sequence):ownMessages)[0].time;
  t.recordedDates=[...new Set(ownMessages.map(m=>(m.time.local||m.time.original||m.section?.time.original||'').match(/^\d{4}-\d{2}-\d{2}/)?.[0]).filter(Boolean))].sort();
  const sourceIds=new Map();for(const m of ownMessages)if(m.sourceMessageId){if(!sourceIds.has(m.sourceMessageId))sourceIds.set(m.sourceMessageId,[]);sourceIds.get(m.sourceMessageId).push(m.id);}
  for(const m of ownMessages){m.replyToId=m.replyToSourceId&&sourceIds.get(m.replyToSourceId)?.length===1?sourceIds.get(m.replyToSourceId)[0]:null;
   for(const r of m.recipients)direct.push({id:id('direct',m.id,r),from:m.senderId,to:ensure(r).id,threadId:t.id,messageId:m.id,kind:'direct_message',count:1});}
  for(const name of names){const p=ensure(name,t.participantScope),sent=ownMessages.filter(m=>m.sender===name).length,received=ownMessages.filter(m=>m.recipients.includes(name)).length;p.threadIds.push(t.id);p.sentCount+=sent;p.receivedCount+=received;
   p.sourceLabels??=[];for(const declared of t.declaredLabels||[])if(declared.handle===name)p.sourceLabels.push(declared);
   memberships.push({id:id('membership',t.id,p.id),from:p.id,to:t.id,threadId:t.id,kind:'participation',count:sent,receivedCount:received,declared:t.declaredParticipants.includes(name)});}
 }
 const people=[...participants.values()].sort((a,b)=>a.name.localeCompare(b.name));
 if(people.length>LIMITS.participants||people.length+threads.length>LIMITS.nodes||memberships.length+direct.length>LIMITS.links)throw fail(422,'Conversation graph exceeds the 60-participant, 80-node or 2,500-link display limit. Split the batch; no partial snapshot was saved.');
 return {version:VERSION,threads,participants:people,messages,links:[...memberships,...direct],sources,skipped,limits:LIMITS,counts:{threads:threads.length,participants:people.length,messages:messages.length,participations:memberships.length,directMessages:messages.filter(m=>m.recipients.length).length},identityBasis:'Exact source names/handles within this batch; not verified POI identities. No surname or alias inference.'};
}
module.exports={csvColumns,analysisBytes,transcriptSource,VERSION,LIMITS,hash,id,fail,label,date,timestamp,textFormat,parseSource,normalize};
