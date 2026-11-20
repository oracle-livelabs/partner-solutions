import React,{createContext,useContext,useEffect,useState} from 'react';
import {SYNTHETIC_NOTICE} from './profile-presentation.mjs';
const ProfileContext=createContext({timeZone:'UTC',locale:'en-GB',notice:SYNTHETIC_NOTICE});
export function ActiveProfileProvider({user,children}) {
  const [context,setContext]=useState({timeZone:'UTC',locale:'en-GB',notice:SYNTHETIC_NOTICE});
  useEffect(()=>{
    const controller=new AbortController();
    let requestId=0;
    const load=()=>{
      const current=++requestId;
      fetch('/api/profile-context',{headers:{'X-Demo-User':user},signal:controller.signal})
        .then(async r=>{if(!r.ok)throw Error('Active profile unavailable');return r.json();})
        .then(value=>{if(current===requestId)setContext(value);})
        .catch(e=>{if(e.name!=='AbortError'&&current===requestId)setContext({timeZone:'UTC',locale:'en-GB',notice:SYNTHETIC_NOTICE,unavailable:true});});
    };
    const loadWhenVisible=()=>{if(!document.hidden)load();};
    load();
    window.addEventListener('crimedata-profile-changed',load);
    window.addEventListener('focus',loadWhenVisible);
    document.addEventListener('visibilitychange',loadWhenVisible);
    const refresh=setInterval(loadWhenVisible,30000);
    return()=>{controller.abort();clearInterval(refresh);window.removeEventListener('crimedata-profile-changed',load);window.removeEventListener('focus',loadWhenVisible);document.removeEventListener('visibilitychange',loadWhenVisible);};
  },[user]);
  return <ProfileContext.Provider value={context}>{children}</ProfileContext.Provider>;
}
export const useActiveProfile=()=>useContext(ProfileContext);
