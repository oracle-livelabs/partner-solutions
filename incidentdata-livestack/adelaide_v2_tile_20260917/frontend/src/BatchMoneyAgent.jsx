import React,{useEffect,useRef,useState} from 'react';
const selectionKey=s=>JSON.stringify([s.runId,s.currency,s.dateFrom||'',s.dateTo||'',s.from,s.to,Number(s.maxHops)]);
function Answer({text,evidence,onInspect}){const index=new Map(evidence.map(e=>[e.ref,e]));return <div className="cdr-money-agent-answer">{text.split(/(\[T\d{3}\])/g).map((part,i)=>{const record=index.get(part.slice(1,-1));return record?<button className="cdr-money-citation" key={i} onClick={()=>onInspect(record.transferId)} title={`${record.source.path}, record ${record.source.record}`}>{part}</button>:<React.Fragment key={i}>{part}</React.Fragment>;})}</div>;}
export default function BatchMoneyAgent({batchId,api,selection,readOnly,stale,onShowRoute,onInspect}){
 const [opened,setOpened]=useState(false),[question,setQuestion]=useState(''),[runId,setRunId]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!opened)return;const controller=new AbortController();let timer;
  async function poll(){try{const result=await api(`/batches/${batchId}/money-agent${runId?`?runId=${encodeURIComponent(runId)}`:''}`,{signal:controller.signal});if(controller.signal.aborted)return;setData(result);if(['queued','running'].includes(result.run?.status))timer=setTimeout(poll,2000);}catch(e){if(!controller.signal.aborted)setError(e.message);}}
  void poll();return()=>{controller.abort();clearTimeout(timer);};
 },[api,batchId,opened,runId,revision]);
 const running=busy||['queued','running'].includes(data?.run?.status),valid=!!selection.from&&!!selection.to&&selection.from!==selection.to&&!!selection.currency&&!stale;
 const matching=data?.context&&selectionKey(selection)===selectionKey(data.context.summary.selection),usable=matching&&!data?.stale&&!stale;
 async function ask(){setBusy(true);setError('');try{const result=await api(`/batches/${batchId}/money-agent`,{method:'POST',body:JSON.stringify({...selection,question})});if(alive.current){setRunId(result.runId);setData({run:{run_id:result.runId,status:'queued'}});setRevision(v=>v+1);}}catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setBusy(false);}}
 return <details className="cdr-money-agent" onToggle={event=>setOpened(event.currentTarget.open)}><summary>Ask the Money Flow Agent <span>Read-only pilot{running?' · working…':''}</span></summary>
  <p>Ask for an explanation of the selected route search. Oracle supplies the exact totals, routes and transaction references; the agent’s explanation is an unreviewed draft.</p>
  <label>Question (optional)<textarea aria-label="Money Flow agent question" value={question} maxLength={1000} rows={2} onChange={e=>setQuestion(e.target.value)} placeholder="Explain how money reaches the selected destination and show the supporting transactions."/></label>
  <div className="cdr-money-route-list"><button onClick={ask} disabled={!valid||readOnly||running}>{running?'Agent review in progress…':'Explain selected flows'}</button><span className="cdr-small">Uses the start/end accounts, currency, dates and maximum hops above. Runs only when requested.</span></div>
  {readOnly&&<p>AI reviews are disabled for the read-only demo user.</p>}{!valid&&<p>Choose a current snapshot and distinct start/end accounts to use this pilot.</p>}
  {error&&<p role="alert" className="cdr-failure">{error} The graph remains available.</p>}
  {data?.run?.status==='failed'&&<p role="alert" className="cdr-failure">Agent review failed: {data.run.error_text} Your graph and source records are unchanged; you can submit a new request.</p>}
  {running&&<p role="status">The native ADB agent is reviewing the selected saved results. You can continue exploring or close this workspace; the review is saved in Oracle.</p>}
  {data?.result&&<><p className="cdr-ai-label">AI EXPLANATION · REVIEW REQUIRED</p>{!usable&&<p className="cdr-ai-warning">This saved answer belongs to a different selection or older source snapshot. It is retained for reference; run a new review for the current view.</p>}<p className="cdr-small">{data.context.summary.selection.from} → {data.context.summary.selection.to} · {data.context.summary.currency} · up to {data.context.routes.maxHops} hops</p>
   <Answer text={data.result.answer} evidence={data.context.evidence} onInspect={id=>{if(usable)onInspect(id);}}/>
   {usable&&<div className="cdr-money-route-list" aria-label="Agent-supported graph routes">{data.context.routes.routes.map(r=><button key={r.id} onClick={()=>onShowRoute(data.context.routes,r.id)}>Show {r.label.toLowerCase()} · {r.hops} hops</button>)}</div>}
   <p className="cdr-small">{data.context.routes.truncated?'Route results reached the limit; this is not a complete count.':'Route search completed within its configured limit.'} Shared transfers may appear in several routes; these are not separate amounts of money.</p>
   <details><summary>Agent tools and provenance</summary><p>{data.result.basis}</p><p>Team {data.result.team} · Snapshot {data.run.money_run_id} · Review {data.run.run_id}</p><p>Question: {data.run.question}</p>{data.toolEvents.map((e,i)=><p key={i}>{e.tool_name} · {new Date(e.created_at).toLocaleString()}</p>)}<p>Citations validate transaction references, not every interpretation. Source records, Money Flow calculations, the existing Connection Review agent and Batch Assistant are unchanged.</p></details>
  </>}
 </details>;
}
