/* Data-driven saved-profile discovery and READ-ONLY review. No activation DML. */
const oracle = require('oracledb');
const NOTICE = 'Synthetic demonstration data. These are not actual police incidents.';
const fail = (status, message) => Object.assign(new Error(message), {status});
function profileCode(value) {
  if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]{1,79}$/.test(value)) throw fail(400, 'A valid explicit profile code is required.');
  return value;
}
function json(value) {
  if (typeof value === 'string') { try { return JSON.parse(value); } catch { return {}; } }
  return value && typeof value === 'object' ? value : {};
}
function validZone(value) {
  if (typeof value !== 'string') return null;
  try { new Intl.DateTimeFormat('en-GB', {timeZone:value}).format(0); return value; } catch { return null; }
}
function zonedSql(column, zone) {
  if (!/^[a-z_.]+$/i.test(column) || !validZone(zone)) throw fail(400, 'Invalid time-zone expression.');
  return `(${column} AT TIME ZONE '${zone.replace(/'/g,"''")}')`;
}
function parseFilters(query={}) {
  const result={};
  for (const key of ['q','group','category','area','status','role','from','to']) {
    const value=query[key];
    if (value !== undefined && (typeof value !== 'string' || value.length>200)) throw fail(400, 'Invalid '+key+' filter.');
    result[key]=value?.trim() || null;
  }
  if (result.role && !['physical_context','locality_reference'].includes(result.role)) throw fail(400,'Invalid location role.');
  for (const key of ['from','to']) if (result[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(result[key]) || Number.isNaN(Date.parse(result[key]+'T00:00:00Z')) || new Date(result[key]+'T00:00:00Z').toISOString().slice(0,10)!==result[key])) throw fail(400,'Invalid calendar date.');
  if (result.from && result.to && result.from>result.to) throw fail(400,'Start date must not follow end date.');
  const bounded = (value, fallback, max) => { const n=value===undefined?fallback:Number(value); if(!Number.isInteger(n)||n<1||n>max)throw fail(400,'Invalid result limit.');return n; };
  result.limit=bounded(query.limit,75,200);result.mapLimit=bounded(query.mapLimit,15000,25000);
  return result;
}
function contextFrom(row) {
  const document=json(row.CONFIG_DOCUMENT),config=json(document.config);
  const timeZone=validZone(config.time_zone);
  let locale='en-GB';try{if(config.locale)locale=Intl.getCanonicalLocales(config.locale)[0];}catch{}
  return {profileCode:row.PROFILE_CODE,profileName:row.PROFILE_NAME,cityLabel:row.CITY_LABEL,status:row.PROFILE_STATUS,
    timeZone:timeZone||'UTC',timeZoneConfigured:!!timeZone,locale,notice:NOTICE,
    bounds:config.geography?.municipal_bounds_wgs84||null,
    activationReady:document.activation_ready===true,activationBlockers:document.activation_blockers||[],
    classification:config.source_taxonomy||null,synthetic:true};
}
async function getProfile(c, code) {
  const rows=(await c.execute(`SELECT p.dataset_profile_id,p.profile_code,p.profile_name,p.city_label,p.profile_status,p.profile_notes,p.captured_at,
    cfg.config_document FROM z_base_dataset_profiles p LEFT JOIN z_base_profile_config cfg ON cfg.dataset_profile_id=p.dataset_profile_id
    WHERE p.profile_code=:code`,{code:profileCode(code)})).rows;
  if (!rows.length) throw fail(404,'Saved profile not found.');return rows[0];
}
async function activeContext(c) {
  const rows=(await c.execute(`SELECT p.dataset_profile_id,p.profile_code,p.profile_name,p.city_label,p.profile_status,cfg.config_document
    FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id
    LEFT JOIN z_base_profile_config cfg ON cfg.dataset_profile_id=p.dataset_profile_id WHERE a.control_id=1`)).rows;
  if(!rows.length)throw fail(503,'No active profile is configured.');return contextFrom(rows[0]);
}
async function requireAdmin(c,user) {
  if(user!=='statewide_admin')throw fail(403,'Saved-profile library review is restricted to the existing Statewide Admin. Live locality access is unchanged.');
  const row=(await c.execute('SELECT role_name,is_active FROM security_users WHERE user_name=:userName',{userName:user})).rows[0];
  if(row?.ROLE_NAME!=='admin'||row.IS_ACTIVE!==1)throw fail(403,'An active library administrator is required.');
}
const joins=`FROM z_base_crime_incidents i
  JOIN z_base_incident_categories cat ON cat.dataset_profile_id=i.dataset_profile_id AND cat.category_id=i.category_id
  JOIN z_base_incident_reports r ON r.dataset_profile_id=i.dataset_profile_id AND r.incident_id=i.incident_id`;
