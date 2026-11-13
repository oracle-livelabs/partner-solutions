#!/usr/bin/env node
/* Loads the supplied pattern catalog as watch definitions only; it never creates incident or post links. */
const fs = require('fs');
const oracledb = require('oracledb');
const CATALOG = process.env.CRIME_WATCH_CATALOG || '/home/opc/scratch/Crime_Watch_Patterns_Catalog.csv';
const EXISTING = {
  'After-Hours Rear Service Access Property Entry': { code: 'SERVICE_ACCESS', kind: 'case_series', status: 'comparative_review', caseRef: 'CASE-2026-0317', color: '#7B5B45' },
  'Payment-Document Anomaly Chain': { code: 'ART_MARKET_PAYMENTS', kind: 'case_series', status: 'comparative_review', caseRef: 'CASE-2026-0421', color: '#5D7A48' },
  'Entertainment Precinct Escalation': { code: 'NIGHT_PRECINCT_ACTIVITY', kind: 'community_signal', status: 'monitoring', caseRef: null, color: '#A33A3A' },
  'Retail and Transport Theft Activity': { code: 'RETAIL_TRANSIT_THEFT', kind: 'community_signal', status: 'monitoring', caseRef: null, color: '#3F7391' },
};
const CODES = {
  'Residential Daytime Occupancy Test Burglary': 'RESIDENTIAL_OCCUPANCY_BURGLARY', 'Vehicle Catalytic Converter / Parts Harvesting Cluster': 'VEHICLE_PARTS_HARVESTING',
  'Elderly / Vulnerable Person Scam Escalation Chain': 'VULNERABLE_PERSON_SCAM_CHAIN', 'Construction / Development Site Material Strip': 'CONSTRUCTION_SITE_MATERIAL_THEFT',
  'Youth Group Public Space Takeover / Disorder Wave': 'YOUTH_PUBLIC_SPACE_DISORDER', 'Package / Porch Piracy Hotspot Pattern': 'PORCH_PIRACY_HOTSPOT',
  'Rural / Agricultural Equipment & Livestock Targeting': 'RURAL_AG_EQUIPMENT_TARGETING', 'Workplace Internal Shrinkage & Collusion Pattern': 'WORKPLACE_SHRINKAGE_COLLUSION',
  'Bicycle / E-Scooter / Mobility Device Harvesting Cluster': 'MOBILITY_DEVICE_HARVESTING', 'ATM / Payment Terminal Skimming & Shoulder-Surfing Hotspot': 'PAYMENT_TERMINAL_SKIMMING',
  'Drug Supply House / Stash Location Activity Pattern': 'DRUG_STASH_LOCATION_ACTIVITY', 'Environmental Dumping & Illegal Waste Disposal Circuit': 'ILLEGAL_DUMPING_CIRCUIT',
  'Domestic Violence Escalation Indicators (Public/Neighbourhood)': 'DOMESTIC_VIOLENCE_PUBLIC_SIGNS', 'Clandestine Drug Laboratory / Manufacturing Indicators': 'CLANDESTINE_LAB_INDICATORS',
  'Drug Supply Network Movement Pattern': 'DRUG_NETWORK_MOVEMENT', 'Illegal Tobacco (Chop-Chop / Illicit Cigarette) Supply Chain': 'ILLICIT_TOBACCO_SUPPLY',
  'Illegal Tobacco Retail & Street-Level Distribution': 'ILLICIT_TOBACCO_RETAIL',
};
const COLORS = ['#437C94', '#796087', '#A33A3A', '#5D7A48', '#7B5B45', '#3F7391'];

