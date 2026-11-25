'use strict';
// Explicit relationships only. Semantic matches never create a trail edge.
const {storyForProfile,visibleStory}=require('./care-trust-stories');
const {activeContext}=require('./profile-library');
const rows=async(c,sql,binds={})=>(await c.execute(sql,binds)).rows;
const invalid=()=>Object.assign(Error('Invalid investigation context.'),{status:400});
function context(input={}){
  const result={};
  for(const [key,max] of [['patternCode',40],['incidentRef',24],['postRef',40]]){
    const value=String(input[key]||'').trim();
    if(value&&(value.length>max||!/^[A-Z0-9_-]+$/.test(value)))throw invalid();
    result[key]=value||null;
  }
  if(!Object.values(result).some(Boolean))throw invalid();
  return result;
}
async function trail(c,input){
  const b=context(input);
  // When two contexts are supplied, require the recorded relationship between them.
  const incidents=await rows(c,`SELECT i.incident_ref,i.suburb,i.incident_status,r.report_summary,
    (SELECT COUNT(*) FROM secure_ei_items_v e WHERE e.incident_id=i.incident_id) evidence_count
    FROM secure_crime_incidents_v i JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id
    WHERE (:incidentRef IS NULL OR i.incident_ref=:incidentRef)
      AND (:patternCode IS NULL OR EXISTS(SELECT 1 FROM watched_pattern_incidents w WHERE w.incident_ref=i.incident_ref AND w.pattern_code=:patternCode))
      AND (:postRef IS NULL OR EXISTS(SELECT 1 FROM social_post_incident_links l JOIN secure_social_media_posts_v s ON s.post_ref=l.post_ref WHERE l.incident_ref=i.incident_ref AND l.post_ref=:postRef AND l.review_status='reviewed'))
    ORDER BY i.occurred_at,i.incident_ref FETCH FIRST 100 ROWS ONLY`,b);
  const patterns=await rows(c,`SELECT w.pattern_code,w.pattern_name,w.case_ref FROM watched_crime_patterns w
    WHERE w.active=1 AND (:patternCode IS NULL OR w.pattern_code=:patternCode)
    AND EXISTS(SELECT 1 FROM watched_pattern_incidents wi JOIN secure_crime_incidents_v i ON i.incident_ref=wi.incident_ref WHERE wi.pattern_code=w.pattern_code AND (:incidentRef IS NULL OR i.incident_ref=:incidentRef))
    AND (:postRef IS NULL OR EXISTS(SELECT 1 FROM watched_pattern_posts wp JOIN secure_social_media_posts_v s ON s.post_ref=wp.post_ref WHERE wp.pattern_code=w.pattern_code AND wp.post_ref=:postRef))`,b);
  const posts=await rows(c,`SELECT s.post_ref,s.post_text,s.posted_at,s.verification_status,s.topic_code,
    JSON_VALUE(s.post_attributes,'$.knowledge_set_id') knowledge_set_id,
    l.incident_ref,l.link_summary,l.review_status
    FROM secure_social_media_posts_v s LEFT JOIN (
      SELECT l.* FROM social_post_incident_links l JOIN secure_crime_incidents_v i ON i.incident_ref=l.incident_ref WHERE l.review_status='reviewed'
    ) l ON l.post_ref=s.post_ref
    WHERE (:postRef IS NULL OR s.post_ref=:postRef)
      AND (:patternCode IS NULL OR EXISTS(SELECT 1 FROM watched_pattern_posts wp WHERE wp.post_ref=s.post_ref AND wp.pattern_code=:patternCode))
      AND (:incidentRef IS NULL OR l.incident_ref=:incidentRef)
    ORDER BY CASE WHEN JSON_VALUE(s.post_attributes,'$.knowledge_set_id') IS NOT NULL THEN 0 ELSE 1 END,s.posted_at,s.post_ref FETCH FIRST 100 ROWS ONLY`,b);
  const evidence=[];
  for(const i of incidents)evidence.push(...await rows(c,`SELECT evidence_ref,incident_ref,title,evidence_type,case_ref FROM secure_ei_items_v WHERE incident_ref=:r ORDER BY evidence_ref`,{r:i.INCIDENT_REF}));
  // Story instructions contain no identities or conclusions. Each step requires all its scoped sources.
  const profile=await activeContext(c),story=storyForProfile(profile.profileCode);
  const relevant=story&&incidents.length>0&&patterns.some(p=>p.PATTERN_CODE===story.patternCode&&p.CASE_REF===story.caseRef);
  const visible=relevant?await rows(c,`SELECT e.evidence_ref FROM secure_ei_items_v e WHERE e.case_ref=:r`,{r:story.caseRef}):[];
  return {context:b,patterns,incidents,posts,evidence,story:relevant?visibleStory(profile.profileCode,visible.map(e=>e.EVIDENCE_REF)):null,
    notice:'Recorded comparison links explain why to inspect a source. Public posts remain unverified; a link is not corroboration or a finding.'};
}
async function linkedIncidents(c,input){
  const {patternCode}=context({patternCode:input.patternCode});
  const binds={patternCode};for(const k of ['q','category','suburb','status','area'])binds[k]=String(input[k]||'').trim().slice(0,500)||null;
  return rows(c,`SELECT i.incident_id,i.incident_ref,i.suburb,i.incident_status,i.occurred_at,i.location_type,i.modus_operandi,i.latitude,i.longitude,
    cat.executive_group_label category_name,cat.category_name detailed_category_name,cat.display_color,cat.severity_band,p.area_name,r.report_summary
    FROM secure_crime_incidents_v i JOIN incident_categories cat ON cat.category_id=i.category_id JOIN patrol_areas p ON p.patrol_area_id=i.patrol_area_id JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id
    JOIN watched_pattern_incidents w ON w.incident_ref=i.incident_ref AND w.pattern_code=:patternCode
    WHERE cat.active=1 AND (:q IS NULL OR INSTR(LOWER(i.incident_ref||' '||i.suburb||' '||r.report_summary),LOWER(:q))>0 OR DBMS_LOB.INSTR(LOWER(r.report_text),LOWER(:q))>0)
    AND (:category IS NULL OR cat.executive_group_label=:category) AND (:suburb IS NULL OR i.suburb=:suburb) AND (:status IS NULL OR i.incident_status=:status) AND (:area IS NULL OR p.area_name=:area)
    ORDER BY i.occurred_at DESC FETCH FIRST 200 ROWS ONLY`,binds);
}
function registerInvestigationTrail(app,db){app.get('/api/incidents',async(req,res,next)=>{
  if(!req.query.patternCode)return next();
  try{res.json(await db(req.demoUser,c=>linkedIncidents(c,req.query)));}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Linked incidents unavailable.'});}
});app.get('/api/investigation-trail',async(req,res)=>{
  try{res.json(await db(req.demoUser,c=>trail(c,req.query)));}catch(e){console.error('Investigation trail:',e.message);res.status(e.status||503).json({error:e.status?e.message:'Investigation trail unavailable.'});}
});}
module.exports={context,trail,linkedIncidents,registerInvestigationTrail};
