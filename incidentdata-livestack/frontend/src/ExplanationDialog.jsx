import React, {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './batch-brief-explain.css';

function DatabaseIcon() {
  return <svg width="18" height="20" viewBox="0 0 20 22" fill="none" aria-hidden="true"><ellipse cx="10" cy="4" rx="7" ry="3"/><path d="M3 4v13c0 4 14 4 14 0V4M3 10c0 4 14 4 14 0"/></svg>;
}

export default function ExplanationDialog({label,title,children}) {
  const [open,setOpen]=useState(false);
  const titleId=useId(),dialog=useRef(null),trigger=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const node=dialog.current,overflow=document.body.style.overflow;
    node.showModal();document.body.style.overflow='hidden';
    return()=>{node.close();document.body.style.overflow=overflow;trigger.current?.focus({preventScroll:true});};
  },[open]);
  return <>
    <button ref={trigger} type="button" className="brief-explain-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><DatabaseIcon/><span>EXPLAIN</span></button>
    {createPortal(<dialog ref={dialog} className="brief-explain-dialog" aria-labelledby={titleId} onKeyDownCapture={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);}}} onCancel={event=>{event.preventDefault();event.stopPropagation();setOpen(false);}}>
      <header className="brief-explain-header"><div><span className="brief-explain-eyebrow"><DatabaseIcon/> HOW IT WORKS</span><h2 id={titleId}>{title}</h2></div><button type="button" onClick={()=>setOpen(false)} autoFocus>Close explanation</button></header>
      <div className="brief-explain-content">{children}</div>
    </dialog>,document.body)}
  </>;
}
