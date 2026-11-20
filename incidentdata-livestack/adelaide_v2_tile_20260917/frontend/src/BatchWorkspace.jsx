import React,{useEffect,useState} from 'react';
import './batch-workspace.css';
const date=v=>v?new Date(v).toLocaleString():'—';
const labels={declared_cast:'Declared synthetic cast',literal_reference:'Literal source reference',description_similarity:'Description similarity',scene_similarity:'Whole-scene similarity'};

function Graph({graph,onSource}){
  const [kind,setKind]=useState('all'),[focus,setFocus]=useState('');
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  const edges=graph.edges.filter(e=>(kind==='all'||e.kind===kind)&&(!focus||e.source===focus||e.target===focus));
  const included=new Set(edges.flatMap(e=>[e.source,e.target]));
  const nodes=graph.nodes.filter(n=>included.has(n.id)),shown=nodes.slice(0,36),positions=new Map(shown.map((n,i)=>[n.id,{x:450+335*Math.cos(2*Math.PI*i/shown.length),y:245+185*Math.sin(2*Math.PI*i/shown.length)}]));
  return <div className="cdr-graph">
    <div className="cdr-workspace-controls"><label>Link type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All connections</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Focus<select value={focus} onChange={e=>setFocus(e.target.value)}><option value="">All nodes</option>{graph.nodes.map(n=><option value={n.id} key={n.id}>{n.label}</option>)}</select></label></div>
    {shown.length>0?<svg viewBox="0 0 900 490" role="img" aria-label="Batch source connection graph" className="cdr-graph-canvas">
      {edges.map((e,i)=>{const a=positions.get(e.source),b=positions.get(e.target);return a&&b?<line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`cdr-edge-${e.kind}`}><title>{labels[e.kind]}{e.score!==undefined?` · ${e.score}`:''}</title></line>:null;})}
      {shown.map(n=>{const p=positions.get(n.id);return <g key={n.id} transform={`translate(${p.x} ${p.y})`}><circle r={n.kind==='item'?10:7} className={`cdr-node-${n.kind}`}/><text y={-16} textAnchor="middle">{n.label.length>31?n.label.slice(0,28)+'…':n.label}</text><title>{n.label}</title></g>;})}
    </svg>:<p>No connections of this type were found in the analysed material.</p>}
    {nodes.length>36&&<p className="cdr-small">Diagram shows 36 of {nodes.length} nodes. Use Focus to inspect smaller groups; all links remain in the table and export.</p>}
    <p className="cdr-small">{edges.length} links · {graph.coverage.items} items · {graph.coverage.originalTextTruncated} original text files limited to 24,000 characters. Green: declared cast; blue: literal references; dashed: similarity.</p>
    <div className="cdr-table-scroll"><table className="cdr-table"><thead><tr><th>From</th><th>To</th><th>Support</th><th>Sources</th></tr></thead><tbody>{edges.map((e,i)=><tr key={i}><td>{byId.get(e.source)?.label||e.source}</td><td>{byId.get(e.target)?.label||e.target}</td><td>{labels[e.kind]}{e.score!==undefined&&` · cosine ${e.score.toFixed(3)}`}<small className="cdr-source">{e.basis}</small></td><td>{e.sourceRefs.map(ref=><button key={ref} onClick={()=>onSource(ref)}>{ref}</button>)}</td></tr>)}</tbody></table></div>
  </div>;
}