function parseCsv(file) {
  const text = fs.readFileSync(file, 'utf8'); const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) { const ch = text[i]; if (quoted) { if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (ch === '"') quoted = false; else field += ch; } else if (ch === '"') quoted = true; else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; } else field += ch; }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [headers, ...values] = rows;
  return values.filter((value) => value.length === headers.length).map((value) => Object.fromEntries(headers.map((header, index) => [header, value[index].trim()])));
}
function compact(value, max) { return value.length <= max ? value : `${value.slice(0, max - 1).replace(/\s+\S*$/, '').trim()}…`; }
function searchQuery(title, indicators) { return compact(`${title.replace(/[()\/]/g, ' ')} ${indicators.split(';').slice(0, 2).join(' ')}`.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(), 480); }

async function main() {
  for (const key of ['APP_SCHEMA_PASSWORD', 'ADB_WALLET_PASSWORD']) if (!process.env[key]) throw new Error(`${key} must be set.`);
  const rows = parseCsv(CATALOG); if (!rows.length) throw new Error('Catalog is empty.');
  const walletLocation = process.env.ORACLE_WALLET_LOCATION || '/home/opc/wallet';
  const connection = await oracledb.getConnection({ user: process.env.ORACLE_USER || 'CRIME_DATA', password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ADB_CONNECT_STRING || 'fu40_medium', walletLocation, walletPassword: process.env.ADB_WALLET_PASSWORD, configDir: walletLocation });
  try {
    await connection.execute('ALTER SESSION DISABLE PARALLEL DML');
    const binds = rows.map((row, index) => {
      const retained = EXISTING[row.Title]; const code = retained?.code || CODES[row.Title]; if (!code) throw new Error(`No stable pattern code assigned for ${row.Title}.`);
      return { code, name: compact(row.Title, 120), summary: compact(row.Description, 500), whyWatch: compact(`Catalog indicators: ${row['Key Indicators']} Analyst review is required before any comparison or action.`, 500), kind: retained?.kind || 'community_signal', status: retained?.status || 'monitoring', query: searchQuery(row.Title, row['Key Indicators']), caseRef: retained?.caseRef || null, displayOrder: index + 1, color: retained?.color || COLORS[index % COLORS.length] };
    });
    await connection.executeMany(`MERGE INTO watched_crime_patterns p USING (SELECT :code pattern_code FROM dual) s ON (p.pattern_code=s.pattern_code)
      WHEN MATCHED THEN UPDATE SET p.pattern_name=:name,p.pattern_summary=:summary,p.why_watch=:whyWatch,p.pattern_kind=:kind,p.pattern_status=:status,p.search_query=:query,p.case_ref=:caseRef,p.display_order=:displayOrder,p.display_color=:color,p.active=1
      WHEN NOT MATCHED THEN INSERT(pattern_code,pattern_name,pattern_summary,why_watch,pattern_kind,pattern_status,search_query,case_ref,display_order,display_color,active)
      VALUES(:code,:name,:summary,:whyWatch,:kind,:status,:query,:caseRef,:displayOrder,:color,1)`, binds);
    await connection.commit();
    await connection.execute(`DELETE FROM z_base_watched_crime_patterns
      WHERE dataset_profile_id=(SELECT dataset_profile_id FROM z_base_dataset_profiles WHERE profile_code='ADELAIDE_DATA')`);
    await connection.execute(`INSERT INTO z_base_watched_crime_patterns(dataset_profile_id,pattern_code,pattern_name,pattern_summary,why_watch,pattern_kind,pattern_status,search_query,case_ref,display_order,display_color,active)
      SELECT (SELECT dataset_profile_id FROM z_base_dataset_profiles WHERE profile_code='ADELAIDE_DATA'),pattern_code,pattern_name,pattern_summary,why_watch,pattern_kind,pattern_status,search_query,case_ref,display_order,display_color,active
      FROM watched_crime_patterns`);
    await connection.commit();
    const result = await connection.execute(`SELECT COUNT(*) active_patterns FROM watched_crime_patterns WHERE active=1`);
    console.log(JSON.stringify({ phase: 'complete', catalogRows: rows.length, activePatterns: Number(result.rows[0][0]) }));
  } catch (error) { await connection.rollback(); throw error; } finally { await connection.close(); }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
