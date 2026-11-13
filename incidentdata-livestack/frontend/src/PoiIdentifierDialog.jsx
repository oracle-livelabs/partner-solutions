import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import * as d3 from 'd3';
import {useActiveProfile} from './ProfileContext';
import {TYPE_COLORS,identifierState,filterIdentifiers,identifierNetwork,timeDomain} from './poi-identifier-model.mjs';
import './poi-identifier-dialog.css';

const pretty=value=>String(value||'Not recorded').replaceAll('_',' ');
const short=(value,length=25)=>value.length>length?value.slice(0,length-1)+'…':value;
const dateText=(value,zone)=>value?new Intl.DateTimeFormat('en-AU',{timeZone:zone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Not recorded';
// Same name normalisation as People mentioned (backend normalizeName), so highlighted rows are the matched ones.
const matchKey=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[’']/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const BASIS={display_name:'display name',primary_alias:'primary alias',registered_alias:'registered alias'};
// Only registered-alias matches are highlighted: those are the identifier rows the match used.
function matchedRows(rows,match){
 const keys=new Set((match?.matches||[]).filter(m=>m.basis==='registered_alias').map(m=>matchKey(m.value)));
 return keys.size?rows.filter(r=>r.IDENTIFIER_TYPE==='alias'&&['declared','confirmed'].includes(r.REVIEW_STATUS)&&keys.has(matchKey(r.IDENTIFIER_VALUE))):[];
}
function MatchBanner({match}){
 return <section className="pid-match-banner" aria-label="Why this record was opened"><small>OPENED FROM {match.origin}</small>
  <p>{match.matches.map((m,i)=><span key={m.basis+m.value}>{i?'; ':''}Matched {BASIS[m.basis]} “<strong>{m.value}</strong>” in {m.foundIn.join(', ')}</span>)}.</p>
  <p>A name or alias match is a possible match for review. It does not confirm identity.</p></section>;
}
function RecordLinks({detail,zone}){
 if(!detail)return <p className="pid-hint">Loading incident links and visual assets…</p>;
 if(detail.error)return <p className="pid-hint">{detail.error}</p>;
 return <>
  <h4>Recorded incident links</h4><p>{detail.person?.SCOPED_INCIDENT_COUNT||0} in your authorised scope · showing up to six recent links</p>
  {detail.incidentLinks.map(link=><article key={link.INCIDENT_REF} className="pid-link"><strong>{link.INCIDENT_REF} · {link.CATEGORY_NAME}</strong><p>{link.CONNECTION_TYPE} · {link.LINK_SUMMARY}</p></article>)}
  <h4>Registered visual assets</h4>{!detail.assets.length&&<p>No visual assets recorded.</p>}
  {detail.assets.map(asset=><details key={asset.ASSET_REF}><summary>{asset.ASSET_REF} · {asset.ASSET_KIND}</summary><p>{asset.ASSET_CAPTION}</p><p>{asset.MIME_TYPE} · {asset.EMBEDDING_MODEL} · {dateText(asset.CREATED_AT,zone)}</p>{asset.ASSET_URI&&<img className="pid-asset" src={asset.ASSET_URI} alt={asset.ASSET_CAPTION||'Fictional POI asset'} loading="lazy"/>}</details>)}
 </>;
}
function RecordDetail({row,zone}){
 if(!row)return <p className="pid-hint">Select an identifier to inspect its source, capture and review details.</p>;
 return <section className="pid-record" aria-label="Selected identifier details"><header><div><small>{pretty(row.IDENTIFIER_TYPE)} · {row.NAMESPACE}</small><h3>{row.IDENTIFIER_VALUE}</h3></div><span className={'pid-status '+identifierState(row).toLowerCase().replaceAll(' ','-')}>{identifierState(row)}</span></header>
  <dl>{[['Review status',pretty(row.REVIEW_STATUS)],['Captured by',row.RECORDED_BY],['Captured',dateText(row.CREATED_AT,zone)],['Reviewed by',row.REVIEWED_BY||'Awaiting review'],['Reviewed',dateText(row.REVIEWED_AT,zone)],['Valid from',dateText(row.VALID_FROM,zone)],['Valid to',row.VALID_TO?dateText(row.VALID_TO,zone):'Open-ended'],['Source reference',row.SOURCE_REF]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Not recorded'}</dd></div>)}</dl><p>{row.SOURCE_NOTE}</p>
 </section>;
}
function Network({person,rows,selectedId,onSelect,matchedIds}){
 const svgRef=useRef(),rootRef=useRef(),zoomRef=useRef();
 const [actors,setActors]=useState(true),[actor,setActor]=useState(null);
 const network=useMemo(()=>{
  const graph=identifierNetwork(person,rows,actors);
  const simulation=d3.forceSimulation(graph.nodes).stop().force('link',d3.forceLink(graph.edges).id(n=>n.id).distance(e=>e.kind==='association'?145:110)).force('charge',d3.forceManyBody().strength(-180)).force('radial',d3.forceRadial(n=>n.kind==='person'?0:n.kind==='actor'?210:125,500,240).strength(.8)).force('center',d3.forceCenter(500,240)).force('collide',d3.forceCollide(n=>n.kind==='person'?70:53));
  for(let i=0;i<180;i++)simulation.tick();
  const xs=d3.extent(graph.nodes,n=>n.x),ys=d3.extent(graph.nodes,n=>n.y);
  const scale=Math.min(1.3,850/Math.max(1,xs[1]-xs[0]),350/Math.max(1,ys[1]-ys[0]));
  return {...graph,fit:d3.zoomIdentity.translate(500,225).scale(scale).translate(-(xs[0]+xs[1])/2,-(ys[0]+ys[1])/2)};
 },[person,rows,actors]);
 useEffect(()=>{
  const svg=d3.select(svgRef.current),zoom=d3.zoom().extent([[0,0],[1000,480]]).scaleExtent([.15,4]).on('zoom',e=>d3.select(rootRef.current).attr('transform',e.transform));
  zoomRef.current=zoom;svg.call(zoom).on('dblclick.zoom',null);svg.call(zoom.transform,network.fit);return()=>svg.on('.zoom',null);
 },[network]);
 useEffect(()=>setActor(null),[rows]);
 const choose=n=>{if(n.row){setActor(null);onSelect(n.row.IDENTIFIER_ID);}else if(n.kind==='actor')setActor(n.label);};
 const zoomBy=k=>d3.select(svgRef.current).call(zoomRef.current.scaleBy,k);
 return <><div className="pid-chart-tools"><label><input type="checkbox" checked={actors} onChange={e=>setActors(e.target.checked)}/> Show capture and review actors</label><div><button onClick={()=>zoomBy(1.3)} aria-label="Zoom identifier graph in">+</button><button onClick={()=>zoomBy(1/1.3)} aria-label="Zoom identifier graph out">−</button><button onClick={()=>d3.select(svgRef.current).call(zoomRef.current.transform,network.fit)}>Fit graph</button></div></div>
  <div className="pid-network"><svg ref={svgRef} viewBox="0 0 1000 480" role="group" aria-label="Person identifier network. Select an identifier or actor; pan and zoom to explore."><g ref={rootRef}>
   {network.edges.map(e=><line key={e.id} x1={e.source.x} y1={e.source.y} x2={e.target.x} y2={e.target.y} className={'pid-edge '+e.kind}><title>{e.kind==='association'?'Register association':e.kind==='capture'?'Captured by':'Administrative review'}: {e.source.label} — {e.target.label}</title></line>)}
   {network.nodes.map(n=><g key={n.id} transform={`translate(${n.x},${n.y})`} role={n.kind==='person'?'img':'button'} tabIndex={n.kind==='person'?undefined:0} aria-label={`${n.label}${n.row?', '+identifierState(n.row):n.kind==='actor'?', capture or review actor':', selected person'}`} onClick={()=>choose(n)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(n);}}} className={'pid-node '+(n.row&&selectedId===n.row.IDENTIFIER_ID?'selected ':'')+(n.row&&matchedIds.has(n.row.IDENTIFIER_ID)?'matched ':'')+(n.row&&identifierState(n.row)==='Expired'?'expired':'')}>
    <circle r={n.kind==='person'?34:n.kind==='actor'?19:25} fill={n.kind==='person'?'#213c4c':n.kind==='actor'?'#e8edf1':TYPE_COLORS[n.kind]||'#647480'}/>
    <text textAnchor="middle" dy=".35em" fill={n.kind==='actor'?'#354c5b':'white'} fontSize={n.kind==='person'?12:11}>{n.kind==='person'?'POI':n.kind==='actor'?'A':n.kind.slice(0,1).toUpperCase()}</text>
    <text className="pid-node-label" textAnchor="middle" y={n.kind==='person'?52:n.kind==='actor'?36:42}>{short(n.label)}</text><title>{n.label}{n.row?' · '+pretty(n.row.REVIEW_STATUS)+' · '+identifierState(n.row):''}</title>
   </g>)}
  </g></svg></div>
  <div className="pid-legend">{Object.entries(TYPE_COLORS).map(([name,color])=><span key={name}><i style={{background:color}}/>{name}</span>)}<span>Dashed line: review · Dashed node: expired</span>{!!matchedIds.size&&<span className="pid-legend-match">Gold ring: matched in source material</span>}</div>
  {actor&&<p className="pid-actor-detail" role="status"><strong>{actor}</strong> · {rows.filter(r=>r.RECORDED_BY===actor).length} capture records · {rows.filter(r=>r.REVIEWED_BY===actor).length} administrative reviews</p>}
 </>;
}
function IdentifierTable({rows,selectedId,onSelect,zone,matchedIds}){
 return <div className="pid-table-wrap"><table className="pid-table"><caption>Identifiers for this profile. Select a value for the full record.</caption><thead><tr>{['Identifier','Type / platform','State','Captured by','Captured','Reviewed by','Valid to'].map(s=><th key={s} scope="col">{s}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.IDENTIFIER_ID} className={(selectedId===r.IDENTIFIER_ID?'selected ':'')+(matchedIds.has(r.IDENTIFIER_ID)?'matched':'')}><td><button onClick={()=>onSelect(r.IDENTIFIER_ID)}>{r.IDENTIFIER_VALUE}</button>{matchedIds.has(r.IDENTIFIER_ID)&&<small className="pid-match-tag">Matched in material</small>}</td><td>{r.IDENTIFIER_TYPE}<small>{r.NAMESPACE}</small></td><td><span className={'pid-status '+identifierState(r).toLowerCase().replaceAll(' ','-')}>{identifierState(r)}</span><small>{pretty(r.REVIEW_STATUS)}</small></td><td>{r.RECORDED_BY}</td><td>{dateText(r.CREATED_AT,zone)}</td><td>{r.REVIEWED_BY||'Awaiting review'}</td><td>{r.VALID_TO?dateText(r.VALID_TO,zone):'Open-ended'}</td></tr>)}</tbody></table></div>;
}
function TimeChart({rows,selectedId,onSelect,zone,matchedIds}){
 const [mode,setMode]=useState('validity');
 const domain=useMemo(()=>timeDomain(rows),[rows]);
 const scale=d3.scaleTime().domain(domain).range([225,955]);
 const ticks=scale.ticks(6),height=70+rows.length*47;
 const tickText=d=>new Intl.DateTimeFormat('en-AU',{timeZone:zone,day:'numeric',month:'short',year:'2-digit'}).format(d);
 return <><div className="pid-chart-tools"><div className="pid-segment"><button aria-pressed={mode==='validity'} onClick={()=>setMode('validity')}>Active periods</button><button aria-pressed={mode==='events'} onClick={()=>setMode('events')}>Capture &amp; review</button></div><span>Dates in {zone}</span></div>
  <div className="pid-time-scroll"><svg viewBox={`0 0 1000 ${height}`} style={{height}} role="group" aria-label={mode==='validity'?'Identifier validity Gantt chart':'Identifier capture and review timeline'}>
   {ticks.map(t=><g key={+t}><line x1={scale(t)} y1="27" x2={scale(t)} y2={height-10} stroke="#dce4e8"/><text x={scale(t)} y="17" textAnchor="middle" className="pid-tick">{tickText(t)}</text></g>)}
   {rows.map((r,i)=>{const y=52+i*47,from=scale(new Date(r.VALID_FROM||r.CREATED_AT)),to=r.VALID_TO?scale(new Date(r.VALID_TO)):955,capture=scale(new Date(r.CREATED_AT)),review=r.REVIEWED_AT?scale(new Date(r.REVIEWED_AT)):null;return <g key={r.IDENTIFIER_ID} role="button" tabIndex={0} aria-label={`${r.IDENTIFIER_VALUE}, captured ${dateText(r.CREATED_AT,zone)}, ${r.VALID_TO?'valid to '+dateText(r.VALID_TO,zone):'open-ended'}`} onClick={()=>onSelect(r.IDENTIFIER_ID)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(r.IDENTIFIER_ID);}}} className="pid-time-row">
    <rect x="0" y={y-18} width="990" height="40" rx="5" fill={selectedId===r.IDENTIFIER_ID?'#e5f3f0':i%2?'#f6f9fa':'#fff'} stroke={matchedIds.has(r.IDENTIFIER_ID)?'#c48a16':'none'} strokeWidth="2"/>
    <text x="10" y={y-1} className="pid-time-name">{matchedIds.has(r.IDENTIFIER_ID)?'★ ':''}{short(r.IDENTIFIER_VALUE,matchedIds.has(r.IDENTIFIER_ID)?25:27)}</text><text x="10" y={y+13} className="pid-tick">{identifierState(r)} · {r.RECORDED_BY}</text>
    {mode==='validity'&&<><rect x={from} y={y-6} width={Math.max(3,to-from)} height="13" rx="5" fill={TYPE_COLORS[r.IDENTIFIER_TYPE]} opacity={r.REVIEW_STATUS==='proposed'?.3:.65} stroke={r.REVIEW_STATUS==='proposed'?TYPE_COLORS[r.IDENTIFIER_TYPE]:'none'} strokeDasharray={r.REVIEW_STATUS==='proposed'?'4 3':undefined}/>{!r.VALID_TO&&<path d={`M948,${y-9} L960,${y+.5} L948,${y+10}`} fill={TYPE_COLORS[r.IDENTIFIER_TYPE]}/>}</>}
    {mode==='events'&&review!==null&&<line x1={capture} x2={review} y1={y} y2={y} stroke="#8495a0" strokeWidth="2"/>}
    <circle cx={capture} cy={y} r="5" fill="#213c4c" stroke="white" strokeWidth="1.5"/>
    {review!==null&&<path d={`M${review},${y-6} l6,6 l-6,6 l-6,-6 z`} fill="#b57835" stroke="white" strokeWidth="1"/>}
    <title>{r.IDENTIFIER_VALUE}\nCaptured: {dateText(r.CREATED_AT,zone)}\nReviewed: {dateText(r.REVIEWED_AT,zone)}\nValid from: {dateText(r.VALID_FROM,zone)}\nValid to: {r.VALID_TO?dateText(r.VALID_TO,zone):'Open-ended'}</title>
   </g>;})}
  </svg></div><div className="pid-legend">{!!matchedIds.size&&<span className="pid-legend-match">★ Gold outline: matched in source material</span>}<span>● Capture</span><span style={{color:'#9a6229'}}>◆ Administrative review</span>{mode==='validity'&&<span>Bars show validity; arrows mark open intervals at the chart boundary.</span>}</div>
 </>;
}
export default function PoiIdentifierDialog({personRef,user,onClose,portrait,match}){
 const dialog=useRef(),closeRef=useRef(),profile=useActiveProfile();
 const [data,setData]=useState(null),[detail,setDetail]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[view,setView]=useState('Time'),[query,setQuery]=useState(''),[type,setType]=useState('all'),[state,setState]=useState('all'),[selectedId,setSelectedId]=useState('');
 const zone=profile.timeZone||'UTC';
 useEffect(()=>{const node=dialog.current,trigger=document.activeElement,overflow=document.body.style.overflow;node.showModal();document.body.style.overflow='hidden';closeRef.current?.focus();return()=>{node.close();document.body.style.overflow=overflow;if(trigger?.isConnected)trigger.focus();};},[]);
 useEffect(()=>{
  const controller=new AbortController();setData(null);setError('');setSelectedId('');
  fetch('/api/persons/'+encodeURIComponent(personRef)+'/identifiers',{headers:{'X-Demo-User':user},signal:controller.signal}).then(async r=>{const value=await r.json();if(!r.ok)throw Error(value.error||'Unable to load the person record.');if(profile.profileCode&&value.profileCode!==profile.profileCode)throw Error('The active dataset changed. Close this record and open it again.');return value;}).then(value=>{if(controller.signal.aborted)return;setData(value);const first=matchedRows(value.identifiers,match)[0];if(first)setSelectedId(first.IDENTIFIER_ID);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return()=>controller.abort();
 },[personRef,user,profile.profileCode,attempt]);
 useEffect(()=>{
  const controller=new AbortController();setDetail(null);
  fetch('/api/persons/'+encodeURIComponent(personRef),{headers:{'X-Demo-User':user},signal:controller.signal}).then(async r=>{const value=await r.json();if(!r.ok)throw Error(value.error||'Incident links and visual assets are unavailable.');return value;}).then(value=>{if(!controller.signal.aborted)setDetail(value);}).catch(e=>{if(!controller.signal.aborted)setDetail({error:e.message});});
  return()=>controller.abort();
 },[personRef,user,attempt]);
 const visible=useMemo(()=>filterIdentifiers(data?.identifiers||[],{query,type,state}),[data,query,type,state]);
 const matchedIds=useMemo(()=>new Set(matchedRows(data?.identifiers||[],match).map(r=>r.IDENTIFIER_ID)),[data,match]);
 const selected=visible.find(r=>r.IDENTIFIER_ID===selectedId);
 const person=data?.person;
 return createPortal(<dialog ref={dialog} className="poi-identifier-dialog" aria-labelledby="pid-title" onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <header className="pid-header"><div><small>PERSON INTELLIGENCE · REGISTER DETAIL</small><h2 id="pid-title">{person?.DISPLAY_NAME||'Person record'}</h2><span>{personRef}</span></div><button ref={closeRef} type="button" onClick={onClose} aria-label="Close person record">×</button></header>
  {error?<div className="pid-empty" role="alert"><p>{error}</p><button onClick={()=>setAttempt(x=>x+1)}>Try again</button></div>:!data?<p className="pid-empty" role="status">Loading person and identifier records…</p>:<>
   {match&&<MatchBanner match={match}/>}<section className="pid-profile" aria-label="Basic person record"><div className="pid-profile-heading">{portrait}<div><small>{pretty(person.PERSON_STATUS)}</small><h3>{person.DISPLAY_NAME}</h3><p>Primary alias: <strong>{person.ALIAS_NAME||'Not recorded'}</strong></p></div><div className="pid-count"><strong>{data.identifiers.length}</strong><span>identifiers</span></div></div><p className="pid-summary">{person.NARRATIVE_SUMMARY}</p>
    <dl className="pid-basics">{[['Reference',person.PERSON_REF],['Registered',dateText(person.CREATED_AT,zone)],['Linked incidents in your scope',person.SCOPED_INCIDENT_COUNT],['Dataset',data.profileCode]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value??'Not recorded'}</dd></div>)}</dl>
    <details className="pid-full-record"><summary>Full person record</summary><p className="pid-narrative">{person.NARRATIVE_TEXT||'No detailed narrative recorded.'}</p>{person.PROFILE_ATTRIBUTES&&<details><summary>Profile attributes</summary><pre>{JSON.stringify(person.PROFILE_ATTRIBUTES,null,2)}</pre></details>}<RecordLinks detail={detail} zone={zone}/></details>
   </section>
   <div className="pid-tabs" role="tablist" aria-label="Identifier views">{['Time','Table','Graph'].map((label,i)=><button key={label} id={'pid-tab-'+label} role="tab" aria-selected={view===label} aria-controls="pid-panel" tabIndex={view===label?0:-1} onClick={()=>setView(label)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;const value=['Time','Table','Graph'][next];setView(value);document.getElementById('pid-tab-'+value)?.focus();}}}><span aria-hidden="true">{['◷','▤','⌘'][i]}</span>{label}</button>)}</div>
   <div className="pid-filters"><label>Find identifiers<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Value, actor or source…"/></label><label>Type<select aria-label="Identifier type" value={type} onChange={e=>setType(e.target.value)}><option value="all">All types</option>{Object.keys(TYPE_COLORS).map(t=><option key={t}>{t}</option>)}</select></label><label>State<select aria-label="Identifier state" value={state} onChange={e=>setState(e.target.value)}>{['all','Current','Expired','Proposed','Rejected','Not yet valid'].map(t=><option key={t} value={t}>{t==='all'?'All states':t}</option>)}</select></label><span role="status">{visible.length} of {data.identifiers.length}</span></div>
   {data.truncated&&<p className="pid-hint">This profile has more than 1,000 identifiers. The first 1,000 are shown.</p>}
   <section id="pid-panel" role="tabpanel" aria-labelledby={'pid-tab-'+view} className="pid-panel">{!visible.length?<p className="pid-empty">{data.identifiers.length?'No identifiers match these filters.':'No identifiers recorded for this profile.'}</p>:<>{view==='Graph'?<Network person={person} rows={visible} selectedId={selectedId} onSelect={setSelectedId} matchedIds={matchedIds}/>:view==='Table'?<IdentifierTable rows={visible} zone={zone} selectedId={selectedId} onSelect={setSelectedId} matchedIds={matchedIds}/>:<TimeChart rows={visible} zone={zone} selectedId={selectedId} onSelect={setSelectedId} matchedIds={matchedIds}/>}<RecordDetail row={selected} zone={zone}/></>}</section>
   <footer className="pid-footer">Current and expired are validity states; administrative review does not confirm identity or account ownership. Dates use {zone}.</footer>
  </>}
 </dialog>,document.body);
}
