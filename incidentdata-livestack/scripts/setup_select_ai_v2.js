/* Configure the native ADB Select AI profile used by Ask IncidentData V2.
 *
 * The OCI API-key material is read inside the deployed app container and is
 * never printed or written to this repository. Re-running this script replaces
 * only the dedicated IncidentData credential/profile.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const oracledb = require('oracledb');

const PROFILE = 'CRIMEDATA_SELECT_AI_V2';
const CREDENTIAL = 'CRIMEDATA_OCI_GENAI_CRED';
const MODEL = 'meta.llama-4-maverick-17b-128e-instruct-fp8';

function parseOciConfig(text) {
  const values = {};
  let selected = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) { selected = line === `[${process.env.OCI_CONFIG_PROFILE || 'DEFAULT'}]`; continue; }
    if (!selected) continue;
    const index = line.indexOf('=');
    if (index > 0) values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

async function main() {
  const configPath = process.env.OCI_CONFIG_FILE || '/root/.oci/config';
  const config = parseOciConfig(fs.readFileSync(configPath, 'utf8'));
  const keyPath = config.key_file;
  if (!config.user || !config.tenancy || !config.fingerprint || !keyPath) throw Error('The deployed OCI configuration is incomplete.');
  const resolvedKeyPath = keyPath.startsWith('~/') ? path.join('/root', keyPath.slice(2)) : path.resolve(path.dirname(configPath), keyPath);
  const privateKey = fs.readFileSync(resolvedKeyPath, 'utf8');
  const views = [
    `CREATE OR REPLACE VIEW secure_evidence_items_v AS SELECT e.evidence_id,e.incident_id,e.evidence_type,e.evidence_metadata,e.created_at FROM evidence_items e JOIN secure_crime_incidents_v i ON i.incident_id=e.incident_id`,
    `CREATE OR REPLACE VIEW secure_watched_crime_patterns_v AS SELECT pattern_code,pattern_name,pattern_summary,why_watch,pattern_kind,pattern_status,search_query,case_ref,display_order,display_color,active,activate_ui FROM watched_crime_patterns WHERE active=1`,
    `CREATE OR REPLACE VIEW secure_watched_pattern_incidents_v AS SELECT wpi.pattern_code,wpi.incident_ref,wpi.relationship_label FROM watched_pattern_incidents wpi JOIN secure_watched_crime_patterns_v w ON w.pattern_code=wpi.pattern_code JOIN secure_crime_incidents_v i ON i.incident_ref=wpi.incident_ref`,
    `CREATE OR REPLACE VIEW secure_watched_pattern_posts_v AS SELECT wpp.pattern_code,wpp.post_ref,wpp.relationship_label FROM watched_pattern_posts wpp WHERE EXISTS (SELECT 1 FROM secure_watched_pattern_incidents_v wpi WHERE wpi.pattern_code=wpp.pattern_code)`
  ];
  const objects = ['SECURE_CRIME_INCIDENTS_V','SECURE_INCIDENT_REPORTS_V','SECURE_EVIDENCE_ITEMS_V','INCIDENT_CATEGORIES','PATROL_AREAS','SECURE_WATCHED_CRIME_PATTERNS_V','SECURE_WATCHED_PATTERN_INCIDENTS_V','SECURE_WATCHED_PATTERN_POSTS_V'].map(name => ({ owner: process.env.ORACLE_USER, name }));
  const attributes = JSON.stringify({
    provider: 'oci', credential_name: CREDENTIAL, oci_compartment_id: process.env.OCI_COMPARTMENT_ID || config.tenancy,
    region: process.env.OCI_GENAI_REGION || 'us-chicago-1', model: MODEL, object_list: objects,
    temperature: 0, max_tokens: 1200, comments: false,
    role: 'You are a governed IncidentData SQL assistant for synthetic demonstration data.',
    additional_instructions: 'Generate one Oracle read-only SELECT statement only. Use only the listed CRIME_DATA objects. Never use DML, DDL, PL/SQL, database packages, or views/tables outside the object list. Prefer clear joins using incident_id, category_id, patrol_area_id, and pattern_id. Limit detail listings to 100 rows. This is descriptive synthetic data only; do not infer responsibility, risk, or recommend operational action.'
  });
  const connection = await oracledb.getConnection({ user: process.env.ORACLE_USER, password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ORACLE_CONNECTION_STRING, configDir: process.env.ORACLE_WALLET_LOCATION, walletLocation: process.env.ORACLE_WALLET_LOCATION, walletPassword: process.env.ORACLE_WALLET_PASSWORD });
  try {
    for (const view of views) await connection.execute(view);
    await connection.execute(`BEGIN DBMS_CLOUD_AI.DROP_PROFILE(:profile_name, TRUE); END;`, { profile_name: PROFILE });
    await connection.execute(`BEGIN DBMS_CLOUD.DROP_CREDENTIAL(:credential_name); EXCEPTION WHEN OTHERS THEN IF SQLCODE != -20004 THEN RAISE; END IF; END;`, { credential_name: CREDENTIAL });
    await connection.execute(`BEGIN DBMS_CLOUD.CREATE_CREDENTIAL(credential_name => :credential_name, user_ocid => :user_ocid, tenancy_ocid => :tenancy_ocid, private_key => :private_key, fingerprint => :fingerprint); END;`, { credential_name: CREDENTIAL, user_ocid: config.user, tenancy_ocid: config.tenancy, private_key: privateKey, fingerprint: config.fingerprint });
    await connection.execute(`BEGIN DBMS_CLOUD_AI.CREATE_PROFILE(profile_name => :profile_name, attributes => :attributes, description => :description); END;`, { profile_name: PROFILE, attributes, description: 'IncidentData Ask IncidentData V2: OCI GenAI Llama 4 Maverick, scoped to approved synthetic crime-data tables.' });
    await connection.commit();
    console.log(JSON.stringify({ configured: true, profile: PROFILE, model: MODEL, region: process.env.OCI_GENAI_REGION || 'us-chicago-1', objects: objects.map(item => item.name) }));
  } finally { await connection.close(); }
}
main().catch(error => { console.error(error.message); process.exit(1); });
