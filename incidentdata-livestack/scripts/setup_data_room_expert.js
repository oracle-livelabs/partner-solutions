'use strict';
/* Private Section G Crime Expert Assistant objects. Additive and repeatable. */
require('dotenv').config();
const o=require('oracledb');
const PROFILE='CDR_CRIME_DETECTIVE_V1';
const tables=[
 `CREATE TABLE cdr_expert_theories (
   theory_id VARCHAR2(36) PRIMARY KEY,batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id),owner_name VARCHAR2(80) NOT NULL,
   title VARCHAR2(240 BYTE) NOT NULL,theory_text CLOB NOT NULL,evidence_json CLOB CHECK(evidence_json IS JSON),test_plan CLOB,counterevidence CLOB,
   status VARCHAR2(20) DEFAULT 'draft' NOT NULL CHECK(status IN ('draft','testing','supported','not_supported','uncertain')),
   decision_reason CLOB,created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL)`,
 `CREATE INDEX cdr_expert_theory_owner_ix ON cdr_expert_theories(batch_id,owner_name,updated_at DESC)`,
 `CREATE TABLE cdr_expert_notes (
   note_id VARCHAR2(36) PRIMARY KEY,batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id),owner_name VARCHAR2(80) NOT NULL,
   note_kind VARCHAR2(12) NOT NULL CHECK(note_kind IN ('narrative','learning')),body CLOB NOT NULL,updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
   CONSTRAINT cdr_expert_note_uq UNIQUE(batch_id,owner_name,note_kind))`,
 `CREATE TABLE cdr_expert_assistant_runs (
   run_id VARCHAR2(36) PRIMARY KEY,batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id),owner_name VARCHAR2(80) NOT NULL,
   theory_id VARCHAR2(36) REFERENCES cdr_expert_theories(theory_id),question CLOB NOT NULL,answer CLOB,status VARCHAR2(12) NOT NULL CHECK(status IN ('complete','failed')),
   source_fingerprint VARCHAR2(64) NOT NULL,native_conversation_id VARCHAR2(200),error_text VARCHAR2(1000 BYTE),created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL)`
 ,`CREATE TABLE cdr_expert_boards (
   board_id VARCHAR2(36) PRIMARY KEY,batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id),owner_name VARCHAR2(80) NOT NULL,
   summary_brief CLOB NOT NULL,detailed_brief CLOB NOT NULL,nodes_json CLOB NOT NULL CHECK(nodes_json IS JSON),edges_json CLOB NOT NULL CHECK(edges_json IS JSON),
   review_status VARCHAR2(20) DEFAULT 'draft' NOT NULL CHECK(review_status IN ('draft','testing','reviewed','archived')),source_fingerprint VARCHAR2(64) NOT NULL,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
   CONSTRAINT cdr_expert_board_uq UNIQUE(batch_id,owner_name))`
];
async function setup(c){
 for(const sql of tables)try{await c.execute(sql);}catch(e){if(e.errorNum!==955)throw e;}
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_expert_theories_v AS SELECT t.* FROM cdr_expert_theories t JOIN secure_cdr_batches_v b ON b.batch_id=t.batch_id WHERE t.owner_name=SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')`);
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_expert_notes_v AS SELECT n.* FROM cdr_expert_notes n JOIN secure_cdr_batches_v b ON b.batch_id=n.batch_id WHERE n.owner_name=SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')`);
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_expert_assistant_runs_v AS SELECT r.* FROM cdr_expert_assistant_runs r JOIN secure_cdr_batches_v b ON b.batch_id=r.batch_id WHERE r.owner_name=SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')`);
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_expert_boards_v AS SELECT d.* FROM cdr_expert_boards d JOIN secure_cdr_batches_v b ON b.batch_id=d.batch_id WHERE d.owner_name=SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')`);
 const existing=(await c.execute('SELECT profile_name FROM user_cloud_ai_profiles WHERE profile_name=:profile',{profile:PROFILE})).rows;
 if(!existing.length){
  const attributes=(await c.execute(`SELECT attribute_name,attribute_value FROM user_cloud_ai_profile_attributes WHERE profile_name='CRIMEDATA_SELECT_AI_V2'`,[],{outFormat:o.OUT_FORMAT_OBJECT,fetchInfo:{ATTRIBUTE_VALUE:{type:o.STRING}}})).rows,base={};
  for(const row of attributes)if(['provider','credential_name','oci_compartment_id','oci_region','oci_apiformat'].includes(row.ATTRIBUTE_NAME.toLowerCase()))base[row.ATTRIBUTE_NAME.toLowerCase()]=row.ATTRIBUTE_VALUE;
  if(!base.provider||!base.credential_name)throw Error('The existing IncidentData Select AI provider is not configured.');
  const role='You are a cautious crime detective expert reviewing synthetic training evidence. Produce clearly source-cited, editable first-cut hypotheses only; distinguish observations, uncertainty, counterevidence and tests. Never identify a suspect, infer guilt, predict crime or recommend operational action.';
  await c.execute('BEGIN DBMS_CLOUD_AI.CREATE_PROFILE(:name,:attrs); END;',{name:PROFILE,attrs:JSON.stringify({...base,model:'google.gemini-2.5-flash',temperature:0,max_tokens:2500,conversation:false,role,additional_instructions:role})});
 }
 console.log('Crime Expert Assistant: private theories, notes and assistant-run tables are ready.');
}
if(require.main===module)(async()=>{const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});try{await setup(c);await c.commit();}finally{await c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup};
