/* Explicitly destructive loader for the staged Brisbane 42,317-record re-cut.
 * Generate and validate the JSON export before running this script. */
const fs = require('fs');
const oracledb = require('oracledb');
const rows = JSON.parse(fs.readFileSync('generated/brisbane_42317_may_jun_2026_recut.json', 'utf8'));
const groups = { person: ['OFFENCES_AGAINST_PERSON', 'Offences against the person', '#A33A3A'], property: ['OFFENCES_AGAINST_PROPERTY', 'Offences against property', '#437C94'], other: ['OTHER_OFFENCES', 'Drug, public order and other offences', '#796087'] };
const users = [['statewide_admin','admin','Statewide Administrator'],['central_analyst','analyst','Brisbane Central Analyst'],['northern_analyst','analyst','Brisbane North Analyst'],['southern_analyst','analyst','Brisbane South Analyst'],['read_only_viewer','viewer','Limited Viewer']];
const areas = [['BRIS_CENTRAL','Brisbane Inner Metro','central',-27.4698,153.0251],['BRIS_NORTH','Brisbane and Moreton North Metro','north',-27.3300,153.0250],['BRIS_SOUTH','Logan and South Brisbane Metro','south',-27.6000,153.1100],['BRIS_WEST','Ipswich and Western Brisbane Metro','west',-27.5800,152.9000],['BRIS_OUTER','Bayside and Outer Metro','outer',-27.4500,153.2100]];
const tables = ['watched_pattern_posts','watched_pattern_incidents','social_post_incident_links','social_media_posts','social_media_sources','watched_crime_patterns','person_visual_embeddings','person_narrative_embeddings','person_profile_embeddings','incident_report_embeddings','semantic_matches','case_incident_links','person_incident_links','evidence_items','incident_reports','case_files','persons_of_interest','crime_incidents','analyst_actions','security_user_geo_entitlements','patrol_areas','incident_categories','security_users'];

