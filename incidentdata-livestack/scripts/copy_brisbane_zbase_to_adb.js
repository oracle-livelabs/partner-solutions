#!/usr/bin/env node
/* Copies a VM Z_BASE snapshot profile to OCI ADB without changing the active profile. */
const oracledb = require('oracledb');
oracledb.fetchAsString = [oracledb.CLOB];

const profileArgument = process.argv.indexOf('--profile');
const PROFILE = profileArgument >= 0 ? String(process.argv[profileArgument + 1] || '').toUpperCase() : 'BRISBANE_DATA';
const TABLES = [
  'Z_BASE_SECURITY_USERS', 'Z_BASE_PATROL_AREAS', 'Z_BASE_SECURITY_ENTITLEMENTS', 'Z_BASE_INCIDENT_CATEGORIES',
  'Z_BASE_CRIME_INCIDENTS', 'Z_BASE_INCIDENT_REPORTS', 'Z_BASE_EVIDENCE_ITEMS', 'Z_BASE_PERSONS',
  'Z_BASE_PERSON_INCIDENT_LINKS', 'Z_BASE_CASE_FILES', 'Z_BASE_CASE_INCIDENT_LINKS', 'Z_BASE_SEMANTIC_MATCHES',
  'Z_BASE_INCIDENT_EMBEDDINGS', 'Z_BASE_PERSON_EMBEDDINGS', 'Z_BASE_ANALYST_ACTIONS', 'Z_BASE_PERSON_NARRATIVE_VEC',
  'Z_BASE_PERSON_VISUAL_VEC', 'Z_BASE_SOCIAL_MEDIA_SOURCES', 'Z_BASE_SOCIAL_MEDIA_POSTS', 'Z_BASE_WATCHED_CRIME_PATTERNS',
  'Z_BASE_SOCIAL_POST_INCIDENT_LINKS', 'Z_BASE_WATCHED_PATTERN_INCIDENTS', 'Z_BASE_WATCHED_PATTERN_POSTS',
];

function bindValue(value, dataType) {
  if (value == null) return value;
  if (dataType === 'JSON') return typeof value === 'string' ? value : JSON.stringify(value);
  if (dataType === 'VECTOR' && ArrayBuffer.isView(value)) return `[${Array.from(value).join(',')}]`;
  return value;
}

async function tableColumns(connection, table) {
  const result = await connection.execute(`SELECT column_name,data_type FROM user_tab_columns WHERE table_name=:tableName ORDER BY column_id`, { tableName: table });
  return result.rows.map(([name, type]) => ({ name, type }));
}

