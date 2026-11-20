import React,{useEffect,useId,useMemo,useRef,useState} from 'react';
import './batch-money-flows.css';
import BatchMoneyAgent from './BatchMoneyAgent';

const money=value=>{const [whole,part='00']=String(value).split('.');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+part;};
const shortMoney=value=>money(value).replace(/\.00$/,'');
const params=values=>new URLSearchParams(Object.entries(values).filter(([,v])=>v!==''&&v!=null)).toString();
function wrap(text,width=26){
 const lines=[];let line='';for(const word of text.split(/\s+/)){if((line+' '+word).trim().length>width&&line){lines.push(line);line='';}line+=(line?' ':'')+word;}if(line)lines.push(line);return lines.slice(0,3).map(l=>l.length>30?l.slice(0,29)+'…':l);
}
function placement(accounts,summary){
 const ids=accounts.map(a=>a.id),out=new Map(ids.map(id=>[id,[]])),incoming=new Map(ids.map(id=>[id,0])),levels=new Map(ids.map(id=>[id,0]));
 for(const e of summary.pairs){out.get(e.from).push(e.to);incoming.set(e.to,incoming.get(e.to)+1);}
 const queue=ids.filter(id=>incoming.get(id)===0);let count=0;
 while(queue.length){const id=queue.shift();count++;for(const to of out.get(id)){levels.set(to,Math.max(levels.get(to),levels.get(id)+1));incoming.set(to,incoming.get(to)-1);if(incoming.get(to)===0)queue.push(to);}}
 const cyclic=count!==ids.length;
 if(cyclic){const width=1100,height=Math.max(620,ids.length*48),positions=new Map();ids.forEach((id,i)=>{const angle=(i/ids.length)*Math.PI*2-Math.PI/2;positions.set(id,{x:width/2+Math.cos(angle)*385,y:height/2+Math.sin(angle)*(height/2-90)});});return {width,height,positions,cyclic};}
 const maxLevel=Math.max(0,...levels.values()),columns=Array.from({length:maxLevel+1},()=>[]);
 for(const a of accounts)columns[levels.get(a.id)].push(a.id);
 const height=Math.max(360,...columns.map(c=>c.length*130+70)),width=Math.max(750,(maxLevel+1)*300),positions=new Map();
 columns.forEach((column,i)=>column.forEach((id,j)=>positions.set(id,{x:150+i*300,y:height/2+(j-(column.length-1)/2)*130})));
 return {width,height,positions,cyclic};
}
function MoneyGraph({accounts,summary,selection,setSelection,highlightIds,pattern,search}){
 const marker=useId().replace(/:/g,''),layout=useMemo(()=>placement(accounts,summary),[accounts,summary]);
 const matches=new Set(accounts.filter(a=>`${a.id} ${a.labels.join(' ')}`.toLowerCase().includes(search.toLowerCase())).map(a=>a.id));
 const patternNodes=new Set(summary[pattern]||[]),pairOn=e=>highlightIds.size?e.transferIds.some(id=>highlightIds.has(id)):selection?.kind==='pair'?selection.id===e.id:selection?.kind==='account'?e.from===selection.id||e.to===selection.id:pattern==='repeatedPairs'?e.transferIds.length>1:patternNodes.size?patternNodes.has(e.from)||patternNodes.has(e.to):true;
 const activate=(event,action)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action();}};
 return <div className="cdr-money-canvas" tabIndex="0" aria-label="Money-flow graph. Scroll to explore; accounts and arrows are keyboard selectable.">
  <svg viewBox={`0 0 ${layout.width} ${layout.height}`} style={{minWidth:accounts.length>16?layout.width:Math.min(layout.width,900)}} role="group" aria-label="Directed account transfer graph">
   <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>
   {summary.pairs.map(e=>{
    const a=layout.positions.get(e.from),b=layout.positions.get(e.to),self=e.from===e.to;
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,offset=self?0:Math.min(112/Math.max(Math.abs(dx),.001),49/Math.max(Math.abs(dy),.001));
    const start=layout.cyclic?{x:a.x+dx*offset,y:a.y+dy*offset}:{x:a.x+108,y:a.y},end=layout.cyclic?{x:b.x-dx*offset,y:b.y-dy*offset}:{x:b.x-110,y:b.y};
    const bend={x:(a.x+b.x)/2-dy/length*45,y:(a.y+b.y)/2+dx/length*45};
    const d=self?`M ${a.x+50} ${a.y-42} C ${a.x+135} ${a.y-145} ${a.x-135} ${a.y-145} ${a.x-50} ${a.y-42}`:layout.cyclic?`M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}`:`M ${start.x} ${start.y} C ${start.x+62} ${start.y} ${end.x-62} ${end.y} ${end.x} ${end.y}`;
    const lx=self?a.x:layout.cyclic?bend.x:(start.x+end.x)/2,ly=self?a.y-118:layout.cyclic?bend.y-5:(start.y+end.y)/2-9,on=pairOn(e)&&(!search||matches.has(e.from)||matches.has(e.to));
    return <g key={e.id} role="button" tabIndex="0" className={`cdr-money-edge ${on?'':'is-dim'} ${selection?.id===e.id?'is-selected':''}`} aria-label={`Transfers ${e.from} to ${e.to}: ${summary.currency} ${money(e.amount)}, ${e.transferIds.length} source records`} onClick={()=>setSelection({kind:'pair',id:e.id})} onKeyDown={event=>activate(event,()=>setSelection({kind:'pair',id:e.id}))}>
     <title>{e.from} → {e.to}: {summary.currency} {money(e.amount)} · {e.transferIds.length} transfer(s)</title>
     <path d={d} className="cdr-money-edge-hit"/><path d={d} className="cdr-money-edge-line" markerEnd={`url(#${marker})`}/>
     <text x={lx} y={ly} textAnchor="middle">{shortMoney(e.amount)}{e.transferIds.length>1?` (${e.transferIds.length})`:''}</text>
    </g>;
   })}
   {accounts.map(a=>{
    const p=layout.positions.get(a.id),isRoot=summary.roots.includes(a.id),isSink=summary.sinks.includes(a.id),lines=wrap(a.labels.join(' / '));
    return <g key={a.id} transform={`translate(${p.x},${p.y})`} role="button" tabIndex="0" className={`cdr-money-node ${isRoot?'is-root':isSink?'is-sink':''} ${selection?.id===a.id?'is-selected':''} ${search&&!matches.has(a.id)?'is-dim':''} ${patternNodes.has(a.id)?'is-pattern':''}`} aria-label={`${a.labels.join(' / ')}, account ${a.id}`} onClick={()=>setSelection({kind:'account',id:a.id})} onKeyDown={event=>activate(event,()=>setSelection({kind:'account',id:a.id}))}>
     <title>{a.labels.join(' / ')} · {a.id}</title><rect x="-108" y="-45" width="216" height="90" rx="10"/>
     {lines.map((line,i)=><text className="cdr-money-name" key={i} x="0" y={-24+i*15} textAnchor="middle">{line}</text>)}
     <text className="cdr-money-account-ref" x="0" y="31" textAnchor="middle">{a.id.length>27?a.id.slice(0,26)+'…':a.id}</text>
    </g>;
   })}
  </svg>
 </div>;
}
export default function BatchMoneyFlows({batchId,api,ready,readOnly,onOpenSource,download,onStatusChange}){
 const [data,setData]=useState(null),[loading,setLoading]=useState(false),[building,setBuilding]=useState(false),[error,setError]=useState('');
 const [currency,setCurrency]=useState(''),[dateFrom,setDateFrom]=useState(''),[dateTo,setDateTo]=useState(''),[search,setSearch]=useState(''),[pattern,setPattern]=useState('all');
 const [selection,setSelection]=useState(null),[record,setRecord]=useState(null),[page,setPage]=useState(0),[revision,setRevision]=useState(0);
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[maxHops,setMaxHops]=useState('4'),[routes,setRoutes]=useState(null),[routeId,setRouteId]=useState(''),[routeBusy,setRouteBusy]=useState(false),[routeError,setRouteError]=useState('');
 const alive=useRef(true),routeRequest=useRef(0),root=useRef();
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;routeRequest.current++;};},[]);
 useEffect(()=>{
  if(!batchId)return;const controller=new AbortController();let stopped=false;setLoading(true);setError('');setSelection(null);setRecord(null);setPage(0);
  api(`/batches/${batchId}/money-flows?${params({currency,dateFrom,dateTo})}`,{signal:controller.signal}).then(result=>{if(!stopped){setData(result);if(!currency&&result.currencies?.length)setCurrency(result.currencies[0]);}}).catch(e=>{if(!stopped)setError(e.message);}).finally(()=>{if(!stopped)setLoading(false);});
  return()=>{stopped=true;controller.abort();};
 },[api,batchId,currency,dateFrom,dateTo,revision]);
 const summary=data?.summary?.[0],accounts=data?.accounts||[];
 useEffect(()=>{setFrom(summary?.roots?.[0]||'');setTo(summary?.sinks?.[0]||'');},[data?.run?.id,currency,dateFrom,dateTo,summary?.roots?.join('|'),summary?.sinks?.join('|')]);
 useEffect(()=>{routeRequest.current++;setRoutes(null);setRouteId('');setRouteError('');setRouteBusy(false);},[from,to,maxHops,currency,dateFrom,dateTo,data?.run?.id]);
 const chosenRoute=routes?.routes.find(r=>r.id===routeId),highlightIds=new Set(chosenRoute?.transferIds||[]);
 const pairs=summary?.pairs||[],chosenPair=selection?.kind==='pair'?pairs.find(p=>p.id===selection.id):null,chosenAccount=selection?.kind==='account'?accounts.find(a=>a.id===selection.id):null;
 const labels=new Map(accounts.map(a=>[a.id,a.labels.join(' / ')]));
 const shown=(data?.transfers||[]).filter(t=>(!selection||(chosenPair?chosenPair.transferIds.includes(t.id):chosenAccount?[t.from,t.to].includes(chosenAccount.id):true))&&(!chosenRoute||highlightIds.has(t.id))&&(!search||`${t.from} ${t.to} ${t.fromLabel} ${t.toLabel} ${t.transactionId||''} ${t.description}`.toLowerCase().includes(search.toLowerCase())));
 const pages=Math.max(1,Math.ceil(shown.length/20)),safePage=Math.min(page,pages-1),inspected=record?data?.transfers.find(t=>t.id===record):null;
 async function build(){setBuilding(true);setError('');try{await api(`/batches/${batchId}/money-flows`,{method:'POST'});if(alive.current)setRevision(v=>v+1);}catch(e){if(alive.current)setError(e.message);}finally{if(alive.current){setBuilding(false);onStatusChange?.();}}}
 async function findRoutes(){const request=++routeRequest.current;setRouteBusy(true);setRouteError('');setRouteId('');setSelection(null);try{const value=await api(`/batches/${batchId}/money-flows/routes?${params({runId:data.run.id,currency,dateFrom,dateTo,from,to,maxHops})}`);if(alive.current&&request===routeRequest.current)setRoutes(value);}catch(e){if(alive.current&&request===routeRequest.current)setRouteError(e.message);}finally{if(alive.current&&request===routeRequest.current)setRouteBusy(false);}}
 function select(value){setSelection(value);setPage(0);setRecord(null);}
 if(!batchId)return null;
 return <section ref={root} className="cdr-money" aria-label="Money flows">
  <div className="cdr-money-heading"><div><span className="cdr-ai-label">BATCH EVIDENCE · MONEY FLOWS</span><h3>Follow the money</h3><p>Account-to-account transfers, source records and directed routes from this batch’s CSV files.</p></div><button className="cdr-primary" onClick={build} disabled={!ready||readOnly||building||loading}>{building?'Building money flows…':data?.run?'Verify / rebuild money flows':'Build money flows'}</button></div>
  {error&&<p role="alert" className="cdr-failure">{error}</p>}
  {loading&&<p role="status">Loading money flows…</p>}
  {!loading&&!data?.run&&!error&&<p className="cdr-small">{ready?'Build this view once the transaction CSV is loaded. No AI description or connection review is required.':'Available after batch ingestion completes.'} Supports up to 500 transfers and 100 accounts per batch.</p>}
  {data?.run&&<>
   {data.stale&&<p className="cdr-ai-warning">Sources have changed since this snapshot. Rebuild money flows before using these results.</p>}
   <div className="cdr-money-filters"><label>Currency<select aria-label="Money flow currency" value={currency} onChange={e=>setCurrency(e.target.value)}>{data.currencies.map(c=><option key={c} value={c}>{c==='UNKNOWN'?'Not recorded':c}</option>)}</select></label><label>From date<input aria-label="Money flow from date" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label><label>To date<input aria-label="Money flow to date" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label><label className="cdr-money-search">Find account / party / transaction<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="e.g. Hartley or SYN-AUD-008"/></label><button onClick={()=>{setDateFrom('');setDateTo('');setSearch('');setPattern('all');select(null);setRouteId('');}}>Clear filters</button></div>
   {loading||error?null:!summary?<p>No transfers in the selected date/currency window.</p>:<>
    <div className="cdr-money-stats"><div><strong>{summary.accountCount} accounts · {summary.transferCount} transfers</strong><span>{summary.pairCount} directed account pairs</span></div><div><strong>{summary.currency==='UNKNOWN'?'Unknown currency':summary.currency} {money(summary.rootOutflow)}</strong><span>Outflow from accounts with no observed incoming transfers</span></div><div><strong>{money(summary.sinkInflow)}</strong><span>Inflow to accounts with no observed outgoing transfers</span></div><div><strong>{money(summary.grossVolume)}</strong><span>Gross transfer volume · includes onward movement</span></div></div>
    <div className="cdr-money-patterns"><label>Highlight pattern<select value={pattern} onChange={e=>{setPattern(e.target.value);select(null);setRouteId('');}}><option value="all">All transfers</option><option value="split">Split payments ({summary.split.length} accounts)</option><option value="convergence">Converging payments ({summary.convergence.length} accounts)</option><option value="onward">Onward transfers ({summary.onward.length} accounts)</option><option value="repeatedPairs">Repeated pairs ({summary.repeatedPairs})</option></select></label><span>{summary.split.length} split · {summary.convergence.length} convergence · {summary.equalIntermediates.length} equal-in/out intermediaries · Circular topology: {summary.hasCycle?'present':'none'}</span></div>
    <p className="cdr-small">{({split:'Split: an account pays two or more distinct recipient accounts.',convergence:'Convergence: an account receives from two or more distinct sender accounts.',onward:'Onward: an account has both incoming and outgoing transfers in the selected window.',repeatedPairs:'Repeated pair: two or more source records share the same sender, receiver and currency.',all:'Arrows run from sender to receiver. Amount labels aggregate transfers for each account pair; click an arrow or account to inspect the records.'})[pattern]} Window: {summary.dateFrom} to {summary.dateTo}. Graph and totals use the date/currency filters; text search highlights matches and narrows the table only.</p>
    {currency==='UNKNOWN'&&<p className="cdr-ai-warning">Currency is not recorded. These amounts are grouped as unknown, not converted to AUD; currency continuity cannot be checked.</p>}
    <MoneyGraph accounts={accounts} summary={summary} selection={selection} setSelection={select} highlightIds={highlightIds} pattern={pattern} search={search}/>
    <div className="cdr-money-route"><h4>Trace a route</h4><div className="cdr-money-filters"><label>Start account<select aria-label="Route start account" value={from} onChange={e=>setFrom(e.target.value)}><option value="">Choose account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.labels[0]} · {a.id}</option>)}</select></label><label>End account<select aria-label="Route end account" value={to} onChange={e=>setTo(e.target.value)}><option value="">Choose account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.labels[0]} · {a.id}</option>)}</select></label><label>Maximum hops<select aria-label="Maximum route hops" value={maxHops} onChange={e=>setMaxHops(e.target.value)}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label><button onClick={findRoutes} disabled={!from||!to||from===to||routeBusy||data.stale}>{routeBusy?'Tracing…':'Find routes'}</button></div>
     {routeError&&<p role="alert" className="cdr-failure">{routeError}</p>}
     {routes&&<><p role="status">{routes.truncated?'At least ':''}{routes.routes.length} routes found · up to {routes.maxHops} hops{routes.truncated?' · result limit reached; narrow the date window':''}.</p><div className="cdr-money-route-list">{routes.routes.map((r,i)=><button key={r.id} aria-pressed={r.id===routeId} onClick={()=>{setRouteId(r.id===routeId?'':r.id);select(null);}}>Route {i+1} · {r.hops} hops</button>)}{routeId&&<button onClick={()=>setRouteId('')}>Clear route</button>}</div></>}
     {chosenRoute&&<ol className="cdr-money-route-steps">{chosenRoute.transferIds.map(id=>{const t=data.transfers.find(t=>t.id===id);return <li key={id}><button onClick={()=>setRecord(id)}>{t.fromLabel} → {t.toLabel}</button><span>{t.date} · {money(t.amount)} {t.currency} · {t.transactionId||`record ${t.source.record}`}</span></li>;})}</ol>}
     <p className="cdr-small">Oracle finds simple directed routes, up to 4 hops and 100 results, with non-decreasing calendar dates. Same-day ordering is unknown. Shared transfers can appear in several routes; route amounts must not be added together as separate funds.</p>
    </div>
    <BatchMoneyAgent key={data.run.id} batchId={batchId} api={api} selection={{runId:data.run.id,currency,dateFrom,dateTo,from,to,maxHops}} readOnly={readOnly} stale={data.stale} onShowRoute={(value,id)=>{setRoutes(value);setRouteId(id);select(null);requestAnimationFrame(()=>root.current?.querySelector('.cdr-money-canvas')?.scrollIntoView({behavior:'smooth',block:'start'}));}} onInspect={id=>{setRecord(id);requestAnimationFrame(()=>root.current?.querySelector('.cdr-money-source')?.scrollIntoView({behavior:'smooth',block:'center'}));}}/>
    <div className="cdr-money-ledger"><h4>{chosenAccount?`${chosenAccount.labels.join(' / ')} · ${chosenAccount.id}`:chosenPair?`${labels.get(chosenPair.from)} → ${labels.get(chosenPair.to)}`:'Source transactions'}</h4>
     {chosenAccount&&<p className="cdr-small">Recorded inflow {money(summary.accounts.find(a=>a.id===chosenAccount.id).inflow)} · outflow {money(summary.accounts.find(a=>a.id===chosenAccount.id).outflow)} {currency}. These are movements in this file/window, not the account balance.</p>}
     {selection&&<button onClick={()=>select(null)}>Show all accounts / transfers</button>}
     <p className="cdr-small">Showing {shown.length} of {data.transfers.length} transfers in this date/currency window ({data.totalTransferCount} in the snapshot). Every original record is retained, including repeated rows.</p>
     <div className="cdr-table-scroll"><table className="cdr-table"><thead><tr><th>Date / transaction</th><th>From</th><th>To</th><th>Amount · {currency}</th><th>Source</th></tr></thead><tbody>{shown.slice(safePage*20,(safePage+1)*20).map(t=><tr key={t.id}><td>{t.date}<small>{t.transactionId||'No source transaction ID'}</small></td><td>{t.fromLabel}<small>{t.from}</small></td><td>{t.toLabel}<small>{t.to}</small></td><td className="cdr-nowrap">{money(t.amount)}</td><td><button onClick={()=>setRecord(t.id)}>Record {t.source.record}</button><small>{t.source.path}</small></td></tr>)}</tbody></table></div>
     {pages>1&&<div className="cdr-money-pagination"><button disabled={safePage===0} onClick={()=>setPage(safePage-1)}>Previous records</button><span>Page {safePage+1} of {pages}</span><button disabled={safePage===pages-1} onClick={()=>setPage(safePage+1)}>Next records</button></div>}
     {inspected&&<div className="cdr-money-source" role="region" aria-label="Original transaction record"><div className="cdr-money-heading"><h4>Original transaction record {inspected.source.record}</h4><button onClick={()=>setRecord(null)}>Close record</button></div><p>{inspected.source.path} · Data-record ordinal excludes the header and blank records; quoted multiline values count as one record.</p><dl>{Object.entries(inspected.raw).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'—'}</dd></div>)}</dl><p className="cdr-small">Source SHA-256: <code>{inspected.source.sha256}</code></p><div className="cdr-money-route-list"><button onClick={()=>onOpenSource({item_id:inspected.source.itemId})}>Open source file details</button><button onClick={()=>download(`/batches/${batchId}/items/${inspected.source.itemId}/download`,inspected.source.path.split('/').pop())}>Download original CSV</button></div></div>}
    </div>
   </>}
   <details className="cdr-money-provenance"><summary>Coverage, method and snapshot</summary><p>{data.engine}. Exact decimal amounts are stored as Oracle NUMBER; summaries use integer arithmetic. Party labels are source assertions, not verified account ownership or POI links.</p><p>Patterns support review, not a calibrated laundering likelihood. Equal intermediary inflow/outflow does not establish continuity of the same funds. Source STAGE/FLAG columns are preserved but are not detection results.</p><p>Snapshot {data.run.id} · {new Date(data.run.createdAt).toLocaleString()} · {data.run.version}</p>{data.sources.map(s=><p key={s.itemId}>{s.path}: {s.records} records · SHA-256 <code>{s.sha256}</code></p>)}{data.skipped.map(s=><p key={s.itemId}>Not imported: {s.path} — {s.reason}</p>)}<p>Only supported transaction CSVs are included. No image, narrative or message-derived transactions are inferred. Limits: 2 MiB per CSV, {data.limits.transfers} transfers, {data.limits.accounts} accounts; oversized or malformed imports fail without saving partial results.</p></details>
  </>}
 </section>;
}
