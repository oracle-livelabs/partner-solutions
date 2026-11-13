#!/usr/bin/env node
/* Batched ADB loader for the Adelaide v5 synthetic teaching profile.
 * This replaces the generated row-by-row SQL loader for hosted deployments.
 */
const fs = require('fs');
const path = require('path');
const oracledb = require('oracledb');

const SOURCE = process.env.ADELAIDE_DATA_DIR || '/home/opc/synthetic_adelaide_crime_may_jun_2026_v5';
const PROFILE = 'ADELAIDE_DATA';
const BATCH_SIZE = 500;
const REGION = {
  Adelaide: 'CENTRAL', 'North Adelaide': 'CENTRAL', Hindmarsh: 'CENTRAL', Thebarton: 'CENTRAL', 'Kent Town': 'CENTRAL', Norwood: 'CENTRAL', Unley: 'CENTRAL', Goodwood: 'CENTRAL', Prospect: 'CENTRAL', Walkerville: 'CENTRAL',
  Salisbury: 'NORTH', Elizabeth: 'NORTH', 'Tea Tree Gully': 'NORTH', Modbury: 'NORTH', 'Golden Grove': 'NORTH', 'Mawson Lakes': 'NORTH', 'Para Hills': 'NORTH', 'Port Adelaide': 'NORTH', Semaphore: 'NORTH', 'West Lakes': 'NORTH', Kilburn: 'NORTH', Enfield: 'NORTH', Pooraka: 'NORTH',
  Burnside: 'SOUTH', Glenelg: 'SOUTH', Marion: 'SOUTH', 'Oaklands Park': 'SOUTH', 'Morphett Vale': 'SOUTH', 'Noarlunga Centre': 'SOUTH', 'Hallett Cove': 'SOUTH', Campbelltown: 'SOUTH', Newton: 'SOUTH', Blackwood: 'SOUTH', Plympton: 'SOUTH', Edwardstown: 'SOUTH', 'Seacombe Gardens': 'SOUTH', Reynella: 'SOUTH', Lonsdale: 'SOUTH', Paradise: 'SOUTH', 'Modbury North': 'NORTH', Findon: 'CENTRAL', Seaton: 'CENTRAL',
};

function parseCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [headers, ...values] = rows;
  return values.filter((valuesRow) => valuesRow.length === headers.length).map((valuesRow) => Object.fromEntries(headers.map((header, index) => [header, valuesRow[index]])));
}

async function executeBatches(connection, sql, binds, label) {
  for (let start = 0; start < binds.length; start += BATCH_SIZE) {
    await connection.executeMany(sql, binds.slice(start, start + BATCH_SIZE));
    await connection.commit();
    console.log(JSON.stringify({ phase: label, loaded: Math.min(start + BATCH_SIZE, binds.length), total: binds.length }));
  }
}

