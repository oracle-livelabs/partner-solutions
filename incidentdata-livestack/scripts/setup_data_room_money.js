'use strict';
require('dotenv').config();
const o=require('oracledb');
const tables=[
 `CREATE TABLE cdr_money_runs (run_id VARCHAR2(36) PRIMARY KEY,batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id),
 requested_by VARCHAR2(80) NOT NULL,version VARCHAR2(40) NOT NULL,fingerprint VARCHAR2(64) NOT NULL,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,result_json CLOB NOT NULL CHECK(result_json IS JSON),
 CONSTRAINT cdr_money_snapshot_uq UNIQUE(batch_id,version,fingerprint))`,
 `CREATE TABLE cdr_money_accounts (account_key VARCHAR2(64) PRIMARY KEY,run_id VARCHAR2(36) NOT NULL REFERENCES cdr_money_runs(run_id),
 account_ref VARCHAR2(200 BYTE) NOT NULL,CONSTRAINT cdr_money_account_run_uq UNIQUE(run_id,account_key))`,
 `CREATE TABLE cdr_money_transfers (edge_key VARCHAR2(64) PRIMARY KEY,run_id VARCHAR2(36) NOT NULL REFERENCES cdr_money_runs(run_id),
 transfer_id VARCHAR2(64) NOT NULL,from_key VARCHAR2(64) NOT NULL,to_key VARCHAR2(64) NOT NULL,
 amount NUMBER(30,6) NOT NULL CHECK(amount>0),currency VARCHAR2(7) NOT NULL,event_day VARCHAR2(10) NOT NULL,
 CONSTRAINT cdr_money_from_fk FOREIGN KEY(run_id,from_key) REFERENCES cdr_money_accounts(run_id,account_key),
 CONSTRAINT cdr_money_to_fk FOREIGN KEY(run_id,to_key) REFERENCES cdr_money_accounts(run_id,account_key))`,
 `CREATE INDEX cdr_money_edge_run_ix ON cdr_money_transfers(run_id)`,
];
async function setup(c){
 for(const sql of tables)try{await c.execute(sql);}catch(e){if(e.errorNum!==955)throw e;}
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_money_runs_v AS SELECT r.* FROM cdr_money_runs r JOIN secure_cdr_batches_v b ON b.batch_id=r.batch_id`);
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_money_accounts_v AS SELECT a.* FROM cdr_money_accounts a JOIN secure_cdr_money_runs_v r ON r.run_id=a.run_id`);
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_money_transfers_v AS SELECT e.* FROM cdr_money_transfers e JOIN secure_cdr_money_runs_v r ON r.run_id=e.run_id
 JOIN secure_cdr_money_accounts_v a ON a.run_id=e.run_id AND a.account_key=e.from_key JOIN secure_cdr_money_accounts_v b ON b.run_id=e.run_id AND b.account_key=e.to_key`);
 // Views enforce batch visibility at every vertex and edge, not just endpoints.
 // Composite foreign keys prohibit edges crossing snapshot boundaries.
 await c.execute(`CREATE OR REPLACE PROPERTY GRAPH cdr_money_graph_v1
 VERTEX TABLES (secure_cdr_money_accounts_v KEY(account_key) LABEL money_account PROPERTIES(account_key,run_id,account_ref))
 EDGE TABLES (secure_cdr_money_transfers_v KEY(edge_key)
 SOURCE KEY(from_key) REFERENCES secure_cdr_money_accounts_v(account_key)
 DESTINATION KEY(to_key) REFERENCES secure_cdr_money_accounts_v(account_key)
 LABEL money_transfer PROPERTIES(edge_key,run_id,transfer_id,currency,event_day,amount)) OPTIONS (TRUSTED MODE)`);
 console.log('Money flows: three additive tables, scoped views and CDR_MONEY_GRAPH_V1 are ready.');
}
if(require.main===module)(async()=>{const w=process.env.ORACLE_WALLET_LOCATION;const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});try{await setup(c);}finally{await c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup};
