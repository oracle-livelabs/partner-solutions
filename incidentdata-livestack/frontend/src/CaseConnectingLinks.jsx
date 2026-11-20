import React, {useEffect, useRef, useState} from 'react';
import './case-connecting-links.css';

const layers = [
  {id:'original', title:'Original network', description:'Your original 2-hop view: the case, incidents, people and evidence.'},
  {id:'similarity', title:'Add similarity links', description:'Adds recorded incident comparisons, keeping the case, people and evidence visible.'},
  {id:'connections', title:'Highlight connecting groups', description:'Focuses on incidents. Orange links join groups; case, people and evidence are temporarily hidden.'},
];

export default function CaseConnectingLinks({stage, depth, onStage, onDepth, ready, error, threshold, onThreshold, analysis, selectedId, onSelect, children}) {
  const [advanced, setAdvanced] = useState(false);
  const active = stage === 'connections';
  const selected = analysis.connections.find(edge => edge.connectionId === selectedId);
  const explanation = useRef(null);
  useEffect(()=>{if(selected)explanation.current?.scrollIntoView({block:'nearest'});},[selected]);
  const names = new Map(analysis.network.nodes.map(node => [node.id, node.label]));
  const chooseLayer = id => {if(id === 'original')setAdvanced(false);onStage(id);};
  return <section className="case-connections" aria-label="Graph layers" data-layer={stage}>
    <div className="case-connections__toolbar"><strong>Explore in layers</strong>
      <button type="button" className="case-connections__reset" disabled={stage==='original'&&depth===2&&threshold===0.75&&!advanced} onClick={()=>chooseLayer('original')}>Back to original</button></div>
    <nav aria-label="Graph exploration layers"><ol className="case-connections__steps">
      {layers.map((layer,index)=><li key={layer.id}><button type="button" aria-current={stage===layer.id?'step':undefined} aria-pressed={stage===layer.id} onClick={()=>chooseLayer(layer.id)}><span aria-hidden="true">{index+1}</span>{layer.title}</button></li>)}
    </ol></nav>
    <p key={stage+depth} className="case-connections__description">{depth===1?'Case and incidents only (1 hop). Choose Original network to restore the usual 2-hop view.':layers.find(layer=>layer.id===stage).description}</p>
    {!ready&&<p role="status">{error?'This layer could not load. Choose another layer to continue.':'Waiting for authorised graph data…'}</p>}
    {stage!=='original'&&<p className="case-connections__scope">Loaded, authorised records only. Similarity is a comparison lead, not proof.</p>}
    {active && ready && <>
      <p className="case-connections__summary" role="status">{analysis.groups.length} incident groups · {analysis.connections.length} connecting links · {analysis.network.nodes.length} loaded incidents</p>
      {analysis.omittedEdges > 0 && <p>{analysis.omittedEdges} comparison(s) omitted because an endpoint is outside the loaded incidents.</p>}
      {analysis.unscoredEdges > 0 && <p>{analysis.unscoredEdges} comparison(s) have no valid score: shown as context, excluded from grouping and highlighting.</p>}
      {!analysis.network.edges.length ? <p>No incident-similarity links are available in this loaded result.</p> : !analysis.connections.length ? <p>No connecting links at this threshold. Open Advanced controls to adjust it, or go back to original.</p> : <>
        <label className="case-connections__picker">Explain a connecting link<select aria-label="Connecting link explanation" value={selected?.connectionId || ''} onChange={event => onSelect(event.target.value)}>
          <option value="">Select a link, or select an orange edge in the graph…</option>
          {analysis.connections.map(edge => <option key={edge.connectionId} value={edge.connectionId}>{names.get(edge.source)} → {names.get(edge.target)} · {edge.score.toFixed(3)}</option>)}
        </select></label>
        {selected && <article ref={explanation} className="case-connections__explanation" aria-label="Recorded link explanation">
          <h3>{names.get(selected.source)} → {names.get(selected.target)}</h3>
          <p>Group {selected.sourceGroup} ({analysis.groups[selected.sourceGroup - 1].length} incidents) → Group {selected.targetGroup} ({analysis.groups[selected.targetGroup - 1].length} incidents) · recorded similarity {selected.score.toFixed(3)}</p>
          <strong>Recorded comparison reason</strong><p>{selected.reason || 'No comparison reason was supplied for this link.'}</p>
          <small>This is the stored reason, not newly generated evidence. Open an incident node to review its source record.</small>
          <button type="button" className="case-connections__close" onClick={()=>onSelect('')}>Close explanation</button>
        </article>}
      </>}
    </>}
    <details className="case-connections__advanced" open={advanced} onToggle={event=>setAdvanced(event.currentTarget.open)}>
      <summary>Advanced controls</summary>
      <div className="case-graph__depth"><b>Graph depth (hops)</b><div>{[1,2,3].map(hop=><button key={hop} type="button" className={depth===hop?'active':''} aria-pressed={depth===hop} onClick={()=>onDepth(hop)}>{hop} Hop{hop>1?'s':''}</button>)}</div></div>
      <p className="case-connections__scope">1 hop: case and incidents. 2 hops: adds people and evidence. 3 hops: adds recorded incident comparisons. Choosing a depth leaves the connecting-groups focus.</p>
      {active&&<>
        <label className="case-connections__threshold">Group using similarity scores at or above <output>{threshold.toFixed(2)}</output>
          <input type="range" aria-label="Incident grouping threshold" min="0" max="1" step="0.01" value={threshold} onChange={event=>onThreshold(Number(event.target.value))}/>
        </label>
        <p>Groups use scored similarity links at or above this threshold in either direction. Orange links cross groups; grey links provide context. Explanations retain the recorded source → target. Scores are comparison values, not confidence.</p>
        <p className="case-connections__scope">Calculated only from this loaded result—not the complete database graph. Changing the threshold or user scope can change the groups. A connecting link is not necessarily the only path between groups.</p>
      </>}
      {children}
    </details>
  </section>;
}
