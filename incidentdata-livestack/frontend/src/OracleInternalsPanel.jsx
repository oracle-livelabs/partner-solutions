import React, { useEffect, useRef, useState } from 'react';
import { ORACLE_INTERNALS } from './oracle-internals-content.mjs';
import './oracle-internals.css';
import {PageLearningVisual} from './WorkshopGuides';

const WIDTH_KEY = 'crimedata.oracleInternals.width';
const clamp = width => Math.min(560, Math.max(300, width));
const palette = label => /vector|cosine|clip|minilm|dimension/i.test(label) ? 'pine'
  : /json|blob|sha-256/i.test(label) ? 'sienna'
  : /graph|pgq/i.test(label) ? 'plum'
  : /spatial|sdo|coordinate|wgs/i.test(label) ? 'teal'
  : /scope|validated/i.test(label) ? 'rose'
  : /ai|agent|oci|llm/i.test(label) ? 'red' : 'ocean';

export function FeatureBadge({ label }) {
  return <span className={`oi-badge oi-tone-${palette(label)}`}>{label}</span>;
}

function SqlBlock({ example, index }) {
  const [message, setMessage] = useState('');
  const codeRef = useRef(null);
  const language=example.kind==='plsql'?'PL/SQL':'SQL';
  async function copy() {
    try {
      await navigator.clipboard.writeText(example.code);
      setMessage(language+' copied.');
    } catch {
      // HTTP deployments may not offer Clipboard API access. Select visible
      // text so a keyboard or browser context-menu copy still works.
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(codeRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
      setMessage(language+' selected. Use your browser’s Copy command or Ctrl/Cmd+C.');
    }
  }
  return <section className="oi-sql" aria-labelledby={`oi-sql-title-${index}`}>
    <div className="oi-sql__heading">
      <h4 id={`oi-sql-title-${index}`}>{example.title}</h4>
      <button type="button" onClick={copy} aria-label={`Copy ${language}: ${example.title}`}>Copy {language}</button>
    </div>
    <p>{example.note}</p>
    <pre tabIndex={0} aria-label={`${language}: ${example.title}`}><code ref={codeRef}>{example.code}</code></pre>
    <span className="oi-copy-status" role="status">{message}</span>
  </section>;
}

export default function OracleInternalsPanel({ page }) {
  const [collapsed, setCollapsed] = useState(true);
  const [width, setWidth] = useState(() => {
    try { const stored = Number(localStorage.getItem(WIDTH_KEY)); return stored ? clamp(stored) : 370; }
    catch { return 370; }
  });
  const [drag, setDrag] = useState(null);
  const contentRef = useRef(null);
  const info = ORACLE_INTERNALS[page];

  useEffect(() => { try { localStorage.setItem(WIDTH_KEY, String(width)); } catch {} }, [width]);
  useEffect(() => { contentRef.current?.scrollTo(0, 0); }, [page]);
  useEffect(() => {
    if (!drag) return undefined;
    const move = event => setWidth(clamp(drag.width + drag.x - event.clientX));
    const stop = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
    };
  }, [drag]);
  if (!info) return null;

  function resizeKey(event) {
    const values = { ArrowLeft: width + 20, ArrowRight: width - 20, Home: 300, End: 560 };
    if (event.key in values) { event.preventDefault(); setWidth(clamp(values[event.key])); }
  }

  return <aside className={`oi-panel ${collapsed ? 'oi-panel--collapsed' : ''} ${drag ? 'oi-panel--resizing' : ''}`}
    aria-label="Oracle Internals" style={{ '--oi-width': `${width}px` }} data-page={page}>
    <div className="oi-panel__sticky">
      <button type="button" className="oi-toggle" onClick={() => setCollapsed(value => !value)}
        aria-expanded={!collapsed} aria-controls="oracle-internals-content"
        aria-label={collapsed ? 'Show Oracle Internals' : 'Collapse Oracle Internals'}
        title={collapsed ? 'Show Oracle Internals' : 'Collapse Oracle Internals'}>
        <svg width="18" height="20" viewBox="0 0 20 22" fill="none" aria-hidden="true">
          <ellipse cx="10" cy="4" rx="7" ry="3" />
          <path d="M3 4v13c0 4 14 4 14 0V4M3 10c0 4 14 4 14 0" />
        </svg>
        <span className="oi-toggle__title">{collapsed ? 'Explain' : 'Oracle Internals'}</span>
        <span className="oi-toggle__chevron" aria-hidden="true">{collapsed ? '‹' : '›'}</span>
      </button>
      <div id="oracle-internals-content" className="oi-content" hidden={collapsed} ref={contentRef}>
        {!collapsed && <div key={page}>
          <small className="oi-eyebrow">Oracle AI Database 26ai</small>
          <h2>{info.title}</h2>
          <p className="oi-engine">{info.engine}</p>
          <PageLearningVisual page={page} />
          <section><h3>What’s happening</h3><p>{info.what}</p></section>
          <div className="oi-badges" aria-label="Database capabilities">
            {info.badges.map(label => <FeatureBadge key={label} label={label} />)}
          </div>
          <section><h3>Why it matters</h3><p>{info.why}</p></section>
          <section><h3>How it works</h3><p>{info.how}</p>
            <ol className="oi-flow" aria-label="How data flows">
              {info.flow.map(([label, detail], index) => <li className={`oi-tone-${['ocean', 'plum', 'teal'][index % 3]}`} key={label}>
                <span className="oi-flow__number" aria-hidden="true">{index + 1}</span>
                <div><strong>{label}</strong><span>{detail}</span></div>
              </li>)}
            </ol>
          </section>
          {info.lessons?.map((lesson,index)=><details className="oi-lesson" key={lesson.title} open={index===0}>
            <summary>{lesson.title}</summary>
            <p>{lesson.intro}</p>
            <dl>{lesson.items.map(([label,description])=><React.Fragment key={label}><dt>{label}</dt><dd>{description}</dd></React.Fragment>)}</dl>
          </details>)}
          {info.implementationExamples?.length>0&&<details className="oi-examples oi-implementation">
            <summary>Implementation excerpts · illustration only <span>{info.implementationExamples.length} excerpts</span></summary>
            <p className="oi-sql-note">These excerpts explain the existing setup and runtime. Registration calls create database objects, CREATE_CONVERSATION persists metadata, and RUN_TEAM invokes a model. For read-only exploration, use the inspection examples below. This panel never executes code.</p>
            {info.implementationExamples.map((example,index)=><SqlBlock key={example.title} example={example} index={`implementation-${index}`}/>)}
          </details>}
          {info.examples.length > 0 && <details className="oi-examples" open>
            <summary>{info.examples.some(example=>example.kind==='plsql')?'SQL and PL/SQL you can inspect':'SQL you can inspect'} <span>{info.examples.length} {info.examples.length === 1 ? 'example' : 'examples'}</span></summary>
            <p className="oi-sql-note">Copy into an authorised SQL client connected to this application’s database schema. Follow each example’s session-context instructions. The examples read data; this panel does not execute them.</p>
            {info.examples.map((example, index) => <SqlBlock key={example.title} example={example} index={index} />)}
          </details>}
          <section className="oi-teaching"><h3>Teaching point</h3><p>{info.point}</p></section>
          <footer>Explanations and examples only · Opening this panel makes no AI requests.</footer>
        </div>}
      </div>
    </div>
    {!collapsed && <div className="oi-resize" role="separator" tabIndex={0}
      aria-label="Resize Oracle Internals" aria-orientation="vertical" aria-controls="oracle-internals-content"
      aria-valuemin={300} aria-valuemax={560} aria-valuenow={width}
      aria-valuetext={`${width} pixels wide`} title="Drag to resize. Arrow keys adjust width; double-click resets."
      onKeyDown={resizeKey} onDoubleClick={() => setWidth(370)}
      onPointerDown={event => { if (event.button === 0) { event.preventDefault(); setDrag({ x: event.clientX, width }); } }} />}
  </aside>;
}
