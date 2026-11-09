import React,{useEffect,useRef,useState} from 'react';
import {useActiveProfile} from './ProfileContext';
import {useConversationHistory,HistorySaveNotice} from './AgentHistory';
import AgentBrief from './AgentBrief';
import './native-agent-v2.css';

export default function NativeAgentV2(props){
 const profile=useActiveProfile();
 return <NativeAgentCase key={`${props.user}:${profile.profileCode||''}`} {...props} profile={profile}/>;
}
function NativeAgentCase({user,onClose,onSaved,profile}){
 const history=useConversationHistory();
 const scope=`${user}:${profile.profileCode||''}`;
 const [catalog,setCatalog]=useState({scope:null,patterns:[],status:'loading'}),[retry,setRetry]=useState(0),[selected,setSelected]=useState('');
 const pending=useRef(null),epoch=useRef(0);
 const patterns=catalog.scope===scope?catalog.patterns:[];
 const catalogReady=catalog.scope===scope&&catalog.status==='ready';
 const [conversationId,setConversationId]=useState(''),[question,setQuestion]=useState(''),[result,setResult]=useState(null),[sending,setSending]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  epoch.current++;pending.current?.abort();
  setConversationId('');setQuestion('');setResult(null);setSelected('');setError('');setSending(false);history.reset();
  return()=>{epoch.current++;pending.current?.abort();};
 },[scope]);
 useEffect(()=>{
  const controller=new AbortController();
  if(!profile.profileCode){setCatalog({scope,patterns:[],status:'error',error:'Active dataset is unavailable. Refresh the page to try again.'});return()=>controller.abort();}
  setCatalog({scope,patterns:[],status:'loading'});
  const read=async url=>{const response=await fetch(url,{headers:{'X-Demo-User':user},signal:controller.signal});const body=await response.json();if(!response.ok)throw Error(body.error||'Watched patterns are unavailable.');if(!Array.isArray(body))throw Error('Watched patterns are unavailable.');return body;};
  Promise.all([read('/api/watched-patterns'),read('/api/agent-v2/teaching-cases')])
   .then(([body,cases])=>{if(!controller.signal.aborted)setCatalog({scope,patterns:body.slice(0,6),teachingCases:cases,status:'ready'});})
   .catch(e=>{if(!controller.signal.aborted)setCatalog({scope,patterns:[],status:'error',error:e.message});});
  return()=>controller.abort();
 },[scope,retry]);
 useEffect(()=>{
  const refresh=()=>setRetry(value=>value+1);
  window.addEventListener('crimedata-profile-changed',refresh);window.addEventListener('focus',refresh);
  return()=>{window.removeEventListener('crimedata-profile-changed',refresh);window.removeEventListener('focus',refresh);};
 },[]);
 const choose=pattern=>{
  setSelected(pattern.PATTERN_CODE);
  const teaching=catalog.teachingCases?.find(c=>c.PATTERN_CODE===pattern.PATTERN_CODE);
  if(teaching){setQuestion(`Investigate watched pattern ${pattern.PATTERN_CODE} for the currently active synthetic dataset (${profile.profileCode}). Focus on authored teaching case ${teaching.CASE_CODE} (${teaching.CASE_TITLE}): ${teaching.TEACHING_QUESTION} Use the supporting-records tool and cite the supplied source references. Keep this case separate from broader pattern counts.`);return;}
  setQuestion(`Investigate watched pattern ${pattern.PATTERN_CODE} for the currently active synthetic dataset (${profile.profileCode}). Use current tool results to review its links, area and time coverage, reports, evidence and data gaps.`);
 };
 const run=()=>{
  if(!question.trim()||sending||!catalogReady)return;
  const version=epoch.current,controller=new AbortController();pending.current=controller;
  setSending(true);setError('');
  fetch('/api/agent-v2/run',{method:'POST',headers:{'Content-Type':'application/json','X-Demo-User':user},signal:controller.signal,body:JSON.stringify({question,conversationId,historyThreadId:history.threadId})})
   .then(response=>version===epoch.current?history.readResponse(response):null)
   .then(b=>{if(b&&version===epoch.current){setResult(b);setConversationId(b.conversationId);}})
   .catch(e=>{if(e.name!=='AbortError'&&version===epoch.current)setError(e.message);})
   .finally(()=>{if(version===epoch.current){setSending(false);onSaved?.();}});
 };
 return <div className="crime-challenge native-agent" role="dialog" aria-modal="true" aria-labelledby="native-agent-title">
  <section>
   <header><div><small>ORACLE SELECT AI AGENT · NATIVE ADB TEAM</small><h2 id="native-agent-title">IncidentData Agent V2</h2><p>Explore a watched pattern, review the returned brief, then ask a follow-up in the same case conversation.</p></div><button onClick={onClose} aria-label="Close native Agent V2">×</button></header>
   <main>
    <section className="native-agent__question" aria-label="Ask the native agent">
     <div className="native-agent__watch-heading"><div><small>CHOOSE A WATCHED PATTERN</small><p>{profile.cityLabel||profile.profileName||'Active synthetic dataset'}</p></div><span>From Incident Pattern Signals</span></div>
     {!catalogReady&&catalog.status!=='error'&&<p role="status">Loading watched patterns…</p>}
     {catalog.scope===scope&&catalog.status==='error'&&<div className="native-agent__catalog-error" role="alert"><p>{catalog.error}</p><button disabled={sending} onClick={()=>setRetry(value=>value+1)}>Retry loading patterns</button></div>}
     {catalogReady&&!patterns.length&&<p>No active watched patterns are available in Incident Pattern Signals for this dataset. You can still enter a question below.</p>}
     <div className="native-agent__watch-tiles" aria-label="Watched pattern choices">{patterns.map(pattern=><button type="button" key={pattern.PATTERN_CODE} aria-pressed={selected===pattern.PATTERN_CODE} disabled={sending} onClick={()=>choose(pattern)}>
      <small>{String(pattern.PATTERN_KIND||'watched pattern').replaceAll('_',' ')}</small><b>{pattern.PATTERN_NAME}</b><p>{pattern.PATTERN_SUMMARY}</p><span>{pattern.INCIDENT_COUNT} incidents · {pattern.POST_COUNT} public posts</span>{catalog.teachingCases?.filter(c=>c.PATTERN_CODE===pattern.PATTERN_CODE).map(c=><em className="native-agent__teaching-badge" key={c.CASE_CODE}>{c.CASE_TITLE} · {c.SOURCE_COUNT} synthetic sources</em>)}
     </button>)}</div>
     <label htmlFor="native-agent-question">Your question</label>
     <textarea id="native-agent-question" rows={3} value={question} disabled={sending} onChange={e=>{setQuestion(e.target.value);setSelected('');}} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent.isComposing){e.preventDefault();run();}}} placeholder="Ask about a watched pattern, or follow up on the previous brief…" aria-describedby="native-agent-input-help"/>
     <div className="native-agent__submit"><span id="native-agent-input-help">Enter adds a new line. Ctrl / ⌘ + Enter runs the agent.</span><button className="primary" disabled={sending||!question.trim()||!catalogReady} onClick={run}>{sending?'Running native team…':'Run Agent V2'}</button></div>
    </section>
    <HistorySaveNotice history={history}/>
    {sending&&<p className="native-agent__status" role="status">The native team is reviewing your question and its controlled tools…</p>}
    {error&&<p className="pattern-error" role="alert">Agent V2 error: {error}</p>}
    {result&&<section className="native-agent__result" aria-label="Agent review brief">
     <header><div><small>{sending?'LAST COMPLETED BRIEF':'NATIVE AGENT REVIEW BRIEF'}</small><h3>Investigation brief</h3><span className="native-agent__team">{result.team}</span></div><span className="native-agent__duration">{(result.elapsed/1000).toFixed(1)} seconds</span></header>
     <div className="native-agent__stages" aria-label="Framework stages">{result.layers.map(stage=><article key={stage}><b aria-hidden="true">✓</b><span>{stage}</span></article>)}</div>
     <AgentBrief text={result.answer}/>
     <details className="native-agent__original"><summary>View original response text</summary><pre>{result.answer}</pre></details>
     <footer><span>Conversation: {result.conversationId}</span><span>Case memory: five turns · one-day retention</span></footer>
    </section>}
    <footer className="native-agent__actions"><button disabled={sending} onClick={()=>{setConversationId('');setResult(null);setError('');history.reset();}}>Start new case memory</button><button className="primary" onClick={onClose}>Return to console</button></footer>
   </main>
  </section>
 </div>;
}
