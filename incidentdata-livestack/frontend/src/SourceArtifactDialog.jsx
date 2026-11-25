import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './source-artifact-dialog.css';

const MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'video/mp4',wav:'audio/wav',txt:'text/plain',csv:'text/csv',json:'application/json'};
const TEXT_LIMIT=1024*1024;
export default function SourceArtifactDialog({source,batchId,user,onClose}){
 const dialog=useRef(null),title=useId();
 const [content,setContent]=useState(null),[error,setError]=useState(''),[mediaError,setMediaError]=useState(false);
 const type=String(source.type||source.path?.split('.').pop()||'').toLowerCase();
 useEffect(()=>{
  const node=dialog.current,focus=document.activeElement,overflow=document.body.style.overflow;
  node.showModal();document.body.style.overflow='hidden';
  return()=>{node.querySelectorAll('audio,video').forEach(media=>{media.pause();media.removeAttribute('src');media.load();});node.close();document.body.style.overflow=overflow;focus?.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{
  let active=true,url='';const controller=new AbortController();setContent(null);setError('');setMediaError(false);
  (async()=>{
   const r=await fetch(`/api/data-room/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(source.itemId)}/download`,{headers:{'X-Demo-User':user},signal:controller.signal});
   if(!r.ok)throw Error(r.status===403||r.status===404?'This artifact is unavailable in your current access scope.':'Unable to load this artifact. Please try again.');
   const blob=await r.blob();if(!active)return;
   url=URL.createObjectURL(new Blob([blob],{type:MIME[type]||'application/octet-stream'}));
   let text='',truncated=false;
   if(['txt','csv','json'].includes(type)){
    truncated=blob.size>TEXT_LIMIT;text=await blob.slice(0,TEXT_LIMIT).text();
    if(type==='json'&&!truncated){try{text=JSON.stringify(JSON.parse(text),null,2);}catch{/* Show original text when JSON is invalid. */}}
   }
   if(active)setContent({url,text,truncated});
  })().catch(e=>{if(active&&e.name!=='AbortError')setError(e.message);});
  return()=>{active=false;controller.abort();if(url)URL.revokeObjectURL(url);};
 },[batchId,user,source.itemId,type]);
 const image=['png','jpg','jpeg','gif','webp'].includes(type),audio=['mp3','m4a','wav'].includes(type),video=type==='mp4',text=['txt','csv','json'].includes(type);
 return createPortal(<dialog ref={dialog} className="source-artifact-dialog" aria-labelledby={title} onCancel={e=>{e.preventDefault();onClose();}}>
  <header><div><small>ORIGINAL SOURCE ARTIFACT · {source.ref}</small><h2 id={title}>{source.path}</h2></div><button type="button" autoFocus onClick={onClose}>Close artifact</button></header>
  <div className="source-artifact-body">
   {error?<p role="alert">{error}</p>:!content?<p role="status">Loading original artifact…</p>:<>
    {image&&<img src={content.url} alt={source.path} onError={()=>setMediaError(true)}/>}
    {audio&&<audio controls preload="metadata" src={content.url} aria-label={`Play ${source.path}`} onError={()=>setMediaError(true)}/>}
    {video&&<video controls playsInline preload="metadata" src={content.url} aria-label={`Play ${source.path}`} onError={()=>setMediaError(true)}/>}
    {text&&<>{type==='csv'&&<p className="source-artifact-note">Original CSV · comma-separated text</p>}{content.truncated&&<p className="source-artifact-note">Showing the first 1 MB. Download the original for the complete file.</p>}<pre tabIndex={0} aria-label="Original file content">{content.text||'(Empty file)'}</pre></>}
    {!image&&!audio&&!video&&!text&&<p>Preview is unavailable for this file type. Download the original to open it.</p>}
    {mediaError&&<p role="alert">Your browser could not display or play this artifact. Download the original to open it in another application.</p>}
    <a className="source-artifact-download" href={content.url} download={source.path?.split('/').pop()}>Download original</a>
   </>}
  </div>
 </dialog>,document.body);
}
