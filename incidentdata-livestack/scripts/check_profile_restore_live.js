#!/usr/bin/env node
/*
 * Exercises the same database package used by Data Foundation → IncidentData
 * Setup.  A restore intentionally replaces the active demonstration dataset,
 * so it requires an explicit profile-code confirmation.
 */
require('dotenv').config();
const assert = require('node:assert/strict');
const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const requestedProfile = String(process.env.CRIMEDATA_RESTORE_TEST_PROFILE || '').trim().toUpperCase();
if (!requestedProfile || process.env.CONFIRM_CRIMEDATA_RESTORE_TEST !== requestedProfile) {
  throw new Error('Set CRIMEDATA_RESTORE_TEST_PROFILE and CONFIRM_CRIMEDATA_RESTORE_TEST to the same profile code (for example ADELAIDE_DATA). This test replaces the active demonstration dataset.');
}

async function main() {
  const walletLocation = process.env.ORACLE_WALLET_LOCATION;
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER || 'CRIME_DATA',
    password: process.env.APP_SCHEMA_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING || process.env.ADB_CONNECT_STRING,
    ...(walletLocation ? { walletLocation, walletPassword: process.env.ORACLE_WALLET_PASSWORD, configDir: walletLocation } : {}),
  });
  try {
    const [before, source] = await Promise.all([
      connection.execute(`SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`),
      connection.execute(`SELECT COUNT(*) incident_count FROM z_base_crime_incidents b JOIN z_base_dataset_profiles p ON p.dataset_profile_id=b.dataset_profile_id WHERE p.profile_code=:profileCode`, { profileCode: requestedProfile }),
    ]);
    assert(Number(source.rows[0].INCIDENT_COUNT) > 0, `Profile ${requestedProfile} has no Z_BASE incidents.`);

    await connection.execute(`BEGIN z_base_dataset_admin.restore_profile(:profileCode); END;`, { profileCode: requestedProfile });

    const [after, live] = await Promise.all([
      connection.execute(`SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`),
      connection.execute('SELECT COUNT(*) incident_count FROM crime_incidents'),
    ]);
    assert.equal(after.rows[0].PROFILE_CODE, requestedProfile, 'Restore did not activate the requested profile.');
    assert.equal(Number(live.rows[0].INCIDENT_COUNT), Number(source.rows[0].INCIDENT_COUNT), 'Live incident count does not match the selected Z_BASE profile.');
    console.log(JSON.stringify({
      passed: true,
      restoredProfile: requestedProfile,
      previousProfile: before.rows[0]?.PROFILE_CODE || null,
      incidentCount: Number(live.rows[0].INCIDENT_COUNT),
    }));
  } finally {
    await connection.close();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
