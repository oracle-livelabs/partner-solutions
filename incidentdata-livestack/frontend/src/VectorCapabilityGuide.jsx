import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './vector-capability-guide.css';

// Hand-chosen teaching coordinates, not measured model embeddings.
const ITEMS = [
  {name:'Dog', vector:[0.23,0.69], label:[0,26]},
  {name:'Poodle', vector:[0.13,0.83], label:[-6,-20]},
  {name:'Greyhound', vector:[0.32,0.82], label:[20,-20]},
  {name:'Cat', vector:[0.47,0.58], label:[0,-20]},
  {name:'Car', vector:[0.88,0.16], label:[0,-20]},
];
const STEPS=['What is a vector?', 'See similarity', 'What Oracle provides', 'Apply it to this app'];
const NOTES=[
  '“A vector is a list of numbers. An embedding model turns content into those numbers, giving us a way to compare its meaning with other content.”',
  null,
  '“The embedding model creates the representation. Oracle stores it beside our records, compares vectors with SQL, and can index them for faster approximate searches.”',
  '“We can look for reports about similar activity even when they use different wording. Similarity helps us find material to review; it does not establish a case relationship.”',
];
const QUERY_NOTES={
  Dog:'“Poodle and greyhound are dog breeds, so they are close to Dog in this illustration. Cat shares an animal context, while Car is much farther away.”',
  Cat:'“Dog and Cat share an animal context. The dog breeds are also closer to Cat than Car is. Changing the query changes which stored points we measure from.”',
  Car:'“Closest is relative. This small collection has no other vehicle, so its nearest other points are still animals. A distance threshold can help us exclude weak matches.”',
};
function SimilarityExample() {
  const [query,setQuery]=useState('Dog');
  const selected=ITEMS.find(i=>i.name===query);
  const ranked=ITEMS.filter(i=>i!==selected).map(i=>({...i,distance:Math.hypot(i.vector[0]-selected.vector[0],i.vector[1]-selected.vector[1])})).sort((a,b)=>a.distance-b.distance);
  const nearest=ranked.slice(0,3);
  const xy=item=>[56+item.vector[0]*510,286-item.vector[1]*245];
  const [qx,qy]=xy(selected);
  return <>
    <p className="vg-lead">Similar meanings can sit near one another. Select a query and compare the other items.</p>
    <div className="vg-query" aria-label="Example query"><span>Find items similar to</span>{['Dog','Cat','Car'].map(name=><button key={name} type="button" aria-pressed={query===name} onClick={()=>setQuery(name)}>{name}</button>)}</div>
    <div className="vg-example-grid">
      <figure className="vg-map"><svg viewBox="0 0 640 340" role="img" aria-label={`Teaching vector map. Query ${query}. Nearest other items: ${nearest.map(i=>i.name).join(', ')}.`}>
        <title>Illustrative two-dimensional vector space</title>
        {[0,0.25,0.5,0.75,1].map(v=><g key={v} className="vg-grid"><line x1={56+v*510} y1="35" x2={56+v*510} y2="286"/><line x1="56" y1={286-v*245} x2="566" y2={286-v*245}/></g>)}
        <text x="311" y="323" textAnchor="middle" className="vg-axis">Illustrative dimension 1</text><text transform="translate(20 160) rotate(-90)" textAnchor="middle" className="vg-axis">Illustrative dimension 2</text>
        {nearest.map(i=>{const [x,y]=xy(i);return <line key={i.name} x1={qx} y1={qy} x2={x} y2={y} className="vg-connection"/>;})}
        {ITEMS.map(i=>{const [x,y]=xy(i),active=i===selected,close=nearest.some(n=>n.name===i.name);return <g key={i.name}>
          {active&&<circle cx={x} cy={y} r="22" className="vg-query-halo"/>}<circle cx={x} cy={y} r={active?10:8} className={active?'vg-dot-query':close?'vg-dot-near':'vg-dot-other'}/>
          <text x={x+i.label[0]} y={y+i.label[1]} textAnchor="middle" className="vg-point-label">{i.name}</text>
        </g>;})}
      </svg><figcaption>Coordinates chosen by hand for teaching. Real embeddings and rankings depend on the model and context.</figcaption></figure>
      <div className="vg-ranking"><h4>Nearest other items to {query}</h4><p>Smaller distance = closer in this example.</p><ol aria-live="polite">{ranked.map((item,index)=><li key={item.name}><span><b>{index+1}. {item.name}</b><small>[{item.vector.map(v=>v.toFixed(2)).join(', ')}]</small></span><strong>{item.distance.toFixed(2)}</strong></li>)}</ol><small>Straight-line distance between the two-number vectors. The lines mark the nearest three; the query itself is excluded.</small></div>
    </div>
    <aside className="vg-talk"><small>Talk track</small><p>{QUERY_NOTES[query]}</p></aside>
  </>;
}
export default function VectorCapabilityGuide({onClose}) {
  const [step,setStep]=useState(0),dialog=useRef(null),returnFocus=useRef(document.activeElement);
  useEffect(()=>{
    const element=dialog.current,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';element.showModal();
    return()=>{element.close();document.body.style.overflow=overflow;if(returnFocus.current?.isConnected)returnFocus.current.focus({preventScroll:true});};
  },[]);
  function trapTab(event){
    if(event.key!=='Tab')return;
    const buttons=[...dialog.current.querySelectorAll('button:not([disabled]),a[href],summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  function backdrop(event){if(event.target!==dialog.current)return;const rect=dialog.current.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();}
  return createPortal(<dialog ref={dialog} className="vector-guide" aria-labelledby="vector-guide-title" onKeyDown={trapTab} onClick={backdrop} onCancel={e=>{e.preventDefault();onClose();}}>
    <header className="vg-header"><div><small>DATA FOUNDATION · PRESENTER WALKTHROUGH</small><h2 id="vector-guide-title">Oracle Vector Search</h2><p>From a list of numbers to finding similar meaning.</p></div><button type="button" onClick={onClose} autoFocus aria-label="Close vector walkthrough">Close ×</button></header>
    <nav className="vg-steps" aria-label="Walkthrough steps">{STEPS.map((name,index)=><button key={name} type="button" aria-pressed={step===index} onClick={()=>setStep(index)}><span>{index+1}</span>{name}</button>)}</nav>
    <div className="vg-body" key={step}>
      <h3>{STEPS[step]}</h3>
      {step===0&&<>
        <p className="vg-lead">A vector is an ordered list of numbers. For semantic search, an <strong>embedding model</strong> turns text or other content into a vector that represents learned features of that content.</p>
        <div className="vg-number-flow"><div><span>Content</span><strong>Dog</strong></div><b aria-hidden="true">→</b><div><span>Embedding</span><strong>[0.23, 0.69]</strong></div><b aria-hidden="true">→</b><div><span>Vector space</span><strong>A point we can compare</strong></div></div>
        <p>Our teaching example has just two numbers, so we can draw it on a page. Real embeddings often have hundreds or thousands of dimensions. Individual numbers usually are not named features such as “has fur” or “has wheels”.</p>
        <div className="vg-explain"><h4>Why numbers?</h4><p>Numbers let us calculate distance. A model can represent “dog”, “poodle” and “greyhound” with related vectors even though the words are different. This makes similarity search broader than matching exact words.</p></div>
        <p className="vg-footnote">The example numbers are invented teaching coordinates, not an embedding model’s output.</p>
      </>}
      {step===1&&<SimilarityExample/>}
      {step===2&&<>
        <p className="vg-lead">Oracle AI Vector Search stores, compares and searches vectors alongside the rest of your database records.</p>
        <ol className="vg-oracle-flow">
          <li><b>1 · Create an embedding</b><p>Use a suitable embedding model. Vectors can be generated outside Oracle, or inside Oracle with a supported imported ONNX model. Use the same model and dimensions for queries and stored content.</p></li>
          <li><b>2 · Store it as VECTOR</b><p>The native <code>VECTOR</code> data type stores the numbers beside text, IDs, JSON and other business data.</p></li>
          <li><b>3 · Search with SQL</b><p><code>VECTOR_DISTANCE</code> compares the query vector with stored vectors. Rank by distance, join the matching records and apply the relevant SQL filters. Use a distance metric appropriate to the model, such as cosine distance.</p></li>
          <li><b>4 · Scale the search</b><p>HNSW and IVF vector indexes support approximate nearest-neighbour search. They offer speed and accuracy trade-offs; exact search calculates distances across the searched candidates.</p></li>
        </ol>
        <details className="vg-sql"><summary>Show illustrative SQL</summary><p>For our two-number example: a table <code>demo_items</code> has <code>label</code> and <code>embedding VECTOR(2, FLOAT32)</code>. The query binds contain the selected label and its vector. This example uses Euclidean distance to match the diagram.</p><pre tabIndex={0}><code>{`SELECT label,
       VECTOR_DISTANCE(embedding, :query_vector, EUCLIDEAN) AS distance
FROM demo_items
WHERE label <> :query_label
ORDER BY distance
FETCH FIRST 3 ROWS ONLY;`}</code></pre></details>
      </>}
      {step===3&&<>
        <p className="vg-lead">In IncidentData, the same idea helps retrieve reports describing similar activity, even when their wording differs.</p>
        <div className="vg-explain"><h4>For example</h4><p>“Vehicle window broken and a bag taken” and “A backpack was removed after glass was smashed” can be semantically related. Review the returned narratives to understand the actual connection.</p></div>
        <ol className="vg-app-flow"><li>Turn the analyst’s question into a query embedding.</li><li>Compare it with report embeddings from the same model.</li><li>Oracle ranks the authorised candidates using vector distance.</li><li>Open the source report and review its wording and context.</li></ol>
        <p>A similarity score helps select material for review. It does not establish an identity, responsibility or a case relationship.</p>
        <details className="vg-sql"><summary>A useful audience question: does context matter?</summary><p>Yes. “Greyhound dog” and “Greyhound bus” can have different embeddings. The model, wording and context determine what “similar” means. Our dog-and-cat diagram is an illustration, not a universal ranking.</p></details>
      </>}
      {NOTES[step]&&<aside className="vg-talk"><small>Talk track</small><p>{NOTES[step]}</p></aside>}
      {(step===0||step===2)&&<p className="vg-sources">Oracle reference: <a href="https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/overview-ai-vector-search.html" target="_blank" rel="noreferrer">Vectors and semantic search</a>{step===2&&<> · <a href="https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/manage-different-categories-vector-indexes.html" target="_blank" rel="noreferrer">Vector indexes</a></>}</p>}
    </div>
    <footer className="vg-footer"><span>Step {step+1} of {STEPS.length}</span><div><button type="button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Back</button><button type="button" className="vg-next" onClick={()=>step===STEPS.length-1?onClose():setStep(s=>s+1)}>{step===STEPS.length-1?'Finish':'Next →'}</button></div></footer>
  </dialog>,document.body);
}
