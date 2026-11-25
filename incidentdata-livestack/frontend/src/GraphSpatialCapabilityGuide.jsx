import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './vector-capability-guide.css';
import './graph-spatial-capability-guide.css';

const NODES=[
 {id:'alex',name:'Alex',type:'Person',x:90,y:90,properties:{ID:'P-A',Name:'Alex'}},
 {id:'blue',name:'Blue bicycle',type:'Bicycle',x:285,y:90,properties:{ID:'B-A',Colour:'Blue'}},
 {id:'shop',name:'Cycle shop',type:'Shop',x:510,y:200,properties:{ID:'S-1',Name:'Cycle shop'}},
 {id:'sam',name:'Sam',type:'Person',x:90,y:310,properties:{ID:'P-B',Name:'Sam'}},
 {id:'red',name:'Red bicycle',type:'Bicycle',x:285,y:310,properties:{ID:'B-B',Colour:'Red'}},
];
const EDGES=[
 {id:'ownsAlex',from:'alex',to:'blue',label:'owns',path:'M125 90 L225 90',labelX:175,labelY:67,properties:{Type:'owns',Source:'Example ownership record',Recorded:'14 August 2026'}},
 {id:'saleBlue',from:'blue',to:'shop',label:'purchased from',path:'M340 108 L440 181',labelX:405,labelY:128,properties:{Type:'purchased from',Source:'Example purchase record',Recorded:'12 August 2026'}},
 {id:'ownsSam',from:'sam',to:'red',label:'owns',path:'M125 310 L225 310',labelX:175,labelY:287,properties:{Type:'owns',Source:'Example ownership record',Recorded:'18 August 2026'}},
 {id:'saleRed',from:'red',to:'shop',label:'purchased from',path:'M340 292 L440 219',labelX:405,labelY:278,properties:{Type:'purchased from',Source:'Example purchase record',Recorded:'17 August 2026'}},
];
function GraphExample(){
 const [start,setStart]=useState('alex'),[hops,setHops]=useState(1),[inspect,setInspect]=useState('blue');
 const path=(start==='alex'?EDGES.slice(0,2):EDGES.slice(2)).slice(0,hops),reached=path.map(e=>NODES.find(n=>n.id===e.to));
 const selected=NODES.find(n=>n.id===inspect)||EDGES.find(e=>e.id===inspect);
 return <>
  <p className="vg-lead">Each hop follows one recorded relationship. Start with a person and follow the arrows.</p>
  <div className="gs-controls"><div className="vg-query"><span>Start at</span>{['alex','sam'].map(id=><button key={id} type="button" aria-pressed={start===id} onClick={()=>setStart(id)}>{NODES.find(n=>n.id===id).name}</button>)}</div><div className="vg-query"><span>Follow</span>{[1,2].map(n=><button key={n} type="button" aria-pressed={hops===n} onClick={()=>setHops(n)}>{n===1?'One hop':'Two hops'}</button>)}</div></div>
  <div className="vg-example-grid gs-example-grid">
   <figure className="vg-map"><svg viewBox="0 0 640 410" role="img" aria-label={`Teaching property graph. ${NODES.find(n=>n.id===start).name} reaches ${reached.map(n=>n.name).join(', ')} in ${hops} hops.`}>
    <title>People, bicycles and recorded purchase relationships</title><defs>{['active','muted'].map(kind=><marker key={kind} id={`pg-arrow-${kind}`} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0 0 L10 4 L0 8 Z" fill={kind==='active'?'#bc4634':'#a4b3b6'}/></marker>)}</defs>
    {EDGES.map(e=>{const active=path.includes(e);return <g key={e.id}><path d={e.path} fill="none" stroke={active?'#bc4634':'#b3c1c4'} strokeWidth={active?3:2} markerEnd={`url(#pg-arrow-${active?'active':'muted'})`}/><text x={e.labelX} y={e.labelY} textAnchor="middle" className={active?'gs-edge-label gs-edge-label-active':'gs-edge-label'}>{e.label}</text></g>;})}
    {NODES.map(n=>{const active=n.id===start||reached.includes(n);return <g key={n.id} className={active?'gs-node gs-node-active':'gs-node'}>{n.type==='Person'?<circle cx={n.x} cy={n.y} r="33"/>:<rect x={n.x-(n.type==='Shop'?65:55)} y={n.y-27} width={n.type==='Shop'?130:110} height="54" rx="9"/>}<text x={n.x} y={n.y+5} textAnchor="middle" className="gs-node-label">{n.name}</text><text x={n.x} y={n.y+49} textAnchor="middle" className="gs-node-type">{n.type}</text></g>;})}
   </svg><figcaption>Invented records and relationships for teaching. Drawing positions have no geographic meaning.</figcaption></figure>
   <div className="gs-results"><h4>Reached in {hops} {hops===1?'hop':'hops'}</h4><ol aria-live="polite">{reached.map((n,i)=><li key={n.id}><b>{i+1}. {n.name}</b><span>{path[i].label} · {n.type}</span></li>)}</ol><p>Highlighted arrows show the selected path. Other links remain visible for context.</p><label>Inspect a node or edge<select aria-label="Inspect example graph record" value={inspect} onChange={e=>setInspect(e.target.value)}>{NODES.map(n=><option key={n.id} value={n.id}>Node: {n.name}</option>)}{EDGES.map(e=><option key={e.id} value={e.id}>Edge: {NODES.find(n=>n.id===e.from).name} {e.label} {NODES.find(n=>n.id===e.to).name}</option>)}</select></label><dl className="gs-properties">{Object.entries(selected.properties).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div>
  </div>
  <aside className="vg-talk"><small>Talk track</small><p>“One hop reaches the bicycle. Two hops reaches the shop through that bicycle. Alex and Sam both have paths to the shop, but this graph has no recorded friendship between them.”</p></aside>
 </>;
}
const POINTS=[{name:'Point A',x:3.7,y:3.3},{name:'Point B',x:1.8,y:4.1},{name:'Point C',x:5.2,y:3.6},{name:'Point D',x:5.7,y:5.4},{name:'Point E',x:2,y:0.6}];
const inside=p=>p.x>=1&&p.x<=4.2&&p.y>=1&&p.y<=5.5;
function SpatialExample(){
 const [mode,setMode]=useState('distance'),[radius,setRadius]=useState(1);
 const distance=p=>Math.hypot(p.x-3,p.y-3),matches=POINTS.filter(p=>mode==='distance'?distance(p)<=radius:inside(p));
 const x=n=>145+n*56,y=n=>380-n*56;
 return <>
  <p className="vg-lead">“How close?” and “inside which area?” are different questions about the same points.</p>
  <div className="vg-query"><span>Query</span><button type="button" aria-pressed={mode==='distance'} onClick={()=>setMode('distance')}>Within distance</button><button type="button" aria-pressed={mode==='area'} onClick={()=>setMode('area')}>In patrol area</button></div>
  {mode==='distance'?<label className="gs-radius">Distance limit: <strong>{radius.toFixed(1)} km</strong><input aria-label="Distance limit in kilometres" type="range" min="0.5" max="4" step="0.5" value={radius} onChange={e=>setRadius(Number(e.target.value))}/></label>:<p className="vg-footnote">Include points inside or on the example patrol-area boundary.</p>}
  <div className="vg-example-grid gs-example-grid">
   <figure className="vg-map"><svg viewBox="0 0 640 445" role="img" aria-label={`Teaching spatial map. ${mode==='distance'?`Within ${radius} kilometres of the reference point`:'Inside the patrol area'}: ${matches.map(p=>p.name).join(', ')||'no points'}.`}>
    <title>Illustrative local kilometre grid with points, an area and a distance query</title><defs><clipPath id="spatial-guide-clip"><rect x="145" y="44" width="336" height="336"/></clipPath></defs>
    {[0,1,2,3,4,5,6].map(v=><g key={v} className="vg-grid"><line x1={x(v)} y1="44" x2={x(v)} y2="380"/><line x1="145" y1={y(v)} x2="481" y2={y(v)}/><text x={x(v)} y="401" textAnchor="middle" className="vg-axis">{v}</text><text x="131" y={y(v)+4} textAnchor="end" className="vg-axis">{v}</text></g>)}
    <g clipPath="url(#spatial-guide-clip)"><rect x={x(1)} y={y(5.5)} width={3.2*56} height={4.5*56} className={mode==='area'?'gs-patrol gs-patrol-active':'gs-patrol'}/>{mode==='distance'&&<circle cx={x(3)} cy={y(3)} r={radius*56} className="gs-radius-circle"/>}</g>
    <text x={x(1)+9} y={y(5.5)+20} className="gs-area-label">Patrol area</text>
    {POINTS.map(p=><g key={p.name}><circle cx={x(p.x)} cy={y(p.y)} r="8" className={matches.includes(p)?'vg-dot-near':'vg-dot-other'}/><text x={x(p.x)} y={y(p.y)-16} textAnchor="middle" className="gs-point-label">{p.name}</text></g>)}
    <path d={`M${x(3)-9} ${y(3)} H${x(3)+9} M${x(3)} ${y(3)-9} V${y(3)+9}`} stroke="#bc4634" strokeWidth="3"/><text x={x(3)} y={y(3)+27} textAnchor="middle" className="gs-reference-label">Reference point</text>
    <text x="313" y="430" textAnchor="middle" className="vg-axis">Local x coordinate (km)</text><text transform="translate(90 212) rotate(-90)" textAnchor="middle" className="vg-axis">Local y coordinate (km)</text>
   </svg><figcaption>Invented local coordinates measured in kilometres. This schematic is not a real city map or latitude/longitude data.</figcaption></figure>
   <div className="gs-results"><h4 aria-live="polite">{matches.length} {matches.length===1?'point matches':'points match'}</h4><p>{mode==='distance'?`Distance ≤ ${radius.toFixed(1)} km from the reference point.`:'Inside or on the patrol boundary.'}</p><ul className="gs-point-results">{POINTS.map(p=><li key={p.name} className={matches.includes(p)?'gs-match':''}><span><b>{p.name}</b><small>{distance(p).toFixed(2)} km from reference</small></span><em>{matches.includes(p)?'Included':'Outside query'}</em></li>)}</ul><p>Change the query to see that a nearby point can sit outside an area.</p></div>
  </div>
  <aside className="vg-talk"><small>Talk track</small><p>“The circle asks which points are within a distance. The rectangle asks which points fall in an area. Spatial compares physical coordinates and shapes; vector similarity compares learned representations.”</p></aside>
 </>;
}
const GRAPH_STEPS=['What is a property graph?','Follow relationships','What Oracle provides','Apply it to this app'];
const SPATIAL_STEPS=['What is spatial data?','Explore distance and area','What Oracle provides','Apply it to this app'];
export default function GraphSpatialCapabilityGuide({kind,onClose}){
 const graph=kind==='graph',steps=graph?GRAPH_STEPS:SPATIAL_STEPS,title=graph?'Oracle Property Graph':'Oracle Spatial';
 const [step,setStep]=useState(0),dialog=useRef(null),returnFocus=useRef(document.activeElement);
 useEffect(()=>{const el=dialog.current,overflow=document.body.style.overflow;document.body.style.overflow='hidden';el.showModal();return()=>{el.close();document.body.style.overflow=overflow;if(returnFocus.current?.isConnected)returnFocus.current.focus({preventScroll:true});};},[]);
 function trapTab(e){if(e.key!=='Tab')return;const all=[...dialog.current.querySelectorAll('button:not([disabled]),select,input:not([disabled]),a[href],summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0].focus();}}
 function backdrop(e){if(e.target!==dialog.current)return;const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}
 const talk=graph?[
  '“Nodes represent things, edges represent recorded relationships, and properties carry details about either one. A graph lets us ask how things connect.”',null,
  '“Oracle can define a SQL property graph over existing tables. GRAPH_TABLE matches a relationship pattern and returns rows that we can filter and join with SQL.”',
  '“Follow the type and source of each link. A recorded link, a similarity comparison and a graph layout communicate different things.”',
 ]:[
  '“Spatial data tells us where something is and what shape it has. Points, lines and polygons let us ask questions about distance, areas and intersections.”',null,
  '“Oracle stores geometry with its coordinate system. Spatial indexes help narrow candidates, and geometry operations answer distance and shape questions.”',
  '“The map shows approximate locations. Nearby records give spatial context; proximity alone does not establish a relationship between events.”',
 ];
 return createPortal(<dialog ref={dialog} className="vector-guide gs-guide" aria-labelledby="graph-spatial-guide-title" onKeyDown={trapTab} onClick={backdrop} onCancel={e=>{e.preventDefault();onClose();}}>
  <header className="vg-header"><div><small>DATA FOUNDATION · PRESENTER WALKTHROUGH</small><h2 id="graph-spatial-guide-title">{title}</h2><p>{graph?'From connected records to questions about relationships.':'From coordinates and shapes to questions about place.'}</p></div><button type="button" autoFocus onClick={onClose} aria-label={`Close ${graph?'property graph':'spatial'} walkthrough`}>Close ×</button></header>
  <nav className="vg-steps" aria-label="Walkthrough steps">{steps.map((name,i)=><button type="button" key={name} aria-pressed={step===i} onClick={()=>setStep(i)}><span>{i+1}</span>{name}</button>)}</nav>
  <div className="vg-body" key={step}><h3>{steps[step]}</h3>
   {step===0&&(graph?<>
    <p className="vg-lead">A property graph represents things as <strong>nodes</strong> (vertices), connections as <strong>edges</strong>, and descriptive values as <strong>properties</strong>.</p>
    <div className="vg-number-flow"><div><span>Node</span><strong>Alex</strong></div><b aria-hidden="true">→</b><div><span>Edge</span><strong>owns</strong></div><b aria-hidden="true">→</b><div><span>Node</span><strong>Blue bicycle</strong></div></div>
    <div className="vg-explain"><h4>What makes it a property graph?</h4><p>The bicycle node can have a colour and ID. The ownership edge can have a recorded date and a source reference. Direction and relationship type tell us how to interpret the connection.</p></div>
    <p>A graph can connect many kinds of records: people, accounts, documents, incidents or evidence. The useful question is “which recorded paths connect these records?”</p>
   </>:<>
    <p className="vg-lead">Spatial data describes <strong>location and shape</strong>. Coordinates locate an object, while its geometry tells us whether it is a point, a line or an area.</p>
    <div className="gs-shapes">{[['Point','An approximate incident location'],['Line','A route or street segment'],['Polygon','A patrol area or boundary']].map(([name,detail],i)=><div key={name}><svg viewBox="0 0 42 42" aria-hidden="true">{i===0?<circle cx="21" cy="21" r="6"/>:i===1?<polyline points="5,32 14,12 27,20 37,6"/>:<polygon points="7,8 32,5 37,28 17,36 4,23"/>}</svg><b>{name}</b><p>{detail}</p></div>)}</div>
    <div className="vg-explain"><h4>Coordinates need context</h4><p>A longitude/latitude pair locates a point using a geographic coordinate system. Other coordinate systems use local x/y values. Use the correct coordinate reference system and distance units when comparing geometries.</p></div>
    <p>Our next example uses an invented flat grid in kilometres, so the distance calculation is easy to explain.</p>
   </>)}
   {step===1&&(graph?<GraphExample/>:<SpatialExample/>)}
   {step===2&&(graph?<>
    <p className="vg-lead">Oracle can expose relational records as a SQL property graph, then match patterns of connections.</p>
    <ol className="vg-oracle-flow"><li><b>1 · Define the graph</b><p><code>CREATE PROPERTY GRAPH</code> maps vertex and edge tables. Source and destination keys define the relationships.</p></li><li><b>2 · Keep properties</b><p>Labels identify kinds of vertices and edges. Properties expose selected values from the underlying data.</p></li><li><b>3 · Match paths</b><p><code>GRAPH_TABLE</code> describes a graph pattern to match: for example Person → Bicycle → Shop.</p></li><li><b>4 · Return SQL rows</b><p>Project matched properties as columns, then join and filter them with other database records under the relevant access rules.</p></li></ol>
    <details className="vg-sql"><summary>Show illustrative SQL</summary><p>Assumes a declared <code>demo_graph</code> with person, bicycle and shop labels, plus owns and purchased_from edges. This example matches two recorded hops.</p><pre tabIndex={0}><code>{`SELECT *
FROM GRAPH_TABLE(demo_graph
  MATCH (p IS person)-[o IS owns]->(b IS bicycle)
        -[sale IS purchased_from]->(s IS shop)
  WHERE p.name = :person_name
  COLUMNS (p.name AS person,
           b.colour AS bicycle_colour,
           s.name AS shop)
);`}</code></pre></details>
   </>:<>
    <p className="vg-lead">Oracle Spatial stores geometries and provides operations for distance, area relationships and intersections.</p>
    <ol className="vg-oracle-flow"><li><b>1 · Store geometry</b><p><code>SDO_GEOMETRY</code> can hold points, lines and polygons, including a coordinate-system identifier.</p></li><li><b>2 · Describe coordinates</b><p>Geometry metadata records dimensions, bounds and tolerance. Coordinate systems and units must be appropriate for the question.</p></li><li><b>3 · Index spatial data</b><p>Spatial indexes can narrow candidate geometries for supported spatial predicates. Geometry operations establish the detailed spatial relationship.</p></li><li><b>4 · Ask with SQL</b><p>Calculate distance, test area relationships and combine the results with record attributes and access filters.</p></li></ol>
    <details className="vg-sql"><summary>Show illustrative SQL</summary><p>Assumes location geometries and the reference point use the same appropriate georeferenced coordinate system. Set the tolerance for that data; kilometres are requested explicitly. This distance-function example illustrates the calculation, rather than an indexed spatial predicate.</p><pre tabIndex={0}><code>{`SELECT incident_ref, distance_km
FROM (
  SELECT incident_ref,
    SDO_GEOM.SDO_DISTANCE(location, :reference_point,
      :tolerance, 'unit=KM') AS distance_km
  FROM demo_incidents
)
WHERE distance_km <= :radius_km
ORDER BY distance_km;`}</code></pre></details>
   </>)}
   {step===3&&(graph?<>
    <p className="vg-lead">Use graph views to explore the recorded connections between cases, incidents, people and evidence.</p>
    <div className="vg-explain"><h4>Where it appears in IncidentData</h4><p>Case Relationships renders scoped record links. Evidence Intelligence and Data Room tools also demonstrate native Oracle graph queries, including conversation participation and money-flow records.</p></div>
    <ol className="vg-app-flow"><li>Start with a visible record.</li><li>Follow its recorded link type and direction.</li><li>Inspect the supporting source and relationship details.</li><li>Distinguish an explicit link from a comparison or a layout choice.</li></ol>
    <p>Moving nodes closer together in a drawing changes the layout, not the underlying relationships. A shared object or a multi-hop path does not establish responsibility or agreement.</p>
   </>:<>
    <p className="vg-lead">Use spatial views to understand the approximate geographic context of visible incident records.</p>
    <div className="vg-explain"><h4>Where it appears in IncidentData</h4><p>Incident Map displays scoped latitude/longitude coordinates. Those coordinates can also be represented as Oracle geometries for database-side distance calculations. Evidence and travel workspaces add source-linked location context.</p></div>
    <ol className="vg-app-flow"><li>Check the source and precision of the coordinates.</li><li>Choose the distance or area question you want to answer.</li><li>Use a compatible coordinate system and units.</li><li>Review the returned records and their original context.</li></ol>
    <p>Nearby places are not necessarily related events. Vector Search compares learned representations, Property Graph follows recorded relationships, and Spatial compares physical locations and shapes.</p>
   </>)}
   {talk[step]&&<aside className="vg-talk"><small>Talk track</small><p>{talk[step]}</p></aside>}
   {(step===0||step===2)&&<p className="vg-sources">Oracle references: {graph?<><a href="https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/create-property-graph.html" target="_blank" rel="noreferrer">Property graph definition</a> · <a href="https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/graph_table-operator.html" target="_blank" rel="noreferrer">GRAPH_TABLE</a></>:<><a href="https://docs.oracle.com/en/database/oracle/oracle-database/26/spatl/spatial-data-types-and-metadata.html" target="_blank" rel="noreferrer">Geometry and metadata</a> · <a href="https://docs.oracle.com/en/database/oracle/oracle-database/26/spatl/sdo_geom-sdo_distance.html" target="_blank" rel="noreferrer">Distance calculations</a></>}</p>}
  </div>
  <footer className="vg-footer"><span>Step {step+1} of {steps.length}</span><div><button type="button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Back</button><button type="button" className="vg-next" onClick={()=>step===steps.length-1?onClose():setStep(s=>s+1)}>{step===steps.length-1?'Finish':'Next →'}</button></div></footer>
 </dialog>,document.body);
}
