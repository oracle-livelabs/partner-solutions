/*
 * Enables the bounded Brisbane teaching capabilities after the 42,317-record
 * Brisbane re-cut has been loaded. All added people, links, posts and vectors
 * are generated, fictional and non-operational.
 */
const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const PROFILE = 'BRIS_NMC_026';
const CASE_REF = 'BRIS-CASE-026';
const poiProfiles = [
  ['BPOI-2026-0261', 'Profile Lantern', 'Lantern', 'associate', 'BRIS_CENTRAL', '[1,0,0,0,1,0,0,0]'],
  ['BPOI-2026-0262', 'Profile Quay', 'Quay', 'person_of_interest', 'BRIS_NORTH', '[0,0,1,0,0,0,1,0]'],
  ['BPOI-2026-0263', 'Profile Cedar', 'Cedar', 'associate', 'BRIS_SOUTH', '[0,1,0,1,0,0,0,0]'],
];
const scenario = [
  ['BURGLARY_COMMERCIAL', 'BRIS_CENTRAL'], ['BURGLARY_COMMERCIAL', 'BRIS_NORTH'],
  ['OTHER_THEFT', 'BRIS_SOUTH'], ['OTHER_THEFT', 'BRIS_WEST'],
  ['FRAUD_DECEPTION', 'BRIS_CENTRAL'], ['FRAUD_DECEPTION', 'BRIS_OUTER'],
  ['MOTOR_VEHICLE_THEFT', 'BRIS_NORTH'], ['MOTOR_VEHICLE_THEFT', 'BRIS_SOUTH'],
  ['THEFT_RETAIL', 'BRIS_WEST'], ['THEFT_RETAIL', 'BRIS_OUTER'],
  ['ILLICIT_DRUGS', 'BRIS_CENTRAL'], ['ILLICIT_DRUGS', 'BRIS_SOUTH'],
];
const posts = [
  ['SMP-BRI-0001', 'SRC-BRIS-COMMUNITY', '2026-06-27T18:40:00.000+10:00', 'A simulated community stream notes an after-hours commercial closure discussion. This is a generated teaching observation, not a report or evidence.', 'BRIS_NIGHT_MARKET', 'Fictional night-market context', 'BRIS_CENTRAL', 'Brisbane CBD', -27.470, 153.025, 420, 18, 6, 67, 'rising'],
  ['SMP-BRI-0002', 'SRC-BRIS-TRANSIT', '2026-06-28T20:15:00.000+10:00', 'A simulated commuter stream describes a broad public-entry changeover near a transport setting. It has no real-world referent.', 'BRIS_NIGHT_MARKET', 'Fictional night-market context', 'BRIS_NORTH', 'Chermside', -27.385, 153.030, 360, 14, 5, 62, 'rising'],
  ['SMP-BRI-0003', 'SRC-BRIS-COMMUNITY', '2026-06-29T19:05:00.000+10:00', 'A simulated public post refers to a fictional folded-blue-token phrase in a controlled demonstration only.', 'BRIS_NIGHT_MARKET', 'Fictional night-market context', 'BRIS_SOUTH', 'Sunnybank', -27.578, 153.055, 510, 29, 8, 74, 'elevated'],
  ['SMP-BRI-0004', 'SRC-BRIS-RETAIL', '2026-06-30T21:20:00.000+10:00', 'A simulated retail-context stream notes a broad stock-list procedure. It is not evidence and is not linked to a real venue.', 'BRIS_RETAIL_CONTEXT', 'Simulated retail and access context', 'BRIS_WEST', 'Indooroopilly', -27.503, 152.975, 290, 9, 3, 55, 'normal'],
  ['SMP-BRI-0005', 'SRC-BRIS-TRANSIT', '2026-06-30T22:10:00.000+10:00', 'A simulated commuter observation uses the fictional R-26 shorthand for vector and graph teaching only.', 'BRIS_NIGHT_MARKET', 'Fictional night-market context', 'BRIS_OUTER', 'Manly', -27.454, 153.186, 470, 24, 7, 71, 'elevated'],
  ['SMP-BRI-0006', 'SRC-BRIS-RETAIL', '2026-06-30T23:00:00.000+10:00', 'A simulated retail stream mentions a general after-hours review workflow. It contains no person, address or incident claim.', 'BRIS_RETAIL_CONTEXT', 'Simulated retail and access context', 'BRIS_CENTRAL', 'South Brisbane', -27.478, 153.018, 315, 11, 4, 58, 'normal'],
];