async function main() {
  if (rows.length !== 42317) throw new Error(`Expected 42,317 rows; received ${rows.length}.`);
  let connection;
  try {
    connection = await oracledb.getConnection({ user: process.env.ORACLE_USER || 'CRIME_DATA', password: process.env.APP_SCHEMA_PASSWORD || 'crime-demo-only', connectString: process.env.ORACLE_CONNECTION_STRING || 'localhost:1533/FREEPDB1' });
    const present = new Set((await connection.execute(`select table_name from user_tables where table_name in (${tables.map((_, index) => `:t${index}`).join(',')})`, Object.fromEntries(tables.map((name, index) => [`t${index}`, name.toUpperCase()])))).rows.map(row => row[0]));
    for (const table of tables) if (present.has(table.toUpperCase())) await connection.execute(`delete from ${table}`);
    for (const user of users) await connection.execute('insert into security_users(user_name,role_name,display_name,is_active) values(:1,:2,:3,1)', user);
    for (const area of areas) await connection.execute('insert into patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) values(:1,:2,:3,:4,:5)', area);
    const areaId = Object.fromEntries((await connection.execute('select area_code,patrol_area_id from patrol_areas')).rows);
    for (const [user, area] of [['central_analyst','BRIS_CENTRAL'],['northern_analyst','BRIS_NORTH'],['southern_analyst','BRIS_SOUTH'],['read_only_viewer','BRIS_CENTRAL']]) await connection.execute('insert into security_user_geo_entitlements(user_name,patrol_area_id) values(:1,:2)', [user, areaId[area]]);
    const categories = [...new Map(rows.map(row => [row.category_code, row])).values()];
    for (let index = 0; index < categories.length; index++) { const row = categories[index], group = groups[row.offence_group]; await connection.execute('insert into incident_categories(category_code,category_name,severity_band,executive_group_code,executive_group_label,person_property_class,synthetic_profile_code,display_order,display_color) values(:1,:2,:3,:4,:5,:6,:7,:8,:9)', [row.category_code,row.crime_category,row.severity_band,group[0],group[1],row.offence_group.toUpperCase(),'BRISBANE_DATA',index + 1,group[2]]); }
    const categoryId = Object.fromEntries((await connection.execute('select category_code,category_id from incident_categories')).rows);
    const incidentSql = `insert into crime_incidents(incident_ref,category_id,patrol_area_id,incident_status,occurred_at,location_type,suburb,latitude,longitude,address_line_1,address_locality,address_region,address_country_code,address_precision,modus_operandi,property_category,incident_attributes) values(:ref,:categoryId,:areaId,:status,to_timestamp_tz(:occurredAt,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),:locationType,:suburb,:latitude,:longitude,:address,:locality,:region,'AU','approximate_suburb',:modus,:property,:attributes)`;
    const incidents = rows.map((row, index) => ({ ref: row.incident_ref, categoryId: categoryId[row.category_code], areaId: areaId[row.patrol_area_code], status: ['reported','under_review','assigned','resolved','closed_no_further_action'][index % 5], occurredAt: row.occurred_at, locationType: row.location_type, suburb: row.suburb, latitude: row.latitude, longitude: row.longitude, address: row.address_line_1, locality: row.address_locality, region: row.address_region, modus: row.category_code.toLowerCase().replaceAll('_','-'), property: row.location_type, attributes: JSON.stringify(row.incident_attributes) }));
    for (let index = 0; index < incidents.length; index += 500) await connection.executeMany(incidentSql, incidents.slice(index, index + 500));
    const incidentId = Object.fromEntries((await connection.execute('select incident_ref,incident_id from crime_incidents')).rows);
    const reports = rows.map(row => ({ id: incidentId[row.incident_ref], summary: row.report_summary, text: row.report_text, embedding: `${row.crime_category} ${row.suburb} ${row.location_type}`, attributes: JSON.stringify(row.incident_attributes) }));
    for (let index = 0; index < reports.length; index += 500) await connection.executeMany('insert into incident_reports(incident_id,report_summary,report_text,embedding_text,enrichments) values(:id,:summary,:text,:embedding,:attributes)', reports.slice(index, index + 500));
    await connection.executeMany('insert into evidence_items(incident_id,evidence_type,evidence_metadata) values(:id,:type,:metadata)', rows.filter((_, index) => index % 251 === 0).map(row => ({ id: incidentId[row.incident_ref], type: 'synthetic recorded observation', metadata: JSON.stringify({ synthetic_record: true, city_profile: 'brisbane-metro-may-jun-2026-recut', observed_detail: 'Non-identifying generated teaching record' }) })));
    const check = await connection.execute("select (select count(*) from crime_incidents) incidents,(select count(*) from incident_reports) reports,(select to_char(min(occurred_at),'YYYY-MM-DD') from crime_incidents) first_day,(select to_char(max(occurred_at),'YYYY-MM-DD') from crime_incidents) last_day from dual");
    if (Number(check.rows[0][0]) !== 42317 || Number(check.rows[0][1]) !== 42317 || check.rows[0][2] !== '2026-05-01' || check.rows[0][3] !== '2026-06-30') throw new Error(`Post-load validation failed: ${JSON.stringify(check.rows[0])}`);
    await connection.execute("begin z_base_dataset_admin.capture_active_profile('BRISBANE_DATA','Brisbane Data Set Profile','Brisbane Metropolitan Area','Brisbane May--June 2026 synthetic re-cut: 42,317 records; aggregate QPS-aligned teaching taxonomy; varied fictional narratives and approximate privacy-grid points.'); end;");
    await connection.commit();
    console.log(JSON.stringify({ phase: 'loaded-and-snapshotted', profile: 'BRISBANE_DATA', counts: check.rows[0] }));
  } catch (error) { if (connection) await connection.rollback(); throw error; } finally { if (connection) await connection.close(); }
}
main().catch(error => { console.error(error); process.exit(1); });
