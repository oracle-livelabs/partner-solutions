'use strict';
// Read-only Oracle regression. No model calls or database writes.
const assert = require('node:assert/strict');
const oracledb = require('oracledb');
const {executeSelectAiV2Results} = require('../backend/ask-crime-v2-results');

(async () => {
  if (process.env.ORACLE_USER !== 'CRIME_DATA' || !/fu40/i.test(process.env.ORACLE_CONNECTION_STRING || '')) throw Error('Expected FU40 IncidentData.');
  const wallet = process.env.ORACLE_WALLET_LOCATION;
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER, password: process.env.APP_SCHEMA_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING,
    walletLocation: wallet, configDir: wallet, walletPassword: process.env.ORACLE_WALLET_PASSWORD,
  });
  try {
    connection.callTimeout = 15000;
    await connection.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;', {u: 'statewide_admin'});
    const text = 'Norwood café — long narrative. '.repeat(1500);
    const sql = `SELECT :narrative AS "Report narrative", TO_NCLOB('会話 — café') AS "National text", TO_CLOB(NULL) AS null_text, EMPTY_CLOB() AS empty_text FROM dual`;
    // The executor takes validated SQL in the route; this direct unit-level
    // Oracle check uses DUAL only to construct long text without writing data.
    const fixtureSql = `SELECT TO_CLOB(RPAD('N', 4000, 'N')) || TO_CLOB(RPAD('X', 4000, 'X')) || TO_CLOB(' — café') AS "Report narrative", TO_NCLOB('会話 — café') AS "National text", TO_CLOB(NULL) AS null_text, EMPTY_CLOB() AS empty_text FROM dual`;
    const legacy = await connection.execute(`SELECT * FROM (${fixtureSql}) WHERE ROWNUM<=100`, {}, {outFormat: oracledb.OUT_FORMAT_OBJECT});
    assert.equal(typeof legacy.rows[0]['Report narrative'].getData, 'function');
    for (const row of legacy.rows) for (const value of Object.values(row)) if (value instanceof oracledb.Lob) await value.getData();
    for (let pass = 0; pass < 3; pass++) {
      const {rows} = await executeSelectAiV2Results(connection, fixtureSql);
      assert.equal(rows[0]['Report narrative'], 'N'.repeat(4000) + 'X'.repeat(4000) + ' — café');
      assert.equal(rows[0]['National text'], '会話 — café');
      assert.equal(rows[0].NULL_TEXT, null);
      assert.equal(rows[0].EMPTY_TEXT, null, 'The driver maps empty LOB text to SQL string null');
      JSON.stringify(rows);
    }
    // A CLOB bind exercises text beyond 32K with the same production fetch options.
    const bindingConnection = {execute: (query, binds, options) => connection.execute(query, {narrative: {val: text, type: oracledb.CLOB}}, options)};
    const longResult = await executeSelectAiV2Results(bindingConnection, sql);
    assert.equal(longResult.rows[0]['Report narrative'], text);
    const norwoodSql = `SELECT i.incident_ref, i.occurred_at, r.report_summary, r.report_text AS "Report narrative", DBMS_LOB.GETLENGTH(r.report_text) AS narrative_length FROM secure_crime_incidents_v i LEFT JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id WHERE UPPER(i.suburb)='NORWOOD' ORDER BY i.occurred_at DESC FETCH FIRST 5 ROWS ONLY`;
    const result = await executeSelectAiV2Results(connection, norwoodSql);
    assert.equal(result.rows.length, 5);
    for (const row of result.rows) {
      assert.equal(typeof row.REPORT_SUMMARY, 'string');
      assert.equal(typeof row['Report narrative'], 'string');
      assert.equal(row['Report narrative'].length, row.NARRATIVE_LENGTH);
    }
    console.log(JSON.stringify({driver: oracledb.versionString, norwoodRows: result.rows.length, fullNarratives: true, longTextCharacters: text.length, clob: 'passed', nclob: 'passed', nullAndEmpty: 'passed', cachedExecutions: 3}));
  } finally {await connection.close();}
})().catch(error => {console.error(error.message); process.exitCode = 1;});
