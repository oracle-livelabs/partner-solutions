import React,{useEffect,useMemo,useRef,useState} from 'react';
import {oracleCaseGraph,oracleLayoutChoice,ORACLE_GRAPH_VERSION} from './oracle-case-graph.mjs';
import './oracle-case-graph.css';
const CHANNEL='crimedata-oracle-graph-v1';
export default function OracleCaseGraph({network,onNodeSelect,onEdgeSelect,layout:requestedLayout='hierarchical',onLayoutChange}){
 const frame=useRef(),select=useRef(onNodeSelect),[ready,setReady]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[frameRevision,setFrameRevision]=useState(0),[rendered,setRendered]=useState(false),[selectedId,setSelectedId]=useState('');
 select.current=onNodeSelect;
 const edgeSelect=useRef(onEdgeSelect);edgeSelect.current=onEdgeSelect;
 const converted=useMemo(()=>{try{return oracleCaseGraph(network);}catch(e){return {error:e.message};}},[network]);
 const layout=oracleLayoutChoice(requestedLayout,converted.canCluster);
 const send=value=>frame.current?.contentWindow?.postMessage({channel:CHANNEL,...value},window.location.origin);
 useEffect(()=>{
  function receive(event){
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow||event.data?.channel!==CHANNEL)return;
   if(event.data.type==='ready'){setReady(true);setError('');}
   if(event.data.type==='rendered')setRendered(true);
   if(event.data.type==='error'){setError('Oracle Graph Explorer could not render this network. The other graph views remain available.');setRendered(false);}
   if(event.data.type==='select'){const node=network.nodes.find(n=>n.id===event.data.id);if(node){setSelectedId(node.id);select.current?.(node);}}
   if(event.data.type==='select-edge'){const edge=network.edges.find(e=>e.connectionHighlight&&e.connectionId===event.data.id);if(edge)edgeSelect.current?.(edge.connectionId);}
  }
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[network]);
 useEffect(()=>{if(!ready||converted.error)return;setRendered(false);setError('');send({type:'render',data:converted.data,layout});},[ready,converted,layout,revision]);
 useEffect(()=>{if(ready)return;const timer=setTimeout(()=>setError('Oracle Graph Explorer did not load. Retry or choose another graph view.'),15000);return()=>clearTimeout(timer);},[ready,frameRevision]);
 function retry(){setError('');setReady(false);setRendered(false);setFrameRevision(v=>v+1);}
 const selectedNode=network.nodes.find(n=>n.id===selectedId);
 return <section className="oracle-case" aria-label="Oracle Graph Explorer" data-ready={rendered&&!error} data-layout={layout}>
  <div className="oracle-case__toolbar"><div><strong>Oracle Graph Explorer</strong><small>Oracle Graph Visualization {ORACLE_GRAPH_VERSION} · read-only case explorer</small></div><label>Oracle layout<select aria-label="Oracle graph layout" value={layout} onChange={e=>{setRendered(false);onLayoutChange?.(e.target.value);}}><option value="hierarchical">Hierarchical</option><option value="force">Force-directed</option><option value="radial">Radial</option>{converted.canCluster&&<option value="clustered">Clustered force-directed</option>}</select></label><button onClick={()=>{setRendered(false);setRevision(v=>v+1);}} disabled={!ready}>Reset exploration</button></div>
  {layout==='radial'&&<p className="oracle-case__counts">Radial arranges the same records in outward branches. Distance from the centre does not indicate importance or evidence strength.</p>}
  {layout==='clustered'&&<p className="oracle-case__counts">{converted.groupCount} computed incident group{converted.groupCount===1?'':'s'} · labels and colours identify groups from the current threshold, not risk. This layout does not discover new relationships.</p>}
  <p className="oracle-case__notice">Same scoped case data, rendered with Oracle’s library. Drag or zoom to explore; double-click a node to open its details. {network.edges.some(e=>e.connectionMode)&&'Select an orange connecting edge to see its recorded reason above the graph. '}Grouping and hiding affect only this view. Expansion, saving and database edits are disabled.</p>
  <p className="oracle-case__counts">{converted.data?.vertices.length||0} loaded nodes · {converted.data?.edges.length||0} loaded relationships · source: scoped relational SQL over the case graph model</p>
  {selectedNode?.type==='case'&&<p className="oracle-case__counts" role="status"><strong>Case file: {selectedNode.label}</strong> · {selectedNode.detail}</p>}
  {converted.omittedEdges>0&&<p className="oracle-case__warning">{converted.omittedEdges} relationship(s) have endpoints outside this bounded result and are not drawn. This is not the complete database graph.</p>}
  {(error||converted.error)&&<p className="oracle-case__warning" role="alert">{error||converted.error} {!converted.error&&<button onClick={retry}>Retry Oracle view</button>}</p>}
  {!error&&!converted.error&&!rendered&&<p role="status" className="oracle-case__status">Loading Oracle graph…</p>}
  {!converted.error&&<iframe key={frameRevision} ref={frame} src="/oracle-graph/explorer.html" title="Oracle Graph Explorer canvas" className="oracle-case__frame" referrerPolicy="same-origin" sandbox="allow-scripts allow-same-origin" onLoad={()=>send({type:'hello'})}/>}
  <details className="oracle-case__accessible"><summary>Accessible node list and details</summary><p>Use this list as an alternative to graph interaction. Legend filters inside the canvas do not remove records from this list.</p><label>Authorised node<select aria-label="Oracle graph node" value={selectedId} onChange={e=>setSelectedId(e.target.value)}><option value="">Choose a node…</option>{network.nodes.map(n=><option key={n.id} value={n.id}>{n.type}: {n.label}</option>)}</select></label><button disabled={!selectedId} onClick={()=>{const node=network.nodes.find(n=>n.id===selectedId);if(node)select.current?.(node);}}>Open node details</button></details>
 </section>;
}
