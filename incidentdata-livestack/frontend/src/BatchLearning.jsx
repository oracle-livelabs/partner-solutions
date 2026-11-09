import React, {useEffect,useState} from 'react';
import './batch-learning.css';
import BatchBriefExplain from './BatchBriefExplain';
const date=value=>value?new Date(value).toLocaleString():'—';
const labels={queued:'Queued',running:'Generating brief',complete:'Brief saved',failed:'Failed'};

export default function BatchLearning({batchId,api,latestRun,ready,readOnly,working,onRun,onOpenSource,explain=false}){
  const [data,setData]=useState(null),[selectedRun,setSelectedRun]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    if(!batchId){setData(null);return;}
    const controller=new AbortController();let active=true;
    setLoading(true);setError('');setData(null);
    api(`/batches/${batchId}/learning${selectedRun?`?runId=${encodeURIComponent(selectedRun)}`:''}`,{signal:controller.signal})
      .then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[batchId,api,selectedRun,latestRun?.run_id,latestRun?.status,latestRun?.updated_at,refresh]);
  const busy=['queued','running'].includes(latestRun?.status),result=data?.result;
  const manifest=data?.manifest||[],byRef=new Map(manifest.map(s=>[s.ref,s]));
  const citations=refs=><div className="cdr-brief-citations">{refs.map(ref=>{const s=byRef.get(ref);return s?<button key={ref} disabled={!data.isCurrent||working} title={`${s.path} · description ${s.descriptionRunId}`} onClick={()=>onOpenSource({item_id:s.itemId,descriptionRunId:s.descriptionRunId})}>{ref} · {s.path}</button>:null;})}</div>;
  return <div className="cdr-learning" aria-label="Batch learning">
    <div className="cdr-learning-heading"><div><span className="cdr-ai-label">STAGE 5 · LEARN WHAT IS THERE</span><h3>Batch Brief</h3><p>A source-linked overview of this batch’s saved descriptions, content themes and questions for review.</p></div>
      {explain ? <div className="brief-explain-actions"><BatchBriefExplain/><button className="cdr-primary" onClick={onRun} disabled={!ready||readOnly||working||busy||loading}>{busy?'Learning…':latestRun?.status==='failed'?'Retry batch learning':data?.isCurrent&&result?'Reopen saved brief':'Run batch learning'}</button></div> : <button className="cdr-primary" onClick={onRun} disabled={!ready||readOnly||working||busy||loading}>{busy?'Learning…':latestRun?.status==='failed'?'Retry batch learning':data?.isCurrent&&result?'Reopen saved brief':'Run batch learning'}</button>}
    </div>
    <p className="cdr-learning-boundary">Uses saved AI descriptions—not a fresh review of the full original files. Themes are not established relationships. No POI matching, graph links or incident changes are made.</p>
    {!ready&&<p className="cdr-small">Complete Identify/Describe for every item before running this stage.</p>}
    {latestRun&&<div className="cdr-learning-status" role="status"><span className={`cdr-status cdr-status--${latestRun.status}`}>{labels[latestRun.status]}</span><span>Requested by {latestRun.requested_by} · {date(latestRun.created_at)}</span>{busy&&<span>Generating and validating source references; no estimated percentage.</span>}{latestRun.error_text&&<p className="cdr-failure">{latestRun.error_text}</p>}</div>}
    <div className="cdr-learning-history"><label>Brief history<select value={selectedRun} onChange={e=>setSelectedRun(e.target.value)} disabled={loading||!data?.history?.length}><option value="">Latest saved brief</option>{(data?.history||[]).map(r=><option key={r.run_id} value={r.run_id}>{date(r.created_at)} · {labels[r.status]} · {r.run_id.slice(0,8)}</option>)}</select></label><button disabled={loading} onClick={()=>setRefresh(v=>v+1)}>Refresh brief</button></div>
    {error&&<p className="cdr-failure" role="alert">{error}</p>}
    {data?.run?.error_text&&data.run.run_id!==latestRun?.run_id&&<p className="cdr-failure">Selected attempt: {data.run.error_text}</p>}
    {data?.generation?.attempts?.length>0&&<details><summary>Generation diagnostics</summary>{data.generation.attempts.map(a=><p className="cdr-small" key={a.attempt}>Attempt {a.attempt}: {a.status} · {a.elapsedMs} ms · finish: {a.finishReason||'unavailable'} · tokens: {a.usage?.totalTokens??'unavailable'}{a.error?` · ${a.error}`:''}</p>)}</details>}
    {loading?<p className="cdr-empty">Loading saved brief…</p>:!result?<p className="cdr-empty">{busy?'The batch brief will appear here when the learning run finishes.':'No saved brief for this selection yet. Run batch learning when the descriptions are ready.'}</p>:<div className="cdr-brief-result">
      <span className="cdr-ai-label">AI DRAFT · ANALYST REVIEW REQUIRED</span><h3>{result.title}</h3>
      {!data.isCurrent&&<p className="cdr-ai-warning">This saved brief uses older descriptions or an older learning prompt. Generate a current brief before relying on its source links.</p>}
      {latestRun?.run_id!==data.run.run_id&&<p className="cdr-small">Viewing saved run {data.run.run_id.slice(0,8)}; the latest attempt is shown above.</p>}
      <div className="cdr-learning-metrics"><span><strong>{data.coverage.itemCount}</strong> descriptions supplied</span><span><strong>{data.coverage.imageCount}</strong> image descriptions</span><span><strong>{data.coverage.partialTextCount}</strong> partial original-text analyses</span><span><strong>{data.coverage.condensedCount}</strong> descriptions condensed for this brief</span></div>
      <p className="cdr-small">Inventory counts from ADB: {Object.entries(data.coverage.typeCounts).map(([t,n])=>`${n} ${t.toUpperCase()}`).join(' · ')}. Source references are checked for batch membership, not for the truth of each AI claim.</p>
      <section className="cdr-brief-section"><h4>What is in this batch</h4>{result.overview.map((entry,i)=><div className="cdr-brief-entry" key={i}><p>{entry.text}</p>{citations(entry.sourceIds)}</div>)}</section>
      <section className="cdr-brief-section"><h4>Content themes</h4><div className="cdr-theme-grid">{result.themes.map((entry,i)=><div className="cdr-brief-entry" key={i}><h5>{entry.title}</h5><p>{entry.summary}</p>{citations(entry.sourceIds)}</div>)}</div></section>
      <section className="cdr-brief-section"><h4>Questions and gaps to review</h4>{result.reviewQuestions.length?result.reviewQuestions.map((entry,i)=><div className="cdr-brief-entry" key={i}><h5>{entry.question}</h5><p>{entry.reason}</p>{citations(entry.sourceIds)}</div>):<p>No additional questions were returned by the model. This does not establish that the batch is complete.</p>}</section>
      <details className="cdr-learning-manifest"><summary>Source manifest · {manifest.length} description versions</summary>{manifest.map(s=><div key={s.ref}><strong>{s.ref} · {s.path}</strong><span>{s.descriptionModel} · {s.descriptionPromptVersion} · {date(s.descriptionCreatedAt)}</span><code>Item: {s.itemId}</code><code>Source SHA-256: {s.sourceSha256}</code><code>Description run: {s.descriptionRunId}</code><code>Description SHA-256: {s.descriptionSha256}</code>{s.condensedForBrief&&<small>Condensed before synthesis; the original description is retained.</small>}</div>)}</details>
      <div className="cdr-ai-provenance"><span>Model: {data.run.model_id} · {data.run.region} · Prompt: {data.run.prompt_version}</span><span>Saved: {date(data.run.finished_at)} · Requested by: {data.run.requested_by}</span><span>Run: <code>{data.run.run_id}</code></span><span>Input SHA-256: <code>{data.run.input_sha256}</code></span><span>OCI request: <code>{data.run.request_id||'—'}</code></span></div>
    </div>}
  </div>;
}
