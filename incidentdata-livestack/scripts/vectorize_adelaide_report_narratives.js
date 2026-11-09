#!/usr/bin/env node
/* Resumable Cohere Embed 4 ingestion for the active Adelaide report corpus. */
const crypto = require('crypto');
const oracledb = require('oracledb');
const { PATTERN_EMBEDDING_MODEL, PATTERN_EMBEDDING_DIMENSIONS, embedPatternTexts, vectorLiteral } = require('../backend/pattern-embeddings');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
const PROFILE = process.env.INCIDENT_VECTOR_PROFILE || 'ADELAIDE_DATA';
const BATCH_SIZE = 64;

function sha(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function documentFor(row) {
  return [`Incident category: ${row.CATEGORY_NAME}`, `Location context: ${row.LOCATION_TYPE || 'unspecified'} in ${row.SUBURB}`, `Report summary: ${row.REPORT_SUMMARY}`, `Report narrative: ${String(row.REPORT_TEXT || '').slice(0, 1800)}`, 'Synthetic demonstration record. Semantic relevance requires analyst review and is not evidence of a connection.'].join('\n');
}
async function main() {
  const walletPassword = process.env.ADB_WALLET_PASSWORD || process.env.ORACLE_WALLET_PASSWORD;
  for (const key of ['APP_SCHEMA_PASSWORD']) if (!process.env[key]) throw new Error(`${key} must be set.`);
  if (!walletPassword) throw new Error('ADB_WALLET_PASSWORD or ORACLE_WALLET_PASSWORD must be set.');
  const walletLocation = process.env.ORACLE_WALLET_LOCATION || '/home/opc/wallet';
  const connection = await oracledb.getConnection({ user: process.env.ORACLE_USER || 'CRIME_DATA', password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ADB_CONNECT_STRING || 'fu40_medium', walletLocation, walletPassword, configDir: walletLocation });
  try {
    await connection.execute('ALTER SESSION DISABLE PARALLEL DML');
    await connection.execute(`DECLARE v_count NUMBER; BEGIN SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name='INCIDENT_NARRATIVE_EMBEDDINGS_V4'; IF v_count=0 THEN EXECUTE IMMEDIATE q'[CREATE TABLE incident_narrative_embeddings_v4 (profile_code VARCHAR2(40) NOT NULL, incident_ref VARCHAR2(24) NOT NULL, embedding_model VARCHAR2(120) NOT NULL, source_sha256 VARCHAR2(64) NOT NULL, embedding VECTOR(1536,FLOAT32) NOT NULL, created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, PRIMARY KEY(profile_code,incident_ref)) ]'; END IF; END;`);
    const active = await connection.execute(`SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`);
    if (active.rows[0]?.PROFILE_CODE !== PROFILE) throw new Error(`Active profile must be ${PROFILE}; found ${active.rows[0]?.PROFILE_CODE || 'none'}.`);
    const result = await connection.execute(`SELECT i.incident_ref,cat.category_name,i.location_type,i.suburb,r.report_summary,DBMS_LOB.SUBSTR(r.report_text,1800,1) report_text FROM crime_incidents i JOIN incident_categories cat ON cat.category_id=i.category_id JOIN incident_reports r ON r.incident_id=i.incident_id ORDER BY i.incident_ref`);
    const records = result.rows.map((row) => ({ ...row, document: documentFor(row) }));
    const existing = await connection.execute(`SELECT incident_ref,source_sha256 FROM incident_narrative_embeddings_v4 WHERE profile_code=:profile`, { profile: PROFILE });
    const existingHash = new Map(existing.rows.map((row) => [row.INCIDENT_REF, row.SOURCE_SHA256]));
    const pending = records.filter((row) => existingHash.get(row.INCIDENT_REF) !== sha(row.document));
    console.log(JSON.stringify({ phase: 'prepared', total: records.length, alreadyCurrent: records.length - pending.length, pending: pending.length, batchSize: BATCH_SIZE }));
    for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
      const batch = pending.slice(offset, offset + BATCH_SIZE); const vectors = await embedPatternTexts(batch.map((row) => row.document), 'SEARCH_DOCUMENT');
      await connection.executeMany(`MERGE INTO incident_narrative_embeddings_v4 e USING (SELECT :profile profile_code,:incidentRef incident_ref FROM dual) s ON (e.profile_code=s.profile_code AND e.incident_ref=s.incident_ref)
        WHEN MATCHED THEN UPDATE SET e.embedding_model=:model,e.source_sha256=:hash,e.embedding=TO_VECTOR(:vector),e.created_at=SYSTIMESTAMP
        WHEN NOT MATCHED THEN INSERT(profile_code,incident_ref,embedding_model,source_sha256,embedding) VALUES(:profile,:incidentRef,:model,:hash,TO_VECTOR(:vector))`, batch.map((row, index) => ({ profile: PROFILE, incidentRef: row.INCIDENT_REF, model: PATTERN_EMBEDDING_MODEL, hash: sha(row.document), vector: vectorLiteral(vectors[index]) })));
      await connection.commit();
      console.log(JSON.stringify({ phase: 'embedded', completed: Math.min(offset + batch.length, pending.length), pending: pending.length, total: records.length }));
    }
    const check = await connection.execute(`SELECT COUNT(*) vector_count,MIN(embedding_model) model FROM incident_narrative_embeddings_v4 WHERE profile_code=:profile`, { profile: PROFILE });
    if (Number(check.rows[0].VECTOR_COUNT) !== records.length) throw new Error(`Vector count validation failed: ${check.rows[0].VECTOR_COUNT}/${records.length}.`);
    console.log(JSON.stringify({ phase: 'complete', profile: PROFILE, vectors: Number(check.rows[0].VECTOR_COUNT), dimensions: PATTERN_EMBEDDING_DIMENSIONS, model: PATTERN_EMBEDDING_MODEL }));
  } catch (error) { await connection.rollback(); throw error; } finally { await connection.close(); }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
