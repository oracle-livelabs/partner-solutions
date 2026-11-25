#!/usr/bin/env node
/*
 * Clean only the objects owned by the configured IncidentData schema.
 * Use before a full ADB demonstration rebuild. This script is intentionally
 * guarded because it drops all application tables, views, packages, property
 * graphs, and sequences in that schema.
 */
const oracledb = require('oracledb');

const apply = process.argv.includes('--apply');
const identifier = (name) => {
  if (!/^[A-Z][A-Z0-9_$#]*$/.test(name)) throw new Error(`Unexpected database object name: ${name}`);
  return name;
};

async function rows(connection, sql) {
  const result = await connection.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
  return result.rows;
}

async function main() {
  const password = process.env.APP_SCHEMA_PASSWORD;
  const walletPassword = process.env.ADB_WALLET_PASSWORD || process.env.ORACLE_WALLET_PASSWORD;
  if (!password || !walletPassword) throw new Error('APP_SCHEMA_PASSWORD and ADB_WALLET_PASSWORD are required.');
  const walletLocation = process.env.ORACLE_WALLET_LOCATION || '/home/opc/wallet';
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER || 'CRIME_DATA',
    password,
    connectString: process.env.ADB_CONNECT_STRING || process.env.ORACLE_CONNECTION_STRING || 'fu40_medium',
    walletLocation,
    walletPassword,
    configDir: walletLocation,
  });
  try {
    const inventory = {
      graphs: await rows(connection, 'SELECT graph_name FROM user_property_graphs'),
      views: await rows(connection, 'SELECT view_name FROM user_views'),
      packages: await rows(connection, "SELECT object_name FROM user_objects WHERE object_type='PACKAGE'"),
      tables: await rows(connection, 'SELECT table_name FROM user_tables'),
      sequences: await rows(connection, 'SELECT sequence_name FROM user_sequences'),
    };
    console.log(JSON.stringify(Object.fromEntries(Object.entries(inventory).map(([kind, values]) => [kind, values.length]))));
    if (!apply) {
      console.log('Dry run only. Re-run with --apply to remove these schema-owned objects.');
      return;
    }
    for (const { GRAPH_NAME } of inventory.graphs) await connection.execute(`DROP PROPERTY GRAPH ${identifier(GRAPH_NAME)}`);
    for (const { VIEW_NAME } of inventory.views) await connection.execute(`DROP VIEW ${identifier(VIEW_NAME)}`);
    for (const { OBJECT_NAME } of inventory.packages) await connection.execute(`DROP PACKAGE ${identifier(OBJECT_NAME)}`);
    for (const { TABLE_NAME } of inventory.tables) await connection.execute(`DROP TABLE ${identifier(TABLE_NAME)} CASCADE CONSTRAINTS PURGE`);
    for (const { SEQUENCE_NAME } of await rows(connection, 'SELECT sequence_name FROM user_sequences')) await connection.execute(`DROP SEQUENCE ${identifier(SEQUENCE_NAME)}`);
    const remaining = await rows(connection, 'SELECT COUNT(*) remaining_tables FROM user_tables');
    if (Number(remaining[0].REMAINING_TABLES) !== 0) throw new Error(`Schema reset incomplete: ${remaining[0].REMAINING_TABLES} tables remain.`);
    console.log('Clean refresh complete: no schema tables remain.');
  } finally {
    await connection.close();
  }
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
