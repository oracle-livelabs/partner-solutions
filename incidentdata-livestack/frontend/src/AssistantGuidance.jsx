import React, {useCallback, useEffect, useRef, useState} from 'react';
import './assistant-guidance.css';

export function useAssistantGuidance({api,batchId,assistant,enabled}) {
  const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef(0);
  useEffect(()=>()=>{request.current++;},[batchId,assistant]);
  const run=useCallback(async command=>{
    if(!enabled||!batchId)return;
    const ticket=++request.current;setBusy(true);setError('');
    try{const result=await api(`/batches/${batchId}/assistants/${assistant}/${command}`);if(ticket===request.current)setData(result);}
    catch(e){if(ticket===request.current)setError(e.message);}
    finally{if(ticket===request.current)setBusy(false);}
  },[enabled,batchId,assistant,api]);
  return {enabled,available:!!batchId,data,busy,error,run};
}

export default function AssistantGuidance({guidance,onQuestion}) {
  const panel=useRef(null);
  useEffect(()=>{if(guidance.data)panel.current?.scrollIntoView({behavior:'smooth',block:'start'});},[guidance.data]);
  if(!guidance.enabled)return null;
  const {available,data,busy,error,run}=guidance;
  return <section ref={panel} className="assistant-guidance" aria-label="Assistant help and status">
    <div className="assistant-guidance-actions"><span>{available?<>Type <strong>help</strong> or <strong>status</strong>, or choose:</>:'Select a batch to use help and status.'}</span><button type="button" disabled={busy||!available} onClick={()=>run('help')}>Help</button><button type="button" disabled={busy||!available} onClick={()=>run('status')}>Status</button></div>
    {busy&&<p role="status">Checking saved application state…</p>}
    {error&&<p role="alert" className="cdr-failure">{error}</p>}
    {data&&<div className="assistant-guidance-result" role="status"><h4>{data.title}</h4><p>{data.summary}</p><dl>{data.facts.map(f=><div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl><strong>Next steps</strong><ul>{data.nextSteps.map(s=><li key={s}>{s}</li>)}</ul><p>{data.notes}</p><strong>Questions you can ask next</strong><div className="assistant-guidance-questions">{data.questions.map(q=><button type="button" key={q} disabled={!data.canAsk} onClick={()=>{onQuestion(q);requestAnimationFrame(()=>panel.current?.closest('.cdr-chat,.cdr-detective-chat')?.querySelector('form textarea')?.focus());}}>{q}</button>)}</div><small>{data.canAsk?'Choosing a question fills the input; Send or Ask Detective submits it.':'Complete the prerequisites with an authorised demo user to ask these questions.'} {data.source} · Checked {new Date(data.checkedAt).toLocaleString()} · Guidance is not saved to conversation history.</small></div>}
  </section>;
}