async function loadAdelaideBulk(connection) {
  const categories = parseCsv(path.join(SOURCE, 'INCIDENT_CATEGORIES.csv'));
  const incidents = parseCsv(path.join(SOURCE, 'CRIME_INCIDENTS.csv'));
  const reports = parseCsv(path.join(SOURCE, 'INCIDENT_REPORTS.csv'));
  const evidence = parseCsv(path.join(SOURCE, 'EVIDENCE_ITEMS.csv'));
  if (incidents.length !== 21513 || reports.length !== 21513 || !evidence.length) throw new Error('The Adelaide v5 source files do not have their expected row counts.');
  const preflight = await connection.execute(`SELECT
    (SELECT profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1) profile_code,
    (SELECT COUNT(*) FROM crime_incidents) incident_count,
    (SELECT COUNT(*) FROM incident_categories) category_count,
    (SELECT COUNT(*) FROM patrol_areas WHERE area_code IN ('CENTRAL','NORTH','SOUTH')) area_count
    FROM dual`);
  const [profileCode, incidentCount, categoryCount, areaCount] = preflight.rows[0];
  if (profileCode !== PROFILE || Number(incidentCount) !== 0 || Number(categoryCount) !== 0 || Number(areaCount) !== 3) {
    throw new Error(`Bulk load preflight failed (profile=${profileCode}, incidents=${incidentCount}, categories=${categoryCount}, areas=${areaCount}).`);
  }
  await connection.executeMany(`INSERT INTO incident_categories(category_code,category_name,category_description,severity_band,locality_code,executive_group_code,executive_group_label,person_property_class,synthetic_profile_code,display_order,display_color,active)
    VALUES(:code,:name,:description,:severity,:locality,:groupCode,:groupLabel,:personProperty,:profile,:displayOrder,:color,1)`, categories.map((row) => ({
    code: row.category_code, name: row.category_name, description: row.category_description, severity: row.severity_band, locality: row.locality_code,
    groupCode: row.executive_group_code, groupLabel: row.executive_group_label, personProperty: row.person_property_class, profile: row.synthetic_profile_code,
    displayOrder: Number(row.display_order), color: row.display_color,
  })));
  await connection.commit();
  const categoryId = Object.fromEntries((await connection.execute('SELECT category_code,category_id FROM incident_categories')).rows);
  const areaId = Object.fromEntries((await connection.execute('SELECT area_code,patrol_area_id FROM patrol_areas')).rows);
  const incidentBinds = incidents.map((row) => {
    const area = REGION[row.suburb_or_locality];
    if (!area) throw new Error(`No patrol area mapping for ${row.suburb_or_locality}.`);
    return {
      ref: row.incident_id, categoryId: categoryId[`ADL${row.category_id.split('-')[1]}`], areaId: areaId[area], status: row.incident_status,
      occurredAt: row.datetime, locationType: row.location_type, suburb: row.suburb_or_locality, latitude: Number(row.latitude), longitude: Number(row.longitude),
      address: `Synthetic vicinity — ${row.suburb_or_locality}`, postcode: row.postcode, modus: row.modus_operandi, property: row.location_type,
      attributes: JSON.stringify({ synthetic_record: true, synthetic_profile_code: row.city_profile, generator_version: row.generator_version, generator_seed: Number(row.generator_seed), offence_category_broad: row.offence_category_broad, offence_level_1: row.offence_level_1, offence_level_2: row.offence_level_2, executive_group_code: row.executive_group_code, executive_group_label: row.executive_group_label, family_domestic_abuse_related: row.family_domestic_abuse_related === 'true', spatial_precision: row.spatial_precision }),
    };
  });
  await executeBatches(connection, `INSERT INTO crime_incidents(incident_ref,category_id,patrol_area_id,incident_status,occurred_at,location_type,suburb,latitude,longitude,address_line_1,address_locality,address_region,address_postcode,address_country_code,address_precision,address_enrichment_source,modus_operandi,property_category,incident_attributes)
    VALUES(:ref,:categoryId,:areaId,:status,TO_TIMESTAMP_TZ(:occurredAt,'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM'),:locationType,:suburb,:latitude,:longitude,:address,:suburb,'South Australia',:postcode,'AU','masked_vicinity','bulk_synthetic_locality',:modus,:property,:attributes)`, incidentBinds, 'incidents');
  const incidentId = Object.fromEntries((await connection.execute('SELECT incident_ref,incident_id FROM crime_incidents')).rows);
  const reportBinds = reports.map((row) => {
    const context = JSON.parse(row.report_context_json);
    return { incidentId: incidentId[row.incident_id], summary: row.report_summary, text: row.report_text, embedding: row.report_text,
      enrichments: JSON.stringify({ synthetic_record: true, locality_code: context.locality_code, report_month: context.report_month, sapol_category: context.sapol_category, detailed_category: context.detailed_category, executive_group_code: context.executive_group_code, executive_group_label: context.executive_group_label, location_context: context.location_context, property_context: context.property_context, modus_operandi: context.modus_operandi, narrative_variant: Number(context.narrative_variant), family_domestic_abuse_related: context.family_domestic_abuse_related, spatial_precision: context.spatial_precision }), };
  });
  await executeBatches(connection, 'INSERT INTO incident_reports(incident_id,report_summary,report_text,embedding_text,enrichments) VALUES(:incidentId,:summary,:text,:embedding,:enrichments)', reportBinds, 'reports');
  await executeBatches(connection, 'INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata) VALUES(:incidentId,:type,:metadata)', evidence.map((row) => ({ incidentId: incidentId[row.incident_id], type: row.evidence_type, metadata: JSON.stringify({ synthetic_record: true, synthetic_profile_code: row.synthetic_profile_code, summary: row.evidence_summary }) })), 'evidence');
  await connection.execute(`INSERT INTO incident_report_embeddings(incident_id,embedding)
    SELECT incident_id, TO_VECTOR('[0,0,0,0,1,0,0,0]') FROM crime_incidents`);
  const validation = await connection.execute(`SELECT (SELECT COUNT(*) FROM crime_incidents) incidents,(SELECT COUNT(*) FROM incident_reports) reports,(SELECT COUNT(*) FROM evidence_items) evidence,(SELECT COUNT(*) FROM incident_report_embeddings) vectors,(SELECT COUNT(DISTINCT TRUNC(occurred_at)) FROM crime_incidents) days FROM dual`);
  const [loadedIncidents, loadedReports, loadedEvidence, loadedVectors, days] = validation.rows[0];
  if (Number(loadedIncidents) !== 21513 || Number(loadedReports) !== 21513 || !Number(loadedEvidence) || Number(loadedVectors) !== 21513 || Number(days) !== 61) throw new Error(`Bulk load validation failed: ${JSON.stringify(validation.rows[0])}`);
  await connection.execute(`BEGIN z_base_dataset_admin.capture_active_profile('ADELAIDE_DATA','Adelaide Data Set Profile','Adelaide Metropolitan Area','Adelaide May-June 2026 synthetic profile v5; natural report titles and narratives; generator 5.0.0 seed 20260828.'); END;`);
  await connection.commit();
  console.log(JSON.stringify({ phase: 'complete', incidents: Number(loadedIncidents), reports: Number(loadedReports), evidence: Number(loadedEvidence), vectors: Number(loadedVectors) }));
}

async function main() {
  for (const key of ['APP_SCHEMA_PASSWORD', 'ADB_WALLET_PASSWORD']) if (!process.env[key]) throw new Error(`${key} must be set.`);
  const walletLocation = process.env.ORACLE_WALLET_LOCATION || '/home/opc/wallet';
  const connection = await oracledb.getConnection({ user: process.env.ORACLE_USER || 'CRIME_DATA', password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ADB_CONNECT_STRING || 'fu40_medium', walletLocation, walletPassword: process.env.ADB_WALLET_PASSWORD, configDir: walletLocation });
  try { await loadAdelaideBulk(connection); } catch (error) { await connection.rollback(); throw error; } finally { await connection.close(); }
}
if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { loadAdelaideBulk };
