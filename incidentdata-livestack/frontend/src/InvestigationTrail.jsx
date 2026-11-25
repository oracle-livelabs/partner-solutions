import React,{useEffect,useState} from 'react';
import {useActiveProfile} from './ProfileContext';
import './investigation-trail.css';

export default function InvestigationTrail({user,context={},onNavigate,mode='pattern',onStep}){
  const profile=useActiveProfile();
  const [data,setData]=useState(null),[error,setError]=useState('');
  const {patternCode='',incidentRef='',postRef=''}=context;
  useEffect(()=>{
    setData(null);setError('');if(!patternCode&&!incidentRef&&!postRef)return;
    const controller=new AbortController();
    const params=new URLSearchParams({patternCode,incidentRef,postRef});
    fetch('/api/investigation-trail?'+params,{headers:{'X-Demo-User':user},signal:controller.signal})
      .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d;})
      .then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>controller.abort();
  },[user,profile.profileCode,patternCode,incidentRef,postRef]);
  if(!patternCode&&!incidentRef&&!postRef)return null;
  if(error)return <p role="alert">{error}</p>;
  if(!data)return <p role="status">Loading the source trail…</p>;
  const p=data.patterns[0];
  const base={...context,patternCode:p?.PATTERN_CODE||patternCode,patternName:p?.PATTERN_NAME||'',caseRef:p?.CASE_REF||'',profileCode:profile.profileCode};
  const navigate=(page,extra)=>onNavigate(page,{...base,...extra});
  return <section className="investigation-trail" aria-label="Investigation trail">
    <small>WATCH PATTERN → SIGNAL / INCIDENT → SOURCE EVIDENCE</small>
    <h3>{data.story?.title||p?.PATTERN_NAME||'Follow the recorded links'}</h3>
    {data.story&&<p>{data.story.premise}</p>}
    {mode!=='pattern'&&p&&<button onClick={()=>navigate('signals',{incidentRef:'',postRef:'',query:''})}>Back to watch pattern</button>}
    {postRef&&data.posts.map(s=><div className="trail-context" key={s.POST_REF+':'+s.INCIDENT_REF}><b>Lead: {s.POST_REF} · unverified public post</b><p>{s.POST_TEXT}</p><p><strong>Why linked:</strong> {s.LINK_SUMMARY||'No reviewed incident link. Do not infer one from similarity.'}</p></div>)}
    {mode==='pattern'&&<>
      <h4>Start with a concern</h4>
      <div className="trail-grid">{data.posts.filter(s=>s.KNOWLEDGE_SET_ID).map(s=><article key={s.POST_REF+':'+s.INCIDENT_REF}><small>SIMULATED PUBLIC SIGNAL · NOT EVIDENCE</small><p>{s.POST_TEXT}</p><p className="trail-basis">{s.LINK_SUMMARY||'No reviewed incident relationship. This remains an unlinked awareness signal.'}</p>{s.INCIDENT_REF&&data.incidents.some(i=>i.INCIDENT_REF===s.INCIDENT_REF)&&<button onClick={()=>navigate('incidents',{query:s.INCIDENT_REF,incidentRef:s.INCIDENT_REF,postRef:s.POST_REF})}>Follow this lead</button>}</article>)}</div>
      <details><summary>{data.incidents.length} explicitly linked incidents · inspect the source reports</summary>{data.incidents.map(i=><article key={i.INCIDENT_REF}><b>{i.SUBURB} · {i.INCIDENT_STATUS}</b><p>{i.REPORT_SUMMARY}</p><button onClick={()=>navigate('incidents',{query:i.INCIDENT_REF,incidentRef:i.INCIDENT_REF,postRef:''})}>Open {i.INCIDENT_REF}</button><span> · {i.EVIDENCE_COUNT} source items</span></article>)}</details>
    </>}
    {mode==='incident'&&<>
      <h4>Continue into the source material</h4>
      <p>The original incident report remains unchanged. These are supplementary synthetic records, not findings.</p>
      {data.evidence.length?<button onClick={()=>navigate('evidence',{incidentRef,query:'',evidenceRef:data.evidence.find(e=>e.EVIDENCE_TYPE==='signal_triage_note')?.EVIDENCE_REF||data.evidence[0].EVIDENCE_REF})}>Inspect {data.evidence.length} linked evidence sources</button>:<p>No Evidence Intelligence sources are available for this incident in your scope.</p>}
    </>}
    {data.story&&mode!=='pattern'&&<div className="trail-steps" aria-label="Care-Trust questions">{data.story.steps.map(step=><button key={step.id} aria-pressed={context.storyStep===step.id} onClick={()=>onStep?onStep(step):navigate('evidence',{storyStep:step.id,evidenceRefs:step.evidenceRefs,evidenceRef:step.evidenceRefs[0],reviewQuestion:step.reviewQuestion})}>{step.label}</button>)}</div>}
    {mode==='evidence'&&data.story?.steps.filter(s=>s.id===context.storyStep).map(s=><div key={s.id} className="trail-context"><b>{s.question}</b><p>{s.basis}</p></div>)}
    <small>{data.notice}</small>
  </section>;
}
