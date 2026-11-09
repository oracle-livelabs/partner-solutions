import React,{useEffect,useMemo,useState} from 'react';
import {CircleMarker,MapContainer,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet';
import {geoAnchor} from './travel-anchors';
import './travel-source-map.css';
const palette=['#227b96','#b05c28','#7f57a5','#258060','#ba4766','#8f751f'];
function Frame({points,version}){
 const map=useMap();
 useEffect(()=>{map.invalidateSize();if(points.length)map.fitBounds(points.map(p=>p.position),{padding:[55,55],maxZoom:14,animate:false});},[map,version]);
 useEffect(()=>{const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(map.getContainer());return()=>observer.disconnect();},[map]);
 return null;
}
export default function TravelSourceMap({records,locations,people,onSelect}){
 const [tileError,setTileError]=useState(false),[fitVersion,setFitVersion]=useState(0);
 const points=useMemo(()=>locations.flatMap(l=>{const fallback=geoAnchor(l.name),position=l.geo?[l.geo.latitude,l.geo.longitude]:fallback;return position?[{...l,position}]:[];}),[locations]);
 const byName=new Map(points.map(p=>[p.name,p])),mapped=records.filter(r=>byName.has(r.origin)&&byName.has(r.destination));
 const pointVersion=JSON.stringify(points.map(p=>p.position))+fitVersion;
 return <section className="cdr-source-map" aria-label="Travel geographic map">
  <div className="cdr-source-map-heading"><div><strong>Recorded journeys · local map</strong><p>{mapped.length} of {records.length} journeys mapped · {points.length} of {locations.length} locations</p></div><button onClick={()=>setFitVersion(v=>v+1)} disabled={!points.length}>Fit journeys</button></div>
  <p className="cdr-small">Locations use explicitly labelled coarse synthetic teaching anchors from the batch. Lines connect recorded endpoints; they do not show the route taken.</p>
  <div className="cdr-source-map-legend">{people.filter(p=>records.some(r=>r.person===p)).map(p=><span key={p}><i style={{background:palette[people.indexOf(p)%palette.length]}}/>{p}</span>)}</div>
  {tileError&&<p role="status" className="cdr-world-warning">Background map tiles could not load. Journey lines and teaching locations remain available; check your network connection.</p>}
  <MapContainer center={points[0]?.position||[20,0]} zoom={12} scrollWheelZoom={false} className="cdr-source-leaflet" aria-label="Recorded travel teaching locations">
   <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution="Tiles © Esri" eventHandlers={{tileerror:()=>setTileError(true)}}/>
   <Frame points={points} version={pointVersion}/>
   {mapped.map(r=><Polyline key={r.id} positions={[byName.get(r.origin).position,byName.get(r.destination).position]} pathOptions={{color:palette[Math.max(0,people.indexOf(r.person))%palette.length],weight:4,opacity:.7}} eventHandlers={{click:()=>onSelect(r)}}><Tooltip sticky>{r.person}: {r.origin} → {r.destination}</Tooltip></Polyline>)}
   {points.map(p=><CircleMarker key={p.id} center={p.position} radius={7} pathOptions={{color:'#294653',fillColor:'#fff',fillOpacity:1}}><Tooltip permanent direction="top" className="cdr-source-map-label">{p.name.replace(/^.*? - /,'').replace(/ - fictional.*$/,'')}</Tooltip></CircleMarker>)}
  </MapContainer>
  {mapped.length<records.length&&<p role="status">{records.length-mapped.length} journeys have an unmapped endpoint. They remain available in the schematic view.</p>}
  {!records.length&&<p role="status">No journeys match the current filters.</p>}
  <details><summary>Location sources and journey records</summary>{points.map(p=><p key={p.id}><strong>{p.name}</strong> · {p.geo?`${p.geo.source.path} · ${p.geo.source.featureId} · ${p.geo.precision}`:'Approximate city-centre teaching anchor'}</p>)}{mapped.map(r=><button key={r.id} type="button" onClick={()=>onSelect(r)}>{r.person}: {r.origin} → {r.destination} · record {r.source.record}</button>)}</details>
 </section>;
}
