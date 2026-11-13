import React,{useEffect,useState} from 'react';
import SavedProfileReview from './SavedProfileReview';
import {FOUNDATION_PROFILES,foundationTiles,additionalProfiles} from './foundation-profiles.mjs';
export default function ProfileLibraryPanel({user}) {
  const [code,setCode]=useState(''),[data,setData]=useState(null),[review,setReview]=useState(false),[confirmation,setConfirmation]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState(false),[notice,setNotice]=useState('');
  const [catalogue,setCatalogue]=useState([]);
  useEffect(()=>{
    setData(null);setReview(false);setConfirmation('');setError('');setNotice('');
    if(user!=='statewide_admin'){setCatalogue([]);return;}
    const controller=new AbortController();let cancelled=false;
    fetch('/api/setup/profiles'+(code?'?profileCode='+encodeURIComponent(code):''),{headers:{'X-Demo-User':user},signal:controller.signal}).then(async r=>{
      const x=await r.json();if(!r.ok)throw Error(x.error||'Profile catalogue unavailable');
      if(!x.profile?.PROFILE_CODE||(code&&x.profile.PROFILE_CODE!==code))throw Error('The server returned a different dataset profile. Restore is disabled; refresh and try again.');
      return x;
    }).then(x=>{if(!cancelled){setData(x);setCatalogue(x.profiles);}}).catch(e=>{if(!cancelled&&e.name!=='AbortError')setError(e.message);});
    return()=>{cancelled=true;controller.abort();};
  },[code,user]);
  if(user!=='statewide_admin')return <section className="crimedata-setup"><h2>Saved profile library</h2><p>Saved-library review is restricted to Statewide Admin. Your authorised live incident views and locality scope remain unchanged.</p></section>;
  const selected=data?.profile,selectedCode=selected?.PROFILE_CODE||code,confirmText='ACTIVATE '+selectedCode;
  const selectedCity=FOUNDATION_PROFILES.find(tile=>tile.code===selectedCode)?.city||selected?.CITY_LABEL;
  const extras=additionalProfiles(catalogue);
  const selectProfile=nextCode=>{if(working||nextCode===selectedCode)return;setData(null);setReview(false);setConfirmation('');setCode(nextCode);};
  const perform=action=>{
    if(working||!data||confirmation!==confirmText||!data.capabilities.restore)return;
    if(action==='load-nrt'&&!data.capabilities.nrtRestore)return;
    setWorking(true);setError('');setNotice('');
    fetch('/api/setup/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Demo-User':user},body:JSON.stringify({profileCode:selectedCode,confirmation,expectedActiveProfileCode:data.activeProfileCode})}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Action unavailable');if(x.profile?.PROFILE_CODE!==selectedCode)throw Error('Restore response did not match the selected profile. Refresh the catalogue before continuing.');return x;}).then(x=>{setData(x);setCatalogue(x.profiles);setConfirmation('');setNotice(x.message);window.dispatchEvent(new Event('crimedata-profile-changed'));}).catch(e=>{setError(e.message);setConfirmation('');}).finally(()=>setWorking(false));
  };
  return <section className="crimedata-setup" aria-label="Saved profile library">
    <header><div><small className="kicker">CRIMEDATA SETUP · Z_BASE DATASET PROFILE LIBRARY</small><h2>CrimeData Setup</h2><p>Six city datasets: Adelaide, Perth, Brisbane, Amsterdam, Brussels and Dublin. Selecting or reviewing a tile does not change the active dataset.</p><p>Active operational profile: <b data-testid="active-profile-code">{data?.activeProfileCode||'Loading…'}</b></p></div></header>
    <div className="crimedata-setup__profiles">{foundationTiles(catalogue).map(({code:tileCode,city,profile:p})=>
      <button type="button" key={tileCode} data-profile-code={tileCode} className={tileCode===selectedCode?'active':'planned'} aria-pressed={tileCode===selectedCode} disabled={working||!p} onClick={()=>selectProfile(tileCode)}>
        <small>{tileCode===data?.activeProfileCode?'ACTIVE DATASET':p?'SAVED PROFILE':'PROFILE UNAVAILABLE'}</small><b>{city}</b><p>{p?.PROFILE_NAME||'Waiting for saved profile metadata'}</p>
        {p&&<span className="crimedata-setup__coverage"><strong>{Number(p.INCIDENT_COUNT).toLocaleString('en-GB')}</strong> incidents · <strong>{Number(p.SUBURB_COUNT).toLocaleString('en-GB')}</strong> source locality labels</span>}<em>{tileCode}</em>
      </button>
    )}</div>
    {extras.length>0&&<details className="crimedata-setup__additional"><summary>Other saved profiles ({extras.length})</summary>
      {extras.map(p=><button type="button" key={p.PROFILE_CODE} aria-pressed={p.PROFILE_CODE===selectedCode} disabled={working} onClick={()=>selectProfile(p.PROFILE_CODE)}>{p.PROFILE_NAME} · {Number(p.INCIDENT_COUNT).toLocaleString('en-GB')} incidents · {p.PROFILE_CODE}</button>)}
    </details>}
    {data&&<><div className="crimedata-setup__counts"><span><b>{Number(data.live.INCIDENTS).toLocaleString('en-GB')}</b> live incidents</span><span><b>{Number(data.live.REPORTS).toLocaleString('en-GB')}</b> live reports</span><span><b>{Number(data.backup.INCIDENTS).toLocaleString('en-GB')}</b> selected saved incidents</span></div>
      <div className="crimedata-setup__actions"><button type="button" disabled={working} onClick={()=>setReview(x=>!x)}>{review?'Hide saved-profile review':'Review saved profile (read only)'}</button></div>
      <p className="crimedata-setup__access">Review does not activate a profile. Restore replaces the single active operational dataset for all users. Confirm the selected profile before restoring.</p>
      {!data.capabilities.restore?<p data-testid="activation-blocked">Restore is not enabled for this saved profile. Read-only review does not change any data or security entitlement.</p>:<>
        <label className="profile-activation-confirmation">To restore {selectedCity}, enter <code>{confirmText}</code><input aria-label="Global replacement confirmation" value={confirmation} disabled={working} onChange={e=>setConfirmation(e.target.value)} placeholder={confirmText}/></label>
        <div className="crimedata-setup__actions"><button type="button" className="restore" disabled={working||confirmation!==confirmText} onClick={()=>perform('load')}>Restore {selectedCity}</button>{data.capabilities.nrtRestore&&<button type="button" className="restore nrt" disabled={working||confirmation!==confirmText} onClick={()=>perform('load-nrt')}>Restore {selectedCity} NRT</button>}</div>
        {!data.capabilities.nrtRestore&&<p className="crimedata-setup__access">Standard restore only. NRT time shifting, capture and delete are not enabled for this profile.</p>}
      </>}
      {review&&<SavedProfileReview key={selectedCode+user} user={user} profileCode={selectedCode} activeProfileCode={data.activeProfileCode} onClose={()=>setReview(false)}/>}
    </>}{notice&&<p>{notice}</p>}{error&&<p className="pattern-error" role="alert">{error}</p>}
  </section>;
}
