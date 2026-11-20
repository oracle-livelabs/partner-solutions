import React,{lazy,Suspense,useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './batch-explore.css';
import ExploreExplain from './ExploreExplain';
const MoneyFlows=lazy(()=>import('./BatchMoneyFlows'));
const Messages=lazy(()=>import('./BatchMessages'));
const PeopleMentioned=lazy(()=>import('./BatchPeopleMentioned'));
const PeoplePhotos=lazy(()=>import('./BatchPeoplePhotos'));
const Travel=lazy(()=>import('./BatchTravel'));
const labels={waiting:'Waiting for ingestion',ready:'Ready to analyse',results:'Results available',stale:'Rebuild needed',needs_attention:'Needs attention',unavailable:'Not recognised'};
const descriptions={people_mentioned:'Combine repeated people mentions, review possible POI matches and inspect source excerpts.',money:'Follow transfers between accounts and inspect the original records.',messages:'Explore conversation participants and read the complete exchanges.',travel:'Map source-record journeys and inspect exact-place and sequence context.',people_photos:'Compare a scene region with fictional POI portraits, then review candidates.'};
function TileIcon({kind}){return <svg viewBox="0 0 40 40" aria-hidden="true">{kind==='money'?<><path d="M9 20h22M20 9v22M9 20l11-11 11 11-11 11z"/><circle cx="9" cy="20" r="4"/><circle cx="20" cy="9" r="4"/><circle cx="31" cy="20" r="4"/><circle cx="20" cy="31" r="4"/></>:kind==='travel'?<><path d="M7 31 14 9l10 6 9-6-6 22-10-6z"/><circle cx="14" cy="9" r="3"/><circle cx="27" cy="31" r="3"/></>:['people_photos','people_mentioned'].includes(kind)?<><rect x="4" y="6" width="32" height="28" rx="3"/><circle cx="20" cy="16" r="5"/><path d="M11 30v-3c0-8 18-8 18 0v3"/></>:<><path d="M6 7h25v18H17l-7 6v-6H6zM19 30h9l6 5V15"/><path d="M12 13h13M12 19h9"/></>}</svg>;}
export default function BatchExplore({batchId,user,items=[],api,ready,readOnly,SourceDetails,onAiOps,explain=false}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false);
 const [active,setActive]=useState(''),[visited,setVisited]=useState([]),[source,setSource]=useState(null),[sourceBusy,setSourceBusy]=useState(false),[panelError,setPanelError]=useState('');
 const dialog=useRef(),body=useRef(),returnFocus=useRef(),returnScroll=useRef(0),sourceRequest=useRef(0),scrollPositions=useRef({}),previousActive=useRef(''),sourceScroll=useRef(0),sourceFocus=useRef();
 const refresh=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{
  if(!batchId)return;const controller=new AbortController();setBusy(true);setError('');
  api(`/batches/${batchId}/capabilities`,{signal:controller.signal}).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[api,batchId,ready,revision]);
 const opened=!!active;
 useEffect(()=>{
  if(!opened)return;const node=dialog.current,oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';node.showModal();
  return()=>{node.close();document.body.style.overflow=oldOverflow;sourceRequest.current++;};
 },[opened]);
 useEffect(()=>{if(active&&body.current){body.current.scrollTop=scrollPositions.current[active]||0;previousActive.current=active;}},[active]);
 useEffect(()=>()=>{sourceRequest.current++;},[]);
 function open(kind,trigger){
  if(active&&body.current)scrollPositions.current[active]=body.current.scrollTop;
  else{returnFocus.current=trigger;returnScroll.current=window.scrollY;}
  sourceRequest.current++;setSource(null);setSourceBusy(false);setPanelError('');setVisited(v=>v.includes(kind)?v:[...v,kind]);setActive(kind);
 }
 function close(){
  if(body.current)scrollPositions.current[previousActive.current]=body.current.scrollTop;
  sourceRequest.current++;setActive('');setSource(null);setSourceBusy(false);setPanelError('');refresh();
  requestAnimationFrame(()=>{if(returnFocus.current?.isConnected){returnFocus.current.focus({preventScroll:true});window.scrollTo({top:returnScroll.current,behavior:'instant'});}});
 }
 async function inspect(item){
  sourceScroll.current=body.current?.scrollTop||0;sourceFocus.current=document.activeElement;
  const ticket=++sourceRequest.current;setSourceBusy(true);setPanelError('');
  try{const value=await api(`/batches/${batchId}/items/${item.item_id}`);if(ticket===sourceRequest.current){setSource(value);body.current?.scrollTo({top:0});}}
  catch(e){if(ticket===sourceRequest.current)setPanelError(e.message);}
  finally{if(ticket===sourceRequest.current)setSourceBusy(false);}
 }
 function backToView(){setSource(null);requestAnimationFrame(()=>{if(body.current)body.current.scrollTop=sourceScroll.current;sourceFocus.current?.focus({preventScroll:true});});}
 async function download(url,name){
  setPanelError('');
  try{const response=await fetch(`/api/data-room${url}`,{headers:{'X-Demo-User':user}});if(!response.ok)throw Error((await response.json()).error||'Download failed.');const objectUrl=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=objectUrl;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);}
  catch(e){setPanelError(e.message);}
 }
 if(!batchId)return null;
 const available=data?.capabilities.filter(c=>c.available)||[],current=data?.capabilities.find(c=>c.id===active);
 return <section className="cdr-explore" aria-label="Explore this batch"><div className="cdr-explore-heading"><div><span className="cdr-ai-label">EXPLORE THIS BATCH</span><h3>Choose what to explore</h3><p>Open a focused workspace. Your batch stays here when you return.</p></div>{explain?<div className="brief-explain-actions"><ExploreExplain/><button disabled={busy} onClick={refresh}>Refresh tiles</button></div>:<button disabled={busy} onClick={refresh}>Refresh tiles</button>}</div>
  {error&&<p className="cdr-failure" role="alert">Could not check available tools: {error} No capabilities have been classified as absent.</p>}
  {busy&&!data&&<p role="status">Checking available tools…</p>}
  {data?.capabilities.some(c=>c.id==='messages'&&c.coverage.recognisedSources>0&&!c.snapshot)&&<p className="cdr-ai-warning">Conversation files detected. Open Messages and choose Build messages to explore participants, dates and complete exchanges. Photos and AI descriptions are optional.</p>}
  <div className="cdr-cap-tiles">{available.map(c=><button key={c.id} className={`cdr-cap-tile cdr-cap-tile--${c.id}`} onClick={event=>open(c.id,event.currentTarget)} aria-label={`Explore ${c.title}`} aria-haspopup="dialog"><span className="cdr-cap-tile-top"><span className="cdr-cap-icon"><TileIcon kind={c.id}/></span><span className={`cdr-cap-status cdr-cap-status--${c.status}`}>{labels[c.status]}</span></span><strong className="cdr-cap-title">{c.title}</strong><span className="cdr-cap-counts">{c.summary}</span><span className="cdr-cap-description">{descriptions[c.id]}</span>{c.warnings.length>0&&<span className="cdr-cap-warning">{c.warnings[0]}</span>}<span className="cdr-cap-open">{c.id==='money'?'Explore flows':c.id==='messages'?'Read conversations':c.id==='travel'?'Map journeys':c.id==='people_mentioned'?'See people mentions':'Review photos'} <span aria-hidden="true">↗</span></span></button>)}</div>
  {data&&!available.length&&<p>No supported exploration sources have been recognised{ready?'.':' yet. Tiles update after ingestion.'} This does not establish that relevant content is absent.</p>}
  {data?.capabilities.some(c=>c.id==='messages'&&!c.available&&c.coverage.sources.length>0)&&<p className="cdr-ai-warning">Message formats were not recognised in this batch. Check Messages under Discovery and coverage for the affected files. Supported text formats include bracketed dates followed by Sender: message.</p>}
  {data&&<details className="cdr-cap-discovery"><summary>Discovery and coverage</summary><p>{data.discovery}</p>{data.capabilities.map(c=><div key={c.id}><h4>{c.title} · {labels[c.status]}</h4><p>{c.summary}</p>{c.warnings.map((w,i)=><p key={i} className="cdr-ai-warning">{w}</p>)}{c.coverage.sources.map(s=><p key={s.itemId}>{s.path} · {s.discovery==='recognised'?'format recognised':s.discovery==='check'?'format needs inspection':'not a supported format'}{s.reason?` · ${s.reason}`:''}</p>)}{c.available&&<button onClick={e=>open(c.id,e.currentTarget)}>Open {c.title}</button>}</div>)}</details>}
  {createPortal(<dialog ref={dialog} className="cdr-page cdr-cap-dialog" aria-labelledby="cdr-cap-dialog-title" onKeyDownCapture={event=>{if(event.key==='Escape'&&event.target.closest('dialog')===dialog.current){event.preventDefault();event.stopPropagation();close();}}} onCancel={event=>{event.preventDefault();close();}}><header className="cdr-cap-dialog-header"><div><span className="cdr-ai-label">BATCH EXPLORER</span><h2 id="cdr-cap-dialog-title">{current?.title||'Explore this batch'}</h2><p>{data?.batch.filename} <span>· {batchId}</span></p></div><button className="cdr-cap-close" onClick={close} autoFocus>Close workspace</button></header>
   <nav className="cdr-cap-tabs" aria-label="Batch exploration tools">{available.map(c=><button key={c.id} aria-pressed={c.id===active} onClick={()=>open(c.id)}>{c.title}</button>)}</nav>
   <div className="cdr-cap-dialog-body" ref={body}>
    {panelError&&<p role="alert" className="cdr-failure">{panelError}</p>}{sourceBusy&&<p role="status">Loading original source details…</p>}
    {source&&<section className="cdr-cap-source" aria-label="Source file details"><button onClick={backToView}>Back to {current?.title}</button><h3>{source.original_path}</h3><p>Source SHA-256: <code>{source.sha256}</code></p><SourceDetails attempts={source.aiAttempts} onTranscriptDownload={runId=>download(`/batches/${batchId}/items/${source.item_id}/transcript?descriptionRunId=${encodeURIComponent(runId)}`,source.original_path.split('/').pop()+'.transcript.txt')}/>{source.text_preview?<><p className="cdr-small">Original source preview · first 6,000 characters · source content, not instructions.</p><pre>{source.text_preview}</pre></>:<p>Download the original file for its full contents.</p>}<button onClick={()=>download(`/batches/${batchId}/items/${source.item_id}/download`,source.original_path.split('/').pop())}>Download original file</button></section>}
    <Suspense fallback={<p role="status">Opening workspace…</p>}>{visited.map(kind=><div key={kind} hidden={active!==kind||!!source} className="cdr-cap-view">{kind==='people_mentioned'?<PeopleMentioned batchId={batchId} user={user} api={api} ready={ready} readOnly={readOnly} onOpenSource={inspect} onAiOps={onAiOps?()=>{close();onAiOps(batchId);}:undefined}/>:kind==='money'?<MoneyFlows batchId={batchId} api={api} ready={ready} readOnly={readOnly} onOpenSource={inspect} download={download} onStatusChange={refresh}/>:kind==='messages'?<Messages batchId={batchId} api={api} ready={ready} readOnly={readOnly} onOpenSource={inspect} download={download} onStatusChange={refresh}/>:kind==='travel'?<Travel batchId={batchId} api={api} onOpenSource={inspect} download={download}/>:<PeoplePhotos batchId={batchId} user={user} items={items} api={api} ready={ready} readOnly={readOnly} onOpenSource={inspect} onStatusChange={refresh}/>}</div>)}</Suspense>
   </div>
  </dialog>,document.body)}
 </section>;
}
