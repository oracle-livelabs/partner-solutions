import React,{useEffect,useRef,useState} from 'react';
import {CircleMarker,MapContainer,TileLayer,Tooltip,useMap,useMapEvents} from 'react-leaflet';
import {boundsFromContext,physicalCoordinates} from './profile-presentation.mjs';

export function viewportQuery(bounds,zoom) {
  const width=bounds.getEast()-bounds.getWest();
  const wrap=x=>((x+180)%360+360)%360-180;
  const west=width>=360?-180:wrap(bounds.getWest()),east=width>=360?180:wrap(bounds.getEast());
  const south=Math.max(-90,bounds.getSouth()),north=Math.min(90,bounds.getNorth());
  return {bbox:[west,south,east,north].map(n=>Number(n.toFixed(7))).join(','),zoom:String(Math.max(2,Math.min(19,Math.floor(zoom))))};
}
function Viewport({onChange}) {
  const timer=useRef();
  const map=useMapEvents({moveend:()=>schedule()});
  function schedule(){clearTimeout(timer.current);timer.current=setTimeout(()=>onChange(viewportQuery(map.getBounds(),map.getZoom())),150);}
  useEffect(()=>{schedule();return()=>clearTimeout(timer.current);},[map,onChange]);
  return null;
}
function Cluster({row,gridDegrees}) {
  const map=useMap(),count=Number(row.RECORD_COUNT);
  const expand=()=>{
    const z=Math.min(19,map.getZoom()+3);
    if(row.SOUTH===row.NORTH&&row.WEST===row.EAST)map.setView([row.LATITUDE,row.LONGITUDE],z);
    else map.fitBounds([[row.SOUTH,row.WEST],[row.NORTH,row.EAST]],{padding:[30,30],maxZoom:z});
  };
  return <CircleMarker center={[row.LATITUDE,row.LONGITUDE]} radius={Math.min(25,10+Math.log2(count+1)*1.4)} pathOptions={{color:'#345e76',fillColor:'#dfebf2',fillOpacity:.92,weight:2}} eventHandlers={{click:expand}}>
    <Tooltip permanent direction="center" className="saved-profile-cluster-count" opacity={1}><span title={`${count} incidents in a ${gridDegrees.toPrecision(3)}° presentation cell; click the circle to zoom. Aggregate, not an event site.`}>{count.toLocaleString('en-GB')}</span></Tooltip>
  </CircleMarker>;
}
export default function ClusteredProfileMap({endpoint,user,applied,context,summary,initialMap,selected,onSelect}) {
  const [viewport,setViewport]=useState(null),[data,setData]=useState(initialMap),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const extent=summary.PHYSICAL_COUNT>0&&[summary.WEST,summary.SOUTH,summary.EAST,summary.NORTH].every(Number.isFinite)?[[summary.SOUTH-.002,summary.WEST-.002],[summary.NORTH+.002,summary.EAST+.002]]:boundsFromContext(context);
  // Initial extent is immutable for this mounted filter/profile scope. Paging
  // the record list must not reset the viewport or trigger map refits.
  const initialExtent=useRef(extent);
  useEffect(()=>{
    if(!viewport)return;
    const controller=new AbortController();setLoading(true);setError('');
    const params=new URLSearchParams(Object.entries({...applied,...viewport}).filter(([,v])=>v!==''));
    fetch(endpoint+'/review/map?'+params,{headers:{'X-Demo-User':user},signal:controller.signal}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Map unavailable');return x;}).then(x=>{if(!controller.signal.aborted)setData(x.map);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[endpoint,user,applied,viewport]);
  const markers=(data?.markers||[]).filter(m=>physicalCoordinates(m)),clusters=data?.clusters||[];
  return <>
    <div className="saved-profile-review__map" data-testid="saved-map" data-marker-count={markers.length} data-cluster-count={clusters.length} data-represented-count={data?.representedCount||0} aria-busy={loading}>
      <MapContainer {...(initialExtent.current?{bounds:initialExtent.current,boundsOptions:{padding:[16,16],maxZoom:15}}:{center:[0,0],zoom:2})} minZoom={2} maxZoom={19} preferCanvas scrollWheelZoom zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false}>
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution="Tiles © Esri"/>
        <Viewport onChange={setViewport}/>
        {clusters.map(c=><Cluster key={data.gridDegrees+':'+c.GRID_X+':'+c.GRID_Y} row={c} gridDegrees={data.gridDegrees}/>)}
        {markers.map(m=><CircleMarker key={m.INCIDENT_REF} center={physicalCoordinates(m)} radius={m.INCIDENT_REF===selected?6:3} pathOptions={{color:m.DISPLAY_COLOR||'#437c94',weight:1,fillOpacity:.75}} eventHandlers={{click:()=>onSelect(m.INCIDENT_REF)}}><Tooltip>{m.INCIDENT_REF} · {m.DISTRICT_AREA}</Tooltip></CircleMarker>)}
      </MapContainer>
    </div>
    {loading&&<p role="status">Updating the viewport map…</p>}{error&&<p role="alert">{error} The displayed map is from the last successful request.</p>}
    <p data-testid="saved-map-counts">{Number(data?.representedCount||0).toLocaleString('en-GB')} incidents represented by {data?.mode==='markers'?`${markers.length.toLocaleString('en-GB')} individual markers`:`${clusters.length.toLocaleString('en-GB')} clusters`} in the last loaded viewport; {Number(data?.matchedPhysical||0).toLocaleString('en-GB')} physical incidents match all filters. Counts are exact; no point sampling. Raw markers are capped at {data?.rawMarkerLimit||5000}.</p>
    <p>Cluster positions summarize groups, not actual event sites or measured crime hotspots. Click a cluster to zoom; zoom or filter further for original approximate markers. Online/reference-only records have no physical marker.</p>
  </>;
}