export function BatchConnections({batchId,api,ready,readOnly,onOpenSource,download,onStagesChanged,items,user}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[working,setWorking]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!batchId)return;let active=true,timer;const controller=new AbortController();
    const poll=async()=>{try{const result=await api(`/batches/${batchId}/workspace`,{signal:controller.signal});if(!active)return;setData(result);if(['queued','running'].includes(result.run?.status))timer=setTimeout(poll,2500);else onStagesChanged();}catch(e){if(active)setError(e.message);}};
    void poll();return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[batchId,api,revision,onStagesChanged]);
  const busy=['queued','running'].includes(data?.run?.status),result=data?.result;
  const source=ref=>{const s=result?.manifest.find(s=>s.ref===ref);if(s)onOpenSource({item_id:s.itemId,descriptionRunId:s.descriptionRunId});};
  async function run(kind){setError('');setWorking(true);try{await api(`/batches/${batchId}/${kind}`,{method:'POST'});setRevision(v=>v+1);}catch(e){setError(e.message);}finally{setWorking(false);}}
  return <div className="cdr-workspace">
    <div className="cdr-learning-heading"><div><span className="cdr-ai-label">STAGE 6 · UNDERSTAND CONNECTIONS</span><h3>Connections &amp; Person / Photo Graph</h3><p>Compare source references, saved descriptions and whole-photo vectors, then run an ADB agent review.</p></div><button className="cdr-primary" disabled={!ready||readOnly||working||busy||data?.isCurrent} onClick={()=>run('connections')}>{busy?'Analysing…':data?.isCurrent?'Connections saved':data?.run?.status==='failed'?'Retry connections':'Run connections'}</button></div>
    <p className="cdr-small">Photo-to-person links use the declared cast of packaged synthetic scenes, verified by file checksum. Other photos can be compared by scene similarity; people are not identified from appearance.</p>
    {data?.run&&<p role="status">Latest run: {data.run.status} · {date(data.run.created_at)}{data.run.error_text&&<span className="cdr-failure"> · {data.run.error_text}</span>}</p>}
    {error&&<p role="alert" className="cdr-failure">{error}</p>}
    {result&&<><p className="cdr-ai-label">AI DRAFT · SOURCE LINKS REQUIRE REVIEW</p>{!data.isCurrent&&<p className="cdr-failure">This saved graph uses older source descriptions. Run connections again for the current batch.</p>}<Graph graph={result.graph} onSource={source}/><h4>ADB agent review</h4><p className="cdr-agent-answer">{result.answer}</p><details><summary>Agent execution · {result.toolEvents.length} recorded tool calls</summary><p>Team: {result.team} · Select AI profile: {result.profile}</p>{result.toolEvents.map((e,i)=><p key={i}>{e.tool_name} · {date(e.created_at)}</p>)}<p>Native conversation: {result.nativeConversationId}</p></details></>}
    <div className="cdr-products"><span className="cdr-ai-label">STAGE 7 · CREATE DATA PRODUCTS</span><h3>Saved review pack</h3><p>Create a versioned pack containing the graph, source manifest, dated references, Batch Brief and agent review.</p><button className="cdr-primary" disabled={!data?.isCurrent||readOnly||working||busy} onClick={()=>run('products')}>Create / reopen data products</button>
      {data?.products.map(p=><div key={p.product_id} className="cdr-product-row"><span>{date(p.created_at)} · {p.created_by}{p.connection_run_id!==data.completedRun?.run_id?' · Previous graph version':''}</span>{['review.json','manifest.csv','connections.csv','timeline.csv'].map(f=><button key={f} onClick={()=>download(`/batches/${batchId}/products/${p.product_id}/${f}`,f)}>{f}</button>)}</div>)}
    </div>
  </div>;
}