function summaryFor(index) {
  return [
    'Generated commercial-context profile for a bounded relationship exercise; not a real person or identity claim.',
    'Generated cross-area context profile for synthetic vector comparison; not a real person or attribution.',
    'Generated teaching profile used to demonstrate governed graph traversal; not a real person or finding.',
  ][index];
}

async function main() {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER || 'CRIME_DATA',
      password: process.env.APP_SCHEMA_PASSWORD || 'crime-demo-only',
      connectString: process.env.ORACLE_CONNECTION_STRING || 'localhost:1533/FREEPDB1',
    });
    const q = (sql, binds) => binds === undefined ? connection.execute(sql) : connection.execute(sql, binds);
    const total = await q('SELECT COUNT(*) total FROM crime_incidents');
    if (Number(total.rows[0].TOTAL) !== 42317) throw new Error('Brisbane capability loader requires the 42,317-record Brisbane re-cut.');

    // Clear only this bounded scenario so the loader is safe to rerun.
    await q("DELETE FROM watched_pattern_posts WHERE pattern_code IN ('BRIS_NIGHT_MARKET','BRIS_RETAIL_CONTEXT')");
    await q("DELETE FROM watched_pattern_incidents WHERE pattern_code IN ('BRIS_NIGHT_MARKET','BRIS_RETAIL_CONTEXT')");
    await q("DELETE FROM social_post_incident_links WHERE post_ref LIKE 'SMP-BRI-%'");
    await q("DELETE FROM social_media_posts WHERE post_ref LIKE 'SMP-BRI-%'");
    await q("DELETE FROM watched_crime_patterns WHERE pattern_code IN ('BRIS_NIGHT_MARKET','BRIS_RETAIL_CONTEXT')");
    await q("DELETE FROM social_media_sources WHERE source_code LIKE 'SRC-BRIS-%'");
    await q(`DELETE FROM semantic_matches WHERE match_reason LIKE '%${PROFILE}%'`);
    await q(`DELETE FROM evidence_items WHERE JSON_VALUE(evidence_metadata,'$.teaching_series')='${PROFILE}'`);
    await q(`DELETE FROM case_incident_links WHERE case_id IN (SELECT case_id FROM case_files WHERE case_ref='${CASE_REF}')`);
    await q(`DELETE FROM case_files WHERE case_ref='${CASE_REF}'`);
    await q("DELETE FROM person_profile_embeddings WHERE person_id IN (SELECT person_id FROM persons_of_interest WHERE person_ref LIKE 'BPOI-2026-026%')");
    await q("DELETE FROM person_incident_links WHERE person_id IN (SELECT person_id FROM persons_of_interest WHERE person_ref LIKE 'BPOI-2026-026%')");
    await q("DELETE FROM persons_of_interest WHERE person_ref LIKE 'BPOI-2026-026%'");
    await q(`UPDATE crime_incidents SET modus_operandi=REGEXP_REPLACE(modus_operandi,'^after-hours-market-circuit$','general-generated-context') WHERE JSON_VALUE(incident_attributes,'$.teaching_series')='${PROFILE}'`);

    const selected = [];
    for (const [categoryCode, areaCode] of scenario) {
      const result = await q(`SELECT incident_id,incident_ref FROM (
        SELECT i.incident_id,i.incident_ref FROM crime_incidents i
        JOIN incident_categories c ON c.category_id=i.category_id
        JOIN patrol_areas a ON a.patrol_area_id=i.patrol_area_id
        WHERE c.category_code=:categoryCode AND a.area_code=:areaCode
        ORDER BY i.occurred_at,i.incident_id
      ) WHERE ROWNUM=1`, { categoryCode, areaCode });
      if (result.rows.length !== 1) throw new Error(`Could not select a Brisbane scenario record for ${categoryCode}/${areaCode}.`);
      selected.push({ id: result.rows[0].INCIDENT_ID, ref: result.rows[0].INCIDENT_REF });
    }

    for (let index = 0; index < selected.length; index += 1) {
      const incident = selected[index];
      const marker = ['Q7', 'midnight changeover', 'folded blue token', 'R-26'][index % 4];
      await q(`UPDATE crime_incidents SET modus_operandi='after-hours-market-circuit',incident_status='under_review',
        incident_attributes=JSON_OBJECT('synthetic_record' VALUE true,'city_profile' VALUE 'brisbane-metro-may-jun-2026-recut','teaching_series' VALUE '${PROFILE}','series_note' VALUE 'Fictional cross-area context marker; not a finding or attribution.','spatial_precision' VALUE 'approximate suburb-level training point')
        WHERE incident_id=:id`, { id: incident.id });
      await q(`UPDATE incident_reports SET report_summary=:summary,report_text=:text,embedding_text='after-hours market circuit fictional controlled demonstration',
        enrichments=JSON_OBJECT('synthetic_record' VALUE true,'teaching_series' VALUE '${PROFILE}','relationship_status' VALUE 'fictional context under review') WHERE incident_id=:id`, {
        id: incident.id,
        summary: `Cross-area context review — ${incident.ref}`,
        text: `A generated Brisbane teaching record retains the incomplete fictional marker ${marker} for controlled vector and graph exploration. It is not evidence, a finding, or a claim about a real person, address, venue, or event.`,
      });
      await q(`INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata) VALUES(:id,:type,JSON_OBJECT('synthetic_record' VALUE true,'teaching_series' VALUE '${PROFILE}','shared_marker' VALUE :marker,'description' VALUE 'Fictional non-identifying teaching artefact; not real evidence.'))`, { id: incident.id, type: 'fictional context observation', marker });
    }

    await q(`INSERT INTO case_files(case_ref,case_status,pattern_label,patrol_area_id)
      SELECT '${CASE_REF}','under_review','Cross-area commercial-context review',patrol_area_id FROM patrol_areas WHERE area_code='BRIS_CENTRAL'`);
    await q(`INSERT INTO case_incident_links(case_id,incident_id)
      SELECT c.case_id,i.incident_id FROM case_files c JOIN crime_incidents i ON i.modus_operandi='after-hours-market-circuit' WHERE c.case_ref='${CASE_REF}'`);

    for (let index = 0; index < poiProfiles.length; index += 1) {
      const [personRef, displayName, aliasName, status, areaCode, vector] = poiProfiles[index];
      await q(`INSERT INTO persons_of_interest(person_ref,display_name,alias_name,person_status,portrait_variant,portrait_alt_text,narrative_summary,narrative_text,profile_attributes,owning_patrol_area_id)
        SELECT :personRef,:displayName,:aliasName,:status,:portrait,'Generated fictional profile for teaching only; not a real person.',:summary,:narrative,
        JSON_OBJECT('synthetic_record' VALUE true,'city_profile' VALUE 'brisbane-metro-may-jun-2026-recut','generated_fictional' VALUE true,'capability' VALUE 'POI graph and vector teaching'),patrol_area_id FROM patrol_areas WHERE area_code=:areaCode`, {
        personRef, displayName, aliasName, status, portrait: `brisbane-demo-avatar-${index + 1}`, areaCode,
        summary: summaryFor(index), narrative: `${summaryFor(index)} The profile is a generated entity used only in ${PROFILE}.`,
      });
      await q(`INSERT INTO person_profile_embeddings(person_id,embedding_model,embedding)
        SELECT person_id,'brisbane_poi_demo_v1',TO_VECTOR(:vector) FROM persons_of_interest WHERE person_ref=:personRef`, { personRef, vector });
    }
    await q(`INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary)
      SELECT p.person_id,i.incident_id,CASE MOD(i.incident_id,3) WHEN 0 THEN 'associate' WHEN 1 THEN 'person_of_interest' ELSE 'associate' END,
      'Fictional graph-teaching relationship only; not an attribution or finding.'
      FROM persons_of_interest p JOIN crime_incidents i ON MOD(i.incident_id,3)=MOD(p.person_id,3)
      WHERE p.person_ref LIKE 'BPOI-2026-026%' AND i.modus_operandi='after-hours-market-circuit'`);
    await q(`INSERT INTO semantic_matches(source_incident_id,matched_incident_id,similarity_score,match_reason)
      SELECT a.incident_id,b.incident_id,0.7800 + MOD(a.incident_id+b.incident_id,17)/1000,
      'Fictional teaching-series context: ${PROFILE}; not a finding of a real-world link.'
      FROM crime_incidents a JOIN crime_incidents b ON a.incident_id<b.incident_id
      WHERE a.modus_operandi='after-hours-market-circuit' AND b.modus_operandi='after-hours-market-circuit'`);

    await q(`DELETE FROM incident_report_embeddings`);
    await q(`INSERT INTO incident_report_embeddings(incident_id,embedding_model,embedding)
      SELECT i.incident_id,CASE WHEN i.modus_operandi='after-hours-market-circuit' THEN 'brisbane_night_market_circuit_demo_v1' ELSE 'brisbane_qgso_pattern_demo_v1' END,
      TO_VECTOR(CASE WHEN i.modus_operandi='after-hours-market-circuit' THEN '[0.72,0.08,0.18,0.12,0.10,0.08,0.05,0.62]'
        WHEN c.category_code LIKE 'BURGLARY_%' THEN '[1,0,0,0,0,0,0,0]' WHEN c.category_code='MOTOR_VEHICLE_THEFT' THEN '[0,1,0,0,0,0,0,0]'
        WHEN c.category_code='FRAUD_DECEPTION' THEN '[0,0,1,0,0,0,0,0]' WHEN c.category_code IN ('PROPERTY_DAMAGE','ARSON_FIRE_DAMAGE','GRAFFITI') THEN '[0,0,0,1,0,0,0,0]'
        WHEN c.category_code='ILLICIT_DRUGS' THEN '[0,0,0,0,0,1,0,0]'
        WHEN c.category_code IN ('PUBLIC_ORDER','TRESPASSING_VAGRANCY','WEAPONS_EXPLOSIVES') THEN '[0,0,0,0,0,0,1,0]'
        ELSE '[0,0,0,0,1,0,0,0]' END) FROM crime_incidents i JOIN incident_categories c ON c.category_id=i.category_id`);

    for (const source of [
      ['SRC-BRIS-COMMUNITY', 'Simulated Brisbane community stream', 'Simulated public stream', 'community', 'Synthetic locality observations only.'],
      ['SRC-BRIS-TRANSIT', 'Simulated Brisbane commuter stream', 'Simulated public stream', 'commuter', 'Synthetic travel-context observations only.'],
      ['SRC-BRIS-RETAIL', 'Simulated Brisbane retail stream', 'Simulated public stream', 'retail', 'Synthetic retail-context observations only.'],
    ]) await q('INSERT INTO social_media_sources(source_code,source_name,platform_label,source_type,source_description,active) VALUES(:1,:2,:3,:4,:5,1)', source);
    await q(`INSERT ALL
      INTO watched_crime_patterns VALUES('BRIS_NIGHT_MARKET','Fictional night-market circuit','A bounded fictional series for POI, graph and vector teaching.','Supports reviewed contextual comparison without attribution.','case_series','comparative_review','after-hours market circuit','${CASE_REF}',1,'#437C94',1)
      INTO watched_crime_patterns VALUES('BRIS_RETAIL_CONTEXT','Retail and access context','Simulated public discussion about retail and access context.','Keeps public-context posts separate from incident records.','community_signal','monitoring','retail access context',NULL,2,'#796087',1) SELECT 1 FROM dual`);
    for (const post of posts) {
      await q(`INSERT INTO social_media_posts(post_ref,source_code,posted_at,post_text,topic_code,topic_label,executive_group_code,suburb,patrol_area_code,latitude,longitude,geo_precision,reach_count,reshare_count,reply_count,signal_score,momentum_flag,verification_status,post_attributes)
        VALUES(:ref,:source,TO_TIMESTAMP_TZ(:posted,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),:text,:topic,:label,'OTHER_OFFENCES',:suburb,:area,:lat,:lon,'precinct',:reach,:reshare,:reply,:score,:momentum,'incident_link_reviewed',JSON_OBJECT('synthetic_record' VALUE true,'collection_mode' VALUE 'simulated_public_stream'))`, {
        ref: post[0], source: post[1], posted: post[2], text: post[3], topic: post[4], label: post[5], area: post[6], suburb: post[7], lat: post[8], lon: post[9], reach: post[10], reshare: post[11], reply: post[12], score: post[13], momentum: post[14],
      });
    }
    await q(`INSERT INTO social_post_incident_links(post_ref,incident_ref,link_type,link_confidence,link_summary,review_status,reviewed_by,reviewed_at)
      SELECT 'SMP-BRI-0001',:ref,'analyst_comparison',72,'Synthetic teaching comparison; not evidence or attribution.','reviewed','statewide_admin',SYSTIMESTAMP FROM dual
      UNION ALL SELECT 'SMP-BRI-0003',:ref2,'public_reference',68,'Synthetic teaching comparison; not evidence or attribution.','reviewed','statewide_admin',SYSTIMESTAMP FROM dual`, { ref: selected[0].ref, ref2: selected[5].ref });
    await q(`INSERT INTO watched_pattern_incidents(pattern_code,incident_ref,relationship_label) SELECT 'BRIS_NIGHT_MARKET',incident_ref,'Fictional shared marker for teaching graph' FROM crime_incidents WHERE modus_operandi='after-hours-market-circuit'`);
    await q(`INSERT INTO watched_pattern_posts(pattern_code,post_ref,relationship_label) SELECT topic_code,post_ref,'Simulated public-context topic' FROM social_media_posts WHERE post_ref LIKE 'SMP-BRI-%'`);

    const check = await q(`SELECT (SELECT COUNT(*) FROM persons_of_interest WHERE person_ref LIKE 'BPOI-2026-026%') pois,
      (SELECT COUNT(*) FROM case_incident_links l JOIN case_files c ON c.case_id=l.case_id WHERE c.case_ref='${CASE_REF}') graph_links,
      (SELECT COUNT(*) FROM social_media_posts WHERE post_ref LIKE 'SMP-BRI-%') posts,
      (SELECT COUNT(*) FROM incident_report_embeddings) vectors FROM dual`);
    const result = check.rows[0];
    if ([result.POIS, result.GRAPH_LINKS, result.POSTS, result.VECTORS].map(Number).join(',') !== '3,12,6,42317') throw new Error(`Capability validation failed: ${JSON.stringify(result)}`);
    await q("BEGIN z_base_dataset_admin.capture_active_profile('BRISBANE_DATA','Brisbane Data Set Profile','Brisbane Metropolitan Area','Brisbane May-June 2026 synthetic re-cut with generated fictional POI, graph, social-signal and vector-search teaching capabilities.'); END;");
    await connection.commit();
    console.log(JSON.stringify({ profile: 'BRISBANE_DATA', ...result, notice: 'All enabled capability records are generated, fictional and non-operational.' }));
  } catch (error) { if (connection) await connection.rollback(); throw error; } finally { if (connection) await connection.close(); }
}

main().catch(error => { console.error(error); process.exit(1); });
