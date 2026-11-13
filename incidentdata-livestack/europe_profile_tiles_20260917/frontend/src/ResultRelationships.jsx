import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import './result-relationships.css';

const TYPES = { pattern: 'Patterns', incident: 'Incidents', post: 'Public posts' };
const EDGES = { membership: 'Recorded membership', reviewed: 'Reviewed comparison', similarity: 'Semantic similarity' };
const COLORS = { pattern: '#4f7d7b', incident: '#437c94', post: '#aa643b' };

function Network({ network, onSelect, selected }) {
  const svgRef = useRef(null), groupRef = useRef(null), zoomRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const layout = useMemo(() => {
    const nodes = network.nodes.map(n => ({ ...n }));
    const links = network.edges.map(e => ({ ...e }));
    const simulation = d3.forceSimulation(nodes).stop()
      .force('link', d3.forceLink(links).id(n => n.id).distance(95))
      .force('charge', d3.forceManyBody().strength(-230))
      .force('center', d3.forceCenter(450, 260))
      .force('x', d3.forceX(450).strength(0.04))
      .force('y', d3.forceY(260).strength(0.04))
      .force('collide', d3.forceCollide(42));
    for (let i = 0; i < 180; i++) simulation.tick();
    const xs = d3.extent(nodes, n => n.x), ys = d3.extent(nodes, n => n.y);
    const scale = Math.min(1, 740 / Math.max(1, xs[1] - xs[0]), 410 / Math.max(1, ys[1] - ys[0]));
    const fit = d3.zoomIdentity.translate(450, 260).scale(scale).translate(-(xs[0] + xs[1]) / 2, -(ys[0] + ys[1]) / 2);
    return { nodes, links, fit };
  }, [network]);
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom().extent([[0, 0], [900, 520]]).scaleExtent([0.1, 5])
      .on('zoom', event => { d3.select(groupRef.current).attr('transform', event.transform); setZoomLevel(event.transform.k); });
    zoomRef.current = zoom;
    svg.call(zoom).on('dblclick.zoom', null);
    svg.call(zoom.transform, layout.fit);
    return () => { svg.on('.zoom', null); };
  }, [layout]);
  const zoomBy = factor => d3.select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  const choose = item => onSelect(item);
  const keySelect = (event, item) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(item); } };
  return <div className="result-graph__canvas">
    <div className="result-graph__zoom"><button type="button" onClick={() => zoomBy(1.3)} aria-label="Zoom in">+</button><button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">−</button><button type="button" onClick={() => d3.select(svgRef.current).call(zoomRef.current.transform, layout.fit)}>Fit graph</button></div>
    <svg ref={svgRef} viewBox="0 0 900 520" role="group" aria-label="Result relationships. Select a node or line for details. Pan and zoom, or use the lists below.">
      <g ref={groupRef}>
        {layout.links.map(e => <g key={e.id} role="button" tabIndex={0} aria-label={`${e.label}: ${e.source.label} to ${e.target.label}`} className={`result-graph__edge result-graph__edge--${e.type} ${selected?.id === e.id ? 'is-selected' : ''}`} onClick={() => choose(e)} onKeyDown={event => keySelect(event, e)}>
          <line className="result-graph__edge-hit" x1={e.source.x} y1={e.source.y} x2={e.target.x} y2={e.target.y} />
          <line x1={e.source.x} y1={e.source.y} x2={e.target.x} y2={e.target.y} />
          <title>{e.label}: {e.detail}</title>
        </g>)}
        {layout.nodes.map(n => <g key={n.id} role="button" tabIndex={0} aria-label={`${TYPES[n.type]}: ${n.label}, ${n.matched ? 'in current results' : 'related context'}`} className={`result-graph__node ${n.type === 'pattern' || zoomLevel >= 1 ? 'show-label' : ''} ${selected?.id === n.id ? 'is-selected' : ''}`} transform={`translate(${n.x},${n.y})`} onClick={() => choose(n)} onKeyDown={event => keySelect(event, n)}>
          <circle r={Math.max(n.type === 'pattern' ? 22 : 15, (n.type === 'pattern' ? 12 : 7) / layout.fit.k)} fill={COLORS[n.type]} strokeWidth={(n.matched ? 2.5 : 1) / layout.fit.k} />
          <text className="result-graph__initial" style={{ fontSize: Math.max(11, 8 / layout.fit.k) }} textAnchor="middle" dy=".35em">{n.type === 'pattern' ? 'W' : n.type === 'incident' ? 'I' : 'P'}</text>
          <text className="result-graph__label" style={{ fontSize: Math.max(10, 10 / layout.fit.k) }} textAnchor="middle" y={Math.max(n.type === 'pattern' ? 22 : 15, (n.type === 'pattern' ? 12 : 7) / layout.fit.k) + 13 / layout.fit.k}>{(n.type === 'post' ? n.ref : n.label).slice(0, 23)}</text>
          <title>{n.label}: {n.detail}</title>
        </g>)}
      </g>
    </svg>
    <p>Pan or zoom to explore. Zoom in or select a record to reveal its label. A thick node border marks a current result.</p>
  </div>;
}

