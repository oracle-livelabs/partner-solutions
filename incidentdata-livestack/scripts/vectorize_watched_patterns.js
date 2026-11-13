#!/usr/bin/env node
/* Generates Cohere Embed 4 document vectors for active watched-pattern definitions only. */
const oracledb = require('oracledb');
const { PATTERN_EMBEDDING_MODEL, PATTERN_EMBEDDING_DIMENSIONS, embedPatternTexts, patternEmbeddingText, textHash, vectorLiteral } = require('../backend/pattern-embeddings');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function main() {
  for (const key of ['APP_SCHEMA_PASSWORD', 'ADB_WALLET_PASSWORD']) if (!process.env[key]) throw new Error(`${key} must be set.`);
  const walletLocation = process.env.ORACLE_WALLET_LOCATION || '/home/opc/wallet';
  const connection = await oracledb.getConnection({ user: process.env.ORACLE_USER || 'CRIME_DATA', password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ADB_CONNECT_STRING || 'fu40_medium', walletLocation, walletPassword: process.env.ADB_WALLET_PASSWORD, configDir: walletLocation });
  try {
    await connection.execute('ALTER SESSION DISABLE PARALLEL DML');
    await connection.execute(`DECLARE v_count NUMBER; BEGIN SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name='WATCHED_PATTERN_EMBEDDINGS'; IF v_count=0 THEN EXECUTE IMMEDIATE q'[CREATE TABLE watched_pattern_embeddings (pattern_code VARCHAR2(40) PRIMARY KEY REFERENCES watched_crime_patterns(pattern_code), embedding_model VARCHAR2(120) NOT NULL, source_sha256 VARCHAR2(64) NOT NULL, embedding VECTOR(1536,FLOAT32) NOT NULL, created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL) ]'; END IF; END;`);
    const result = await connection.execute(`SELECT pattern_code,pattern_name,pattern_summary,why_watch FROM watched_crime_patterns WHERE active=1 ORDER BY display_order`);
    const patterns = result.rows;
    const documents = patterns.map(patternEmbeddingText);
    const vectors = await embedPatternTexts(documents, 'SEARCH_DOCUMENT');
    await connection.executeMany(`MERGE INTO watched_pattern_embeddings e USING (SELECT :code pattern_code FROM dual) s ON (e.pattern_code=s.pattern_code)
      WHEN MATCHED THEN UPDATE SET e.embedding_model=:model,e.source_sha256=:hash,e.embedding=TO_VECTOR(:vector),e.created_at=SYSTIMESTAMP
      WHEN NOT MATCHED THEN INSERT(pattern_code,embedding_model,source_sha256,embedding) VALUES(:code,:model,:hash,TO_VECTOR(:vector))`, patterns.map((pattern, index) => ({ code: pattern.PATTERN_CODE, model: PATTERN_EMBEDDING_MODEL, hash: textHash(documents[index]), vector: vectorLiteral(vectors[index]) })));
    await connection.commit();
    const check = await connection.execute('SELECT COUNT(*) vector_count,MIN(embedding_model) model FROM watched_pattern_embeddings');
    console.log(JSON.stringify({ phase: 'complete', patterns: patterns.length, dimensions: PATTERN_EMBEDDING_DIMENSIONS, model: PATTERN_EMBEDDING_MODEL, stored: Number(check.rows[0].VECTOR_COUNT) }));
  } catch (error) { await connection.rollback(); throw error; } finally { await connection.close(); }
}
main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
