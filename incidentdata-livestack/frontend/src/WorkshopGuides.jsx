import React from 'react';
import {PAGE_GUIDES, WORKSHOP_VISUALS, WORKSHOP_CHAPTERS} from './workshop-visuals.mjs';
import './workshop-guides.css';

export function WorkshopFigure({slug,compact=false}) {
  const visual=WORKSHOP_VISUALS[slug];
  if(!visual)return null;
  const url=`/workshop/assets/${visual.file}`;
  return <figure className={`workshop-figure ${compact?'workshop-figure--compact':''}`}>
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open full-size ${visual.kind} in a new tab: ${visual.caption}`}>
      <img src={url} alt={visual.caption} width={visual.width} height={visual.height} loading="lazy" decoding="async" />
    </a>
    <figcaption>{visual.caption}</figcaption>
    {compact&&<a className="workshop-image-link" href={url} target="_blank" rel="noopener noreferrer">Open full-size {visual.kind} ↗</a>}
  </figure>;
}

export function PageLearningVisual({page}) {
  const guide=PAGE_GUIDES[page];
  if(!guide)return null;
  const [slug,file,label]=guide;
  return <section className="oi-learning" aria-label="Illustrated learning guide">
    <h3>Visual guide</h3>
    <WorkshopFigure slug={slug} compact />
    <p>Conceptual learning visual. Use the explanation below to understand this page’s actual execution path.</p>
    <a className="workshop-guide-link" href={`/workshop/${file}.html`} target="_blank" rel="noopener noreferrer">{label} ↗</a>
  </section>;
}

export function WelcomeLearning({onOpen}) {
  return <section className="workshop-welcome" aria-labelledby="welcome-learning-title">
    <div><small>EXPLORE · INSPECT · UNDERSTAND</small><h2 id="welcome-learning-title">Learn through a connected incident story</h2>
      <p>A LiveStack brings the application, services and database together around a practical scenario. Follow a result back to its records, sources and execution path.</p>
      <p>Use the illustrated workshop guides and each page’s Oracle Internals panel to explore the technology behind the experience.</p>
      <button type="button" className="primary" onClick={onOpen}>Open Workshop &amp; Guides →</button></div>
    <WorkshopFigure slug="incidentdata-overview" />
  </section>;
}

export default function WorkshopGuides() {
  return <section className="workshop-library" aria-labelledby="workshop-library-title">
    <div className="workshop-library-head"><small>ILLUSTRATED WORKSHOP · SYNTHETIC TRAINING</small><h2 id="workshop-library-title">Explore the guides alongside the application</h2>
      <p>Start with React, then move through the Data Room, APEX and a separate Deep Data Security lab. Each chapter explains its prerequisites and preparation status.</p>
      <p className="workshop-draft-note">Guides updated 5 November 2026 for the Adelaide V3 data set. For step-by-step tasks across every part of the application, follow the Adelaide LiveLabs workshop (Introduction and Scenes 1–14) alongside these guides. The dedicated Graph Lab is a future update.</p></div>
    <div className="workshop-chapters">{WORKSHOP_CHAPTERS.map(chapter=><article className="workshop-chapter" key={chapter.file}>
      <WorkshopFigure slug={chapter.visual} />
      <div className="workshop-chapter-copy"><h3>{chapter.title}</h3><p>{chapter.description}</p><small>{chapter.status}</small>
        <a className="workshop-guide-link" href={`/workshop/${chapter.file}.html`} target="_blank" rel="noopener noreferrer">Open guide ↗</a></div>
    </article>)}</div>
    <p className="workshop-library-note">Guides and diagrams open in a new tab. They explain the exercises; they do not run queries, upload batches or call AI services.</p>
  </section>;
}
