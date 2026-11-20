import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {geoNaturalEarth1,geoPath,geoGraticule10,select,zoom,zoomIdentity} from 'd3';
import world from './data/world-countries.json';
import {geoAnchor} from './travel-anchors';
import './travel-world-map.css';

const WIDTH=1100,HEIGHT=570;
const projection=geoNaturalEarth1().fitExtent([[25,20],[WIDTH-25,HEIGHT-25]],{type:'Sphere'});
const path=geoPath(projection);
const countries=world.features.map(f=>({id:f.id,name:f.properties.name,d:path(f)}));
const palette=['#227b96','#b05c28','#7f57a5','#258060','#ba4766','#8f751f'];
const colour=(name,people)=>palette[Math.max(0,people.indexOf(name))%palette.length];
const timestamp=value=>value?.raw?.replace('T',' ')||'Time not recorded';
const recordKey=r=>r.source.itemId+':'+r.source.record;

export default function TravelWorldMap({records,locations,people,onSelect}){
 const svg=useRef(),behaviour=useRef(),[transform,setTransform]=useState(zoomIdentity);
 const [hover,setHover]=useState(null),[selectedKey,setSelectedKey]=useState(''),[labels,setLabels]=useState(true);
 const marker=useId().replace(/:/g,'');
 const points=useMemo(()=>locations.map(l=>({...l,geo:geoAnchor(l.name)})).filter(l=>l.geo).map(l=>({...l,point:projection([l.geo[1],l.geo[0]]),label:l.name.split(/,| - /)[0].replace(/ International Airport| Airport| Suvarnabhumi| Changi| Menara| Charles de Gaulle| El Prat| Haneda| Schiphol| Fiumicino/g,'')})),[locations]);
 const byName=new Map(points.map(p=>[p.name,p]));
 const groups=useMemo(()=>{
  const map=new Map();
  for(const r of records){const key=JSON.stringify([r.person,r.origin,r.destination]);if(!map.has(key))map.set(key,{key,person:r.person,origin:r.origin,destination:r.destination,records:[]});map.get(key).records.push(r);}
  return [...map.values()];
 },[records]);
 const selected=groups.find(g=>g.key===selectedKey);
 const preview=hover||selected;
 const mapped=records.filter(r=>byName.has(r.origin)&&byName.has(r.destination)).length;
 useEffect(()=>{
  const canvas=select(svg.current);
  behaviour.current=zoom().extent([[0,0],[WIDTH,HEIGHT]]).scaleExtent([1,24])
   .translateExtent([[-WIDTH,-HEIGHT],[WIDTH*2,HEIGHT*2]])
   .on('zoom',e=>{setTransform(e.transform);setHover(null);});
  canvas.call(behaviour.current);
  return()=>{canvas.on('.zoom',null);behaviour.current=null;};
 },[]);
 function changeZoom(factor){select(svg.current).call(behaviour.current.scaleBy,factor);}
 function reset(){select(svg.current).call(behaviour.current.transform,zoomIdentity);}
 function fit(){
  if(!points.length)return;
  const xs=points.map(p=>p.point[0]),ys=points.map(p=>p.point[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const k=Math.min(24,Math.max(1,Math.min((WIDTH-200)/Math.max(30,maxX-minX),(HEIGHT-150)/Math.max(30,maxY-minY))));
  select(svg.current).call(behaviour.current.transform,zoomIdentity.translate(WIDTH/2-k*(minX+maxX)/2,HEIGHT/2-k*(minY+maxY)/2).scale(k));
 }
 function choose(group){setSelectedKey(group.key);setHover(null);onSelect(group.records[0]);}
 const positioned=points.map(p=>({...p,screen:transform.apply(p.point)}));
 const occupied=[];
 const visibleLabels=positioned.flatMap(p=>{
  const [x,y]=p.screen,w=p.label.length*6.6+10;
  if(x<10||x>WIDTH-10||y<10||y>HEIGHT-10)return [];
  const candidates=[[x+11,y-8],[x-w-11,y-8],[x-w/2,y-28],[x-w/2,y+16]];
  const box=candidates.map(([bx,by])=>({x:bx,y:by,w,h:17})).find(b=>b.x>4&&b.x+b.w<WIDTH-4&&b.y>4&&b.y+b.h<HEIGHT-4&&!occupied.some(o=>b.x<o.x+o.w+5&&b.x+b.w+5>o.x&&b.y<o.y+o.h+4&&b.y+b.h+4>o.y)&&!positioned.some(o=>o.id!==p.id&&o.screen[0]>b.x-7&&o.screen[0]<b.x+b.w+7&&o.screen[1]>b.y-7&&o.screen[1]<b.y+b.h+7));
  if(!box)return [];occupied.push(box);return [{...p,box}];
 });
 return <section className="cdr-world" aria-label="Travel world map">
  <div className="cdr-world-toolbar"><div><strong>World journeys</strong><span>{mapped} of {records.length} journeys mapped · {points.length} of {locations.length} locations</span></div><div className="cdr-world-controls">
   <button onClick={()=>changeZoom(1.5)} aria-label="Zoom in world map">+</button><button onClick={()=>changeZoom(1/1.5)} aria-label="Zoom out world map">−</button>
   <button onClick={fit} disabled={!points.length}>Fit journeys</button><button onClick={reset}>Whole world</button><button aria-pressed={labels} onClick={()=>setLabels(v=>!v)}>City labels</button>
  </div></div>
  <div className="cdr-world-legend">{people.filter(p=>records.some(r=>r.person===p)).map(p=><span key={p}><i style={{background:colour(p,people)}}/>{p}</span>)}<span>Drag to pan · scroll or pinch to zoom · select a journey</span></div>
  <svg ref={svg} viewBox={'0 0 '+WIDTH+' '+HEIGHT} tabIndex="0" role="group" aria-label="Interactive world map: arrow keys pan, plus and minus zoom" onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='+'||e.key==='='){e.preventDefault();changeZoom(1.5);}else if(e.key==='-'){e.preventDefault();changeZoom(1/1.5);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();select(svg.current).call(behaviour.current.translateBy,(e.key==='ArrowLeft'?60:e.key==='ArrowRight'?-60:0)/transform.k,(e.key==='ArrowUp'?60:e.key==='ArrowDown'?-60:0)/transform.k);}}}>
   <defs>{people.map((p,i)=><marker key={p} id={marker+i} viewBox="0 -4 8 8" refX="11" refY="0" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,-3L7,0L0,3" fill={colour(p,people)}/></marker>)}</defs>
   <rect width={WIDTH} height={HEIGHT} fill="#eaf4f8"/>
   <g transform={transform.toString()} className="cdr-world-geography">
    <path d={path({type:'Sphere'})} fill="#e2f0f5" stroke="#cadde5" vectorEffect="non-scaling-stroke"/>
    <path d={path(geoGraticule10())} fill="none" stroke="#cbdde4" strokeWidth=".55" vectorEffect="non-scaling-stroke"/>
    {countries.map(c=><path key={c.id} d={c.d} fill="#f8f7ee" stroke="#aebfbe" strokeWidth=".6" vectorEffect="non-scaling-stroke"><title>{c.name}</title></path>)}
   </g>
   {groups.map(g=>{
    const a=byName.get(g.origin),b=byName.get(g.destination);if(!a||!b)return null;
    const [x1,y1]=transform.apply(a.point),[x2,y2]=transform.apply(b.point),dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1;
    const bend=Math.min(85,len*.16)+people.indexOf(g.person)*7;
    const d=len<2?'M '+x1+' '+y1+' C '+(x1+45)+' '+(y1-55)+' '+(x1-45)+' '+(y1-55)+' '+x1+' '+y1:'M '+x1+' '+y1+' Q '+((x1+x2)/2-dy/len*bend)+' '+((y1+y2)/2+dx/len*bend)+' '+x2+' '+y2;
    const active=preview?.key===g.key,dim=preview?.key&&preview.key!==g.key;
    return <g key={g.key} className="cdr-world-route" style={{opacity:dim?.18:1}} tabIndex="0" role="button" aria-label={g.person+': '+g.origin+' to '+g.destination+', '+g.records.length+' records'} onMouseEnter={()=>setHover(g)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(g)} onBlur={()=>setHover(null)} onClick={()=>choose(g)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(g);}}}>
     <path d={d} fill="none" stroke={colour(g.person,people)} strokeWidth={active?3.5:1.8} markerEnd={'url(#'+marker+people.indexOf(g.person)+')'}/>
     <path d={d} fill="none" stroke="transparent" strokeWidth="13"/><title>{g.person} · {g.records.length} source records</title>
    </g>;
   })}
   {positioned.map(p=><g key={p.id} className="cdr-world-place"><circle cx={p.screen[0]} cy={p.screen[1]} r="5" fill="#fff" stroke="#2b5868" strokeWidth="1.8"><title>{p.name+' · '+p.people.join(', ')}</title></circle></g>)}
   {labels&&visibleLabels.map(p=><text key={p.id} x={p.box.x+4} y={p.box.y+12} className="cdr-world-city">{p.label}</text>)}
  </svg>
  <div className="cdr-world-footer"><span>Approximate city centres · lines connect source endpoints</span><a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Map: Natural Earth</a></div>
  {mapped<records.length&&<details className="cdr-world-warning"><summary>{records.length-mapped} journeys have an unmapped endpoint</summary>{locations.filter(l=>!geoAnchor(l.name)).map(l=><p key={l.id}>{l.name}</p>)}<p>These records remain in the schematic view.</p></details>}
  {!records.length&&<p className="cdr-world-warning" role="status">No journeys match the current filters.</p>}
  <div className="cdr-world-inspector" aria-live="polite">{preview?<><strong style={{color:colour(preview.person,people)}}>{preview.person}</strong><span>{preview.origin} → {preview.destination}</span><small>{preview.records.length} record{preview.records.length===1?'':'s'} · {timestamp(preview.records[0].departure)} · {preview.records[0].mode}</small></>:<><strong>Explore a journey</strong><span>Hover or focus a line for details. Select it to open the source record.</span></>}</div>
  {selected&&<div className="cdr-world-records"><div><strong>Records on this connection</strong><button onClick={()=>{setSelectedKey('');onSelect(null);}}>Clear selection</button></div>{selected.records.map(r=><button key={recordKey(r)} onClick={()=>onSelect(r)}>{timestamp(r.departure)} · {r.source.path} · record {r.source.record}</button>)}</div>}
 </section>;
}
