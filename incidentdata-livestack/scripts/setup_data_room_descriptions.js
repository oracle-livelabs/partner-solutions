'use strict';
require('dotenv').config();
const oracledb = require('oracledb');
const statements = [
  `CREATE TABLE cdr_ai_runs (
    run_id VARCHAR2(40) PRIMARY KEY, batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id),
    requested_by VARCHAR2(80) NOT NULL, status VARCHAR2(20) NOT NULL CHECK(status IN ('queued','running','complete','failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL, started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    lease_token VARCHAR2(40), lease_until TIMESTAMP WITH TIME ZONE, attempts NUMBER DEFAULT 0 NOT NULL,
    item_total NUMBER DEFAULT 0 NOT NULL, completed_count NUMBER DEFAULT 0 NOT NULL, failed_count NUMBER DEFAULT 0 NOT NULL,
    text_model VARCHAR2(200) NOT NULL, image_model VARCHAR2(200) NOT NULL, region VARCHAR2(80) NOT NULL,
    prompt_version VARCHAR2(40) NOT NULL, error_text VARCHAR2(2000 BYTE)
  )`,
  `CREATE UNIQUE INDEX cdr_ai_one_active ON cdr_ai_runs (CASE WHEN status IN ('queued','running') THEN batch_id END)`,
  `CREATE TABLE cdr_ai_results (
    run_id VARCHAR2(40) NOT NULL REFERENCES cdr_ai_runs(run_id), item_id VARCHAR2(32) NOT NULL REFERENCES cdr_items(item_id),
    source_sha256 VARCHAR2(64) NOT NULL, status VARCHAR2(20) NOT NULL CHECK(status IN ('complete','failed')),
    headline VARCHAR2(1000 BYTE), result_json CLOB CHECK(result_json IS JSON), error_text VARCHAR2(2000 BYTE),
    model_id VARCHAR2(200) NOT NULL, region VARCHAR2(80) NOT NULL, prompt_version VARCHAR2(40) NOT NULL,
    request_id VARCHAR2(500), created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT cdr_ai_result_pk PRIMARY KEY(run_id,item_id)
  )`,
];
async function setup(c) {
  for (const sql of statements) { try { await c.execute(sql); } catch(e) { if(e.errorNum !== 955) throw e; } }
  await c.execute(`CREATE OR REPLACE VIEW secure_cdr_ai_runs_v AS SELECT r.* FROM cdr_ai_runs r JOIN secure_cdr_batches_v b ON b.batch_id=r.batch_id`);
  await c.execute(`CREATE OR REPLACE VIEW secure_cdr_ai_results_v AS SELECT r.* FROM cdr_ai_results r JOIN secure_cdr_items_v i ON i.item_id=r.item_id AND i.sha256=r.source_sha256`);
  // Old batches become explicitly available for an on-demand run, without scheduling cloud calls.
  await c.execute(`UPDATE cdr_stages SET status='pending',detail='Ready to run Identify/Describe with OCI GenAI'
    WHERE stage_no=4 AND status='not_enabled'`);
  await c.commit(); console.log('Data Room Identify/Describe tables, scoped views and stage availability ready. No original content changed.');
}
if(require.main === module) (async()=>{
  const wallet=process.env.ORACLE_WALLET_LOCATION;
  const c=await oracledb.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,
    ...(wallet?{walletLocation:wallet,configDir:wallet,walletPassword:process.env.ORACLE_WALLET_PASSWORD}:{})});
  try{await setup(c);}finally{await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup};
