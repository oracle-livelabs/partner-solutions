import React,{createContext,useContext,useEffect,useState} from 'react';
import {SYNTHETIC_NOTICE} from './profile-presentation.mjs';
const ProfileContext=createContext({timeZone:'UTC',locale:'en-GB',notice:SYNTHETIC_NOTICE});
export function ActiveProfileProvider({user,children}) {
  const [context,setContext]=useState({timeZone:'UTC',locale:'en-GB',notice:SYNTHETIC_NOTICE});
  useEffect(()=>{
    const controller=new AbortController();
    const load=()=>fetch('/api/profile-context',{headers:{'X-Demo-User':user},signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Active profile unavailable');return r.json();}).then(setContext).catch(e=>{if(e.name!=='AbortError')setContext({timeZone:'UTC',locale:'en-GB',notice:SYNTHETIC_NOTICE,unavailable:true});});
    load();window.addEventListener('crimedata-profile-changed',load);
    return()=>{controller.abort();window.removeEventListener('crimedata-profile-changed',load);};
  },[user]);
  return <ProfileContext.Provider value={context}>{children}</ProfileContext.Provider>;
}
export const useActiveProfile=()=>useContext(ProfileContext);
