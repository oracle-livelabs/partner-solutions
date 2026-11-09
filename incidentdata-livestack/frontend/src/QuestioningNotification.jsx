import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {createNotification,NOTIFICATION_DELAY,permissionRemaining} from './notification-simulation.mjs';
import './questioning-notification.css';
const time=value=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Adelaide',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export default function QuestioningNotification({user}){
 const [notification,setNotification]=useState(null),[now,setNow]=useState(Date.now()),[copied,setCopied]=useState(false),[imageFailed,setImageFailed]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();let timer;setNotification(null);setCopied(false);setImageFailed(false);
  // Begin the timer on page entry; scope the candidate list to the active user.
  const delay=new Promise(resolve=>{timer=setTimeout(resolve,NOTIFICATION_DELAY);});
  const people=fetch('/api/persons',{headers:{'X-Demo-User':user},signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Profiles unavailable');const body=await r.json();if(!Array.isArray(body))throw Error('Invalid profiles');return body;});
  Promise.all([delay,people]).then(([,profiles])=>{if(!controller.signal.aborted){setNow(Date.now());setNotification(createNotification(profiles));}}).catch(()=>{/* No invented fallback person when profiles are unavailable. */});
  return()=>{clearTimeout(timer);controller.abort();};
 },[user]);
 useEffect(()=>{if(!notification)return;const interval=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(interval);},[notification]);
 if(!notification)return null;
 const {person,code,issuedAt,expiresAt}=notification,remaining=permissionRemaining(expiresAt,now),expired=remaining===0;
 async function copy(){try{await navigator.clipboard.writeText(code);setCopied(true);}catch{setCopied(false);}}
 return createPortal(<aside className="questioning-notification" role="status" aria-live="polite" aria-label="Questioning notification">
  <header><span>INVESTIGATION UPDATE</span><button type="button" aria-label="Dismiss notification" onClick={()=>setNotification(null)}>×</button></header>
  <div className="questioning-notification-person">{imageFailed?<span className="questioning-notification-no-photo">Photo unavailable</span>:<img src={person.PORTRAIT_ASSET_URI} alt={person.PORTRAIT_ALT_TEXT||'POI portrait'} onError={()=>setImageFailed(true)}/>}<div><small>{person.PERSON_REF}</small><h3>{person.DISPLAY_NAME||person.ALIAS_NAME||person.PERSON_REF}</h3><strong>Brought in for questioning</strong></div></div>
  <p>This person has just been brought in for questioning by <strong>Detective Karen Cannell</strong>. Given your recent connected investigation, please contact Karen using the permission code below.</p>
  <div className="questioning-notification-permission"><span>PERMISSION CODE</span><strong>{code}</strong><button type="button" disabled={expired} onClick={copy}>{copied?'Copied':'Copy code'}</button></div>
  <p className="questioning-notification-expiry">{expired?<strong>Code expired</strong>:<>Effective for two hours · {remaining} {remaining===1?'minute':'minutes'} remaining</>}<br/>Issued {time(issuedAt)} · Expires {time(expiresAt)} (Adelaide)</p>
 </aside>,document.body);
}
