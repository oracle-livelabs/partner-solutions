#!/usr/bin/env node
/* Deploy the IncidentData demonstration schema and current Adelaide profile to ADB.
 * Credentials and wallet configuration are supplied only through environment variables.
 */
const fs = require('fs');
const path = require('path');
const oracledb = require('oracledb');
const { loadAdelaideBulk } = require('./load_adelaide_21513_bulk');

const root = path.resolve(__dirname, '..');
const files = [
  'db/schema/01_core.sql',
  'db/schema/04_vector.sql',
  'db/schema/05_case_relationship_graph.sql',
  'db/schema/06_demo_profiles.sql',
  'db/migrations/20260825_add_category_presentation_taxonomy.sql',
  'db/migrations/20260825_add_category_profile_metadata.sql',
  'db/migrations/20260825_add_multimodal_poi_vectors.sql',
  'db/migrations/20260825_add_social_signal_layer.sql',
  'db/migrations/20260825_add_semantic_case_graph_edges.sql',
  'db/migrations/20260820_fix_z_base_profile_restore.sql',
  'db/demo/15_load_adelaide_synthetic_21513_v5.sql',
  'db/demo/16_add_adelaide_service_corridor_series.sql',
  'db/demo/17_add_adelaide_art_market_graph_case.sql',
  'db/demo/18_add_adelaide_social_signals_and_watches.sql',
];

function stripSqlPlusDirectives(sql) {
  return sql.split(/\r?\n/)
    .filter((line) => !/^\s*(?:SET\b|DEFINE|WHENEVER|PROMPT|SPOOL|CONNECT|SHOW|EXIT|@@?)\b/i.test(line))
    .join('\n')
    .replaceAll('&&apply_mode', 'APPLY');
}

function splitSql(sql) {
  const statements = [];
  let pending = '';
  let blockMode = false;
  let quote = null;
  let qClose = null;
  let inLineComment = false;
  let inBlockComment = false;
  const flush = () => {
    const statement = pending.trim();
    if (statement) statements.push(blockMode ? statement : statement.replace(/;\s*$/, ''));
    pending = '';
    blockMode = false;
  };
  for (const rawLine of sql.split(/\r?\n/)) {
    if (!quote && !inBlockComment && /^\s*\/\s*$/.test(rawLine)) {
      flush();
      continue;
    }
    const line = `${rawLine}\n`;
    pending += line;
    const prefix = pending.replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*)*/, '').trimStart();
    if (!blockMode && /^(DECLARE|BEGIN)\b/i.test(prefix)) blockMode = true;
    if (!blockMode && /^CREATE\s+(OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION|PACKAGE|TRIGGER|TYPE)\b/i.test(prefix)) blockMode = true;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const next = line[i + 1];
      if (inLineComment) {
        if (ch === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (ch === '*' && next === '/') { inBlockComment = false; i += 1; }
        continue;
      }
      if (qClose) {
        if (ch === qClose && next === "'") { qClose = null; i += 1; }
        continue;
      }
      if (quote) {
        if (ch === quote) {
          if (next === quote) { i += 1; } else { quote = null; }
        }
        continue;
      }
      if (ch === '-' && next === '-') { inLineComment = true; i += 1; continue; }
      if (ch === '/' && next === '*') { inBlockComment = true; i += 1; continue; }
      if ((ch === 'q' || ch === 'Q') && next === "'" && line[i + 2]) {
        const opener = line[i + 2];
        const pairs = { '[': ']', '(': ')', '{': '}', '<': '>' };
        qClose = pairs[opener] || opener;
        i += 2;
        continue;
      }
      if (ch === "'" || ch === '"') { quote = ch; continue; }
      if (ch === ';' && !blockMode) {
        const statement = pending.slice(0, pending.length - (line.length - i - 1)).trim();
        if (statement) statements.push(statement.replace(/;\s*$/, ''));
        pending = line.slice(i + 1);
      }
    }
  }
  flush();
  return statements;
}

