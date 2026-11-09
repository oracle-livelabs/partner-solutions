'use strict';
require('dotenv').config();
const oracledb=require('oracledb');
const statements=[
  `CREATE TABLE cdr_learn_runs (
    run_id VARCHAR2(40) PRIMARY KEY,batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id),
    requested_by VARCHAR2(80) NOT NULL,status VARCHAR2(20) NOT NULL CHECK(status IN ('queued','running','complete','failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    lease_token VARCHAR2(40),lease_until TIMESTAMP WITH TIME ZONE,attempts NUMBER DEFAULT 0 NOT NULL,
    model_id VARCHAR2(200) NOT NULL,region VARCHAR2(80) NOT NULL,prompt_version VARCHAR2(40) NOT NULL,
    input_fingerprint VARCHAR2(64) NOT NULL,input_sha256 VARCHAR2(64) NOT NULL,
    input_json CLOB NOT NULL CHECK(input_json IS JSON),result_json CLOB CHECK(result_json IS JSON),
    title VARCHAR2(1000 BYTE),request_id VARCHAR2(500),error_text VARCHAR2(2000 BYTE)
  )`,
  `CREATE UNIQUE INDEX cdr_learn_one_active ON cdr_learn_runs(CASE WHEN status IN ('queued','running') THEN batch_id END)`,
];
async function setup(c){
  for(const sql of statements){try{await c.execute(sql);}catch(e){if(e.errorNum!==955)throw e;}}
  await c.execute(`CREATE OR REPLACE VIEW secure_cdr_learn_runs_v AS SELECT r.* FROM cdr_learn_runs r JOIN secure_cdr_batches_v b ON b.batch_id=r.batch_id`);
  await c.execute(`UPDATE cdr_stages SET status='pending',detail='Run Learn-what-is-there after all item descriptions are complete' WHERE stage_no=5 AND status='not_enabled'`);
  await c.commit();console.log('Data Room learning table, scoped view and stage-five availability ready. No inference queued; original content unchanged.');
}
if(require.main===module)(async()=>{
  const wallet=process.env.ORACLE_WALLET_LOCATION;
  const c=await oracledb.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,
    ...(wallet?{walletLocation:wallet,configDir:wallet,walletPassword:process.env.ORACLE_WALLET_PASSWORD}:{})});
  try{await setup(c);}finally{await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup};
