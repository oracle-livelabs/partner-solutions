import React,{useEffect,useRef,useState} from 'react';
import {CircleMarker,MapContainer,TileLayer,Tooltip,useMap} from 'react-leaflet';
import {attributes,boundsFromContext,formatProfileTime,physicalCoordinates,SYNTHETIC_NOTICE} from './profile-presentation.mjs';
import './profile-review.css';
import ClusteredProfileMap from './ClusteredProfileMap';
export function ProfileMapExtent({context,records,scope=''}) {
  const map=useMap(),bounds=boundsFromContext(context,records),key=JSON.stringify(bounds);
  // MapContainer owns teardown; a child cleanup can run after its map pane is removed.
  useEffect(()=>{if(bounds)map.fitBounds(bounds,{padding:[16,16],maxZoom:15,animate:false});},[map,key,scope]);
  return null;
}
const emptyFilters={q:'',group:'',category:'',area:'',status:'',role:'',from:'',to:''};
export default function SavedProfileReview({user,profileCode,activeProfileCode,onClose}) {
  const [filters,setFilters]=useState(emptyFilters),[applied,setApplied]=useState(emptyFilters),[data,setData]=useState(null),[selected,setSelected]=useState(''),[detail,setDetail]=useState(null),[error,setError]=useState(''),[detailError,setDetailError]=useState(''),[loading,setLoading]=useState(true);
  const [view,setView]=useState(''),[pageLoading,setPageLoading]=useState(false),[pageError,setPageError]=useState('');
  const pageRequest=useRef(null);
  const endpoint='/api/setup/profiles/'+encodeURIComponent(profileCode);
  useEffect(()=>{
    const controller=new AbortController();pageRequest.current?.abort();setPageLoading(false);setPageError('');setLoading(true);setError('');setData(null);setDetail(null);setSelected('');
    const params=new URLSearchParams(Object.entries({...applied,...(view?{view}:{})}).filter(([,v])=>v));
    fetch(endpoint+'/review?'+params,{headers:{'X-Demo-User':user},signal:controller.signal}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Review unavailable');return x;}).then(x=>{if(!controller.signal.aborted){setData(x);setSelected(x.records[0]?.INCIDENT_REF||'');}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>{controller.abort();pageRequest.current?.abort();};
  },[profileCode,user,applied,view]);
  async function changePage(offset){
    pageRequest.current?.abort();const controller=new AbortController();pageRequest.current=controller;setPageLoading(true);setPageError('');
    const params=new URLSearchParams(Object.entries({...applied,offset:String(offset),limit:String(data.pagination.limit)}).filter(([,v])=>v!==''));
    try{const r=await fetch(endpoint+'/review/records?'+params,{headers:{'X-Demo-User':user},signal:controller.signal});const x=await r.json();if(!r.ok)throw Error(x.error||'Page unavailable');if(!controller.signal.aborted){setData(prior=>({...prior,records:x.records,pagination:x.pagination,summary:x.summary}));setSelected(x.records[0]?.INCIDENT_REF||'');}}
    catch(e){if(!controller.signal.aborted)setPageError(e.message);}finally{if(!controller.signal.aborted)setPageLoading(false);}
  }
  useEffect(()=>{
    setDetail(null);setDetailError('');if(!selected)return;
    const controller=new AbortController();fetch(endpoint+'/incidents/'+encodeURIComponent(selected),{headers:{'X-Demo-User':user},signal:controller.signal}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Detail unavailable');return x;}).then(x=>{if(!controller.signal.aborted)setDetail(x);}).catch(e=>{if(!controller.signal.aborted)setDetailError(e.message);});return()=>controller.abort();
  },[selected,profileCode,user]);
  const groups=[...new Map((data?.categories||[]).map(c=>[c.EXECUTIVE_GROUP_CODE,{code:c.EXECUTIVE_GROUP_CODE,label:c.EXECUTIVE_GROUP_LABEL,color:c.DISPLAY_COLOR}])).values()];
  const update=(k,value)=>setFilters(f=>({...f,[k]:value,...(k==='group'?{category:''}:{})}));
  const record=detail?.incident,a=attributes(record),coordinates=record?physicalCoordinates(record):null;
  const markers=data?.markers.filter(m=>physicalCoordinates(m))||[];
  const context=data?.context||{},summary=data?.summary||{};
  const mapContext=applied.role==='locality_reference'?context:applied.area||applied.q||applied.group||applied.category?{}:context;
  return <section className="saved-profile-review" aria-label="Saved profile review">
    <header><div><small>READ-ONLY SAVED PROFILE · NO ACTIVATION</small><h2>{context.profileName||profileCode}</h2><p>Reviewing {profileCode}. Active operational profile remains {activeProfileCode||'unchanged'}.</p></div><button type="button" onClick={onClose}>Close saved review</button></header>
    <p className="saved-profile-review__notice">{SYNTHETIC_NOTICE}</p>
    <form className="saved-profile-review__filters" onSubmit={e=>{e.preventDefault();setApplied({...filters});}}>
      <label>Search titles, full reports or references<input aria-label="Saved report search" value={filters.q} onChange={e=>update('q',e.target.value)} maxLength={200}/></label>
      <label>Executive group<select aria-label="Saved executive group" value={filters.group} onChange={e=>update('group',e.target.value)}><option value="">All executive groups</option>{groups.map(g=><option key={g.code} value={g.code}>{g.label}</option>)}</select></label>
      <label>Detailed category<select aria-label="Saved detailed category" value={filters.category} onChange={e=>update('category',e.target.value)}><option value="">All detailed categories</option>{data?.categories.filter(c=>!filters.group||c.EXECUTIVE_GROUP_CODE===filters.group).map(c=><option key={c.CATEGORY_CODE} value={c.CATEGORY_CODE}>{c.CATEGORY_NAME}</option>)}</select></label>
      <label>{context.areaLabel||'District / source area'}<select aria-label="Saved district" value={filters.area} onChange={e=>update('area',e.target.value)}><option value="">Whole profile</option>{data?.areas.map(a=><option key={a.AREA_NAME} value={a.AREA_NAME}>{a.AREA_NAME} ({a.AREA_TYPE||'source locality'})</option>)}</select></label>
      <label>Location role<select aria-label="Saved location role" value={filters.role} onChange={e=>update('role',e.target.value)}><option value="">All records</option><option value="physical_context">Physical-context marker</option><option value="locality_reference">Online / reference only</option></select></label>
      <label>Status<select aria-label="Saved status" value={filters.status} onChange={e=>update('status',e.target.value)}><option value="">All statuses</option>{data?.statuses.map(s=><option key={s.INCIDENT_STATUS}>{s.INCIDENT_STATUS}</option>)}</select></label>
      <label>From local date<input aria-label="Saved from date" type="date" value={filters.from} onChange={e=>update('from',e.target.value)}/></label>
      <label>To local date<input aria-label="Saved to date" type="date" value={filters.to} onChange={e=>update('to',e.target.value)}/></label>
      <button type="submit" disabled={loading}>Apply saved filters</button><button type="button" onClick={()=>{setFilters(emptyFilters);setApplied({...emptyFilters});}}>Clear saved filters</button>
    </form>
    {error&&<p role="alert">{error}</p>}{loading&&<p role="status">Reading saved profile…</p>}
    {data&&<><p className="saved-profile-review__stats" data-testid="saved-summary">{Number(summary.TOTAL_COUNT||0).toLocaleString('en-GB')} matching incidents · {Number(summary.PHYSICAL_COUNT||0).toLocaleString('en-GB')} physical points · {Number(summary.REFERENCE_COUNT||0).toLocaleString('en-GB')} reference-only records · {summary.LOCAL_DATES} local dates ({context.timeZone})</p>
      {!context.savedReview?.required&&<button type="button" onClick={()=>setView(data.viewMode==='clustered'?'legacy':'clustered')}>{data.viewMode==='clustered'?'Use classic saved review':'Use clustered map and pages'}</button>}
      {!context.timeZoneConfigured&&<p role="status">This legacy profile has no stored time-zone configuration. UTC is shown explicitly; it is not an inferred local time.</p>}
      <div className="saved-profile-review__columns"><section>{data.viewMode==='clustered'?<ClusteredProfileMap endpoint={endpoint} user={user} applied={applied} context={context} summary={summary} initialMap={data.map} selected={selected} onSelect={setSelected}/>:<><div className="saved-profile-review__map" data-testid="saved-map" data-marker-count={markers.length}>
        <MapContainer center={[0,0]} zoom={2} minZoom={2} preferCanvas scrollWheelZoom zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false}>
          <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution="Tiles © Esri"/>
          <ProfileMapExtent context={mapContext} records={markers} scope={profileCode}/>
          {markers.map(m=><CircleMarker key={m.INCIDENT_REF} center={physicalCoordinates(m)} radius={m.INCIDENT_REF===selected?6:2} pathOptions={{color:m.DISPLAY_COLOR||'#437c94',weight:1,fillOpacity:.7}} eventHandlers={{click:()=>setSelected(m.INCIDENT_REF)}}><Tooltip>{m.INCIDENT_REF} · {m.DISTRICT_AREA}</Tooltip></CircleMarker>)}
        </MapContainer></div>
        <p>Approximate fictional area markers, not actual event sites or measured crime hotspots. Online/reference-only records have no physical marker. {data.markersTruncated?`Showing ${markers.length} of ${summary.PHYSICAL_COUNT} physical markers; narrow the filters.`:'All matching physical markers are shown.'}</p></>}
        <div className="saved-profile-review__legend">{groups.map(g=><span key={g.code}><i style={{background:g.color}}/>{g.label}</span>)}</div>
        <div className="saved-profile-review__results" aria-label="Saved incident results">{data.records.map(r=><button key={r.INCIDENT_REF} type="button" className={r.INCIDENT_REF===selected?'selected':''} onClick={()=>setSelected(r.INCIDENT_REF)}><b>{r.INCIDENT_REF}</b><span>{r.REPORT_SUMMARY}</span><small>{r.DISTRICT_AREA} · {formatProfileTime(r.OCCURRED_AT,context)}</small></button>)}</div>
        {data.pagination?<nav className="saved-profile-review__pagination" aria-label="Saved result pages"><button type="button" disabled={pageLoading||!data.pagination.hasPrevious} onClick={()=>changePage(data.pagination.previousOffset)}>Previous records</button><span data-testid="saved-page-range">{data.pagination.start.toLocaleString('en-GB')}–{data.pagination.end.toLocaleString('en-GB')} of {data.pagination.total.toLocaleString('en-GB')}</span><button type="button" disabled={pageLoading||!data.pagination.hasNext} onClick={()=>changePage(data.pagination.nextOffset)}>Next records</button><button type="button" disabled={pageLoading||!data.pagination.hasNext} onClick={()=>changePage(Math.floor((data.pagination.total-1)/data.pagination.limit)*data.pagination.limit)}>Last page</button></nav>:data.recordsTruncated&&<p>First {data.recordLimit} matching records listed; search or narrow the filters to reach others. All matching physical markers remain independently available up to the stated map limit.</p>}
        {pageLoading&&<p role="status">Reading the next saved page…</p>}{pageError&&<p role="alert">{pageError}</p>}
      </section><section className="saved-profile-review__detail" aria-label="Saved incident detail">{detailError&&<p role="alert">{detailError}</p>}{selected&&!record&&!detailError&&<p>Loading linked report…</p>}{!selected&&<p>No incident matches these filters.</p>}{record&&<>
        <small>{record.INCIDENT_REF} · {record.CATEGORY_NAME} / {record.DETAILED_CATEGORY_NAME}</small><h3>{record.REPORT_SUMMARY}</h3>
        <dl><dt>Occurred locally</dt><dd data-testid="saved-occurred">{formatProfileTime(record.OCCURRED_AT,context)}</dd><dt>Stored offset / UTC</dt><dd>{record.OCCURRED_AT} / {new Date(record.OCCURRED_AT).toISOString()}</dd>
          <dt>Local authority / municipality</dt><dd>{a.local_authority_name_en||a.municipality_name_en||a.municipality_name_nl||context.cityLabel}</dd><dt>Administrative area / source type</dt><dd>{a.administrative_area_name||a.district_area_name_nl||'Not recorded'} / {a.area_type||'Not recorded'}</dd><dt>Source place / neighbourhood context</dt><dd>{a.electoral_division_name||a.wijk_name_nl||'Not recorded'} / {a.neighbourhood_context_name||a.buurt_name_nl||record.SUBURB}</dd><dt>Setting / status</dt><dd>{record.LOCATION_TYPE} / {record.INCIDENT_STATUS}</dd><dt>Location</dt><dd data-testid="saved-location">{coordinates?`Approximate latitude ${coordinates[0]}, longitude ${coordinates[1]}`:'Reference-only; no physical coordinates or map marker'}</dd><dt>Police unit</dt><dd>{a.police_unit_code||'Unassigned; no independently verified attribution'}</dd></dl>
        <p className="saved-profile-review__narrative" data-testid="saved-narrative">{record.REPORT_TEXT}</p>
        <h4>Evidence references</h4>{detail.evidence.length?detail.evidence.map(e=>{const meta=typeof e.EVIDENCE_METADATA==='string'?JSON.parse(e.EVIDENCE_METADATA):e.EVIDENCE_METADATA||{};return <p key={e.EVIDENCE_ID}>{e.EVIDENCE_TYPE}: {meta.evidence_summary||'Reference metadata only'} ({meta.evidence_status||'recorded reference'}; {meta.media_artifact_exists?'artifact recorded':'no media artifact'})</p>;}):<p>No evidence items linked.</p>}
        <details><summary>Stored source hierarchy and synthetic provenance</summary><pre>{JSON.stringify(a,null,2)}</pre></details>
      </>}</section></div>
      <p className="saved-profile-review__capabilities">Saved narrative embeddings: {data.capabilities.EMBEDDINGS}. Saved graph cases: {data.capabilities.CASES}. This read-only review performs no embedding, AI or graph-generation calls. Original source-profile readiness declaration: {context.activationReady?'ready':'pending'}. Current restore availability is shown in Data Foundation; this review never activates a dataset.</p>
    </>}
  </section>;
}
