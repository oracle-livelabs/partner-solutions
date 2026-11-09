import React,{useEffect,useRef,useState} from 'react';
import './batch-people-mentioned.css';
import PeoplePoiDialog from './PeoplePoiDialog';
import PeopleMentionedExplain from './PeopleMentionedExplain';

function PersonAvatar({poi}){const [failed,setFailed]=useState(false);return <span className="people-mentioned-avatar">{poi?.portrait_asset_uri&&!failed?<img src={poi.portrait_asset_uri} alt={poi.portrait_alt_text||'Possible POI match · register portrait'} onError={()=>setFailed(true)}/>:<PersonIcon/>}</span>;}
function PersonIcon(){return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="21" r="12"/><path d="M10 58v-5c0-25 44-25 44 0v5"/></svg>;}
export default function BatchPeopleMentioned({batchId,user,api,ready,readOnly,onOpenSource,onAiOps}){
 const [coverage,setCoverage]=useState(null),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selectedPoi,setSelectedPoi]=useState(null),[lastRun,setLastRun]=useState(null);
 const request=useRef(0);
 useEffect(()=>{request.current++;setBusy(false);setResult(null);setLastRun(null);setCoverage(null);setSelectedPoi(null);setError('');return()=>{request.current++;};},[batchId,user]);
 useEffect(()=>{const controller=new AbortController();api(`/batches/${batchId}/people-mentioned`,{signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setCoverage(r);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[api,batchId,ready]);
 async function analyse(){const ticket=++request.current;setBusy(true);setError('');setLastRun(null);try{const value=await api(`/batches/${batchId}/people-mentioned`,{method:'POST'});if(ticket===request.current){setResult(value);setCoverage(value);setLastRun(value);}}catch(e){if(ticket===request.current){setError(e.message);setLastRun(e.details||null);}}finally{if(ticket===request.current)setBusy(false);}}
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`${batchId}-people-mentioned.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="people-mentioned" aria-label="People mentioned in the material">
  <header><div><span className="cdr-ai-label">PEOPLE IN THE MATERIAL · AI DRAFT</span><h3>People mentioned</h3><p>Acknowledge named and unnamed people from text or audio transcripts. Photos are optional.</p></div><div className="brief-explain-actions"><PeopleMentionedExplain/><button className="cdr-primary" disabled={!ready||readOnly||busy||!coverage?.sources.length} onClick={analyse}>{busy?'Reading people mentions…':result?'Read material again':'Find people in material'}</button></div></header>
  <section className="people-mentioned-model" aria-label="LLM and measured usage"><div><small>LANGUAGE MODEL</small><strong>{(lastRun?.llm||coverage?.llm)?.model==='google.gemini-2.5-flash'?'Google Gemini 2.5 Flash':(lastRun?.llm||coverage?.llm)?.model||'Loading model configuration…'}</strong><span>{(lastRun?.llm||coverage?.llm)?.provider} · {(lastRun?.llm||coverage?.llm)?.region}</span><p>Find people in material calls this LLM. AI Ops records each attempt, retries, duration and provider-reported tokens, including failed calls.</p></div>{onAiOps&&<button type="button" onClick={onAiOps}>View this batch in AI Ops ↗</button>}
   {lastRun?.usage&&<div className="people-mentioned-usage"><span><b>{lastRun.usage.attempts}</b> attempts · <b>{lastRun.usage.retries}</b> retries</span><span>{(lastRun.usage.elapsedMs/1000).toFixed(1)} s LLM time</span><span>Input: {lastRun.usage.inputTokens?.toLocaleString()??'Unavailable'}</span><span>Output: {lastRun.usage.outputTokens?.toLocaleString()??'Unavailable'}</span><span>Reasoning: {lastRun.usage.reasoningTokens?.toLocaleString()??'Unavailable'}</span><span>Total: <b>{lastRun.usage.totalTokens?.toLocaleString()??'Unavailable'}</b> tokens · {lastRun.usage.tokenStatus}</span><small>Provider totals include reasoning; it is not added again.</small></div>}
   {lastRun?.traceId&&<small className="people-mentioned-trace">AI Ops trace: <code>{lastRun.traceId}</code></small>}
  </section>
  <p className="people-mentioned-note">One card combines mentions with the same name or a unique registered alias. All supporting sources remain available. POI matches are suggestions for review; their existing portraits are labelled as register images. Unnamed people remain separate.</p>
  {error&&<p role="alert" className="cdr-failure">{error}</p>}
  {busy&&<p role="status">Reading the supplied text and checking exact supporting excerpts… Larger batches can take a few minutes.</p>}
  {!result&&!busy&&<p>Choose “Find people in material” to read the available text with AI. The Batch Brief and photo comparisons are not required.</p>}
  {readOnly&&<p>Your demo user can inspect source coverage, but cannot run AI extraction.</p>}
  {result&&<><div className="people-mentioned-summary"><strong>{result.people.length} people cards · {result.mentionCount} source mentions</strong><button type="button" onClick={download}>Download people notes</button></div><p className="cdr-small">{result.notice}</p>
   {!!result.warnings?.length&&<details className="people-mentioned-warnings"><summary>Source-check warnings ({result.warnings.length})</summary><p>Valid mentions are retained. Review these limits alongside the original sources.</p>{result.warnings.map((warning,index)=><p key={index}><strong>{warning.sourceRef||'Unknown source'} · {warning.mentionId} · {warning.attribute}</strong><br/>{warning.reason}</p>)}</details>}
   {!result.people.length&&<p>No supported person mentions were returned in the analysed excerpts. Check source coverage and originals; this does not establish that nobody is mentioned.</p>}
   <div className="people-mentioned-grid">{result.people.map(person=><article key={person.id} className="people-mentioned-card">
    <div className="people-mentioned-card-head"><PersonAvatar poi={person.poi}/><div><small>{person.poi?'POSSIBLE POI MATCH · REGISTER PORTRAIT':person.mentions[0].attributes.name?'NAME REPORTED IN SOURCE':'UNNAMED IN SOURCE'}</small><h4>{person.label}</h4><span>{person.mentions.length} mention{person.mentions.length===1?'':'s'} · {new Set(person.mentions.map(m=>m.sourceRef)).size} source{new Set(person.mentions.map(m=>m.sourceRef)).size===1?'':'s'}</span></div></div>
    {person.poiCandidates.length>1&&<p>Multiple POI profiles share this name or alias. Review the candidates below.</p>}
    {person.poiCandidates.map(poi=><p key={poi.person_ref}><button type="button" aria-haspopup="dialog" onClick={()=>setSelectedPoi(poi)}>View POI details · {poi.display_name} · {poi.person_ref}</button></p>)}
    {!person.poiCandidates.length&&<p className="cdr-small">No matching registered name or alias found in your authorised POI register.</p>}
    <details open={person.mentions.length===1}><summary>Source mentions and supporting excerpts ({person.mentions.length})</summary>{person.mentions.map(mention=>{const source=result.sources.find(s=>s.ref===mention.sourceRef);return <section className="people-mentioned-source" key={mention.id}>
     <strong>{mention.sourceRef} · {source.path}</strong>
     <dl>{[['name','Name'],['gender','Gender / sex stated'],['age','Age stated'],['role','Role / involvement stated']].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{mention.attributes[key]?.value||'Not stated'}</dd></div>)}</dl>
     <blockquote>{mention.mentionQuote}</blockquote><small>{source.basis==='unreviewed_machine_transcript'?'Machine transcript · check the recording':'Exact excerpt from supplied text'} · interpretation needs review</small>
     <details><summary>Attribute evidence</summary>{Object.entries(mention.attributes).filter(([,f])=>f).map(([key,f])=><div key={key}><strong>{key}: {f.value}</strong><blockquote>{f.quote}</blockquote></div>)}</details>
     <button type="button" onClick={()=>onOpenSource({item_id:source.itemId})}>Inspect source · {mention.sourceRef}</button>
    </section>;})}</details>
   </article>)}</div></>}
  {selectedPoi&&<PeoplePoiDialog poi={selectedPoi} user={user} onClose={()=>setSelectedPoi(null)}/>}

  {coverage&&<details className="people-mentioned-coverage"><summary>Source coverage and limits</summary><p>Up to 24,000 characters per source and 80,000 combined. At most 60 mentions per run. Original TXT, CSV and JSON excerpts and saved audio transcripts are supported. Images and video are excluded. Truncated or excluded content may contain additional people.</p>{coverage.coverage.map(source=><p key={source.itemId}><strong>{source.path}</strong> · {source.basis==='excluded'?source.reason:`${source.characters.toLocaleString()} characters · ${source.basis==='original_text_excerpt'?'original text':'machine transcript'}${source.truncated?' · partial source':''}`}</p>)}</details>}
 </section>;
}