export function BatchChat({batchId,api,ready,readOnly,onOpenSource,onBatchRemoved}){
  const [threads,setThreads]=useState([]),[selected,setSelected]=useState(''),[turns,setTurns]=useState([]),[question,setQuestion]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{if(!batchId)return;let active=true;api(`/batches/${batchId}/conversations`).then(r=>{if(active){setThreads(r.threads);setSelected(s=>s||r.threads[0]?.thread_id||'');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[batchId,api,revision]);
  useEffect(()=>{
    setTurns([]);if(!selected)return;let active=true,timer;const controller=new AbortController();
    const poll=async()=>{try{const r=await api(`/batches/${batchId}/conversations/${selected}`,{signal:controller.signal});if(!active)return;setTurns(r.turns);if(r.turns.some(t=>['queued','running'].includes(t.status)))timer=setTimeout(poll,2000);}catch(e){if(active)setError(e.message);}};
    void poll();return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[batchId,selected,api,revision]);
  async function newChat(){setError('');setWorking(true);try{const r=await api(`/batches/${batchId}/conversations`,{method:'POST',body:JSON.stringify({title:'Batch discussion · '+new Date().toLocaleString()})});setSelected(r.threadId);setRevision(v=>v+1);}catch(e){setError(e.message);}finally{setWorking(false);}}
  const removeMatch=value=>value.trim().match(/^REMOVE\s+BATCH\s+`?(DR-[A-Za-z0-9-]+)`?$/i);
  async function send(e){e.preventDefault();const text=question.trim(),remove=removeMatch(text);setWorking(true);setError('');try{
    if(remove){await api(`/batches/${encodeURIComponent(remove[1])}`, { method:'DELETE', body:JSON.stringify({ confirmation:remove[1] }) });setQuestion('');await onBatchRemoved?.(remove[1]);return;}
    if(!ready)throw new Error('Complete the Batch Brief before asking conversational questions. Management commands remain available.');
    let tid=selected;if(!tid){const r=await api(`/batches/${batchId}/conversations`,{method:'POST',body:JSON.stringify({title:question.slice(0,90)})});tid=r.threadId;setSelected(tid);}await api(`/batches/${batchId}/conversations/${tid}/messages`,{method:'POST',body:JSON.stringify({question:text})});setQuestion('');setRevision(v=>v+1);
  }catch(e){setError(e.message);}finally{setWorking(false);}}
  const busy=turns.some(t=>['queued','running'].includes(t.status));
  const managementCommand=!!removeMatch(question);
  return <div className="cdr-chat">
    <p>Ask about this batch’s saved descriptions and brief. Conversations are stored in ADB and can be reopened by the same demo user. Replies use Select AI Chat with the previous five completed turns. For demo cleanup, <code>REMOVE BATCH `DR-…`</code> removes that Data Room batch immediately.</p>
    <div className="cdr-workspace-controls"><label>Conversation history<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">New conversation</option>{threads.map(t=><option value={t.thread_id} key={t.thread_id}>{t.title}</option>)}</select></label><button disabled={!batchId||readOnly||working||busy} onClick={newChat}>New conversation</button></div>
    {error&&<p className="cdr-failure" role="alert">{error}</p>}
    <div className="cdr-chat-history" role="log" aria-label="Batch conversation">{!turns.length&&<p className="cdr-empty">Ask “What does this batch contain?” or “Which files mention invoice 104?”</p>}{turns.map(t=><article className="cdr-chat-turn" key={t.run_id}><p className="cdr-chat-question"><strong>You</strong> · {date(t.created_at)}<br/>{t.question}</p>{t.result?<><p className="cdr-agent-answer"><strong>Batch Assistant · AI draft</strong><br/>{t.result.answer}</p><div className="cdr-brief-citations">{t.result.manifest.filter(s=>new RegExp(`\\b${s.ref}\\b`).test(t.result.answer)).map(s=><button key={s.ref} onClick={()=>onOpenSource({item_id:s.itemId,descriptionRunId:s.descriptionRunId})}>{s.ref} · {s.path}</button>)}</div><small>Select AI · {t.result.profile} · {t.result.nativeConversationId}</small></>:<p role="status" className={t.status==='failed'?'cdr-failure':''}>{t.status==='failed'?t.error_text:t.status==='queued'?'Reply queued…':'Select AI is preparing a reply…'}</p>}</article>)}</div>
    <form onSubmit={send}><label>Question<textarea value={question} onChange={e=>setQuestion(e.target.value)} maxLength={4000} disabled={!batchId||readOnly||working||busy} placeholder={ready?'Ask about the selected batch, or enter REMOVE BATCH `DR-…`…':'Enter REMOVE BATCH `DR-…` to remove a load, or complete the Batch Brief to chat.'}/></label><button className="cdr-primary" disabled={!batchId||readOnly||working||busy||!question.trim()||(!ready&&!managementCommand)}>{working||busy?'Working…':'Send'}</button></form>
  </div>;
}
