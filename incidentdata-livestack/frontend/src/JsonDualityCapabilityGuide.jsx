import React, {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './vector-capability-guide.css';
import './json-duality-capability-guide.css';
const STEPS=['What is duality?','Two views, one record','What Oracle provides','Apply it to this app'];
const NOTES=[
 '“A table organises values into rows and columns. JSON groups values into a document, including nested objects and lists. Duality gives us both ways to work with the same underlying data.”',
 '“Change the status through either representation. Both show the change because they describe one record. There is no separate copy to keep in sync in this teaching example.”',
 '“Oracle defines the mapping between tables and documents. Allowed document updates change the underlying rows. Version checks can detect a change made since we last read a document.”',
 '“A case screen can work with a document while reporting uses table rows. The mapping, permissions and source records still determine what can be read or changed.”',
];
function DualityExample(){
 const [status,setStatus]=useState('Open'),[source,setSource]=useState(null);
 const document={_id:101,reference:'DEMO-101',status,reports:[{reportId:501,summary:'Blue bicycle reported missing'}]};
 function update(value,origin){setStatus(value);setSource(origin);}
 return <><p className="vg-lead">One invented incident, shown as relational rows and a nested JSON document. Change the status on either side.</p>
  <div className="jd-example-grid"><section className="jd-card"><h4>Relational tables</h4><p className="jd-caption">INCIDENTS · one row per incident</p><div className="jd-table-scroll"><table><thead><tr><th>ID</th><th>Reference</th><th>Status</th></tr></thead><tbody><tr><td>101</td><td>DEMO-101</td><td>{status}</td></tr></tbody></table></div><label>Change status through the table<select aria-label="Table incident status" value={status} onChange={e=>update(e.target.value,'table')}><option>Open</option><option>Under review</option><option>Closed</option></select></label><p className="jd-caption">REPORTS · incident_id links the report to its incident</p><div className="jd-table-scroll"><table><thead><tr><th>Report ID</th><th>Incident ID</th><th>Summary</th></tr></thead><tbody><tr><td>501</td><td>101</td><td>Blue bicycle reported missing</td></tr></tbody></table></div></section>
  <section className="jd-card"><h4>JSON document</h4><p className="jd-caption">The related report becomes a nested array.</p><pre tabIndex={0} aria-label="Example JSON document">{JSON.stringify(document,null,2)}</pre><label>Change status through JSON<select aria-label="JSON incident status" value={status} onChange={e=>update(e.target.value,'JSON')}><option>Open</option><option>Under review</option><option>Closed</option></select></label></section></div>
  <p className="jd-update" role="status">{source?`Changed through ${source}: both representations now show “${status}”.`:'Both representations show “Open”. Try changing either status.'}</p>
  <p className="vg-footnote">Local teaching simulation. No database updates are made. The JSON shows application fields; Oracle also adds managed document metadata.</p>
  <button type="button" onClick={()=>{setStatus('Open');setSource(null);}}>Reset example</button>
 </>;
}
export default function JsonDualityCapabilityGuide({onClose}){
 const [step,setStep]=useState(0),dialog=useRef(null),returnFocus=useRef(document.activeElement);
 useEffect(()=>{const el=dialog.current,overflow=document.body.style.overflow;document.body.style.overflow='hidden';el.showModal();return()=>{el.close();document.body.style.overflow=overflow;if(returnFocus.current?.isConnected)returnFocus.current.focus({preventScroll:true});};},[]);
 function trapTab(e){if(e.key!=='Tab')return;const all=[...dialog.current.querySelectorAll('button:not([disabled]),select,a[href],summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0].focus();}}
 function backdrop(e){if(e.target!==dialog.current)return;const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}
 return createPortal(<dialog ref={dialog} className="vector-guide jd-guide" aria-labelledby="json-duality-guide-title" onKeyDown={trapTab} onClick={backdrop} onCancel={e=>{e.preventDefault();onClose();}}>
 <header className="vg-header"><div><small>DATA FOUNDATION · PRESENTER WALKTHROUGH</small><h2 id="json-duality-guide-title">JSON Relational Duality Views</h2><p>Table rows and JSON documents over the same data.</p></div><button type="button" autoFocus onClick={onClose} aria-label="Close JSON duality walkthrough">Close ×</button></header>
 <nav className="vg-steps" aria-label="Walkthrough steps">{STEPS.map((name,i)=><button type="button" key={name} aria-pressed={step===i} onClick={()=>setStep(i)}><span>{i+1}</span>{name}</button>)}</nav>
 <div className="vg-body" key={step}><h3>{STEPS[step]}</h3>
 {step===0&&<><p className="vg-lead">JSON is a document format made of named values, nested objects and lists. A relational table stores values in rows and columns. <strong>Duality means two representations of the same underlying data.</strong></p><div className="vg-number-flow"><div><span>Relational view</span><strong>Incident + report rows</strong></div><b aria-hidden="true">↔</b><div><span>Document view</span><strong>Incident JSON with reports</strong></div></div><div className="vg-explain"><h4>A useful analogy</h4><p>A shopping order can appear as an order row plus item rows, or as one document with a list of items. Incident records and their reports can be presented in the same way.</p></div><p>The document shape is defined by the view. Generating JSON for an API alone does not establish an updatable duality view.</p></>}
 {step===1&&<DualityExample/>}
 {step===2&&<><p className="vg-lead">Oracle JSON Relational Duality Views map relational data to JSON documents.</p><ol className="vg-oracle-flow"><li><b>1 · Define the shape</b><p>Choose the tables, keys and document fields. Related rows can become nested objects or arrays.</p></li><li><b>2 · Read either way</b><p>The view generates documents on demand from underlying table data. SQL can still work with those tables.</p></li><li><b>3 · Control updates</b><p>Views are read-only by default. Explicit annotations allow selected insert, update or delete operations; database permissions also apply.</p></li><li><b>4 · Detect conflicting edits</b><p>Oracle supplies managed metadata, including an ETAG version hash. Supported updates can compare the retrieved ETAG to detect intervening changes.</p></li></ol><details className="vg-sql"><summary>Show illustrative SQL</summary><p>Assumes a teaching table DEMO_INCIDENTS with primary key INCIDENT_ID. This simple view permits status updates but keeps identifiers unchanged. It is not executed here.</p><pre tabIndex={0}><code>{`CREATE JSON RELATIONAL DUALITY VIEW demo_incident_dv AS
SELECT JSON {
  '_id'      : i.incident_id WITH NOUPDATE,
  'reference': i.incident_ref WITH NOUPDATE,
  'status'   : i.status
}
FROM demo_incidents i WITH UPDATE;

SELECT data FROM demo_incident_dv;`}</code></pre></details></>}
 {step===3&&<><p className="vg-lead">A document can group an incident and its related reports for a screen, while tables remain useful for joins, counts and reporting.</p><div className="vg-explain"><h4>Connect it to IncidentData</h4><p>Think of the incident, report, case and evidence structures shown in this app. A duality view could expose a selected group of those records as one document, with update rules chosen for the use case.</p></div><ol className="vg-app-flow"><li>Choose the document boundary, such as one incident.</li><li>Map fields and related records to source tables.</li><li>Set access and update rules.</li><li>Check document versions when coordinating edits.</li></ol><p>This walkthrough explains the capability with invented data. Existing JSON responses and uploaded JSON files do not by themselves mean an endpoint uses a database duality view.</p></>}
 <aside className="vg-talk"><small>Talk track</small><p>{NOTES[step]}</p></aside>
 {(step===0||step===2)&&<p className="vg-sources">Oracle references: <a href="https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/create-json-relational-duality-view.html" target="_blank" rel="noreferrer">Duality view definition</a> · <a href="https://docs.oracle.com/en/database/oracle/oracle-database/26/jsnvu/using-optimistic-concurrency-control-duality-views.html" target="_blank" rel="noreferrer">ETAG and concurrent updates</a></p>}
 </div><footer className="vg-footer"><span>Step {step+1} of {STEPS.length}</span><div><button type="button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Back</button><button type="button" className="vg-next" onClick={()=>step===STEPS.length-1?onClose():setStep(s=>s+1)}>{step===STEPS.length-1?'Finish':'Next →'}</button></div></footer>
 </dialog>,document.body);
}
