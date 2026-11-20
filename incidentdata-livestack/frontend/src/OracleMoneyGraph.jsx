import React,{useEffect,useMemo,useRef,useState} from 'react';
import {oracleMoneyGraph} from './oracle-money-graph.mjs';
import './oracle-case-graph.css';
const CHANNEL='crimedata-oracle-graph-v1';
const VERSION='26.4.0';
export default function OracleMoneyGraph({accounts,summary,onAccountSelect,onPairSelect}){
 const frame=useRef(),accountSelect=useRef(onAccountSelect),pairSelect=useRef(onPairSelect);
 accountSelect.current=onAccountSelect;pairSelect.current=onPairSelect;
 const [ready,setReady]=useState(false),[rendered,setRendered]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[frameRevision,setFrameRevision]=useState(0),[layout,setLayout]=useState('hierarchical'),[selectedAccount,setSelectedAccount]=useState(''),[selectedPair,setSelectedPair]=useState('');
 const converted=useMemo(()=>{try{return oracleMoneyGraph(accounts,summary);}catch(e){return {error:e.message};}},[accounts,summary]);
 const send=value=>frame.current?.contentWindow?.postMessage({channel:CHANNEL,...value},window.location.origin);
 useEffect(()=>{
  function receive(event){
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow||event.data?.channel!==CHANNEL)return;
   if(event.data.type==='ready'){setReady(true);setError('');}
   if(event.data.type==='rendered')setRendered(true);
   if(event.data.type==='error'){setError('Oracle Graph Explorer could not render these money flows. Choose another graph view or retry.');setRendered(false);}
   if(event.data.type==='select'){
    const account=converted.accountByGraphId?.get(event.data.id);
    if(account){setSelectedAccount(event.data.id);accountSelect.current?.(account);}
   }
   if(event.data.type==='select-edge'){
    const pair=converted.pairByGraphId?.get(event.data.id);
    if(pair){setSelectedPair(event.data.id);pairSelect.current?.(pair);}
   }
  }
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
 },[converted]);
 useEffect(()=>{if(!ready||converted.error)return;setRendered(false);setError('');send({type:'render',data:converted.data,layout});},[ready,converted,layout,revision]);
 useEffect(()=>{if(ready)return;const timer=setTimeout(()=>setError('Oracle Graph Explorer did not load. Retry or choose another graph view.'),15000);return()=>clearTimeout(timer);},[ready,frameRevision]);
 function retry(){setError('');setReady(false);setRendered(false);setFrameRevision(v=>v+1);}
 return <section className="oracle-case cdr-money-oracle" aria-label="Oracle Graph Explorer for Money Flows" data-ready={rendered&&!error} data-layout={layout}>
  <div className="oracle-case__toolbar"><div><strong>Oracle Graph Explorer</strong><small>Oracle Graph Visualization {VERSION} · selected batch and currency</small></div><label>Oracle layout<select aria-label="Oracle money graph layout" value={layout} onChange={e=>{setRendered(false);setLayout(e.target.value);}}><option value="hierarchical">Hierarchical</option><option value="force">Force-directed</option><option value="radial">Radial</option></select></label><button onClick={()=>{setRendered(false);setRevision(v=>v+1);}} disabled={!ready}>Reset exploration</button></div>
  <p className="oracle-case__notice">The same filtered accounts and directed payment pairs are rendered with Oracle’s library. Drag or zoom to explore. Double-click an account or select a payment line to inspect its original records below. Grouping and hiding affect only this view.</p>
  <p className="oracle-case__counts">{converted.data?.vertices.length||0} accounts / parties · {converted.data?.edges.length||0} directed pairs · {summary.currency} · source: this batch’s scoped Oracle property graph</p>
  {(error||converted.error)&&<p className="oracle-case__warning" role="alert">{error||converted.error} {!converted.error&&<button onClick={retry}>Retry Oracle view</button>}</p>}
  {!error&&!converted.error&&!rendered&&<p role="status" className="oracle-case__status">Loading Oracle graph…</p>}
  {!converted.error&&<iframe key={frameRevision} ref={frame} src="/oracle-graph/explorer.html" title="Oracle Money Flows graph canvas" className="oracle-case__frame" referrerPolicy="same-origin" sandbox="allow-scripts allow-same-origin" onLoad={()=>send({type:'hello'})}/>}
  <details className="oracle-case__accessible"><summary>Accessible account and payment pair lists</summary><p>Use these lists to inspect the same source records without the graph canvas.</p><label>Account / party<select aria-label="Oracle money account" value={selectedAccount} onChange={e=>setSelectedAccount(e.target.value)}><option value="">Choose an account…</option>{accounts.map(a=><option key={a.id} value={`account:${a.id}`}>{a.labels.join(' / ')||a.id} · {a.id}</option>)}</select></label><button disabled={!selectedAccount} onClick={()=>{const account=converted.accountByGraphId?.get(selectedAccount);if(account)accountSelect.current?.(account);}}>Inspect account</button><label>Payment pair<select aria-label="Oracle money payment pair" value={selectedPair} onChange={e=>setSelectedPair(e.target.value)}><option value="">Choose a payment pair…</option>{summary.pairs.map(pair=><option key={pair.id} value={`pair:${pair.id}`}>{pair.from} → {pair.to} · {summary.currency} {pair.amount}</option>)}</select></label><button disabled={!selectedPair} onClick={()=>{const pair=converted.pairByGraphId?.get(selectedPair);if(pair)pairSelect.current?.(pair);}}>Inspect payments</button></details>
 </section>;
}
