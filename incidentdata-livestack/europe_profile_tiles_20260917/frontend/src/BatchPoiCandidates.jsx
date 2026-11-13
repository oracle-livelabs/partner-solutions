import React,{useEffect,useRef,useState} from 'react';
import './batch-poi-candidates.css';

export default function BatchPoiCandidates({batchId,items=[],api,user,readOnly,narrativeOnly=false}){
 const [mode,setMode]=useState('narrative'),[selected,setSelected]=useState(''),[region,setRegion]=useState(null),[imageUrl,setImageUrl]=useState(''),[imageError,setImageError]=useState('');
 const [groups,setGroups]=useState([]),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
 const [coverage,setCoverage]=useState(null),[coverageError,setCoverageError]=useState(''),[minimumScore,setMinimumScore]=useState(0.30);
 const drag=useRef(null),request=useRef(null),alive=useRef(true);
 const available=mode==='visual'?items.filter(i=>['png','jpg'].includes(i.content_type)):items;
 const item=available.find(i=>i.item_id===selected)||available[0];
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[]);
 useEffect(()=>{setMinimumScore(mode==='visual'?0.60:0.30);},[mode]);
 useEffect(()=>{
  setCoverage(null);setCoverageError('');if(!batchId)return;const controller=new AbortController();
  api(`/batches/${batchId}/poi-catalogue`,{signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setCoverage(r);}).catch(e=>{if(!controller.signal.aborted)setCoverageError(e.message);});
  return()=>controller.abort();
 },[batchId,api]);
 useEffect(()=>{setGroups([]);setError('');setRegion(null);drag.current=null;},[mode,item?.item_id]);
 useEffect(()=>{
  setImageUrl('');setImageError('');
  if(mode!=='visual'||!item)return;
  const controller=new AbortController();let url;
  fetch(`/api/data-room/batches/${batchId}/items/${item.item_id}/download`,{headers:{'X-Demo-User':user},signal:controller.signal}).then(async r=>{
   if(!r.ok)throw Error('Unable to load the authorised scene.');
   const blob=await r.blob();if(controller.signal.aborted)return;
   url=URL.createObjectURL(blob);setImageUrl(url);
  }).catch(e=>{if(!controller.signal.aborted)setImageError(e.message);});
  return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
 },[batchId,item?.item_id,mode,user]);
 function point(e){const box=e.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(e.clientY-box.top)/box.height))};}
 function start(e){if(busy||!imageUrl)return;drag.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);setRegion(null);setGroups([]);}
 function move(e){if(!drag.current)return;const end=point(e),a=drag.current;setRegion({x:Math.min(a.x,end.x),y:Math.min(a.y,end.y),width:Math.abs(end.x-a.x),height:Math.abs(end.y-a.y)});}
 function end(e){move(e);drag.current=null;}
 function numeric(key,value){setGroups([]);const r=region||{x:0,y:0,width:1,height:1};const next={...r,[key]:Math.max(0,Math.min(1,Number(value)/100))};next.width=Math.min(next.width,1-next.x);next.height=Math.min(next.height,1-next.y);setRegion(next);}
 async function search(all=false){
  setError('');setGroups([]);setBusy(true);const controller=new AbortController();request.current=controller;
  const sources=all?items:[item];
  try{
   for(const [index,source] of sources.entries()){
    if(controller.signal.aborted)break;
    setProgress(`Searching ${index+1} of ${sources.length}: ${source.original_path}`);
    try{
     const result=await api(`/batches/${batchId}/items/${source.item_id}/poi-candidates`,{method:'POST',signal:controller.signal,body:JSON.stringify({mode,region:mode==='visual'?region:undefined})});
     if(alive.current&&!controller.signal.aborted){setGroups(g=>[...g,result]);if(result.catalogue)setCoverage(result.catalogue);}
    }catch(e){if(controller.signal.aborted)break;if(alive.current)setGroups(g=>[...g,{itemId:source.item_id,path:source.original_path,error:e.message}]);}
   }
  }finally{if(alive.current){setBusy(false);setProgress('');}}
 }
 function download(){const blob=new Blob([JSON.stringify({version:'cdr-poi-review-export-v2',batchId,exportedAt:new Date().toISOString(),minimumCosineDisplayFilter:minimumScore,notice:'Unreviewed candidates, not saved graph links. No identity probabilities. Display filter is not a calibrated match threshold. All returned neighbours are retained.',searches:groups},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='poi-candidates.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="cdr-poi" aria-label="POI candidate searches">
  <span className="cdr-ai-label">OPTIONAL · FICTIONAL POI CANDIDATES</span><h3>Compare this batch with registered POIs</h3>
  <p>Search narrative context or select a region in a generated scene. Results are candidates for manual review—not established identities or connections.</p>
  {coverage?<div className="cdr-poi-coverage"><strong>Searchable catalogue: {coverage.narrativeReady}/{coverage.registered} narrative · {coverage.visualReady}/{coverage.registered} visual</strong>
   {(coverage.narrativeReady<coverage.registered||coverage.visualReady<coverage.registered)&&<p>Incomplete vector coverage: profiles without compatible vectors cannot appear in similarity results. Literal text mentions can still be listed.</p>}
   <details><summary>Check registered profiles and vector readiness</summary>{coverage.profiles.map(p=><p key={p.person_ref}>{p.display_name} · narrative: {p.narrative_ready?'ready':'unavailable'} · visual: {p.visual_ready?'ready':'unavailable'}</p>)}</details>
  </div>:<p className="cdr-small">{coverageError?`Catalogue coverage unavailable: ${coverageError}`:'Checking catalogue coverage…'}</p>}
  <div className="cdr-poi-modes" role="group" aria-label="POI search mode">
   <button aria-pressed={mode==='narrative'} disabled={busy} onClick={()=>setMode('narrative')}>Narrative → POI profiles</button>
   {!narrativeOnly&&<button aria-pressed={mode==='visual'} disabled={busy} onClick={()=>setMode('visual')}>Image region → POI portraits</button>}
  </div>
  <label>Source file<select aria-label="POI source file" value={item?.item_id||''} disabled={busy||!available.length} onChange={e=>setSelected(e.target.value)}>{available.map(i=><option key={i.item_id} value={i.item_id}>{i.original_path}</option>)}</select></label>
  <label className="cdr-poi-filter">Minimum cosine score (display filter only)<input aria-label="Minimum cosine score" type="number" min="-1" max="1" step="0.05" value={minimumScore} onChange={e=>setMinimumScore(Math.max(-1,Math.min(1,Number(e.target.value))))}/></label>
  <p className="cdr-small">Default display filters: narrative 0.30, visual 0.60. These are adjustable screening choices, not validated identity thresholds. Lower-scoring neighbours remain available below; passing the filter does not confirm a match.</p>
  {!available.length&&<p>No eligible source files are available.</p>}
  {mode==='narrative'?<p className="cdr-small">Similarity uses the first 1,500 text characters or a saved image description; the embedding tokenizer may truncate further. Separately, registered names/aliases are checked against the first 24,000 original text characters—not image descriptions or filenames. Neither signal verifies identity.</p>:<>
   <p className="cdr-small">Draw a box around one fictional character, or enter a region below. This compares a crop with reference portraits using CLIP; it does not detect or identify people automatically. Minimum region: 24 × 24 source pixels.</p>
   {imageError&&<p role="alert">{imageError}</p>}
   {imageUrl&&<div className="cdr-poi-scene" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{drag.current=null;}}>
    <img src={imageUrl} alt={`Original scene: ${item.original_path}. Select a region for comparison.`} draggable="false" onError={()=>setImageError('The scene could not be displayed.')}/>
    {region&&<div className="cdr-poi-box" style={{left:`${region.x*100}%`,top:`${region.y*100}%`,width:`${region.width*100}%`,height:`${region.height*100}%`}}/>}
   </div>}
   <fieldset className="cdr-poi-coordinates" disabled={busy}><legend>Region coordinates (% of displayed image; keyboard alternative)</legend>{['x','y','width','height'].map(k=><label key={k}>{k}<input aria-label={`Region ${k} percent`} type="number" min="0" max="100" step="1" value={region?Math.round(region[k]*100):''} onChange={e=>numeric(k,e.target.value)}/></label>)}<button onClick={()=>{setRegion(null);setGroups([]);}}>Clear region</button></fieldset>
  </>}
  <div className="cdr-poi-actions">
   <button className="cdr-primary" disabled={readOnly||busy||!item||(mode==='visual'&&(!region?.width||!region?.height||!imageUrl||!!imageError))} onClick={()=>search(false)}>{mode==='visual'?'Compare selected region':'Search selected narrative'}</button>
   {mode==='narrative'&&<button disabled={readOnly||busy||!items.length} onClick={()=>search(true)}>Search all batch narratives</button>}
   {busy&&<button onClick={()=>request.current?.abort()}>Stop after current request</button>}
   {groups.length>0&&<button disabled={busy} onClick={download}>Download candidate report</button>}
  </div>
  {busy&&<p role="status">{progress}</p>}{error&&<p role="alert">{error}</p>}
  <p className="cdr-small">Session-only results. Download to retain them; these candidates are not included in the saved graph or Stage 7 pack. No match is asserted, even when a score is high.</p>
  <div aria-live="polite">{groups.map(g=><article className="cdr-poi-result" key={g.itemId}>
   <h4>{g.path}</h4>{g.error?<p className="cdr-failure">Search unavailable: {g.error}</p>:<>
    {g.mentionCoverage?.basis==='original_text'&&<section className="cdr-poi-mentions"><h5>Explicit name / alias mentions in original text</h5>
     <p className="cdr-small">Checked {g.mentionCoverage.charactersScanned} of {g.mentionCoverage.totalCharacters} characters. Literal wording only; not a verified identity or relationship.</p>
     {g.explicitMentions?.length?g.explicitMentions.map(p=><div key={p.person_ref}><strong>{p.display_name}</strong><code> · {p.person_ref}</code>{p.quotes.map(q=><p key={q.startCharacter}><q>{q.quote}</q> · characters {q.startCharacter}–{q.endCharacter} · {q.matchType==='registered_name'?'registered name':'registered alias'}{q.ambiguous?' · ambiguous: shared by multiple profiles':''}</p>)}</div>):<p>No registered name or alias found in the scanned text. This does not rule out a person’s involvement or an unregistered spelling/handle.</p>}
    </section>}
    <div className="cdr-poi-query">{g.cropDataUrl?<img src={g.cropDataUrl} alt="Exact submitted scene crop"/>:<details><summary>Source excerpt used for this search</summary><pre>{g.query.excerpt}</pre><p>{g.query.coverageNotice}</p></details>}</div>
    <p className="cdr-small">{g.mode==='visual'?'Visual':'Narrative'} · {g.model} · {g.dimensions} dimensions · {g.elapsedMs} ms · top {g.candidates.length} distinct profiles</p>
    {!g.candidates.length&&<p>No compatible POI vectors are available in your authorised scope.</p>}
    <h5>Similarity candidates—not confirmed matches</h5>
    {g.candidates.length>0&&!g.candidates.some(p=>Number(p.score)>=minimumScore)&&<p className="cdr-poi-inconclusive" role="status">No candidates meet the current display filter. There is no convincing result under this filter; this does not establish that the person is absent.</p>}
    <div className="cdr-poi-cards">{g.candidates.filter(p=>Number(p.score)>=minimumScore).map((p,index)=><article className="cdr-poi-candidate" key={p.person_ref}>
     {p.portrait_asset_uri&&<img src={p.portrait_asset_uri} alt={p.portrait_alt_text||'Registered fictional reference portrait'}/>}
     <div><span className="cdr-small">Candidate {index+1} · unreviewed</span><h5>{p.display_name}</h5><code>{p.person_ref}</code><p>Cosine similarity: <strong>{Number(p.score).toFixed(3)}</strong></p><p>{p.narrative_summary}</p></div>
    </article>)}</div>
    {g.candidates.some(p=>Number(p.score)<minimumScore)&&<details className="cdr-poi-low"><summary>Inspect below-filter neighbours ({g.candidates.filter(p=>Number(p.score)<minimumScore).length})</summary>{g.candidates.filter(p=>Number(p.score)<minimumScore).map(p=><p key={p.person_ref}>{p.display_name} · {p.person_ref} · cosine {Number(p.score).toFixed(3)} · below display filter</p>)}</details>}
    <details><summary>Search provenance</summary><p>Created: {g.createdAt} · {g.version}</p><p>Source SHA-256: <code>{g.sourceSha256}</code></p>{g.query.descriptionRunId&&<p>Description run: {g.query.descriptionRunId}</p>}{g.query.region&&<p>Region (oriented source pixels): {JSON.stringify(g.query.region)} · crop SHA-256: <code>{g.query.cropSha256}</code></p>}<p>{g.notice}</p></details>
   </>}
   <button disabled={busy} onClick={()=>setGroups(v=>v.filter(r=>r.itemId!==g.itemId))}>Dismiss these candidates</button>
  </article>)}</div>
 </section>;
}