async function ensureFoundation(connection) {
  const areas = [
    ['CENTRAL', 'Adelaide Central', 'central', -34.9285, 138.6007],
    ['NORTH', 'Northern & Western Adelaide', 'north', -34.7900, 138.6000],
    ['SOUTH', 'Southern & Eastern Adelaide', 'south', -35.0200, 138.6200],
  ];
  for (const [areaCode, areaName, regionGroup, centreLat, centreLon] of areas) {
    await connection.execute(`MERGE INTO patrol_areas target USING (SELECT :areaCode area_code,:areaName area_name,:regionGroup region_group,:centreLat centre_lat,:centreLon centre_lon FROM dual) source ON (target.area_code=source.area_code) WHEN NOT MATCHED THEN INSERT(area_code,area_name,region_group,centre_lat,centre_lon) VALUES(source.area_code,source.area_name,source.region_group,source.centre_lat,source.centre_lon)`, { areaCode, areaName, regionGroup, centreLat, centreLon });
  }
  const users = [
    ['statewide_admin', 'admin', 'Statewide Administrator'],
    ['central_analyst', 'analyst', 'Central Analyst'],
    ['northern_analyst', 'analyst', 'Northern Analyst'],
    ['southern_analyst', 'analyst', 'Southern Analyst'],
    ['read_only_viewer', 'viewer', 'Limited Viewer'],
  ];
  for (const [userName, roleName, displayName] of users) {
    await connection.execute(`MERGE INTO security_users target USING (SELECT :userName user_name,:roleName role_name,:displayName display_name FROM dual) source ON (target.user_name=source.user_name) WHEN NOT MATCHED THEN INSERT(user_name,role_name,display_name,is_active) VALUES(source.user_name,source.role_name,source.display_name,1)`, { userName, roleName, displayName });
  }
  for (const [userName, areaCode] of [['central_analyst', 'CENTRAL'], ['northern_analyst', 'NORTH'], ['southern_analyst', 'SOUTH'], ['read_only_viewer', 'CENTRAL']]) {
    await connection.execute(`MERGE INTO security_user_geo_entitlements target USING (SELECT :userName user_name,p.patrol_area_id FROM patrol_areas p WHERE p.area_code=:areaCode) source ON (target.user_name=source.user_name AND target.patrol_area_id=source.patrol_area_id) WHEN NOT MATCHED THEN INSERT(user_name,patrol_area_id) VALUES(source.user_name,source.patrol_area_id)`, { userName, areaCode });
  }
  await connection.commit();
}

async function ensureZBaseFoundation(connection) {
  const legacyMigration = fs.readFileSync(path.join(root, 'db/migrations/20260819_create_z_base_dataset_library.sql'), 'utf8');
  const foundationSql = legacyMigration.split('/* Early Adelaide snapshots')[0];
  const statements = splitSql(stripSqlPlusDirectives(foundationSql));
  for (const statement of statements) await connection.execute(statement);
  await connection.execute(`BEGIN z_base_dataset_admin.capture_active_profile('ADELAIDE_DATA','Adelaide Data Set Profile','Adelaide','Initial FU40 foundation for the Adelaide v5 profile.'); END;`);
  await connection.execute(`UPDATE z_base_active_dataset_profile SET dataset_profile_id=(SELECT dataset_profile_id FROM z_base_dataset_profiles WHERE profile_code='ADELAIDE_DATA'),activated_at=SYSTIMESTAMP,activated_by=SYS_CONTEXT('USERENV','SESSION_USER') WHERE control_id=1`);
  await connection.commit();
}

async function main() {
  for (const key of ['APP_SCHEMA_PASSWORD', 'ADB_WALLET_PASSWORD']) {
    if (!process.env[key]) throw new Error(`${key} must be set before deployment.`);
  }
  const walletLocation = process.env.ORACLE_WALLET_LOCATION || '/home/opc/wallet';
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER || 'CRIME_DATA',
    password: process.env.APP_SCHEMA_PASSWORD,
    connectString: process.env.ADB_CONNECT_STRING || 'fu40_medium',
    walletLocation,
    walletPassword: process.env.ADB_WALLET_PASSWORD,
    configDir: walletLocation,
  });
  try {
    await connection.execute('ALTER SESSION DISABLE PARALLEL DML');
    const from = process.argv[2];
    const startIndex = from ? files.indexOf(from) : 0;
    if (startIndex < 0) throw new Error(`Unknown deployment starting point: ${from}`);
    const selectedFiles = files.slice(startIndex);
    for (const relativePath of selectedFiles) {
      if (relativePath === 'db/schema/04_vector.sql') await ensureFoundation(connection);
      if (relativePath === 'db/demo/15_load_adelaide_synthetic_21513_v5.sql') {
        console.log('Deploying Adelaide v5 data through the batched ADB loader');
        await loadAdelaideBulk(connection);
        continue;
      }
      const file = path.join(root, relativePath);
      const statements = splitSql(stripSqlPlusDirectives(fs.readFileSync(file, 'utf8')));
      console.log(`Deploying ${relativePath} (${statements.length} statements)`);
      for (let index = 0; index < statements.length; index += 1) {
        try {
          await connection.execute(statements[index]);
        } catch (error) {
          error.message = `${relativePath}, statement ${index + 1}/${statements.length}: ${error.message}`;
          throw error;
        }
        if ((index + 1) % 1000 === 0) console.log(`  ${index + 1}/${statements.length}`);
      }
      await connection.commit();
      if (relativePath === 'db/schema/06_demo_profiles.sql') await ensureZBaseFoundation(connection);
    }
    const result = await connection.execute(`SELECT COUNT(*) incident_count FROM secure_crime_incidents_v`);
    console.log(`Deployment complete. Authorised incident count: ${result.rows[0][0]}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
