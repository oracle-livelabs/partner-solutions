/* Scoped live map queries use the active profile's calendar, not session UTC. */
const {activeContext,zonedSql,parseFilters}=require('./profile-library');
async function timeline(c,query={}) {
  const f=parseFilters({...query,limit:undefined}),context=await activeContext(c);
  const extra={};for(const key of ['suburb','area','category','month']){if(query[key]!==undefined&&(typeof query[key]!=='string'||query[key].length>200))throw Object.assign(Error('Invalid map filter.'),{status:400});extra[key]=query[key]?.trim()||null;}
  if(extra.month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(extra.month))throw Object.assign(Error('Invalid month.'),{status:400});
  const limit=query.limit===undefined?2500:Number(query.limit);if(!Number.isInteger(limit)||limit<1||limit>25000)throw Object.assign(Error('Invalid marker limit.'),{status:400});
  const time=zonedSql('i.occurred_at',context.timeZone);
  const role="COALESCE(JSON_VALUE(i.incident_attributes,'$.location_role'),CASE WHEN i.latitude IS NULL OR i.longitude IS NULL THEN 'locality_reference' ELSE 'physical_context' END)";
  const physical=`i.latitude BETWEEN -90 AND 90 AND i.longitude BETWEEN -180 AND 180 AND ${role}<>'locality_reference'`;
  const binds={q:f.q,category:extra.category,suburb:extra.suburb,area:extra.area,status:f.status,month:extra.month,fromDate:f.from,toDate:f.to};
  const where=`cat.active=1 AND (:q IS NULL OR INSTR(LOWER(i.incident_ref),LOWER(:q))>0 OR INSTR(LOWER(i.suburb),LOWER(:q))>0
    OR INSTR(LOWER(cat.category_name),LOWER(:q))>0 OR INSTR(LOWER(cat.executive_group_label),LOWER(:q))>0
    OR INSTR(LOWER(r.report_summary),LOWER(:q))>0 OR DBMS_LOB.INSTR(LOWER(r.report_text),LOWER(:q))>0)
    AND (:category IS NULL OR cat.executive_group_label=:category) AND (:suburb IS NULL OR i.suburb=:suburb)
    AND (:area IS NULL OR p.area_name=:area) AND (:status IS NULL OR i.incident_status=:status)
    AND (:month IS NULL OR TO_CHAR(${time},'YYYY-MM')=:month)
    AND (:fromDate IS NULL OR TO_CHAR(${time},'YYYY-MM-DD')>=:fromDate)
    AND (:toDate IS NULL OR TO_CHAR(${time},'YYYY-MM-DD')<=:toDate)`;
  const joins=`FROM secure_crime_incidents_v i JOIN incident_categories cat ON cat.category_id=i.category_id
    JOIN patrol_areas p ON p.patrol_area_id=i.patrol_area_id JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id`;
  const rows=(await c.execute(`SELECT i.incident_id,i.incident_ref,i.suburb,i.incident_status,TO_CHAR(${time},'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') occurred_at,
    i.location_type,i.modus_operandi,i.latitude,i.longitude,${role} location_role,cat.executive_group_label category_name,
    cat.category_name detailed_category_name,cat.display_color,cat.severity_band,p.area_name,r.report_summary ${joins}
    WHERE ${where} ORDER BY i.occurred_at DESC,i.incident_ref FETCH FIRST :limit ROWS ONLY`,{...binds,limit})).rows;
  const coverage=(await c.execute(`SELECT i.suburb,ROUND(AVG(CASE WHEN ${physical} THEN i.latitude END),6) latitude,
    ROUND(AVG(CASE WHEN ${physical} THEN i.longitude END),6) longitude,COUNT(*) incident_count ${joins}
    WHERE ${where} GROUP BY i.suburb ORDER BY incident_count DESC,i.suburb`,binds)).rows;
  const summary=(await c.execute(`SELECT COUNT(*) total_count,SUM(CASE WHEN i.incident_status NOT IN ('resolved','closed_no_further_action') THEN 1 ELSE 0 END) open_count,
    SUM(CASE WHEN ${physical} THEN 1 ELSE 0 END) physical_count,SUM(CASE WHEN ${role}='locality_reference' THEN 1 ELSE 0 END) reference_count ${joins} WHERE ${where}`,binds)).rows[0];
  const timeBounds=(await c.execute(`SELECT TO_CHAR(MIN(${time}),'YYYY-MM-DD') earliest_date,TO_CHAR(MAX(${time}),'YYYY-MM-DD') latest_date FROM secure_crime_incidents_v i`)).rows[0];
  return {rows,coverage,summary,timeBounds,limit,context,notice:context.notice};
}
function registerLiveIncidentMap(app,db) {
  for(const route of ['/api/incidents/map','/api/incidents/map/timeline'])app.get(route,async(req,res)=>{try{res.json(await db(req.demoUser,c=>timeline(c,req.query)));}catch(e){console.error('Scoped map read:',e.message);res.status(e.status||500).json({error:e.status?e.message:'Scoped incident map is unavailable.'});}});
}
module.exports={timeline,registerLiveIncidentMap};
