import React,{useEffect,useState} from 'react';
import SavedProfileReview from './SavedProfileReview';
import {FOUNDATION_PROFILES,foundationTiles,additionalProfiles} from './foundation-profiles.mjs';
export default function ProfileLibraryPanel({user}) {
  const [code,setCode]=useState(''),[data,setData]=useState(null),[review,setReview]=useState(false),[confirmation,setConfirmation]=useState(''),[error,setError]=useState(''),[working,setWorking]=useState(false),[notice,setNotice]=useState('');
  const [catalogue,setCatalogue]=useState([]);
  const [elapsed,setElapsed]=useState(0),[refresh,setRefresh]=useState(0);
  const [checkingStatus,setCheckingStatus]=useState(false);
  useEffect(()=>{if(!working)return;const start=Date.now();setElapsed(0);const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[working]);
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
  },[code,user,refresh]);
  if(user!=='statewide_admin')return <section className="crimedata-setup"><h2>Saved profile library</h2><p>Saved-library review is restricted to Statewide Admin. Your authorised live incident views and locality scope remain unchanged.</p></section>;
  const selected=data?.profile,selectedCode=selected?.PROFILE_CODE||code,confirmText='ACTIVATE '+selectedCode;
  const selectedCity=FOUNDATION_PROFILES.find(tile=>tile.code===selectedCode)?.city||selected?.CITY_LABEL;
  const extras=additionalProfiles(catalogue);
  const selectProfile=nextCode=>{if(working||nextCode===selectedCode)return;setData(null);setReview(false);setConfirmation('');setCode(nextCode);};
  const perform=async action=>{
    if(working||!data||confirmation!==confirmText||!data.capabilities.restore)return;
    if(action==='load-nrt'&&!data.capabilities.nrtRestore)return;
    const started=performance.now();
    setWorking(true);setCheckingStatus(false);setElapsed(0);setError('');setNotice('');setReview(false);
    try {
      const r=await fetch('/api/setup/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Demo-User':user},body:JSON.stringify({profileCode:selectedCode,confirmation,expectedActiveProfileCode:data.activeProfileCode})});
      const x=await r.json();if(!r.ok)throw Error(x.error||'Restore did not complete normally.');
      if(x.profile?.PROFILE_CODE!==selectedCode||x.activeProfileCode!==selectedCode||!x.restoreVerification?.verified)throw Error('The selected active profile could not be verified.');
      setData(x);setCatalogue(x.profiles);setNotice('Restore complete and verified in '+Math.round((performance.now()-started)/1000)+'s. '+(x.message||selectedCity+' is active.'));
      window.dispatchEvent(new Event('crimedata-profile-changed'));
    } catch(e) {
      setCheckingStatus(true);
      try {
        const r=await fetch('/api/setup/profiles?profileCode='+encodeURIComponent(selectedCode),{headers:{'X-Demo-User':user}});
        const x=await r.json();if(!r.ok||x.profile?.PROFILE_CODE!==selectedCode)throw Error('Status unavailable');
        setData(x);setCatalogue(x.profiles);setError(e.message+' Current active dataset: '+x.activeProfileCode+'. No automatic retry was made.');
        window.dispatchEvent(new Event('crimedata-profile-changed'));
      } catch {
        setData(null);setError(e.message+' The current active dataset could not be checked. Refresh profiles before attempting another restore.');
      }
    } finally {setConfirmation('');setWorking(false);setCheckingStatus(false);}
  };
  return <section className="crimedata-setup" aria-label="Saved profile library">
    <header><div><small className="kicker">INCIDENTDATA SETUP · Z_BASE DATASET PROFILE LIBRARY</small><h2>IncidentData Setup</h2><p>Choose a city, confirm the global switch, then Restore. Reviewing a saved profile is optional and never changes the active dataset. Third row: Boston, Chicago and Las Vegas.</p><p>Active operational profile: <b data-testid="active-profile-code">{data?.activeProfileCode||(error?'Status unavailable — refresh profiles':'Loading…')}</b></p><button type="button" disabled={working} onClick={()=>setRefresh(x=>x+1)}>Refresh profiles</button></div></header>
    <div className="crimedata-setup__profiles">{foundationTiles(catalogue).map(({code:tileCode,city,profile:p})=>
      <button type="button" key={tileCode} data-profile-code={tileCode} className={tileCode===selectedCode?'active':'planned'} aria-pressed={tileCode===selectedCode} disabled={working||!p} onClick={()=>selectProfile(tileCode)}>
        <small>{tileCode===data?.activeProfileCode?'ACTIVE DATASET':p?'SAVED PROFILE':'PROFILE UNAVAILABLE'}</small><b>{city}</b><p>{p?.PROFILE_NAME||'Waiting for saved profile metadata'}</p>
        {p&&<span className="crimedata-setup__coverage"><strong>{Number(p.INCIDENT_COUNT).toLocaleString('en-GB')}</strong> incidents · <strong>{Number(p.SUBURB_COUNT).toLocaleString('en-GB')}</strong> source locality labels</span>}<em>{tileCode}</em>
        {p&&<span className={'profile-restore-state '+(p.RESTORE_ENABLED?'ready':'review-only')}>{p.RESTORE_ENABLED?'Restore available'+(p.NRT_RESTORE_ENABLED?' · Standard / NRT':' · Standard only'):'Review only · Restore unavailable'}</span>}
      </button>
    )}</div>
    {extras.length>0&&<details className="crimedata-setup__additional"><summary>Other saved profiles ({extras.length})</summary>
      {extras.map(p=><button type="button" key={p.PROFILE_CODE} aria-pressed={p.PROFILE_CODE===selectedCode} disabled={working} onClick={()=>selectProfile(p.PROFILE_CODE)}>{p.PROFILE_NAME} · {Number(p.INCIDENT_COUNT).toLocaleString('en-GB')} incidents · {p.PROFILE_CODE}</button>)}
    </details>}
    {data&&<><div className="crimedata-setup__counts"><span><b>{Number(data.live.INCIDENTS).toLocaleString('en-GB')}</b> live incidents</span><span><b>{Number(data.live.REPORTS).toLocaleString('en-GB')}</b> live reports</span><span><b>{Number(data.backup.INCIDENTS).toLocaleString('en-GB')}</b> selected saved incidents</span></div>
      <div className="crimedata-setup__actions"><button type="button" disabled={working} onClick={()=>setReview(x=>!x)}>{review?'Hide saved-profile review':'Review saved profile (read only)'}</button></div>
      <p className="crimedata-setup__access">Restore replaces the active operational dataset for all users. Shared user accounts and Mobile DickTracy access are preserved. Saved city snapshots and Data Room uploads are not replaced.</p>
      {data.restorationNotice&&<p className="profile-restore-note">{data.restorationNotice}</p>}
      {!data.capabilities.restore?<p data-testid="activation-blocked">Restore is not enabled for this saved profile. Read-only review does not change any data or security entitlement.</p>:<>
        <label className="profile-activation-confirmation">To restore {selectedCity}, enter <code>{confirmText}</code><input aria-label="Global replacement confirmation" value={confirmation} disabled={working} onChange={e=>setConfirmation(e.target.value)} placeholder={confirmText}/></label>
        <p className="profile-restore-note">Allow a few minutes for restoration and verification. Previous city tests took about 1–2½ minutes; timing varies with the dataset and database load.</p>
        <div className="crimedata-setup__actions"><button type="button" className="restore" disabled={working||confirmation!==confirmText} onClick={()=>perform('load')}>Restore {selectedCity}</button>{data.capabilities.nrtRestore&&<button type="button" className="restore nrt" disabled={working||confirmation!==confirmText} onClick={()=>perform('load-nrt')}>Restore {selectedCity} NRT</button>}</div>
        {data.capabilities.nrtRestore&&<p className="profile-restore-note">Standard keeps the saved dates. NRT shifts incident occurrence times so the latest incident is now.</p>}
        {!data.capabilities.nrtRestore&&<p className="crimedata-setup__access">Standard restore only. NRT time shifting, capture and delete are not enabled for this profile.</p>}
      </>}
      {review&&<SavedProfileReview key={selectedCode+user} user={user} profileCode={selectedCode} activeProfileCode={data.activeProfileCode} onClose={()=>setReview(false)}/>}
    </>}{working&&<div className="profile-restore-progress" data-testid="restore-progress">
      <p role="status" aria-live="polite">{checkingStatus?'Checking the current active dataset…':'Restoring '+selectedCity+' and waiting for verification…'}</p>
      <progress aria-label={checkingStatus?'Checking active dataset':'City restoration in progress'}/>
      <span className="profile-restore-elapsed" role="timer" aria-live="off">{elapsed}s elapsed</span>
      <p>{checkingStatus?'The restore response could not be verified. Checking which city is active before enabling another attempt.':elapsed>=150?'This is taking longer than the previous test range. The server has not confirmed completion yet. Keep this page open.':'Keep this page open. Incidents, reports and related data are restored together; completion is shown after verification.'}</p>
    </div>}{notice&&<p className="profile-restore-success" role="status" data-testid="restore-success">{notice}</p>}{error&&<p className="pattern-error" role="alert">{error}</p>}
  </section>;
}
