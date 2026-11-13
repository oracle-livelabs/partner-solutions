'use strict';

// Audit by default. --dry-run verifies updates then rolls them back; --apply commits.
// Only ACTIVATE_UI flags change. No profile restore or embedding calls are made.
const assert = require('node:assert/strict');
const REFERENCE = 'ADELAIDE_DATA_V2';
const WATCH_CODES = Object.freeze([
  'SERVICE_ACCESS', 'ART_MARKET_PAYMENTS', 'NIGHT_PRECINCT_ACTIVITY',
  'RESIDENTIAL_OCCUPANCY_BURGLARY', 'VEHICLE_PARTS_HARVESTING',
  'CONSTRUCTION_SITE_MATERIAL_THEFT',
]);
const visible = rows => rows.filter(r => r.ACTIVE === 1 && r.ACTIVATE_UI === 'Y')
  .map(r => r.PATTERN_CODE).sort();

function planFlags(rows, label) {
  assert.equal(new Set(rows.map(r => r.PATTERN_CODE)).size, rows.length, `${label}: duplicate pattern`);
  for (const code of WATCH_CODES) {
    assert(rows.some(r => r.PATTERN_CODE === code && r.ACTIVE === 1), `${label}: missing active definition ${code}`);
  }
  return rows.flatMap(row => {
    const flag = WATCH_CODES.includes(row.PATTERN_CODE) ? 'Y' : null;
    return row.ACTIVATE_UI === flag ? [] : [{code: row.PATTERN_CODE, before: row.ACTIVATE_UI, flag}];
  });
}

