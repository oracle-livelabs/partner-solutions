import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

export default function PeoplePoiDialog({poi,user,onClose}){
 const dialog=useRef(),[data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{
  const node=dialog.current,trigger=document.activeElement,overflow=document.body.style.overflow;
  node.showModal();document.body.style.overflow='hidden';
  return()=>{node.close();document.body.style.overflow=overflow;if(trigger?.isConnected)trigger.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{
  const controller=new AbortController();setData(null);setError('');
  fetch('/api/persons/'+encodeURIComponent(poi.person_ref),{headers:{'X-Demo-User':user},signal:controller.signal}).then(async r=>{const value=await r.json();if(!r.ok)throw Error(value.error||'POI details unavailable.');return value;}).then(setData).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return()=>controller.abort();
 },[poi.person_ref,user]);
 const person=data?.person;
 const value=v=>v==null||v===''?'Not recorded':typeof v==='object'?JSON.stringify(v,null,2):String(v);
 return createPortal(<dialog ref={dialog} className="people-poi-dialog" aria-labelledby="people-poi-title" onCancel={e=>{e.preventDefault();onClose();}} onKeyDownCapture={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}}}>
  <header><div><small>POI REGISTER · POSSIBLE NAME / ALIAS MATCH</small><h2 id="people-poi-title">{poi.display_name}</h2><p>{poi.person_ref}</p></div><button autoFocus type="button" onClick={onClose}>Close POI details</button></header>
  <p>This fictional register profile is a possible match for review. A matching name or alias does not confirm identity.</p>
  {error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Loading authorised POI details…</p>}
  {person&&<>
   {person.PORTRAIT_ASSET_URI&&<img className="people-poi-portrait" src={person.PORTRAIT_ASSET_URI} alt={person.PORTRAIT_ALT_TEXT||'Fictional registered POI portrait'}/>}
   <dl>{[['Reference','PERSON_REF'],['Name','DISPLAY_NAME'],['Alias','ALIAS_NAME'],['Status','PERSON_STATUS'],['Linked incidents in your scope','SCOPED_INCIDENT_COUNT'],['Created','CREATED_AT']].map(([label,key])=><div key={key}><dt>{label}</dt><dd>{value(person[key])}</dd></div>)}</dl>
   {person.NARRATIVE_SUMMARY&&<section><h3>Profile summary</h3><p>{person.NARRATIVE_SUMMARY}</p></section>}
   {person.NARRATIVE_TEXT&&<section><h3>Profile narrative</h3><p>{person.NARRATIVE_TEXT}</p></section>}
   {person.PROFILE_ATTRIBUTES&&<section><h3>Recorded attributes</h3><pre>{value(person.PROFILE_ATTRIBUTES)}</pre></section>}
   <section><h3>Recorded incident links</h3><p>{person.SCOPED_INCIDENT_COUNT||0} in your authorised scope · showing up to six recent links</p>{data.incidentLinks.map(link=><article key={link.INCIDENT_REF}><strong>{link.INCIDENT_REF} · {link.CATEGORY_NAME}</strong><p>{link.CONNECTION_TYPE} · {link.LINK_SUMMARY}</p></article>)}</section>
   <section><h3>Registered visual assets</h3>{!data.assets.length&&<p>No visual assets recorded.</p>}{data.assets.map(asset=><details key={asset.ASSET_REF}><summary>{asset.ASSET_REF} · {asset.ASSET_KIND}</summary><p>{asset.ASSET_CAPTION}</p><p>{asset.MIME_TYPE} · {asset.EMBEDDING_MODEL} · {value(asset.CREATED_AT)}</p>{asset.ASSET_URI&&<img className="people-poi-asset" src={asset.ASSET_URI} alt={asset.ASSET_CAPTION||'Fictional POI asset'} loading="lazy"/>}</details>)}</section>
  </>}
 </dialog>,document.body);
}
