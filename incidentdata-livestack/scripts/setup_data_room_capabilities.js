'use strict';
require('dotenv').config();
const o=require('oracledb');
async function setup(c){
 try{await c.execute(`CREATE TABLE cdr_cap_failures(batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id),capability VARCHAR2(20) NOT NULL CHECK(capability IN ('money','messages')),fingerprint VARCHAR2(64) NOT NULL,error_text VARCHAR2(8000 BYTE) NOT NULL,failed_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,CONSTRAINT cdr_cap_fail_pk PRIMARY KEY(batch_id,capability))`);}catch(e){if(e.errorNum!==955)throw e;}
 await c.execute('CREATE OR REPLACE VIEW secure_cdr_cap_failures_v AS SELECT f.* FROM cdr_cap_failures f JOIN secure_cdr_batches_v b ON b.batch_id=f.batch_id');
 console.log('Capability discovery: additive failure-status table and scoped view ready. No analysis or agent runs started.');
}
if(require.main===module)(async()=>{const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});try{await setup(c);}finally{await c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup};
