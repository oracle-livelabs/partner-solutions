'use strict';

// Explicit restore targets. Unknown identifiers must never fall back to Adelaide.
const profileConfig = Object.freeze({
  ADELAIDE_DATA: {prefix:'basic_bak',name:'Adelaide Data Set V1 - Baseline',city:'Adelaide Metropolitan Area'},
  ADELAIDE_DATA_V2: {prefix:'adelaide_v2_bak',name:'Adelaide Data Set V2 - Scenario Enrichment',city:'Adelaide Metropolitan Area'},
  ADELAIDE_DATA_V3: {name:'Adelaide Data Set V3 - Metro Suburb Coverage',city:'Adelaide Metropolitan Area'},
  PERTH_DATA: {prefix:'perth_bak',name:'Perth Data Set Profile',city:'Perth Metropolitan Area'},
  PERTH_DATA_V2: {name:'Perth Data Set V2 - Mixed Suburb Coverage',city:'Perth Metropolitan Region Scheme area'},
  BRISBANE_DATA_V2: {name:'Brisbane Data Set V2 - Mixed Suburb Workshop',city:'Brisbane'},
  BRISBANE_DATA: {prefix:'brisbane_bak',name:'Brisbane Data Set Profile',city:'Brisbane Metropolitan Area'},
  AMSTERDAM_DATA_V1: {name:'Amsterdam May-June 2026 V1',city:'Amsterdam'},
  BRUSSELS_DATA_V1: {name:'Brussels-Capital May-June 2026 V1',city:'Brussels'},
  DUBLIN_CITY_DATA_V1: {name:'Dublin City Synthetic Data Set V1 - May-June 2026',city:'Dublin'},
  BOSTON_CITY_DATA_V1: {name:'Boston City Synthetic Data Set V1 - May-June 2026',city:'Boston'},
  BOSTON_DATA_V2: {name:'Boston Data Set V2 - Mixed Neighborhood Workshop',city:'Boston'},
  CHICAGO_CITY_DATA_V2: {name:'Chicago City Synthetic Data V2 - May-June 2026',city:'Chicago'},
  CHICAGO_DATA_V2: {name:'Chicago Data Set V2 - Mixed Neighborhood Workshop',city:'Chicago'},
  LAS_VEGAS_URBAN_DATA_V1: {name:'Las Vegas Urban Synthetic Data Set V1 - May-June 2026',city:'Las Vegas'},
  LAS_VEGAS_DATA_V2: {name:'Las Vegas Data Set V2 - Mixed Neighborhood Workshop',city:'Las Vegas'},
});
const europeanProfiles = new Set(['AMSTERDAM_DATA_V1','BRUSSELS_DATA_V1','DUBLIN_CITY_DATA_V1']);
const usaProfiles = new Set(['LAS_VEGAS_DATA_V2','CHICAGO_DATA_V2','BOSTON_DATA_V2','BOSTON_CITY_DATA_V1','CHICAGO_CITY_DATA_V2','LAS_VEGAS_URBAN_DATA_V1']);
const standardOnlyProfiles = new Set([...europeanProfiles,...usaProfiles,'PERTH_DATA_V2','BRISBANE_DATA_V2']);
const standardRestoreCodes = Object.freeze(Object.keys(profileConfig));
const nrtRestoreCodes = Object.freeze(['ADELAIDE_DATA','ADELAIDE_DATA_V2','ADELAIDE_DATA_V3','PERTH_DATA','BRISBANE_DATA']);
function requestedProfile(code) {
  if(typeof code!=='string'||!Object.hasOwn(profileConfig,code))throw Object.assign(new Error('Unknown or missing dataset profile. No fallback profile was selected.'),{status:400});
  return code;
}
function profileSelectionGuard(req,res,next) {
  const action=req.path.slice(1),read=req.method==='GET'&&action==='profiles';
  if(!read&&!(req.method==='POST'&&['load','load-nrt','backup','delete'].includes(action)))return next();
  try {
    if(!read&&req.demoUser!=='statewide_admin')return res.status(403).json({error:'IncidentData Setup changes are restricted to statewide_admin.'});
    const code=requestedProfile(read?(req.query.profileCode??'ADELAIDE_DATA_V2'):req.body?.profileCode);
    if(!read&&standardOnlyProfiles.has(code)&&action!=='load')return res.status(400).json({error:'This saved profile supports standard restore only. NRT, capture and delete are not enabled.'});
    return next();
  }catch(e){return res.status(e.status||500).json({error:e.message});}
}
function createProfileSetup(db) {
  async function profileStatus(demoUser,code='ADELAIDE_DATA_V2') {
    const profileCode=requestedProfile(code);
    // All SQL identifiers here are fixed application constants, never request values.
    const catalogueCodes=Object.keys(profileConfig).map(c=>"'"+c+"'").join(',');
    return db(demoUser,async c=>{
      const [profile,profiles,live,backup,active]=await Promise.all([
        c.execute('SELECT profile_code,profile_name,city_label,profile_status,profile_notes,captured_at AS last_backup_at FROM z_base_dataset_profiles WHERE profile_code=:profileCode',{profileCode}),
        c.execute(`SELECT p.profile_code,p.profile_name,p.city_label,p.profile_status,p.profile_notes,p.captured_at AS last_backup_at,COUNT(i.incident_id) AS incident_count,COUNT(DISTINCT NULLIF(TRIM(i.suburb),'')) AS suburb_count FROM z_base_dataset_profiles p LEFT JOIN z_base_crime_incidents i ON i.dataset_profile_id=p.dataset_profile_id WHERE p.profile_code IN (${catalogueCodes}) GROUP BY p.profile_code,p.profile_name,p.city_label,p.profile_status,p.profile_notes,p.captured_at ORDER BY p.profile_code`),
        c.execute('SELECT (SELECT COUNT(*) FROM crime_incidents) incidents,(SELECT COUNT(*) FROM incident_reports) reports,(SELECT COUNT(*) FROM persons_of_interest) persons,(SELECT COUNT(*) FROM case_files) cases FROM dual'),
        c.execute('SELECT (SELECT COUNT(*) FROM z_base_crime_incidents b JOIN z_base_dataset_profiles p ON p.dataset_profile_id=b.dataset_profile_id WHERE p.profile_code=:profileCode) incidents,(SELECT COUNT(*) FROM z_base_incident_reports b JOIN z_base_dataset_profiles p ON p.dataset_profile_id=b.dataset_profile_id WHERE p.profile_code=:profileCode) reports,(SELECT COUNT(*) FROM z_base_persons b JOIN z_base_dataset_profiles p ON p.dataset_profile_id=b.dataset_profile_id WHERE p.profile_code=:profileCode) persons,(SELECT COUNT(*) FROM z_base_case_files b JOIN z_base_dataset_profiles p ON p.dataset_profile_id=b.dataset_profile_id WHERE p.profile_code=:profileCode) cases FROM dual',{profileCode}),
        c.execute('SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1'),
      ]);
      if(!profile.rows.length)throw Object.assign(new Error('The selected dataset profile is not registered in Z_BASE.'),{status:404});
      return {profile:profile.rows[0],profiles:profiles.rows,live:live.rows[0],backup:backup.rows[0],activeProfileCode:active.rows[0]?.PROFILE_CODE||null};
    });
  }
  return {profileConfig,requestedProfile,profileStatus,profileSelectionGuard};
}
module.exports={profileConfig,requestedProfile,profileSelectionGuard,createProfileSetup,standardRestoreCodes,nrtRestoreCodes,europeanProfiles,usaProfiles,standardOnlyProfiles};
