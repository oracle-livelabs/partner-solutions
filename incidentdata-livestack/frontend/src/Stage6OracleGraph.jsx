import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import {oracleConnectionsGraph,CONNECTION_LABELS} from './oracle-connections-graph.mjs';
import './oracle-case-graph.css';
import './stage6-oracle-graph.css';
const CHANNEL='crimedata-oracle-graph-v1';
function Canvas({graph,onSource}){
 const frame=useRef(),[ready,setReady]=useState(false),[rendered,setRendered]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[layout,setLayout]=useState('force'),[kind,setKind]=useState('all'),[focus,setFocus]=useState(''),[selected,setSelected]=useState(null);
 const converted=useMemo(()=>{try{return oracleConnectionsGraph(graph,kind,focus);}catch(e){return{error:e.message};}},[graph,kind,focus]);
 const send=value=>frame.current?.contentWindow?.postMessage({channel:CHANNEL,...value},window.location.origin);
 useEffect(()=>{
  function receive(event){
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow||event.data?.channel!==CHANNEL)return;
   if(event.data.type==='ready'){setReady(true);setError('');}
   if(event.data.type==='rendered')setRendered(true);
   if(event.data.type==='error'){setError('Oracle’s visualizer could not render this graph. The saved diagram remains available.');setRendered(false);}
   if(event.data.type==='select'){const n=converted.nodeById?.get(event.data.id);if(n)setSelected({node:n});}
   if(event.data.type==='select-edge'){const e=converted.edgeById?.get(event.data.id);if(e)setSelected({edge:e});}
  }
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[converted]);
 useEffect(()=>{if(!ready||converted.error)return;setRendered(false);setSelected(null);send({type:'render',data:converted.data,layout});},[ready,converted,layout]);
 useEffect(()=>{if(ready)return;const timer=setTimeout(()=>setError('Oracle’s visualizer did not load. Retry or choose the saved diagram.'),15000);return()=>clearTimeout(timer);},[ready,revision]);
 function retry(){setError('');setReady(false);setRendered(false);setRevision(v=>v+1);}
 return <section className="oracle-case stage6-oracle" aria-label="Oracle Graph Visualizer" data-ready={rendered&&!error}>
  <div className="cdr-workspace-controls"><label>Link type<select aria-label="Oracle connection link type" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All connections</option>{Object.entries(CONNECTION_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Focus<select aria-label="Oracle connection focus" value={focus} onChange={e=>setFocus(e.target.value)}><option value="">All nodes</option>{graph.nodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label>Layout<select aria-label="Oracle connection layout" value={layout} onChange={e=>setLayout(e.target.value)}><option value="force">Force-directed</option><option value="hierarchical">Hierarchical</option><option value="radial">Radial</option></select></label><button type="button" onClick={retry}>Reset Oracle view</button></div>
  <p className="oracle-case__notice">Oracle Graph Visualization 26.4.0 · results queried from the native Oracle graph. Drag and zoom to explore. Double-click a node or select a link for its support. Layout and proximity do not imply evidence strength.</p>
  <p className="oracle-case__counts">{converted.data?.vertices.length||0} displayed nodes · {converted.data?.edges.length||0} displayed links · draft connections require review</p>
  {(error||converted.error)&&<p role="alert" className="oracle-case__warning">{error||converted.error}</p>}
  {!error&&!converted.error&&!rendered&&<p role="status">Loading Oracle visualizer…</p>}
  {!converted.error&&<iframe key={revision} ref={frame} src="/oracle-graph/explorer.html" title="Oracle Stage 6 graph canvas" className="oracle-case__frame" referrerPolicy="same-origin" sandbox="allow-scripts allow-same-origin" onLoad={()=>send({type:'hello'})}/>}
  <details className="stage6-oracle-records"><summary>Accessible nodes and connections</summary><div className="stage6-oracle-lists"><section><h4>Nodes</h4>{[...(converted.nodeById?.values()||[])].map(n=><button type="button" key={n.id} onClick={()=>setSelected({node:n})}>{n.label}</button>)}</section><section><h4>Connections</h4>{[...(converted.edgeById?.values()||[])].map(e=><button type="button" key={e.id} onClick={()=>setSelected({edge:e})}>{graph.nodes.find(n=>n.id===e.source)?.label} → {graph.nodes.find(n=>n.id===e.target)?.label} · {CONNECTION_LABELS[e.kind]}</button>)}</section></div></details>
  {selected&&<section className="stage6-oracle-inspector" aria-label="Selected Oracle graph record"><h4>{selected.node?.label||CONNECTION_LABELS[selected.edge.kind]}</h4>{selected.node?<><p>{selected.node.kind==='reference'?'A literal reference shared by source files. This does not establish a relationship between incidents or people.':selected.node.kind==='declared_person'?'Declared fictional cast association; no face identification.':'An original uploaded source file.'}</p>{selected.node.sourceRef&&<button type="button" onClick={()=>onSource(selected.node.sourceRef)}>Inspect saved source description</button>}</>:<><p>{selected.edge.basis}</p>{Number.isFinite(selected.edge.score)&&<p>Cosine similarity: {selected.edge.score.toFixed(3)} · comparison candidate only</p>}{selected.edge.quote&&<blockquote>{selected.edge.quote.quote}</blockquote>}<div>{selected.edge.sourceRefs.map(ref=><button type="button" key={ref} onClick={()=>onSource(ref)}>Inspect source {ref}</button>)}</div></>}<button type="button" onClick={()=>setSelected(null)}>Close selection</button></section>}
 </section>;
}
export default function Stage6OracleGraph({api,batchId,runId,onSource}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),modelId=useId();
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');api(`/batches/${batchId}/connections/graph?runId=${encodeURIComponent(runId)}`,{signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setData(r);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[api,batchId,runId,revision]);
 return <div className="stage6-oracle-wrap">{error?<p role="alert" className="cdr-failure">{error} <button onClick={()=>setRevision(v=>v+1)}>Retry Oracle graph</button></p>:!data?<p role="status">Querying the saved Stage 6 Oracle graph…</p>:<>
  <p className="cdr-small"><strong>{data.graphName}</strong> · {data.engine} · {data.graph.nodes.length} vertices · {data.graph.edges.length} edges</p>
  <Canvas graph={data.graph} onSource={onSource}/>
  <details className="stage6-oracle-model"><summary>Oracle graph model &amp; SQL</summary><p>The native graph reads this completed run’s saved JSON through two scoped SQL views. No AI is rerun and no second copy of the connection data is created.</p><div className="stage6-model-flow" aria-label="Oracle graph storage model"><div><strong>Saved Stage 6 result</strong><code>CDR_WORKSPACE_RUNS.RESULT_JSON</code><span>$.graph.nodes / $.graph.edges</span></div><span aria-hidden="true">→</span><div><strong>JSON_TABLE views</strong><code>{data.model.vertexView}</code><code>{data.model.edgeView}</code></div><span aria-hidden="true">→</span><div><strong>Oracle property graph</strong><code>{data.graphName}</code><span>connection_node → connection_link → connection_node</span></div></div><p>Vertex key: run ID + node ID. Edge key: run ID + edge ordinal. Run-scoped keys keep identical filenames or references in different runs separate. All reads use the current user’s authorised batch scope.</p><label htmlFor={modelId}>Graph queries for this saved run</label><pre id={modelId}>{`-- :rid = ${data.runId}\n${data.queries.vertices};\n\n${data.queries.edges};`}</pre></details>
 </>}</div>;
}
