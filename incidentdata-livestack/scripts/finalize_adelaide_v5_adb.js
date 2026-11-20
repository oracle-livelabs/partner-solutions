#!/usr/bin/env node
/* Completes a legacy row-by-row Adelaide v5 load before scenario deployment. */
const oracledb = require('oracledb');

async function main() {
  for (const key of ['APP_SCHEMA_PASSWORD', 'ADB_WALLET_PASSWORD']) if (!process.env[key]) throw new Error(`${key} must be set.`);
  const walletLocation = process.env.ORACLE_WALLET_LOCATION || '/home/opc/wallet';
  const connection = await oracledb.getConnection({ user: process.env.ORACLE_USER || 'CRIME_DATA', password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ADB_CONNECT_STRING || 'fu40_medium', walletLocation, walletPassword: process.env.ADB_WALLET_PASSWORD, configDir: walletLocation });
  try {
    await connection.execute('ALTER SESSION DISABLE PARALLEL DML');
    const before = await connection.execute(`SELECT (SELECT COUNT(*) FROM crime_incidents) incidents,(SELECT COUNT(*) FROM incident_reports) reports,(SELECT COUNT(*) FROM incident_report_embeddings) vectors FROM dual`);
    const [incidents, reports, vectors] = before.rows[0];
    if (Number(incidents) !== 21513 || Number(reports) !== 21513 || Number(vectors) !== 0) throw new Error(`Unexpected legacy-load state: ${JSON.stringify(before.rows[0])}`);
    await connection.execute(`UPDATE crime_incidents SET
      address_line_1='Synthetic vicinity — ' || suburb,
      address_locality=suburb,
      address_region='South Australia',
      address_precision='masked_vicinity',
      address_enrichment_source='bulk_synthetic_locality'
      WHERE address_line_1 IS NULL OR address_precision<>'masked_vicinity'`);
    await connection.commit();
    await connection.execute(`INSERT INTO incident_report_embeddings(incident_id,embedding)
      SELECT incident_id, TO_VECTOR('[0,0,0,0,1,0,0,0]') FROM crime_incidents`);
    await connection.execute(`BEGIN z_base_dataset_admin.capture_active_profile('ADELAIDE_DATA','Adelaide Data Set Profile','Adelaide Metropolitan Area','Adelaide May-June 2026 synthetic profile v5; natural report titles and narratives; generator 5.0.0 seed 20260828.'); END;`);
    await connection.commit();
    const after = await connection.execute(`SELECT (SELECT COUNT(*) FROM crime_incidents) incidents,(SELECT COUNT(*) FROM incident_report_embeddings) vectors,(SELECT COUNT(*) FROM crime_incidents WHERE address_precision='masked_vicinity') masked FROM dual`);
    console.log(JSON.stringify({ phase: 'complete', counts: after.rows[0] }));
  } catch (error) { await connection.rollback(); throw error; } finally { await connection.close(); }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
