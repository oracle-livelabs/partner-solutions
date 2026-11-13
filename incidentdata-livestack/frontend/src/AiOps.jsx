import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './ai-ops.css';
import {displayAppLabel} from './app-branding.mjs';
import './ai-ops-coverage.css';

const number=value=>Number(value||0).toLocaleString();
const date=value=>value?new Date(value).toLocaleString():'Unavailable';
const duration=value=>value==null?'Unavailable':value<1000?`${number(value)} ms`:`${(value/1000).toFixed(1)} s`;
const tokenLabel=event=>event.token_status==='measured'?`${number(event.total_tokens)} tokens`:event.token_status==='not_applicable'?'Not applicable':'Unavailable';
const labels={llm:'LLM attempt',native:'Native invocation',embedding:'Embedding operation',workflow:'Workflow / local processing',historical:'Historical exchange'};
async function read(user,url,signal) {
  const response=await fetch(url,{headers:{'X-Demo-User':user},signal});
  const result=await response.json();if(!response.ok)throw Error(result.error || 'AI Opps is unavailable.');return result;
}
function Bars({title,rows,onSelect}) {
  const max=Math.max(1,...rows.map(r=>r.tokens));
  return <section className="aiops-panel"><h3>{title}</h3><p>Reported tokens · unknown usage excluded</p>
    {!rows.length?<div className="aiops-empty">No activity in this selection.</div>:<div className="aiops-bars">{rows.map(row=><button key={row.label} onClick={()=>onSelect(row.label)} className="aiops-bar" title={`Filter ${displayAppLabel(row.label)}`}>
      <span><b>{displayAppLabel(row.label)}</b><strong>{number(row.tokens)}</strong></span><i><em style={{width:`${row.tokens/max*100}%`}} /></i><small>{number(row.records)} records{row.unavailable>0?` · ${number(row.unavailable)} without token totals`:''}</small>
    </button>)}</div>}
  </section>;
}
function LlmCoverage({rows,onSelect}) {
  const measured=rows.filter(r=>r.coverage==='measured'),unmeasured=rows.filter(r=>r.coverage==='unavailable');
  return <section className="aiops-panel aiops-llm-coverage"><header><h3>LLM invocation coverage</h3><p>Embeddings are excluded. Historical exchanges are records, not reconstructed call counts. Local inference counts are not cloud billing.</p></header><div className="aiops-coverage-columns"><Bars title="Invoked and tokenized" rows={measured} onSelect={onSelect}/><Bars title="Invoked · token totals unavailable" rows={unmeasured} onSelect={onSelect}/></div></section>;
}
function Trend({rows}) {
  const max=Math.max(1,...rows.map(r=>r.tokens)),width=720,height=150,gap=rows.length?width/rows.length:width;
  return <section className="aiops-panel aiops-trend"><div><h3>Usage over time</h3><p>Reported tokens by recorded day · UTC</p></div>
    {!rows.length?<div className="aiops-empty">Activity will appear here as operations complete.</div>:<>
      <svg viewBox={`0 0 ${width} ${height+30}`} role="img" aria-label="Daily reported token usage; exact values are in the daily totals below">
        {[0,.5,1].map(y=><line key={y} x1="0" x2={width} y1={height-y*(height-12)} y2={height-y*(height-12)} stroke="#e5ecee" />)}
        {rows.map((r,i)=><g key={r.label}><title>{r.label}: {number(r.tokens)} reported tokens; {r.records} activity records</title><rect x={i*gap+gap*.12} y={height-r.tokens/max*(height-12)} width={Math.max(1,gap*.76)} height={r.tokens/max*(height-12)} rx="3" fill="#277d83" /></g>)}
        <text x="0" y={height+24}>{rows[0].label}</text><text x={width} y={height+24} textAnchor="end">{rows.at(-1).label}</text>
      </svg><details><summary>Daily totals</summary><div className="aiops-daily">{rows.map(r=><span key={r.label}>{r.label}: <b>{number(r.tokens)}</b> tokens · {number(r.records)} records</span>)}</div></details>
    </>}
  </section>;
}
function Excerpt({title,value,empty}) {
  return <section className="aiops-excerpt"><h3>{title}</h3>{value?<><pre>{value.text}</pre>{value.truncated&&<p className="aiops-warning">Excerpt only · {number(value.characters)} original characters.</p>}</>:<p>{empty}</p>}</section>;
}
function Detail({user,id,onClose,onTrace,onSource}) {
  const dialog=useRef(),[data,setData]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{const element=dialog.current,trigger=document.activeElement,overflow=document.body.style.overflow;element.showModal();document.body.style.overflow='hidden';return()=>{element.close();document.body.style.overflow=overflow;if(trigger?.isConnected)trigger.focus({preventScroll:true});};},[]);
  useEffect(()=>{const controller=new AbortController();setData(null);setError('');read(user,`/api/ai-ops/events/${encodeURIComponent(id)}`,controller.signal).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[user,id,retry]);
  function keys(e){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();return;}
    if(e.key!=='Tab')return;
    const controls=[...dialog.current.querySelectorAll('button:not(:disabled),summary,a[href],[tabindex="0"]')].filter(x=>x.getClientRects().length),first=controls[0],last=controls.at(-1);
    if(e.shiftKey&&(document.activeElement===first||!controls.includes(document.activeElement))){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||!controls.includes(document.activeElement))){e.preventDefault();first?.focus();}
  }
  const event=data?.event,d=data?.detail;
  return createPortal(<dialog ref={dialog} className="aiops-dialog" aria-labelledby="aiops-detail-title" onKeyDownCapture={keys} onCancel={e=>{e.preventDefault();onClose();}}>
    <header><div><small>READ-ONLY · RECORDED ACTIVITY</small><h2 id="aiops-detail-title">AI activity details</h2></div><button autoFocus onClick={onClose}>Close details</button></header>
    <div className="aiops-dialog-body" aria-busy={!data&&!error}>
      {error?<p className="aiops-warning" role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry details</button></p>:!data?<p>Loading saved activity…</p>:<>
        <h3>{displayAppLabel(event.feature)}</h3><p>{displayAppLabel(event.area)} · {labels[event.kind]} · {event.status}</p>
        <div className="aiops-detail-metrics"><div><small>Token coverage</small><strong>{tokenLabel(event)}</strong></div><div><small>Duration</small><strong>{duration(event.elapsed_ms)}</strong></div><div><small>Attempt</small><strong>{event.attempt}</strong></div></div>
        <dl className="aiops-facts">{[['When',date(event.started_at)],['Model',event.model||'Not recorded / not applicable'],['Provider',event.provider],['Select AI profile',d.profile],['Registered operation',d.operationId],['Stage',d.stage],['Process',d.process],['Failure phase',d.failurePhase],['HTTP status',d.httpStatus],['Usage basis',d.usageBasis],['User / job',event.actor],['Batch',event.batch_id],['Source',event.source_label||event.source_id],['Run',event.run_id],['Trace',event.trace_id],['Request ID',d.requestId],['Conversation',d.conversationId],['Agent team',d.team],['Origin',d.origin],['Timing basis',d.timingBasis]].filter(([,v])=>v!=null).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <div className="aiops-detail-actions"><button onClick={()=>onTrace(event.trace_id)}>Show related activity</button>{event.batch_id&&<button onClick={()=>onSource(event.batch_id)}>Open source batch</button>}</div>
        {d.note&&<p className="aiops-notice">{d.note}</p>}{d.contentNotice&&<p className="aiops-warning">{d.contentNotice}</p>}
        <details open><summary>Usage breakdown</summary><dl className="aiops-facts">{[['Input tokens',event.prompt_tokens],['Output tokens',event.completion_tokens],['Reasoning tokens',event.reasoning_tokens],['Reported total',event.total_tokens],['Vectors generated',event.vectors],['Vector dimensions',d.dimensions],['Input items',d.inputCount],['Input characters',d.inputCharacters],['Output items',d.outputCount],['Audio seconds',d.audioSeconds]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v==null?'Not reported':number(v)}</dd></div>)}</dl><p>Do not add reasoning tokens again to the reported total. Vector dimensions are not tokens. Generated vectors include transient search-query vectors, not only saved vectors. Workflow durations can include child operations and must not be summed with them.</p></details>
        {d.error&&<Excerpt title="Recorded error" value={d.error} />}
        <Excerpt title="Request / prompt excerpt" value={d.prompt} empty="No prompt content is available in this record. Embedding inputs and image bytes are not retained here." />
        <Excerpt title="Response excerpt" value={d.response} empty="No response content is available in this record. No answer has been recreated." />
        {d.usage&&<details><summary>Raw provider usage</summary><pre>{JSON.stringify(d.usage,null,2)}</pre></details>}
      </>}
    </div>
  </dialog>,document.body);
}
export default function AiOps({user,initialBatch='',onNavigate}) {
  const [filters,setFilters]=useState({days:'30',batch:initialBatch}),[page,setPage]=useState(1),[data,setData]=useState(null),[error,setError]=useState(''),[fetching,setLoading]=useState(true),[loadedQuery,setLoadedQuery]=useState(''),[refresh,setRefresh]=useState(0),[selected,setSelected]=useState(null);
  const query=new URLSearchParams({...Object.fromEntries(Object.entries(filters).filter(([,v])=>v)),page}).toString();
  const loading=fetching||loadedQuery!==query;
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');read(user,`/api/ai-ops?${query}`,controller.signal).then(result=>{if(!controller.signal.aborted){setData(result);setLoadedQuery(query);setLoading(false);}}).catch(e=>{if(!controller.signal.aborted){setError(e.message);setData(null);setLoadedQuery(query);setLoading(false);}});return()=>controller.abort();},[user,query,refresh]);
  const change=(key,value)=>{setFilters(f=>({...f,[key]:value}));setPage(1);};
  const summary=data?.summary||{},options=data?.options||{},totalPages=Math.max(1,Math.ceil((summary.records||0)/25));
  const select=(key,label,values)=> <label>{label}<select aria-label={label} value={filters[key]||''} onChange={e=>change(key,e.target.value)}><option value="">All</option>{values.map(v=><option key={typeof v==='string'?v:v[0]} value={typeof v==='string'?v:v[0]}>{displayAppLabel(typeof v==='string'?v:v[1])}</option>)}</select></label>;
  return <div className="aiops-page">
    <header className="aiops-head"><div><small>INCIDENTDATA LIVE STACK · OBSERVABILITY</small><h2>AI Opps</h2><p>Understand where AI was used, what it consumed, and what happened.</p></div><button onClick={()=>setRefresh(n=>n+1)} disabled={loading}>{loading?'Refreshing…':'Refresh activity'}</button></header>
    <section className="aiops-filters" aria-label="AI activity filters"><label>Time range<select value={filters.days} onChange={e=>change('days',e.target.value)}>{[1,7,30,90].map(d=><option key={d} value={d}>Last {d} {d===1?'day':'days'}</option>)}</select></label>{select('area','Application area',options.areas||[])}{select('model','Model',options.models||[])}
      <details><summary>More filters</summary><div>{select('operation','Registered operation',(data?.operations||[]).map(o=>[o.id,o.feature]))}{select('batch','Batch',options.batches||[])}{select('kind','Activity type',Object.entries(labels))}{select('status','Status',[['complete','Complete'],['failed','Failed']])}{select('coverage','Token coverage',[['measured','Measured'],['unavailable','Unavailable'],['not_applicable','Not applicable']])}{user==='statewide_admin'&&select('owner','User / job',options.owners||[])}</div></details>
      <button onClick={()=>{setFilters({days:'30'});setPage(1);}}>Reset filters</button>
    </section>
    {filters.trace&&<p className="aiops-notice">Related trace: <code>{filters.trace}</code> <button onClick={()=>change('trace','')}>Clear trace filter</button></p>}
    {filters.batch&&<p className="aiops-notice">Batch: <code>{filters.batch}</code></p>}
    {error&&<p role="alert" className="aiops-warning">{error} <button onClick={()=>setRefresh(n=>n+1)}>Retry dashboard</button></p>}
    {loading&&<p role="status">Loading activity…</p>}
    {data&&<div className={loading?'aiops-loading':''} aria-busy={loading}>
      <p className="aiops-scope">{data.scope}</p>
      {data.collector?.dropped>0&&<p className="aiops-warning" role="alert">Collector warning: {number(data.collector.dropped)} activity records could not be saved since this process started. These totals are incomplete. Last failure: {date(data.collector.lastFailureAt)}.</p>}
      {data.workerCollector&&data.workerCollector.state!=='disabled'&&<p className={data.workerCollector.state==='reporting'&&!data.workerCollector.collector?.dropped?'aiops-notice':'aiops-warning'}>Detective Room collector: {data.workerCollector.state}. {data.workerCollector.collector?`${number(data.workerCollector.collector.saved)} saved · ${number(data.workerCollector.collector.dropped)} dropped since worker start.`:'Worker telemetry has not reported a current health snapshot.'}</p>}
      <section className="aiops-metrics" aria-label="Usage summary">{[
        ['LLM attempts',number(summary.llm_calls),'Direct attempts, including observed retries'],['Native invocations',number(summary.native_invocations),'Internal LLM call counts unavailable'],['Reported tokens',number(summary.reported_tokens),`${number(summary.unavailable)} unavailable · ${number(summary.local_tokens)} local inference tokens included`],['Vectors generated',number(summary.vectors),'Includes document and search-query vectors'],['Failures / retries',`${number(summary.failures)} / ${number(summary.retries)}`,`${number(summary.workflow_failures)} workflow failures included; records, not unique failed requests`],['Average AI duration',duration(summary.average_ai_ms===undefined?summary.average_ms:summary.average_ai_ms),`Workflow average: ${duration(summary.average_workflow_ms)} · not additive`]
      ].map(([label,value,note])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</section>
      <div className="aiops-coverage-strip"><b>Token coverage</b><span className="aiops-measured">{number(summary.measured)} measured</span><span className="aiops-unavailable">{number(summary.unavailable)} unavailable</span><span>{number(summary.not_applicable)} not applicable</span><small>Coverage is per activity record, not an estimate of hidden agent calls.</small></div>
      <section className="aiops-workspaces" aria-label="Explore AI usage"><button onClick={()=>{setFilters({days:filters.days,kind:'embedding'});setPage(1);}}><b>Visual &amp; text vectors</b><span>Embedding creation &amp; query processing ↗</span></button>{['Ask Crime Data','AI Agent Console','Crime Data Room','Evidence Intelligence'].map(area=><button key={area} onClick={()=>{setFilters({days:filters.days,area});setPage(1);}}><b>{area==='AI Agent Console'?'IncidentData AI Agent Console':displayAppLabel(area)}</b><span>Explore this application area ↗</span></button>)}</section>
      <Trend rows={data.trend}/><div className="aiops-chart-grid"><Bars title="Where AI was used" rows={data.byArea} onSelect={label=>change('area',label)}/><LlmCoverage rows={data.llmCoverage||[]} onSelect={label=>{if(options.models?.includes(label))change('model',label);}}/></div>
      <section className="aiops-panel"><header className="aiops-section-head"><div><h3>Activity ledger</h3><p>{number(summary.records)} records · click an activity to inspect its saved trace</p></div><span>{number(summary.workflows)} workflow/local-processing records · {number(summary.historical)} historical exchanges</span></header>
        {!data.events.length?<div className="aiops-empty"><b>No recorded activity matches these filters.</b><p>New activity appears after an instrumented operation finishes. Earlier unrecorded usage cannot be reconstructed.</p></div>:<div className="aiops-table" tabIndex={0} role="region" aria-label="AI activity ledger"><table><thead><tr><th>Recorded time</th><th>Activity / source</th><th>Model / execution</th><th>Usage</th><th>Status / duration</th><th>Inspect</th></tr></thead><tbody>{data.events.map(e=><tr key={e.event_id}><td><time>{date(e.started_at)}</time><small>{e.actor}</small></td><td><b>{displayAppLabel(e.feature)}</b><small>{displayAppLabel(e.area)}</small>{(e.source_label||e.batch_id)&&<small>{e.source_label||e.batch_id}</small>}</td><td>{e.model||e.provider}<small>{labels[e.kind]}{e.attempt>1?` · retry ${e.attempt-1}`:''}</small></td><td><span className={`aiops-${e.token_status}`}>{tokenLabel(e)}</span>{e.vectors>0&&<small>{number(e.vectors)} vectors</small>}</td><td><span className={`aiops-status ${e.status}`}>{e.status}</span><small>{duration(e.elapsed_ms)}</small></td><td><button onClick={()=>setSelected(e.event_id)} aria-label={`Inspect ${displayAppLabel(e.feature)} ${e.event_id}`}>Details ↗</button></td></tr>)}</tbody></table></div>}
        <nav className="aiops-pager" aria-label="Activity pages"><button disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {totalPages}</span><button disabled={loading||page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></nav>
      </section>
      <details className="aiops-panel aiops-coverage"><summary>Coverage, limits &amp; measurement notes</summary><div className="aiops-coverage-grid">{data.coverage.map(c=><article key={c.area}><h3>{displayAppLabel(c.area)}</h3><b>{c.state}</b><p>{c.note}</p></article>)}</div><ul>{data.notes.map(n=><li key={n}>{n}</li>)}</ul><p>Activity is retained in a separate Oracle JSON ledger. Opening this dashboard or its details does not call an LLM or rerun a workflow.</p></details>
      {!!data.operations?.length&&<details className="aiops-panel"><summary>Registered operations ({data.operations.length})</summary><p>Code coverage register; not a claim of complete token visibility. Counts respect the current filters and your access scope. Zero records means no captured activity in this selection, not zero AI usage. {number(summary.legacy_records)} older records have no registration ID.</p><div className="aiops-table" tabIndex={0} role="region" aria-label="Registered AI operations"><table><thead><tr><th>Operation</th><th>Measurement</th><th>Records / failures</th><th>Last seen</th></tr></thead><tbody>{data.operations.map(o=><tr key={o.id}><td><button onClick={()=>change('operation',o.id)}>{displayAppLabel(o.feature)}</button><small>{o.id} · {o.process||'app/shared helpers'}</small></td><td>{o.coverage}</td><td>{number(o.records)} / {number(o.failures)}</td><td>{o.lastSeen?date(o.lastSeen):'No records in selection'}</td></tr>)}</tbody></table></div></details>}
    </div>}
    {selected&&<Detail key={`${user}:${selected}`} user={user} id={selected} onClose={()=>setSelected(null)} onTrace={trace=>{setSelected(null);setFilters({days:'90',trace});setPage(1);}} onSource={batch=>{setSelected(null);onNavigate('data-room',{batchId:batch});}}/>}
  </div>;
}
