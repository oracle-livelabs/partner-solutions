import React,{useEffect,useState} from 'react';
import SavedProfileReview from './SavedProfileReview';
export default function ProfileLibraryPanel({user}) {
  const [code,setCode]=useState(''),[data,setData]=useState(null),[review,setReview]=useState(false),[confirmation,setConfirmation]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{
    setData(null);setReview(false);setConfirmation('');setError('');setNotice('');
    if(user!=='statewide_admin')return;
    const controller=new AbortController();fetch('/api/setup/profiles'+(code?'?profileCode='+encodeURIComponent(code):''),{headers:{'X-Demo-User':user},signal:controller.signal}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Profile catalogue unavailable');return x;}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>controller.abort();
  },[code,user]);
  if(user!=='statewide_admin')return <section className="crimedata-setup"><h2>Saved profile library</h2><p>Saved-library review is restricted to Statewide Admin. Your authorised live incident views and locality scope remain unchanged.</p></section>;
  const selected=data?.profile,selectedCode=selected?.PROFILE_CODE||code,confirmText='ACTIVATE '+selectedCode;
  const perform=action=>{
    if(confirmation!==confirmText)return;setWorking(true);setError('');setNotice('');
    fetch('/api/setup/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Demo-User':user},body:JSON.stringify({profileCode:selectedCode,confirmation,expectedActiveProfileCode:data.activeProfileCode})}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Action unavailable');return x;}).then(x=>{setData(x);setConfirmation('');setNotice(x.message);window.dispatchEvent(new Event('crimedata-profile-changed'));}).catch(e=>setError(e.message)).finally(()=>setWorking(false));
  };
  return <section className="crimedata-setup" aria-label="Saved profile library">
    <header><div><small className="kicker">CRIMEDATA SETUP · Z_BASE DATASET PROFILE LIBRARY</small><h2>CrimeData Setup</h2><p>Profiles come from the database catalogue. Selecting or reviewing a saved profile does not change the globally active operational dataset.</p><p>Active operational profile: <b data-testid="active-profile-code">{data?.activeProfileCode||'Loading…'}</b></p></div></header>
    <div className="crimedata-setup__profiles">{data?.profiles.map(p=><button type="button" key={p.PROFILE_CODE} data-profile-code={p.PROFILE_CODE} className={p.PROFILE_CODE===selectedCode?'active':'planned'} onClick={()=>setCode(p.PROFILE_CODE)}><small>{p.PROFILE_CODE===data.activeProfileCode?'ACTIVE DATASET':p.PROFILE_STATUS==='staged'?'SAVED · NOT ACTIVATED':'SAVED PROFILE'}</small><b>{p.CITY_LABEL}</b><p>{p.PROFILE_NAME}</p><span className="crimedata-setup__coverage"><strong>{Number(p.INCIDENT_COUNT).toLocaleString('en-GB')}</strong> incidents · <strong>{Number(p.SUBURB_COUNT).toLocaleString('en-GB')}</strong> source locality labels</span><em>{p.PROFILE_CODE}</em></button>)}</div>
    {data&&<><div className="crimedata-setup__counts"><span><b>{Number(data.live.INCIDENTS).toLocaleString('en-GB')}</b> live incidents</span><span><b>{Number(data.live.REPORTS).toLocaleString('en-GB')}</b> live reports</span><span><b>{Number(data.backup.INCIDENTS).toLocaleString('en-GB')}</b> selected saved incidents</span></div>
      <div className="crimedata-setup__actions"><button type="button" onClick={()=>setReview(x=>!x)}>{review?'Hide saved-profile review':'Review saved profile (read only)'}</button></div>
      <p>{data.activationNotice}</p>
      {!data.capabilities.restore?<p data-testid="activation-blocked">Activation is disabled for this saved profile pending its separate acceptance and global-switch approval. No data or security entitlement is changed by reviewing it.</p>:<>
        <label className="profile-activation-confirmation">Global replacement confirmation<input aria-label="Global replacement confirmation" value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder={confirmText}/></label>
        <div className="crimedata-setup__actions"><button type="button" disabled={working||confirmation!==confirmText} onClick={()=>perform('load')}>Restore selected legacy profile</button>{data.capabilities.nrtRestore&&<button type="button" disabled={working||confirmation!==confirmText} onClick={()=>perform('load-nrt')}>Restore legacy profile with shifted occurrence times</button>}</div>
      </>}
      {review&&<SavedProfileReview key={selectedCode+user} user={user} profileCode={selectedCode} activeProfileCode={data.activeProfileCode} onClose={()=>setReview(false)}/>}
    </>}{notice&&<p>{notice}</p>}{error&&<p className="pattern-error" role="alert">{error}</p>}
  </section>;
}