async function main() {
  if (!['BRISBANE_DATA', 'PERTH_DATA'].includes(PROFILE)) throw new Error('Use --profile BRISBANE_DATA or --profile PERTH_DATA.');
  for (const key of ['APP_SCHEMA_PASSWORD', 'ADB_WALLET_PASSWORD']) if (!process.env[key]) throw new Error(`${key} must be set.`);
  const walletLocation = process.env.ORACLE_WALLET_LOCATION || '/home/opc/wallet';
  const source = await oracledb.getConnection({
    user: process.env.LOCAL_ORACLE_USER || 'CRIME_DATA', password: process.env.LOCAL_SCHEMA_PASSWORD || 'crime-demo-only',
    connectString: process.env.LOCAL_ORACLE_CONNECTION_STRING || '127.0.0.1:1533/FREEPDB1',
  });
  const target = await oracledb.getConnection({
    user: process.env.ORACLE_USER || 'CRIME_DATA', password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ADB_CONNECT_STRING || 'fu40_medium',
    walletLocation, walletPassword: process.env.ADB_WALLET_PASSWORD, configDir: walletLocation,
  });
  try {
    await target.execute('ALTER SESSION DISABLE PARALLEL DML');
    const profile = await source.execute(`SELECT dataset_profile_id,profile_name,city_label,profile_notes,captured_at FROM z_base_dataset_profiles WHERE profile_code=:profile`, { profile: PROFILE });
    if (profile.rows.length !== 1) throw new Error(`The VM does not contain exactly one ${PROFILE} snapshot.`);
    const [sourceProfileId, profileName, cityLabel, profileNotes, capturedAt] = profile.rows[0];
    const existing = await target.execute('SELECT dataset_profile_id FROM z_base_dataset_profiles WHERE profile_code=:profile', { profile: PROFILE });
    let targetProfileId;
    if (existing.rows.length) {
      targetProfileId = existing.rows[0][0];
      const retained = await target.execute(`SELECT SUM(row_count) FROM (${TABLES.map((table) => `SELECT COUNT(*) row_count FROM ${table} WHERE dataset_profile_id=:profileId`).join(' UNION ALL ')})`, { profileId: targetProfileId });
      if (Number(retained.rows[0][0]) !== 0 && !process.argv.includes('--resume')) throw new Error(`${PROFILE} already exists in OCI ADB with snapshot data; rerun with --resume only after verifying it is an interrupted copy.`);
      await target.execute(`UPDATE z_base_dataset_profiles SET profile_name=:profileName,city_label=:cityLabel,profile_status='available',profile_notes=:profileNotes,captured_at=:capturedAt WHERE dataset_profile_id=:profileId`, { profileName, cityLabel, profileNotes, capturedAt, profileId: targetProfileId });
    } else {
      await target.execute(`INSERT INTO z_base_dataset_profiles(profile_code,profile_name,city_label,profile_status,profile_notes,captured_at)
        VALUES(:profile,:profileName,:cityLabel,'available',:profileNotes,:capturedAt)`, { profile: PROFILE, profileName, cityLabel, profileNotes, capturedAt });
      const targetProfile = await target.execute('SELECT dataset_profile_id FROM z_base_dataset_profiles WHERE profile_code=:profile', { profile: PROFILE });
      targetProfileId = targetProfile.rows[0][0];
    }
    await target.commit();
    console.log(JSON.stringify({ phase: 'profile-created', sourceProfileId: Number(sourceProfileId), targetProfileId: Number(targetProfileId) }));
    for (const table of TABLES) {
      const sourceColumns = await tableColumns(source, table);
      const targetColumns = await tableColumns(target, table);
      if (!sourceColumns.length || !targetColumns.length) throw new Error(`${table} is missing from one database.`);
      const targetByName = new Map(targetColumns.map((column) => [column.name, column]));
      const columns = sourceColumns.filter((column) => column.name !== 'DATASET_PROFILE_ID' && targetByName.has(column.name));
      const selectList = columns.map((column) => column.name).join(',');
      const sourceRows = await source.execute(`SELECT ${selectList} FROM ${table} WHERE dataset_profile_id=:profileId`, { profileId: sourceProfileId });
      const targetRows = await target.execute(`SELECT COUNT(*) FROM ${table} WHERE dataset_profile_id=:profileId`, { profileId: targetProfileId });
      const existingRows = Number(targetRows.rows[0][0]);
      if (existingRows) {
        if (existingRows !== sourceRows.rows.length) throw new Error(`${table} has ${existingRows} pre-existing target rows; expected ${sourceRows.rows.length}.`);
        console.log(JSON.stringify({ phase: 'already-copied', table, rows: existingRows }));
        continue;
      }
      if (sourceRows.rows.length) {
        const insertColumns = ['DATASET_PROFILE_ID', ...columns.map((column) => column.name)];
        const values = [':profileId', ...columns.map((column) => targetByName.get(column.name).type === 'VECTOR' ? `TO_VECTOR(:${column.name})` : `:${column.name}`)];
        const sql = `INSERT INTO ${table}(${insertColumns.join(',')}) VALUES(${values.join(',')})`;
        const binds = sourceRows.rows.map((row) => {
          const bind = { profileId: targetProfileId };
          columns.forEach((column, index) => { bind[column.name] = bindValue(row[index], targetByName.get(column.name).type); });
          return bind;
        });
        for (let offset = 0; offset < binds.length; offset += 200) await target.executeMany(sql, binds.slice(offset, offset + 200));
        await target.commit();
      }
      console.log(JSON.stringify({ phase: 'copied', table, rows: sourceRows.rows.length }));
    }
    const targetActive = await target.execute(`SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`);
    const counts = await Promise.all(['Z_BASE_CRIME_INCIDENTS', 'Z_BASE_INCIDENT_REPORTS', 'Z_BASE_PERSONS', 'Z_BASE_CASE_FILES', 'Z_BASE_SOCIAL_MEDIA_POSTS'].map(async (table) => {
      const [sourceCount, targetCount] = await Promise.all([
        source.execute(`SELECT COUNT(*) FROM ${table} WHERE dataset_profile_id=:id`, { id: sourceProfileId }),
        target.execute(`SELECT COUNT(*) FROM ${table} WHERE dataset_profile_id=:id`, { id: targetProfileId }),
      ]);
      return [table, Number(sourceCount.rows[0][0]), Number(targetCount.rows[0][0])];
    }));
    if (targetActive.rows[0][0] !== 'ADELAIDE_DATA' || counts.some(([, sourceCount, targetCount]) => sourceCount !== targetCount)) throw new Error(`Post-copy validation failed: ${JSON.stringify({ active: targetActive.rows[0][0], counts })}`);
    console.log(JSON.stringify({ phase: 'complete', activeProfile: targetActive.rows[0][0], copiedProfile: PROFILE, counts }));
  } catch (error) { await target.rollback(); throw error; } finally { await source.close(); await target.close(); }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
