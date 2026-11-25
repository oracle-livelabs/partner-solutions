'use strict';
require('dotenv').config();
const oracledb = require('oracledb');

// Additive, intentionally independent of the replaceable city-profile seed tables.
const tables = [
  `CREATE TABLE cdr_batches (
    batch_id VARCHAR2(48) PRIMARY KEY, filename VARCHAR2(255 BYTE) NOT NULL,
    loaded_by VARCHAR2(80) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    status VARCHAR2(20) DEFAULT 'uploading' NOT NULL CHECK (status IN ('uploading','queued','processing','ready','failed')),
    archive_bytes NUMBER NOT NULL, archive_sha256 VARCHAR2(64), archive_blob BLOB,
    file_count NUMBER DEFAULT 0 NOT NULL, expanded_bytes NUMBER DEFAULT 0 NOT NULL,
    headline VARCHAR2(1000 BYTE), error_text VARCHAR2(2000 BYTE), ignored_count NUMBER DEFAULT 0 NOT NULL,
    lease_token VARCHAR2(40), lease_until TIMESTAMP WITH TIME ZONE, attempts NUMBER DEFAULT 0 NOT NULL,
    synthetic_only CHAR(1) DEFAULT 'Y' NOT NULL CHECK (synthetic_only='Y')
  )`,
  `CREATE TABLE cdr_items (
    item_id VARCHAR2(32) PRIMARY KEY, batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id),
    original_path VARCHAR2(500 BYTE) NOT NULL, content_type VARCHAR2(8) NOT NULL,
    byte_count NUMBER NOT NULL, sha256 VARCHAR2(64) NOT NULL, content_blob BLOB NOT NULL,
    headline VARCHAR2(2000 BYTE) NOT NULL, description_source VARCHAR2(30) DEFAULT 'inventory' NOT NULL,
    text_preview CLOB, row_count NUMBER, created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT cdr_item_path_uq UNIQUE (batch_id, original_path)
  )`,
  `CREATE TABLE cdr_stages (
    batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id), stage_no NUMBER NOT NULL,
    stage_name VARCHAR2(50) NOT NULL, status VARCHAR2(20) NOT NULL
      CHECK (status IN ('pending','running','complete','failed','not_enabled')),
    detail VARCHAR2(2000 BYTE), started_at TIMESTAMP WITH TIME ZONE, finished_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT cdr_stage_pk PRIMARY KEY (batch_id,stage_no)
  )`,
];
const views = [
  `CREATE OR REPLACE VIEW secure_cdr_batches_v AS SELECT b.* FROM cdr_batches b
   WHERE b.loaded_by=SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')
     OR SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')='statewide_admin'`,
  `CREATE OR REPLACE VIEW secure_cdr_items_v AS SELECT i.* FROM cdr_items i
   JOIN secure_cdr_batches_v b ON b.batch_id=i.batch_id`,
  `CREATE OR REPLACE VIEW secure_cdr_stages_v AS SELECT s.* FROM cdr_stages s
   JOIN secure_cdr_batches_v b ON b.batch_id=s.batch_id`,
];

async function setup(connection) {
  for (const sql of tables) {
    try { await connection.execute(sql); }
    catch (error) { if (error.errorNum !== 955) throw error; }
  }
  for (const sql of views) await connection.execute(sql);
  console.log('Data Room: three additive tables and three scoped views are ready. Existing incident/profile data was not changed.');
}
if (require.main === module) {
  (async () => {
    const wallet = process.env.ORACLE_WALLET_LOCATION;
    const c = await oracledb.getConnection({ user: process.env.ORACLE_USER, password: process.env.APP_SCHEMA_PASSWORD,
      connectString: process.env.ORACLE_CONNECTION_STRING,
      ...(wallet ? { walletLocation: wallet, configDir: wallet, walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}) });
    try { await setup(c); } finally { await c.close(); }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { setup };
