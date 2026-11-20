import React,{useEffect,useId,useRef,useState} from 'react';
import {cataloguePortrait,messageOrder,recordedDay,senderHue} from './message-presentation.mjs';
import './batch-messages.css';
const queryString=values=>new URLSearchParams(Object.entries(values).filter(([,v])=>v!==''&&v!=null)).toString();
const timeLabel=time=>time?.original?`${time.original.replace('T',' · ')}${time.sourceZone?` · ${time.sourceZone}`:''}${!time.utc?' · UTC offset not recorded':''}`:'Time not recorded · source order retained';
const initials=name=>{const words=name.trim().split(/\s+/);return (words.length>1?Array.from(words[0])[0]+Array.from(words.at(-1))[0]:Array.from(name).slice(0,2).join('')).toUpperCase();};
const participantLabel=p=>{const names=[...new Set((p.sourceLabels||[]).map(l=>l.name))];return names.length===1?names[0]:p.name;};
const avatarHue=name=>Array.from(name).reduce((h,c)=>(h*31+c.codePointAt(0))%360,0);
function Avatar({name,portrait}){const [failed,setFailed]=useState(''),[loaded,setLoaded]=useState('');return <span className="cdr-msg-avatar" style={{'--avatar-hue':avatarHue(name)}} aria-hidden="true">{initials(name)}{portrait&&failed!==portrait.uri&&<img src={portrait.uri} alt="" loading="lazy" decoding="async" style={{opacity:loaded===portrait.uri?1:0}} onLoad={()=>setLoaded(portrait.uri)} onError={()=>setFailed(portrait.uri)}/>}</span>;}
const dateRange=t=>t.recordedDates?.length?`${t.recordedDates[0]}${t.recordedDates.length>1?' – '+t.recordedDates.at(-1):''}`:'Date range not recorded';
const byRecordedDate=(a,b)=>(a.recordedDates?.[0]||'9999').localeCompare(b.recordedDates?.[0]||'9999')||a.source.path.localeCompare(b.source.path);
function Participants({data,selected,onSelect}){
 const p=data.participants.find(p=>p.id===selected);
 return <section className="cdr-msg-participants" aria-label="Source participants"><h4>People in these conversations</h4><p className="cdr-small">Names and handles from this batch. Avatars use initials; no photo is needed. Select a participant to explore their conversations.</p>
  <div className="cdr-msg-person-cards">{data.participants.map(p=><button key={p.id} aria-pressed={p.id===selected} aria-label={`Conversations for ${p.name}`} onClick={()=>onSelect(p.id===selected?'':p.id)}><Avatar name={p.name}/><span><strong>{participantLabel(p)}</strong>{participantLabel(p)!==p.name&&<span className="cdr-msg-handle">{p.name}</span>}<small>{p.sentCount} sent · {p.threadIds.length} conversations</small></span></button>)}</div>
  {p&&<div className="cdr-msg-participant-detail"><h4>{participantLabel(p)} · {p.name}</h4><p>{p.sentCount} messages sent. {p.receivedCount} messages explicitly addressed to this participant.</p><p className="cdr-small">Source participant · identity unverified. A name in a message body does not create a participant or a POI link.</p>
   {!!p.sourceLabels?.length&&<details><summary>Names recorded for this handle</summary>{p.sourceLabels.map((l,i)=><p key={i}>{l.name} ({l.handle}) — {l.source.path}, line {l.source.lineStart}</p>)}</details>}
   <p className="cdr-small">Also present in these conversations:</p><div className="cdr-msg-peers">{data.participants.filter(other=>other.id!==p.id).map(other=>{const shared=data.threads.filter(t=>t.participantIds.includes(p.id)&&t.participantIds.includes(other.id));return shared.length?<span key={other.id}>{other.name} · {shared.length} shared</span>:null;})}</div>
  </div>}
 </section>;
}
function Highlight({text,query}){
 if(!query)return text;const parts=[],lower=text.toLowerCase(),needle=query.toLowerCase();let position=0,index;
 while(parts.length<400&&(index=lower.indexOf(needle,position))!==-1){parts.push(text.slice(position,index));parts.push(<mark key={index}>{text.slice(index,index+query.length)}</mark>);position=index+query.length;}
 parts.push(text.slice(position));return parts;
}
function ConversationGraph({data,participant,threadId,onParticipant,onThread,search}){
 const people=data.participants,threads=data.threads,height=Math.max(380,people.length*100+70,threads.length*115+70),width=940;
 const positions=new Map(),activeThreads=new Set(threads.filter(t=>(!participant||t.participantIds.includes(participant))&&(!search||t.matchCount>0)).map(t=>t.id));
 people.forEach((p,i)=>positions.set(p.id,{x:185,y:height/2+(i-(people.length-1)/2)*100}));threads.forEach((t,i)=>positions.set(t.id,{x:730,y:height/2+(i-(threads.length-1)/2)*115}));
 const activate=(e,fn)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}};
 return <div className="cdr-msg-graph" tabIndex="0" aria-label="Conversation graph. Select a participant or thread."><svg viewBox={`0 0 ${width} ${height}`} style={{minWidth:760}} role="group" aria-label="Source participants and conversation threads">
  {data.links.filter(e=>e.kind==='participation').map(e=>{const a=positions.get(e.from),b=positions.get(e.to),selected=e.threadId===threadId,dim=!activeThreads.has(e.threadId)||(participant&&e.from!==participant);return <g key={e.id} tabIndex="0" role="button" className={`cdr-msg-edge ${selected?'is-selected':''} ${dim?'is-dim':''}`} aria-label={`${people.find(p=>p.id===e.from)?.name}: ${e.count} sent in ${threads.find(t=>t.id===e.to)?.title}`} onClick={()=>onThread(e.threadId)} onKeyDown={event=>activate(event,()=>onThread(e.threadId))}>
   <path className="cdr-msg-hit" d={`M ${a.x+140} ${a.y} C 430 ${a.y} 470 ${b.y} ${b.x-160} ${b.y}`}/><path className="cdr-msg-line" d={`M ${a.x+140} ${a.y} C 430 ${a.y} 470 ${b.y} ${b.x-160} ${b.y}`}/><text x="397" y={a.y*.84375+b.y*.15625-8} textAnchor="middle">{e.count} sent{e.count===0?' · participant':''}</text>
  </g>;})}
  {people.map(p=>{const pos=positions.get(p.id);return <g key={p.id} transform={`translate(${pos.x},${pos.y})`} role="button" tabIndex="0" className={`cdr-msg-node cdr-msg-person ${participant===p.id?'is-selected':''}`} aria-label={`${p.name}, ${p.sentCount} messages sent, ${p.threadIds.length} conversations`} onClick={()=>onParticipant(participant===p.id?'':p.id)} onKeyDown={e=>activate(e,()=>onParticipant(participant===p.id?'':p.id))}><title>{p.name}</title><rect x="-140" y="-36" width="280" height="72" rx="12"/><text textAnchor="middle" y="-5">{p.name.length>32?p.name.slice(0,31)+'…':p.name}</text><text className="cdr-msg-subtitle" textAnchor="middle" y="18">{p.sentCount} sent · {p.threadIds.length} conversation{p.threadIds.length===1?'':'s'}</text></g>;})}
  {threads.map(t=>{const pos=positions.get(t.id);return <g key={t.id} transform={`translate(${pos.x},${pos.y})`} role="button" tabIndex="0" className={`cdr-msg-node cdr-msg-thread ${threadId===t.id?'is-selected':''} ${!activeThreads.has(t.id)?'is-dim':''}`} aria-label={`${t.title}, ${t.messageCount} messages`} onClick={()=>onThread(t.id)} onKeyDown={e=>activate(e,()=>onThread(t.id))}><title>{t.title} · {t.sourceThreadId||t.source.path}</title><rect x="-160" y="-40" width="320" height="80" rx="8"/><text textAnchor="middle" y="-15">{t.title.length>37?t.title.slice(0,36)+'…':t.title}</text><text className="cdr-msg-subtitle" textAnchor="middle" y="5">{t.messageCount} messages · {t.participantIds.length} participants</text><text className="cdr-msg-subtitle" textAnchor="middle" y="24">{t.sourceThreadId||'Source grouping'}</text></g>;})}
 </svg></div>;
}
function SourceReference({message,onOpenSource,download,batchId}){
 const s=message.source;
 return <details className="cdr-msg-source"><summary>Source · {s.path} · {s.format==='json'?s.pointer:s.format==='txt'?`lines ${s.lineStart}–${s.lineEnd}`:`record ${s.record}`}</summary>
  <p>Source order: message {message.sequence}. {s.format==='json'?`JSON body pointer: ${s.bodyPointer}`:['mp3-transcript','m4a-transcript'].includes(s.format)?`Machine-transcript body offsets ${s.start}–${s.end}; check against the original audio.`:s.format==='txt'?`Exact body offsets ${s.start}–${s.end} (${s.offsetUnits}).`:'CSV data-record number excludes the header and blank records; multiline quoted fields remain one record.'}</p>
  <p>{['mp3-transcript','m4a-transcript'].includes(s.format)?'Original audio SHA-256':'SHA-256'}: <code>{s.sha256}</code></p>{['mp3-transcript','m4a-transcript'].includes(s.format)&&<p>Unreviewed machine transcript · neutral speaker labels are not verified identities. Transcript SHA-256: <code>{s.transcriptSha256}</code></p>}<pre>{typeof message.raw==='string'?message.raw:JSON.stringify(message.raw,null,2)}</pre>
  <div className="cdr-msg-actions">{['mp3-transcript','m4a-transcript'].includes(s.format)&&<button onClick={()=>download(`/batches/${batchId}/items/${s.itemId}/transcript?descriptionRunId=${encodeURIComponent(s.descriptionRunId)}`,s.path.split('/').pop()+'.transcript.txt')}>Download transcript TXT</button>}<button onClick={()=>onOpenSource({item_id:s.itemId})}>Open source file details</button><button onClick={()=>download(`/batches/${batchId}/items/${s.itemId}/download`,s.path.split('/').pop())}>Download original source</button></div>
 </details>;
}
function MessageEntry({message:m,participant,space,right,hue,portrait,focused,domPrefix,search,batchId,onOpenSource,download}){
 const fullName=participant?participantLabel(participant):m.sender;
 return <div className={space?`cdr-msg-turn ${right?'cdr-msg-turn--right':'cdr-msg-turn--left'}`:'cdr-msg-record'} style={space?{'--speaker-hue':hue}:undefined} data-sender={m.sender}>
  {space&&<Avatar name={m.sender} portrait={portrait}/>}
  <article id={`${domPrefix}-${m.id}`} className={`cdr-message ${space?'cdr-message--bubble ':''}${focused?'is-focused':''}`} aria-label={`${m.sender}, source message ${m.sequence}`}>
   <header><strong className="cdr-msg-speaker">{!space&&<Avatar name={m.sender}/>}<span className="cdr-msg-sender-name">{m.sender}{space&&fullName!==m.sender&&<small>{fullName}</small>}</span></strong><span>{timeLabel(m.time)}</span></header>
   {space&&portrait&&<span className="cdr-msg-portrait-basis" title={`${portrait.displayName} · ${portrait.personRef} · ${portrait.basis}`}>POI catalogue match · unverified</span>}
   {m.recipients.length>0&&<p className="cdr-msg-recipient">To: {m.recipients.join(', ')} · explicitly recorded</p>}
   <p className="cdr-msg-body"><Highlight text={m.text} query={search}/></p>
   {m.replyToSourceId&&<p className="cdr-small">Source reply reference: {m.replyToSourceId}{m.replyToId?' · resolved within this thread':' · unresolved or ambiguous; no reply link inferred'}</p>}
   <SourceReference message={m} batchId={batchId} onOpenSource={onOpenSource} download={download}/>
  </article>
 </div>;
}
function ConversationReader({batchId,runId,threadId,api,search,onOpenSource,download,mode,onModeChange,participants,portraits}){
 const [data,setData]=useState(null),[page,setPage]=useState(1),[busy,setBusy]=useState(true),[error,setError]=useState(''),[focus,setFocus]=useState(''),[rightParticipant,setRightParticipant]=useState('');
 const space=mode==='messaging-space',order=messageOrder(mode);
 const pane=useRef(),request=useRef(0),domPrefix=useId().replace(/:/g,'');
 useEffect(()=>{setPage(1);setFocus('');},[search,order]);
 useEffect(()=>{
  const controller=new AbortController(),ticket=++request.current;setBusy(true);setError('');
  api(`/batches/${batchId}/messages/threads/${threadId}?${queryString({runId,q:search,page,order})}`,{signal:controller.signal}).then(value=>{if(ticket===request.current)setData(value);}).catch(e=>{if(!controller.signal.aborted&&ticket===request.current)setError(e.message);}).finally(()=>{if(ticket===request.current)setBusy(false);});
  return()=>{request.current++;controller.abort();};
 },[api,batchId,runId,threadId,search,page,order]);
 useEffect(()=>{if(focus&&!busy)document.getElementById(`${domPrefix}-${focus}`)?.scrollIntoView({behavior:'smooth',block:'center'});},[focus,busy,domPrefix]);
 const matchingIndex=data?.matches.findIndex(m=>m.id===focus)??-1;
 const rightId=data?.participants.some(p=>p.id===rightParticipant)?rightParticipant:data?.thread.participantIds[0]||'';
 function jump(delta){if(!data?.matches.length)return;const index=matchingIndex<0?(delta>0?0:data.matches.length-1):(matchingIndex+delta+data.matches.length)%data.matches.length,match=data.matches[index];setPage(match.page);setFocus(match.id);}
 return <div className="cdr-msg-reader" ref={pane} aria-label="Conversation reader" aria-busy={busy}>
  {error&&<p className="cdr-failure" role="alert">{error}</p>}{busy&&<p role="status">Loading conversation…</p>}
  {data&&<><div className="cdr-msg-reader-heading"><div><span className="cdr-ai-label">{['mp3-transcript','m4a-transcript'].includes(data.thread.source.format)?(data.thread.source.format==='m4a-transcript'?'M4A':'MP3')+' TRANSCRIPT DIALOGUE · UNREVIEWED':'ORIGINAL SOURCE CONVERSATION'}</span><h4>{data.thread.title}</h4><p>{data.participants.map(p=>p.name).join(' · ')}</p></div><label>Message order<select aria-label="Message order" value={mode} onChange={e=>onModeChange(e.target.value)}><option value="auto">Automatic (best available)</option><option value="source">Original source order</option>{data.thread.chronological&&<option value="time">Chronological</option>}<option value="messaging-space">messaging-space</option></select></label></div>
   <p className="cdr-small">{data.thread.grouping}. {data.order==='time'?'Ordered by recorded timestamps, retaining original UTC offsets. Equal timestamps use source order.':'Original sequence retained; missing times or offsets are not invented.'}</p>
   {space&&<div className="cdr-msg-space-heading"><div><h5>messaging-space</h5><p>Source-order chat view · read only</p></div><label>Right-side participant<select aria-label="Right-side participant" value={rightId} onChange={e=>setRightParticipant(e.target.value)}>{data.participants.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><p className="cdr-msg-space-notice">Sides and colours distinguish speakers, not recipients or relationships. Portraits are exact matches to the visible POI catalogue, not verified identities; unmatched or ambiguous handles use initials.</p>{portraits.status==='error'&&<p role="status">POI portraits unavailable; showing initials. Switch views to retry.</p>}{portraits.status==='loading'&&<p role="status">Checking available POI portraits…</p>}</div>}
   {search&&!busy&&data.query===search&&<div className="cdr-msg-match-bar" role="status"><strong>{data.matches.length} matching message{data.matches.length===1?'':'s'}</strong><span>Complete conversation retained; search does not hide surrounding messages.</span><button disabled={!data.matches.length} onClick={()=>jump(-1)}>Previous match</button><button disabled={!data.matches.length} onClick={()=>jump(1)}>Next match</button></div>}
   <div className="cdr-msg-page-controls"><span>Messages {(data.page-1)*data.pageSize+1}–{Math.min(data.page*data.pageSize,data.total)} of {data.total}</span>{data.pages>1&&<><button disabled={busy||data.page===1} onClick={()=>setPage(data.page-1)}>Previous messages</button><span>Page {data.page} of {data.pages}</span><button disabled={busy||data.page===data.pages} onClick={()=>setPage(data.page+1)}>Next messages</button></>}</div>
   {!busy&&!error&&<div className={`cdr-msg-exchange ${space?'cdr-msg-exchange--space':''}`} aria-label={space?'messaging-space conversation':'Source message records'}>{data.messages.map((m,index)=>{const p=data.participants.find(p=>p.id===m.senderId),day=recordedDay(m);return <React.Fragment key={m.id}>
    {space&&day&&day!==recordedDay(data.messages[index-1]||{})&&<div className="cdr-msg-date-divider"><span>{day}</span></div>}
    {m.section&&m.section.index!==data.messages[index-1]?.section?.index&&<div className="cdr-msg-section"><h5>{m.section.header}</h5><p>Conversation section {m.section.index} · section date/time as recorded. Individual message times and UTC offset are not recorded.</p></div>}
    <MessageEntry message={m} participant={p} space={space} right={m.senderId===rightId} hue={senderHue(participants,m.senderId)} portrait={space?cataloguePortrait(p,portraits.profiles):null} focused={focus===m.id} domPrefix={domPrefix} search={search} batchId={batchId} onOpenSource={onOpenSource} download={download}/>
   </React.Fragment>;})}</div>}
  </>}
 </div>;
}
export default function BatchMessages({batchId,api,ready,readOnly,onOpenSource,download,onStatusChange}){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[building,setBuilding]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [input,setInput]=useState(''),[search,setSearch]=useState(''),[participant,setParticipant]=useState(''),[threadId,setThreadId]=useState('');const alive=useRef(true);
 const [month,setMonth]=useState('');
 const [readerMode,setReaderMode]=useState('auto'),[portraits,setPortraits]=useState({status:'idle',profiles:[]});
 useEffect(()=>{
  if(readerMode!=='messaging-space'){setPortraits({status:'idle',profiles:[]});return;}
  const controller=new AbortController();setPortraits({status:'loading',profiles:[]});
  api(`/batches/${batchId}/poi-catalogue`,{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setPortraits({status:'ready',profiles:value.profiles||[]});}).catch(()=>{if(!controller.signal.aborted)setPortraits({status:'error',profiles:[]});});
  return()=>controller.abort();
 },[api,batchId,readerMode]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{const timer=setTimeout(()=>setSearch(input.trim()),250);return()=>clearTimeout(timer);},[input]);
 useEffect(()=>{
  if(!batchId)return;let stopped=false;const controller=new AbortController();setBusy(true);setError('');
  api(`/batches/${batchId}/messages?${queryString({q:search})}`,{signal:controller.signal}).then(value=>{if(!stopped){setData(value);setThreadId(current=>value.threads?.some(t=>t.id===current)?current:[...(value.threads||[])].sort(byRecordedDate)[0]?.id||'');}}).catch(e=>{if(!stopped)setError(e.message);}).finally(()=>{if(!stopped)setBusy(false);});
  return()=>{stopped=true;controller.abort();};
 },[api,batchId,revision,search]);
 async function build(){setBuilding(true);setError('');try{await api(`/batches/${batchId}/messages`,{method:'POST'});if(alive.current)setRevision(v=>v+1);}catch(e){if(alive.current)setError(e.message);}finally{if(alive.current){setBuilding(false);onStatusChange?.();}}}
 function selectThread(id){setThreadId(id);}
 function selectParticipant(id){setParticipant(id);if(id){const threads=data.threads.filter(t=>t.participantIds.includes(id));if(!threads.some(t=>t.id===threadId))selectThread(threads[0]?.id||'');}}
 if(!batchId)return null;
 const visibleThreads=(data?.threads?.filter(t=>(!participant||t.participantIds.includes(participant))&&(!search||t.matchCount>0)&&(!month||t.recordedDates?.some(d=>d.startsWith(month))))||[]).sort(byRecordedDate),selected=data?.threads?.find(t=>t.id===threadId),direct=data?.links?.filter(e=>e.kind==='direct_message')||[];
 const months=[...new Set(data?.threads?.flatMap(t=>(t.recordedDates||[]).map(d=>d.slice(0,7)))||[])].sort();
 return <section className="cdr-messages" aria-label="Messages and conversations"><div className="cdr-msg-heading"><div><span className="cdr-ai-label">BATCH EVIDENCE · MESSAGES & CONVERSATIONS</span><h3>Read the conversations</h3><p>Explore who participated in each source thread, then read the complete exchange.</p></div><button className="cdr-primary" disabled={!ready||readOnly||busy||building} onClick={build}>{building?'Building conversations…':data?.run?'Verify / rebuild messages':'Build messages'}</button></div>
  {error&&<p className="cdr-failure" role="alert">{error}</p>}{busy&&<p role="status">Loading message graph…</p>}
  {!busy&&!data?.run&&!error&&<p className="cdr-small">{ready?'Choose Build messages to create participants, conversations and search from JSON, bracketed chat logs, structured TXT or message CSV, plus speaker-turn MP3/M4A transcripts saved in Stage 4. No photo or AI description is required.':'Available after ingestion completes.'} Original sources remain available alongside each message.</p>}
  {data?.run&&<>{data.stale&&<p className="cdr-ai-warning">Sources or the message parser changed since this snapshot. Rebuild messages before using these results.</p>}
   <div className="cdr-msg-stats"><div><strong>{data.counts.threads}</strong><span>Conversations</span></div><div><strong>{data.counts.participants}</strong><span>Source participants</span></div><div><strong>{data.counts.messages}</strong><span>Messages / dialogue turns</span></div><div><strong>{data.counts.directMessages}</strong><span>Messages with explicit recipients</span></div></div>
   <p className="cdr-small">Imported {data.sources.length} source files{data.skipped.length?` · ${data.skipped.length} not imported; see coverage below`:''}.</p>
   <Participants data={data} selected={participant} onSelect={selectParticipant}/>
   <div className="cdr-msg-filters"><label>Search message text<input type="search" aria-label="Search conversation messages" value={input} maxLength="200" onChange={e=>setInput(e.target.value)} placeholder="e.g. gallery, boat or agreed"/></label><label>Participant<select aria-label="Conversation participant" value={participant} onChange={e=>selectParticipant(e.target.value)}><option value="">All participants</option>{data.participants.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{months.length>0&&<label>Recorded month<select aria-label="Recorded month" value={month} onChange={e=>setMonth(e.target.value)}><option value="">All recorded months</option>{months.map(m=><option key={m}>{m}</option>)}</select></label>}<button onClick={()=>{setInput('');setSearch('');setParticipant('');setMonth('');}}>Clear conversation filters</button></div>
   <p className="cdr-small">Lines show participation in a thread; labels count messages sent. Group membership does not establish direct messages, agreement or a financial relationship. Names and handles are taken from message sources. Audio uses neutral machine-assigned speaker labels, kept separate per recording; these do not identify people.</p>
   <details className="cdr-msg-network"><summary>Participant and conversation network</summary><ConversationGraph data={data} participant={participant} threadId={threadId} onParticipant={selectParticipant} onThread={selectThread} search={search}/></details>
   {selected&&!visibleThreads.some(t=>t.id===selected.id)&&<p className="cdr-ai-warning">The open conversation is outside the current filters. Select a matching conversation from the list.</p>}
   <div className="cdr-msg-workspace"><nav className="cdr-msg-thread-list" aria-label="Source conversations"><h4>Conversations ({visibleThreads.length})</h4>{months.length>0&&<p className="cdr-small">By recorded calendar date. Source files stay separate; UTC offsets may be unknown.</p>}{search&&<p className="cdr-small">{data.matchCount} matching messages across the batch.</p>}{visibleThreads.map(t=><button key={t.id} aria-pressed={threadId===t.id} onClick={()=>selectThread(t.id)}><strong>{t.source.path.split('/').pop()}</strong><span>{t.title}</span><span>{dateRange(t)} · {t.messageCount} messages</span><span>{data.participants.filter(p=>t.participantIds.includes(p.id)).map(p=>p.name).join(', ')}</span>{search&&<span>{t.matchCount} matching messages</span>}<small>{t.sourceThreadId||'Grouped by source file'}</small></button>)}{!visibleThreads.length&&<p>No conversations match these filters. The open exchange remains available for context.</p>}</nav>
    {selected&&<ConversationReader key={`${data.run.id}-${threadId}`} batchId={batchId} runId={data.run.id} threadId={threadId} api={api} search={search} onOpenSource={onOpenSource} download={download} mode={readerMode==='time'&&!selected.chronological?'auto':readerMode} onModeChange={setReaderMode} participants={data.participants} portraits={portraits}/>}</div>
   {direct.length>0&&<details className="cdr-msg-direct"><summary>Explicit sender → recipient records ({direct.length})</summary><p>These directed links are stored separately in the Oracle graph. They are based only on recipient fields present in the source.</p><div className="cdr-table-scroll"><table className="cdr-table"><thead><tr><th>Sender</th><th>Recipient</th><th>Conversation</th></tr></thead><tbody>{direct.slice(0,100).map(e=><tr key={e.id}><td>{data.participants.find(p=>p.id===e.from)?.name}</td><td>{data.participants.find(p=>p.id===e.to)?.name}</td><td><button onClick={()=>selectThread(e.threadId,e.messageId)}>{data.threads.find(t=>t.id===e.threadId)?.title}</button></td></tr>)}</tbody></table></div>{direct.length>100&&<p>First 100 directed links shown; all messages remain available in their conversations.</p>}</details>}
   <details className="cdr-msg-coverage"><summary>Coverage, method and snapshot</summary><p>{data.engine}. Message parsing preserves source records. Audio dialogue uses the saved Stage 4 machine transcript; speaker separation and speech require review against the original audio. This snapshot is separate from Money Flows, the connection-review Agent and Batch Assistant.</p><p>{data.identityBasis}</p><p>Snapshot {data.run.id} · {new Date(data.run.createdAt).toLocaleString()} · {data.run.version}</p>{data.sources.map(s=><p key={s.itemId}>{s.path}: {s.threads} threads · {s.messages} messages · SHA-256 <code>{s.sha256}</code></p>)}{data.skipped.map(s=><p key={s.itemId}>Not imported: {s.path} — {s.reason}</p>)}<p>Limits: 2 MiB per text source, 8 MiB combined; 2,000 messages, 40 threads, 60 participants and 80 graph nodes. Unsupported text formats are listed, not inferred. Malformed recognised sources fail without saving partial results. Original files remain unchanged.</p></details>
  </>}
 </section>;
}