async function inside(mode, profiles) {
  const o = require('oracledb');
  o.outFormat = o.OUT_FORMAT_OBJECT;
  const c = await o.getConnection({
    user: process.env.ORACLE_USER, password: process.env.APP_SCHEMA_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING,
    walletLocation: process.env.ORACLE_WALLET_LOCATION,
    walletPassword: process.env.ORACLE_WALLET_PASSWORD,
    configDir: process.env.ORACLE_WALLET_LOCATION,
  });
  c.callTimeout = 30000;
  const rows = async (sql, binds = {}) => (await c.execute(sql, binds)).rows;
  const active = async lock => rows(`SELECT a.*,p.profile_code FROM z_base_active_dataset_profile a
    JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1
    ${lock ? 'FOR UPDATE OF a.dataset_profile_id NOWAIT' : ''}`);
  const inventory = async () => {
    const catalogue = await rows('SELECT dataset_profile_id,profile_code FROM z_base_dataset_profiles ORDER BY profile_code');
    const saved = [];
    for (const profile of profiles) {
      const found = catalogue.find(r => r.PROFILE_CODE === profile.code);
      assert(found, `Missing saved city ${profile.code}`);
      saved.push({...profile, id: found.DATASET_PROFILE_ID, rows: await rows(
        'SELECT * FROM z_base_watched_crime_patterns WHERE dataset_profile_id=:pid ORDER BY pattern_code', {pid: found.DATASET_PROFILE_ID})});
    }
    return {saved, live: await rows('SELECT * FROM watched_crime_patterns ORDER BY pattern_code')};
  };
  try {
    assert.equal((await rows('SELECT user schema_name FROM dual'))[0].SCHEMA_NAME, 'CRIME_DATA');
    await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");
    if (mode === '--check') await c.execute('SET TRANSACTION READ ONLY');
    else {
      await c.execute('ALTER SESSION DISABLE PARALLEL DML');
      // Prevent concurrent profile restoration or watch edits during verification.
      await c.execute('LOCK TABLE z_base_watched_crime_patterns IN EXCLUSIVE MODE NOWAIT');
      await c.execute('LOCK TABLE watched_crime_patterns IN EXCLUSIVE MODE NOWAIT');
    }
    const initialActive = await active(mode !== '--check');
    assert.equal(initialActive.length, 1);
    const before = await inventory();
    assert.deepEqual(visible(before.saved.find(p => p.code === REFERENCE).rows), [...WATCH_CODES].sort(),
      'Adelaide reference selection changed; review before aligning cities');
    const plans = before.saved.map(p => ({code: p.code, city: p.city, id: p.id, changes: planFlags(p.rows, p.code)}));
    const liveProfile = before.saved.find(p => p.code === initialActive[0].PROFILE_CODE);
    assert(liveProfile, 'The active profile is outside the nine city choices');
    const liveChanges = planFlags(before.live, 'active live profile');
    const receipt = {mode, reference: REFERENCE, watchCodes: WATCH_CODES, activeBefore: initialActive,
      profiles: before.saved.map((p, i) => ({city: p.city, profileCode: p.code,
        beforeCount: visible(p.rows).length, beforeCodes: visible(p.rows), plannedChanges: plans[i].changes})),
      liveBeforeCodes: visible(before.live), liveChanges, before};
    if (mode !== '--check') {
      for (const p of plans) for (const change of p.changes) {
        const r = await c.execute('UPDATE z_base_watched_crime_patterns SET activate_ui=:flag WHERE dataset_profile_id=:pid AND pattern_code=:code',
          {flag: change.flag, pid: p.id, code: change.code});
        assert.equal(r.rowsAffected, 1);
      }
      for (const change of liveChanges) {
        const r = await c.execute('UPDATE watched_crime_patterns SET activate_ui=:flag WHERE pattern_code=:code',
          {flag: change.flag, code: change.code});
        assert.equal(r.rowsAffected, 1);
      }
      const after = await inventory();
      const withoutFlags = state => JSON.stringify(state, (key, value) => key === 'ACTIVATE_UI' ? undefined : value);
      assert.equal(withoutFlags(after), withoutFlags(before), 'Unexpected change beyond visibility flags');
      for (const p of after.saved) assert.deepEqual(visible(p.rows), [...WATCH_CODES].sort(), p.code);
      assert.deepEqual(visible(after.live), [...WATCH_CODES].sort());
      assert.deepEqual(await active(false), initialActive, 'Active dataset changed');
      receipt.afterCounts = after.saved.map(p => ({city: p.city, profileCode: p.code, count: visible(p.rows).length}));
      receipt.onlyVisibilityFlagsChanged = true;
      if (mode === '--apply') await c.commit();
      else {
        await c.rollback();
        assert.deepEqual(await inventory(), before, 'Dry-run rollback did not restore original flags');
      }
    }
    receipt.committed = mode === '--apply';
    receipt.at = new Date().toISOString();
    console.log(JSON.stringify(receipt, null, 2));
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    await c.rollback();
    await c.close();
  }
}

async function main() {
  const mode = process.argv.find(a => ['--check', '--dry-run', '--apply'].includes(a)) || '--check';
  if (process.argv.includes('--inside')) {
    const profiles = JSON.parse(process.argv[process.argv.indexOf('--profiles') + 1]);
    return inside(mode, profiles);
  }
  const {FOUNDATION_PROFILES} = await import('../frontend/src/foundation-profiles.mjs');
  assert.equal(FOUNDATION_PROFILES.length, 9);
  const {execFileSync} = require('node:child_process');
  const containerArg = process.argv.indexOf('--container');
  const container = containerArg === -1 ? 'policeadelaide_app-fu40_1' : process.argv[containerArg + 1];
  process.stdout.write(execFileSync('podman', ['exec', '-i', container, 'node', '-', '--inside', mode,
    '--profiles', JSON.stringify(FOUNDATION_PROFILES)], {
    input: require('node:fs').readFileSync(__filename), encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024,
  }));
}

module.exports = {WATCH_CODES, visible, planFlags};
if (require.main === module || process.argv.includes('--inside'))
  main().catch(e => {console.error(e.message); process.exitCode = 1;});
