/* Explicitly destructive loader for the staged Perth 33,511-record re-cut. */
const fs = require('fs');
const oracledb = require('oracledb');
const rows = JSON.parse(fs.readFileSync('generated/perth_33511_may_jun_2026_recut.json', 'utf8'));
const users = [['statewide_admin','admin','Statewide Administrator'],['central_analyst','analyst','Perth Central Analyst'],['northern_analyst','analyst','Perth Northern Analyst'],['southern_analyst','analyst','Perth Southern Analyst'],['read_only_viewer','viewer','Limited Viewer']];
const areas = [['PERTH_CENTRAL','Perth Central','central',-31.953,115.861],['PERTH_NORTH','Northern Perth Metro','north',-31.820,115.820],['PERTH_SOUTH','Southern Perth Metro','south',-32.080,115.940]];
const groups = {person:['OFFENCES_AGAINST_PERSON','Offences against the person','#A33A3A'],property:['OFFENCES_AGAINST_PROPERTY','Offences against property','#437C94'],other:['OTHER_OFFENCES','Drug, public order and other offences','#796087']};
const tables = ['watched_pattern_posts','watched_pattern_incidents','social_post_incident_links','social_media_posts','social_media_sources','watched_crime_patterns','person_visual_embeddings','person_narrative_embeddings','person_profile_embeddings','incident_report_embeddings','semantic_matches','case_incident_links','person_incident_links','evidence_items','incident_reports','case_files','persons_of_interest','crime_incidents','analyst_actions','security_user_geo_entitlements','patrol_areas','incident_categories','security_users'];
async function main() {
  let connection;
  try {
    connection = await oracledb.getConnection({user:process.env.ORACLE_USER||'CRIME_DATA',password:process.env.APP_SCHEMA_PASSWORD||'crime-demo-only',connectString:process.env.ORACLE_CONNECTION_STRING||'localhost:1533/FREEPDB1'});
    const before = await connection.execute('select count(*) from crime_incidents');
    console.log(JSON.stringify({phase:'preflight', existing:Number(before.rows[0][0]), incoming:rows.length}));
    const binds = Object.fromEntries(tables.map((name, index) => [`t${index}`, name.toUpperCase()]));
    const result = await connection.execute(`select table_name from user_tables where table_name in (${tables.map((_, i) => `:t${i}`).join(',')})`, binds);
    const present = new Set(result.rows.map(row => row[0]));
    for (const table of tables) if (present.has(table.toUpperCase())) await connection.execute(`delete from ${table}`);
    for (const [name, role, display] of users) await connection.execute('insert into security_users(user_name,role_name,display_name,is_active) values(:1,:2,:3,1)', [name, role, display]);
    for (const area of areas) await connection.execute('insert into patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) values(:1,:2,:3,:4,:5)', area);
    const areaId = Object.fromEntries((await connection.execute('select area_code,patrol_area_id from patrol_areas')).rows);
    for (const [name, area] of [['central_analyst','PERTH_CENTRAL'],['northern_analyst','PERTH_NORTH'],['southern_analyst','PERTH_SOUTH'],['read_only_viewer','PERTH_CENTRAL']]) await connection.execute('insert into security_user_geo_entitlements(user_name,patrol_area_id) values(:1,:2)', [name, areaId[area]]);
    const categories = [...new Map(rows.map(row => [row.category_code, row])).values()];
    for (let index=0; index<categories.length; index++) { const row=categories[index], group=groups[row.offence_group]; await connection.execute('insert into incident_categories(category_code,category_name,severity_band,executive_group_code,executive_group_label,person_property_class,synthetic_profile_code,display_order,display_color) values(:1,:2,:3,:4,:5,:6,:7,:8,:9)', [row.category_code,row.crime_category,row.severity_band,group[0],group[1],row.offence_group.toUpperCase(),'PERTH_DATA',index+1,group[2]]); }
    const categoryId = Object.fromEntries((await connection.execute('select category_code,category_id from incident_categories')).rows);
    const incidentSql = `insert into crime_incidents(incident_ref,category_id,patrol_area_id,incident_status,occurred_at,location_type,suburb,latitude,longitude,address_line_1,address_locality,address_region,address_country_code,address_precision,modus_operandi,property_category,incident_attributes) values(:ref,:cat,:area,:status,to_timestamp_tz(:occurred,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),:location,:suburb,:lat,:lon,:addr,:locality,:region,'AU','approximate_suburb',:modus,:property,:attrs)`;
    const incidentBinds = rows.map((row,index) => ({ref:row.incident_ref,cat:categoryId[row.category_code],area:areaId[row.patrol_area_code],status:['reported','under_review','assigned','resolved','closed_no_further_action'][index%5],occurred:row.occurred_at,location:row.location_type,suburb:row.suburb,lat:row.latitude,lon:row.longitude,addr:row.address_line_1,locality:row.address_locality,region:row.address_region,modus:row.category_code.toLowerCase().replaceAll('_','-'),property:row.location_type,attrs:JSON.stringify(row.incident_attributes)}));
    for (let index=0; index<incidentBinds.length; index+=500) await connection.executeMany(incidentSql, incidentBinds.slice(index,index+500));
    const incidentId = Object.fromEntries((await connection.execute('select incident_ref,incident_id from crime_incidents')).rows);
    const reportBinds = rows.map(row => ({id:incidentId[row.incident_ref],summary:row.report_summary,text:row.report_text,embedding:`${row.crime_category} ${row.suburb} ${row.location_type}`,attrs:JSON.stringify(row.incident_attributes)}));
    for (let index=0; index<reportBinds.length; index+=500) await connection.executeMany('insert into incident_reports(incident_id,report_summary,report_text,embedding_text,enrichments) values(:id,:summary,:text,:embedding,:attrs)', reportBinds.slice(index,index+500));
    await connection.executeMany('insert into evidence_items(incident_id,evidence_type,evidence_metadata) values(:id,:type,:metadata)', rows.filter((_,index) => index%251===0).map(row => ({id:incidentId[row.incident_ref],type:'synthetic recorded observation',metadata:JSON.stringify({synthetic_record:true,city_profile:'perth-metro-may-jun-2026-recut',observed_detail:'Non-identifying generated teaching record'})})));
    await connection.commit();
    const loaded = await connection.execute("select (select count(*) from crime_incidents) incidents,(select count(*) from incident_reports) reports,(select count(*) from evidence_items) evidence,(select to_char(min(occurred_at),'YYYY-MM-DD') from crime_incidents) first_day,(select to_char(max(occurred_at),'YYYY-MM-DD') from crime_incidents) last_day from dual");
    console.log(JSON.stringify({phase:'loaded', counts:loaded.rows[0]}));
    await connection.execute("begin z_base_dataset_admin.capture_active_profile('PERTH_DATA','Perth Data Set Profile','Perth Metropolitan Area','Perth May--June 2026 synthetic re-cut: 33,511 records; deterministic seed 20260501; approximate privacy-grid points and varied fictional narratives.'); end;");
    await connection.commit(); console.log(JSON.stringify({phase:'snapshot', profile:'PERTH_DATA'}));
  } catch (error) { if (connection) await connection.rollback(); throw error; } finally { if (connection) await connection.close(); }
}
main().catch(error => { console.error(error); process.exit(1); });
