'use strict';
require('dotenv').config();
const o=require('oracledb');
const tables=[
 `CREATE TABLE cdr_photo_searches (search_id VARCHAR2(36) PRIMARY KEY,batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id),
 item_id VARCHAR2(32) NOT NULL REFERENCES cdr_items(item_id),requested_by VARCHAR2(80) NOT NULL,version VARCHAR2(40) NOT NULL,
 source_sha256 VARCHAR2(64) NOT NULL,catalogue_fingerprint VARCHAR2(64) NOT NULL,fingerprint VARCHAR2(64) NOT NULL,
 result_json CLOB NOT NULL CHECK(result_json IS JSON),crop_blob BLOB NOT NULL,created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
 CONSTRAINT cdr_photo_search_uq UNIQUE(batch_id,fingerprint))`,
 `CREATE TABLE cdr_photo_candidates (candidate_id VARCHAR2(36) PRIMARY KEY,search_id VARCHAR2(36) NOT NULL REFERENCES cdr_photo_searches(search_id),
 person_ref VARCHAR2(24) NOT NULL,candidate_rank NUMBER NOT NULL CHECK(candidate_rank BETWEEN 1 AND 3),
 score BINARY_DOUBLE NOT NULL,asset_ref VARCHAR2(80) NOT NULL,reference_sha256 VARCHAR2(64) NOT NULL,
 CONSTRAINT cdr_photo_candidate_uq UNIQUE(search_id,person_ref))`,
 `CREATE TABLE cdr_photo_reviews (review_id VARCHAR2(36) PRIMARY KEY,candidate_id VARCHAR2(36) NOT NULL REFERENCES cdr_photo_candidates(candidate_id),
 revision NUMBER NOT NULL,decision VARCHAR2(24) NOT NULL CHECK(decision IN ('pending','accepted_demo','rejected','uncertain')),
 reviewer VARCHAR2(80) NOT NULL,reason VARCHAR2(4000 BYTE) NOT NULL,created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
 CONSTRAINT cdr_photo_review_uq UNIQUE(candidate_id,revision))`,
 `CREATE INDEX cdr_photo_batch_ix ON cdr_photo_searches(batch_id,created_at)`,
];
async function setup(c){
 c.callTimeout=30000;
 await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');
 await c.execute('ALTER SESSION DISABLE PARALLEL DML');
 for(const sql of tables){console.log('Checking',sql.match(/CREATE (?:TABLE|INDEX) (\w+)/)[1]);try{await c.execute(sql);}catch(e){if(e.errorNum!==955)throw e;}}
 // Data Room history must not prevent existing city-profile restore workflows
 // from replacing the live POI register. Scope is enforced by the views below.
 const oldFk=await c.execute(`SELECT a.constraint_name FROM user_constraints a JOIN user_constraints b ON b.constraint_name=a.r_constraint_name
 WHERE a.table_name='CDR_PHOTO_CANDIDATES' AND a.constraint_type='R' AND b.table_name='PERSONS_OF_INTEREST'`,{}, {outFormat:o.OUT_FORMAT_OBJECT});
 if(oldFk.rows.length){
  console.log('Verifying exact empty initial-schema correction.');
  const check=await c.execute(`SELECT (SELECT COUNT(*) FROM cdr_photo_searches) searches,(SELECT COUNT(*) FROM cdr_photo_candidates) candidates,(SELECT COUNT(*) FROM cdr_photo_reviews) reviews FROM dual`,{}, {outFormat:o.OUT_FORMAT_OBJECT});
  const r=check.rows[0];
  r.CREATED=(await c.execute("SELECT TO_CHAR(created,'YYYY-MM-DD HH24:MI:SS') FROM user_objects WHERE object_name='CDR_PHOTO_CANDIDATES' AND object_type='TABLE'")).rows[0][0];
  if(!process.argv.includes('--correct-empty-initial-schema')||oldFk.rows.length!==1||oldFk.rows[0].CONSTRAINT_NAME!=='SYS_C0062481'||r.CREATED!=='2026-09-15 01:21:22'||r.SEARCHES||r.CANDIDATES||r.REVIEWS)throw Error('Initial-schema correction requires the exact, empty photo tables created by this implementation.');
  console.log('Exact name, creation time and empty counts verified; correcting SYS_C0062481.');
  await c.execute('ALTER TABLE cdr_photo_candidates DROP CONSTRAINT SYS_C0062481');
  console.log('Removed only the newly-created, empty-table POI foreign key; preserved search/review constraints.');
 }
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_photo_searches_v AS SELECT s.* FROM cdr_photo_searches s
 JOIN secure_cdr_batches_v b ON b.batch_id=s.batch_id JOIN secure_cdr_items_v i ON i.item_id=s.item_id AND i.batch_id=s.batch_id`);
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_photo_candidates_v AS SELECT a.*,s.batch_id,s.item_id,p.display_name,p.portrait_asset_uri,p.portrait_alt_text,
 r.review_id,NVL(r.revision,0) revision,NVL(r.decision,'pending') decision,r.reviewer,r.reason,r.created_at reviewed_at
 FROM cdr_photo_candidates a JOIN secure_cdr_photo_searches_v s ON s.search_id=a.search_id
 JOIN secure_persons_of_interest_v p ON p.person_ref=a.person_ref
 LEFT JOIN (SELECT v.*,ROW_NUMBER() OVER(PARTITION BY candidate_id ORDER BY revision DESC) latest FROM cdr_photo_reviews v) r ON r.candidate_id=a.candidate_id AND r.latest=1`);
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_photo_reviews_v AS SELECT r.* FROM cdr_photo_reviews r
 JOIN secure_cdr_photo_candidates_v a ON a.candidate_id=r.candidate_id`);
 // Keys include the batch for POIs, so topology cannot connect otherwise separate batch scopes.
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_photo_nodes_v AS
 SELECT DISTINCT CAST('photo:'||s.item_id AS VARCHAR2(160)) node_key,s.batch_id,CAST('photo' AS VARCHAR2(12)) node_kind,CAST(i.original_path AS VARCHAR2(2000)) node_label
 FROM secure_cdr_photo_searches_v s JOIN secure_cdr_items_v i ON i.item_id=s.item_id AND i.batch_id=s.batch_id
 UNION ALL SELECT CAST('region:'||s.search_id AS VARCHAR2(160)),s.batch_id,CAST('region' AS VARCHAR2(12)),CAST('Region '||SUBSTR(s.search_id,1,8) AS VARCHAR2(2000)) FROM secure_cdr_photo_searches_v s
 UNION ALL SELECT DISTINCT CAST('poi:'||a.batch_id||':'||a.person_ref AS VARCHAR2(160)),a.batch_id,CAST('poi' AS VARCHAR2(12)),CAST(a.display_name AS VARCHAR2(2000)) FROM secure_cdr_photo_candidates_v a`);
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_photo_edges_v AS
 SELECT CAST('source:'||s.search_id AS VARCHAR2(80)) edge_key,s.batch_id,s.search_id,CAST('photo:'||s.item_id AS VARCHAR2(160)) from_key,
 CAST('region:'||s.search_id AS VARCHAR2(160)) to_key,CAST('source_region' AS VARCHAR2(24)) edge_kind,CAST(NULL AS VARCHAR2(36)) candidate_id,CAST(NULL AS BINARY_DOUBLE) score,CAST('source' AS VARCHAR2(24)) decision
 FROM secure_cdr_photo_searches_v s
 UNION ALL SELECT CAST(a.candidate_id AS VARCHAR2(80)),a.batch_id,a.search_id,CAST('region:'||a.search_id AS VARCHAR2(160)),CAST('poi:'||a.batch_id||':'||a.person_ref AS VARCHAR2(160)),CAST('visual_candidate' AS VARCHAR2(24)),a.candidate_id,a.score,a.decision FROM secure_cdr_photo_candidates_v a`);
 await c.execute(`CREATE OR REPLACE PROPERTY GRAPH cdr_photo_graph_v1
 VERTEX TABLES (secure_cdr_photo_nodes_v KEY(node_key) LABEL photo_node PROPERTIES(node_key,batch_id,node_kind,node_label))
 EDGE TABLES (secure_cdr_photo_edges_v KEY(edge_key) SOURCE KEY(from_key) REFERENCES secure_cdr_photo_nodes_v(node_key)
 DESTINATION KEY(to_key) REFERENCES secure_cdr_photo_nodes_v(node_key)
 LABEL photo_link PROPERTIES(edge_key,batch_id,search_id,edge_kind,candidate_id,score,decision)) OPTIONS(TRUSTED MODE)`);
 console.log('People & Photos: three additive tables, scoped views and CDR_PHOTO_GRAPH_V1 ready. No POIs, source images or agents changed.');
}
if(require.main===module)(async()=>{
 if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected CRIME_DATA on FU40.');
 const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
 try{await setup(c);}finally{await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup};