export default function ResultRelationships({ user, seeds, onClose, onOpenIncident }) {
  const [network, setNetwork] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null), [nodeTypes, setNodeTypes] = useState(Object.keys(TYPES)), [edgeTypes, setEdgeTypes] = useState(Object.keys(EDGES));
  const [attempt, setAttempt] = useState(0);
  const body = JSON.stringify(seeds);
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setNetwork(null); setSelected(null);
    fetch('/api/patterns/result-relationships', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Demo-User': user }, body, signal: controller.signal })
      .then(async r => { const data = await r.json(); if (!r.ok) throw Error(data.error || 'Unable to load relationships'); return data; })
      .then(data => { if (!controller.signal.aborted) setNetwork(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [body, user, attempt]);
  const visible = useMemo(() => {
    const nodes = (network?.nodes || []).filter(n => nodeTypes.includes(n.type));
    const ids = new Set(nodes.map(n => n.id));
    return { nodes, edges: (network?.edges || []).filter(e => edgeTypes.includes(e.type) && ids.has(e.source) && ids.has(e.target)) };
  }, [network, nodeTypes, edgeTypes]);
  const toggle = (setter, type) => { setter(current => current.includes(type) ? current.filter(x => x !== type) : [...current, type]); setSelected(null); };
  const labelFor = id => network?.nodes.find(n => n.id === (id?.id || id))?.label || id?.id || id;
  return <section className="result-graph" aria-labelledby="result-graph-title" aria-busy={loading}>
    <div className="result-graph__head"><div><h3 id="result-graph-title" ref={titleRef} tabIndex={-1}>Result relationships</h3><p>Patterns, authorised incidents, and public posts from the current view, with related context.</p></div><button type="button" onClick={onClose}>Close graph</button></div>
    {loading && <p role="status">Loading authorised relationships…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry</button></p>}
    {network && <>
      <p className="result-graph__scope">{network.scope}</p>
      {network.warnings.map(w => <p className="result-graph__notice" key={w}>{w}</p>)}
      <div className="result-graph__filters">
        <fieldset><legend>Show records</legend>{Object.entries(TYPES).map(([type, label]) => <label key={type}><input type="checkbox" checked={nodeTypes.includes(type)} onChange={() => toggle(setNodeTypes, type)} /><i style={{ background: COLORS[type] }} />{label} ({network.nodes.filter(n => n.type === type).length})</label>)}</fieldset>
        <fieldset><legend>Show connections</legend>{Object.entries(EDGES).map(([type, label]) => <label key={type}><input type="checkbox" checked={edgeTypes.includes(type)} onChange={() => toggle(setEdgeTypes, type)} /><i className={`result-graph__key result-graph__key--${type}`} />{label}</label>)}</fieldset>
      </div>
      <p role="status">{visible.nodes.length} records · {visible.edges.length} connections shown</p>
      <div className="result-graph__workspace">
        {visible.nodes.length ? <Network network={visible} onSelect={setSelected} selected={selected} /> : <p>No records to display. Adjust the filters or search again.</p>}
        <aside className="result-graph__details" aria-live="polite">
          <h4>{selected?.label || 'Explore a connection'}</h4>
          {selected ? <>
            <p>{selected.source && selected.target ? `${labelFor(selected.source)} → ${labelFor(selected.target)}` : selected.ref}</p>
            <p>{selected.detail || 'No further description recorded.'}</p>
            {selected.reason && <p>{selected.reason}</p>}
            <dl>{Object.entries({ Source: selected.provenance || (selected.target ? null : selected.source), Category: selected.category, Suburb: selected.suburb, Date: selected.date ? String(selected.date).slice(0, 16).replace('T', ' ') : null, Status: selected.status, Momentum: selected.momentum, [selected.scoreLabel || 'Score']: selected.score, Context: selected.target ? null : selected.matched ? 'Current result' : 'Added related context' }).filter(([, value]) => value != null).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>
            {selected.type === 'incident' && <button type="button" onClick={() => onOpenIncident(selected.ref)}>Open incident details</button>}
          </> : <p>Select a node or line. The details explain the record, relationship source, and any similarity or comparison score.</p>}
        </aside>
      </div>
      <details className="result-graph__lists"><summary>Browse records and connections as lists</summary><div>
        <section><h4>Records</h4>{visible.nodes.map(n => <button type="button" key={n.id} onClick={() => setSelected(n)}>{TYPES[n.type]} · {n.label} · {n.ref}</button>)}</section>
        <section><h4>Connections</h4>{visible.edges.map(e => <button type="button" key={e.id} onClick={() => setSelected(e)}>{labelFor(e.source)} → {labelFor(e.target)} · {e.label}</button>)}</section>
      </div></details>
      <p className="result-graph__notice">Public posts remain unverified. A reviewed comparison or semantic match does not establish evidence, causation, or an operational impact.</p>
    </>}
  </section>;
}
