'use strict';
async function loadIdentifierDetail(c,personRef){
 const profile=(await c.execute(`SELECT a.dataset_profile_id,p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`)).rows[0];
 const person=(await c.execute(`SELECT p.person_ref,p.display_name,p.alias_name,p.person_status,p.portrait_variant,p.portrait_asset_uri,p.portrait_alt_text,p.narrative_summary,
  DBMS_LOB.SUBSTR(p.narrative_text,4000,1) narrative_text,p.profile_attributes,p.created_at,
  (SELECT COUNT(*) FROM person_incident_links l JOIN secure_crime_incidents_v i ON i.incident_id=l.incident_id WHERE l.person_id=p.person_id) scoped_incident_count
  FROM secure_persons_of_interest_v p WHERE p.person_ref=:ref`,{ref:personRef})).rows[0];
 if(!person)return null;
 const identifiers=(await c.execute(`SELECT identifier_id,person_ref,identifier_type,namespace,identifier_value,normalized_value,review_status,source_ref,source_note,
  recorded_by,reviewed_by,reviewed_at,valid_from,valid_to,created_at
  FROM secure_poi_identifiers_v WHERE person_ref=:ref ORDER BY created_at,identifier_type,identifier_id FETCH FIRST 1001 ROWS ONLY`,{ref:personRef})).rows;
 const current=(await c.execute('SELECT dataset_profile_id FROM z_base_active_dataset_profile WHERE control_id=1')).rows[0];
 if(!profile||current?.DATASET_PROFILE_ID!==profile.DATASET_PROFILE_ID){const error=Error('The active dataset changed. Close this record and open it again.');error.status=409;throw error;}
 return {person,identifiers:identifiers.slice(0,1000),truncated:identifiers.length>1000,profileId:profile.DATASET_PROFILE_ID,profileCode:profile.PROFILE_CODE};
}
function registerPoiIdentifierDetail(app,db){
 app.get('/api/persons/:personRef/identifiers',async(req,res)=>{
  const ref=String(req.params.personRef||'').trim();
  if(!ref||ref.length>24)return res.status(400).json({error:'Invalid person reference.'});
  try{
   const value=await db(req.demoUser,c=>loadIdentifierDetail(c,ref));
   if(!value)return res.status(404).json({error:'No authorised person record found.'});
   res.json(value);
  }catch(e){console.error('POI identifier detail:',e.message);res.status(e.status||500).json({error:e.status?e.message:'Unable to load the person record. Please try again.'});}
 });
}
module.exports={registerPoiIdentifierDetail,loadIdentifierDetail};