const areaSql="COALESCE(JSON_VALUE(i.incident_attributes,'$.administrative_area_name'),JSON_VALUE(i.incident_attributes,'$.district_area_name_nl'),i.address_locality,i.suburb)";
const roleSql="COALESCE(JSON_VALUE(i.incident_attributes,'$.location_role'),CASE WHEN i.latitude IS NULL OR i.longitude IS NULL THEN 'locality_reference' ELSE 'physical_context' END)";
const physicalSql=`i.latitude BETWEEN -90 AND 90 AND i.longitude BETWEEN -180 AND 180 AND ${roleSql}<>'locality_reference'`;
function whereFor(filters,zone) {
  const time=zonedSql('i.occurred_at',zone);
  return `i.dataset_profile_id=:pid AND cat.active=1
    AND (:q IS NULL OR INSTR(LOWER(i.incident_ref),LOWER(:q))>0 OR INSTR(LOWER(i.suburb),LOWER(:q))>0
      OR INSTR(LOWER(cat.category_name),LOWER(:q))>0 OR INSTR(LOWER(r.report_summary),LOWER(:q))>0 OR DBMS_LOB.INSTR(LOWER(r.report_text),LOWER(:q))>0)
    AND (:groupCode IS NULL OR cat.executive_group_code=:groupCode) AND (:category IS NULL OR cat.category_code=:category)
    AND (:area IS NULL OR ${areaSql}=:area) AND (:status IS NULL OR i.incident_status=:status)
    AND (:role IS NULL OR ${roleSql}=:role)
    AND (:fromDate IS NULL OR TO_CHAR(${time},'YYYY-MM-DD')>=:fromDate)
    AND (:toDate IS NULL OR TO_CHAR(${time},'YYYY-MM-DD')<=:toDate)`;
}
function bindFilters(pid,f) { return {pid,q:f.q,groupCode:f.group,category:f.category,area:f.area,status:f.status,role:f.role,fromDate:f.from,toDate:f.to}; }
async function review(c,code,query) {
  const profile=await getProfile(c,code),context=contextFrom(profile),f=parseFilters(query),binds=bindFilters(profile.DATASET_PROFILE_ID,f),where=whereFor(f,context.timeZone),time=zonedSql('i.occurred_at',context.timeZone);
  // Saved tables have profile-only indexes, not the live identity-key indexes.
  // Avoid stop-key nested-loop plans repeatedly scanning the same profile.
  const select=`/*+ LEADING(i) USE_HASH(cat r) */ i.incident_id,i.incident_ref,i.suburb,i.incident_status,TO_CHAR(${time},'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') occurred_at,
    i.location_type,i.latitude,i.longitude,cat.category_code,cat.category_name detailed_category_name,cat.executive_group_code,cat.executive_group_label category_name,
    cat.display_color,cat.severity_band,r.report_summary,${areaSql} district_area,${roleSql} location_role`;
  const records=(await c.execute(`SELECT ${select} ${joins} WHERE ${where} ORDER BY i.occurred_at,i.incident_ref FETCH FIRST :limit ROWS ONLY`,{...binds,limit:f.limit})).rows;
  const markers=(await c.execute(`SELECT /*+ LEADING(i) USE_HASH(cat r) */ i.incident_ref,i.latitude,i.longitude,cat.display_color,cat.executive_group_code,${areaSql} district_area ${joins}
    WHERE ${where} AND ${physicalSql} ORDER BY i.incident_ref FETCH FIRST :mapLimit ROWS ONLY`,{...binds,mapLimit:f.mapLimit})).rows;
  const summary=(await c.execute(`SELECT /*+ LEADING(i) USE_HASH(cat r) */ COUNT(*) total_count,SUM(CASE WHEN ${physicalSql} THEN 1 ELSE 0 END) physical_count,
    SUM(CASE WHEN ${roleSql}='locality_reference' THEN 1 ELSE 0 END) reference_count,
    MIN(TO_CHAR(${time},'YYYY-MM-DD')) first_local_date,MAX(TO_CHAR(${time},'YYYY-MM-DD')) last_local_date,
    COUNT(DISTINCT TO_CHAR(${time},'YYYY-MM-DD')) local_dates ${joins} WHERE ${where}`,binds)).rows[0];
  const categories=(await c.execute(`SELECT /*+ LEADING(i) USE_HASH(cat r) */ cat.category_code,cat.category_name,cat.executive_group_code,cat.executive_group_label,cat.display_color,cat.display_order,COUNT(*) record_count
    ${joins} WHERE i.dataset_profile_id=:pid AND cat.active=1
    GROUP BY cat.category_code,cat.category_name,cat.executive_group_code,cat.executive_group_label,cat.display_color,cat.display_order ORDER BY cat.display_order,cat.category_code`,{pid:profile.DATASET_PROFILE_ID})).rows;
  const areas=(await c.execute(`SELECT ${areaSql} area_name,JSON_VALUE(i.incident_attributes,'$.area_type') area_type,COUNT(*) record_count
    FROM z_base_crime_incidents i WHERE i.dataset_profile_id=:pid GROUP BY ${areaSql},JSON_VALUE(i.incident_attributes,'$.area_type') ORDER BY area_name`,{pid:profile.DATASET_PROFILE_ID})).rows;
  const statuses=(await c.execute('SELECT incident_status,COUNT(*) record_count FROM z_base_crime_incidents WHERE dataset_profile_id=:pid GROUP BY incident_status ORDER BY incident_status',{pid:profile.DATASET_PROFILE_ID})).rows;
  const capabilities=(await c.execute(`SELECT (SELECT COUNT(*) FROM z_base_incident_embeddings WHERE dataset_profile_id=:pid) embeddings,
    (SELECT COUNT(*) FROM z_base_case_files WHERE dataset_profile_id=:pid) cases FROM dual`,{pid:profile.DATASET_PROFILE_ID})).rows[0];
  return {context,summary,records,markers,categories,areas,statuses,capabilities,readOnly:true,scope:'saved_profile_admin_review',
    markerLimit:f.mapLimit,markersTruncated:Number(summary.PHYSICAL_COUNT)>markers.length,recordLimit:f.limit,recordsTruncated:Number(summary.TOTAL_COUNT)>records.length,notice:NOTICE};
}
async function detail(c,code,reference) {
  if(typeof reference!=='string'||reference.length>100)throw fail(400,'Invalid incident reference.');
  const profile=await getProfile(c,code),context=contextFrom(profile),pid=profile.DATASET_PROFILE_ID;
  const incident=(await c.execute(`SELECT i.incident_ref,i.incident_id,i.incident_status,i.suburb,i.location_type,i.latitude,i.longitude,i.incident_attributes,
    TO_CHAR(${zonedSql('i.occurred_at',context.timeZone)},'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM') occurred_at,
    cat.category_name detailed_category_name,cat.executive_group_label category_name,cat.executive_group_code,r.report_summary,r.report_text
    ${joins} WHERE i.dataset_profile_id=:pid AND i.incident_ref=:reference`,{pid,reference},{fetchInfo:{REPORT_TEXT:{type:oracle.STRING}}})).rows[0];
  if(!incident)throw fail(404,'Incident not found in the selected saved profile.');
  const evidence=(await c.execute('SELECT evidence_id,evidence_type,evidence_metadata FROM z_base_evidence_items WHERE dataset_profile_id=:pid AND incident_id=:id ORDER BY evidence_id',{pid,id:incident.INCIDENT_ID})).rows;
  return {context,incident,evidence,notice:NOTICE,readOnly:true};
}
function createProfileLibrary(db,{legacyRestoreCodes=[]}={}) {
  async function readAdmin(user,fn) {
    if(user!=='statewide_admin')throw fail(403,'Saved-profile library access is restricted to Statewide Admin; use the scoped live views.');
    return db(user,async c=>{c.callTimeout=30000;await c.execute('SET TRANSACTION READ ONLY');await requireAdmin(c,user);return fn(c);});
  }
  async function status(user,requested) {
    return readAdmin(user,async c=>{
      const active=await activeContext(c),code=requested?profileCode(requested):active.profileCode,row=await getProfile(c,code);
      const profiles=(await c.execute(`SELECT p.dataset_profile_id,p.profile_code,p.profile_name,p.city_label,p.profile_status,p.profile_notes,p.captured_at last_backup_at,
        (SELECT COUNT(*) FROM z_base_crime_incidents i WHERE i.dataset_profile_id=p.dataset_profile_id) incident_count,
        (SELECT COUNT(DISTINCT suburb) FROM z_base_crime_incidents i WHERE i.dataset_profile_id=p.dataset_profile_id) suburb_count
        FROM z_base_dataset_profiles p ORDER BY p.profile_code`)).rows;
      const live=(await c.execute(`SELECT (SELECT COUNT(*) FROM secure_crime_incidents_v) incidents,(SELECT COUNT(*) FROM secure_incident_reports_v) reports,
        (SELECT COUNT(*) FROM secure_persons_of_interest_v) persons,(SELECT COUNT(*) FROM case_files) cases FROM dual`)).rows[0];
      const backup=(await c.execute(`SELECT (SELECT COUNT(*) FROM z_base_crime_incidents WHERE dataset_profile_id=:pid) incidents,
        (SELECT COUNT(*) FROM z_base_incident_reports WHERE dataset_profile_id=:pid) reports,(SELECT COUNT(*) FROM z_base_persons WHERE dataset_profile_id=:pid) persons,
        (SELECT COUNT(*) FROM z_base_case_files WHERE dataset_profile_id=:pid) cases FROM dual`,{pid:row.DATASET_PROFILE_ID})).rows[0];
      const {CONFIG_DOCUMENT,...profile}=row;
      return {profile,profiles,live,backup,activeProfileCode:active.profileCode,context:contextFrom(row),notice:NOTICE,
        capabilities:{savedReview:true,restore:legacyRestoreCodes.includes(code),nrtRestore:legacyRestoreCodes.includes(code)},
        globalSwitch:true,activationNotice:'Review does not activate. Replacing the global active profile requires separate explicit confirmation and completed acceptance checks.'};
    });
  }
  function register(app) {
    const route=(fn)=>(req,res)=>Promise.resolve().then(()=>fn(req)).then(x=>res.json(x)).catch(e=>res.status(e.status||500).json({error:e.status?e.message:'Saved-profile read failed; no data was changed.'}));
    // Register before presentation-copy rewriting: source labels/provenance are immutable.
    app.get('/api/profile-context',route(req=>db(req.demoUser,activeContext)));
    app.get('/api/setup/profiles',route(req=>status(req.demoUser,req.query.profileCode)));
    app.get('/api/setup/profiles/:profileCode/review',route(req=>readAdmin(req.demoUser,c=>review(c,req.params.profileCode,req.query))));
    app.get('/api/setup/profiles/:profileCode/incidents/:incidentRef',route(req=>readAdmin(req.demoUser,c=>detail(c,req.params.profileCode,req.params.incidentRef))));
  }
  return {register,status,readAdmin};
}
module.exports={NOTICE,profileCode,json,validZone,zonedSql,parseFilters,contextFrom,getProfile,activeContext,requireAdmin,review,detail,createProfileLibrary,whereFor};
