'use strict';
require('dotenv').config();
const o=require('oracledb');
const tables=[
 `CREATE TABLE cdr_msg_runs (run_id VARCHAR2(36) PRIMARY KEY,batch_id VARCHAR2(48) NOT NULL REFERENCES cdr_batches(batch_id),
 requested_by VARCHAR2(80) NOT NULL,version VARCHAR2(40) NOT NULL,fingerprint VARCHAR2(64) NOT NULL,
 created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,result_json CLOB NOT NULL CHECK(result_json IS JSON),
 CONSTRAINT cdr_msg_snapshot_uq UNIQUE(batch_id,version,fingerprint))`,
 `CREATE TABLE cdr_msg_nodes (node_key VARCHAR2(64) PRIMARY KEY,run_id VARCHAR2(36) NOT NULL REFERENCES cdr_msg_runs(run_id),
 node_ref VARCHAR2(64) NOT NULL,node_kind VARCHAR2(12) NOT NULL CHECK(node_kind IN ('participant','thread')),node_label VARCHAR2(1000 BYTE) NOT NULL,
 CONSTRAINT cdr_msg_node_run_uq UNIQUE(run_id,node_key))`,
 `CREATE TABLE cdr_msg_records (message_key VARCHAR2(64) PRIMARY KEY,run_id VARCHAR2(36) NOT NULL REFERENCES cdr_msg_runs(run_id),
 message_ref VARCHAR2(64) NOT NULL,thread_key VARCHAR2(64) NOT NULL,sender_key VARCHAR2(64) NOT NULL,source_item_id VARCHAR2(32) NOT NULL REFERENCES cdr_items(item_id),
 source_sequence NUMBER NOT NULL,sent_utc VARCHAR2(30),body CLOB NOT NULL,message_json CLOB NOT NULL CHECK(message_json IS JSON),
 CONSTRAINT cdr_msg_record_run_uq UNIQUE(run_id,message_key),
 CONSTRAINT cdr_msg_thread_fk FOREIGN KEY(run_id,thread_key) REFERENCES cdr_msg_nodes(run_id,node_key),
 CONSTRAINT cdr_msg_sender_fk FOREIGN KEY(run_id,sender_key) REFERENCES cdr_msg_nodes(run_id,node_key))`,
 `CREATE TABLE cdr_msg_links (edge_key VARCHAR2(64) PRIMARY KEY,run_id VARCHAR2(36) NOT NULL REFERENCES cdr_msg_runs(run_id),
 edge_ref VARCHAR2(64) NOT NULL,from_key VARCHAR2(64) NOT NULL,to_key VARCHAR2(64) NOT NULL,
 edge_kind VARCHAR2(20) NOT NULL CHECK(edge_kind IN ('participation','direct_message')),message_key VARCHAR2(64),message_count NUMBER NOT NULL,
 CONSTRAINT cdr_msg_from_fk FOREIGN KEY(run_id,from_key) REFERENCES cdr_msg_nodes(run_id,node_key),
 CONSTRAINT cdr_msg_to_fk FOREIGN KEY(run_id,to_key) REFERENCES cdr_msg_nodes(run_id,node_key),
 CONSTRAINT cdr_msg_evidence_fk FOREIGN KEY(run_id,message_key) REFERENCES cdr_msg_records(run_id,message_key))`,
 `CREATE INDEX cdr_msg_record_thread_ix ON cdr_msg_records(run_id,thread_key,source_sequence)`,
 `CREATE INDEX cdr_msg_link_run_ix ON cdr_msg_links(run_id)`,
];
async function setup(c){
 for(const sql of tables)try{await c.execute(sql);}catch(e){if(e.errorNum!==955)throw e;}
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_msg_runs_v AS SELECT r.* FROM cdr_msg_runs r JOIN secure_cdr_batches_v b ON b.batch_id=r.batch_id`);
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_msg_nodes_v AS SELECT n.* FROM cdr_msg_nodes n JOIN secure_cdr_msg_runs_v r ON r.run_id=n.run_id`);
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_msg_records_v AS SELECT m.* FROM cdr_msg_records m JOIN secure_cdr_msg_runs_v r ON r.run_id=m.run_id
 JOIN secure_cdr_msg_nodes_v t ON t.run_id=m.run_id AND t.node_key=m.thread_key AND t.node_kind='thread'
 JOIN secure_cdr_msg_nodes_v p ON p.run_id=m.run_id AND p.node_key=m.sender_key AND p.node_kind='participant'
 JOIN secure_cdr_items_v i ON i.item_id=m.source_item_id AND i.batch_id=r.batch_id`);
 await c.execute(`CREATE OR REPLACE VIEW secure_cdr_msg_links_v AS SELECT e.* FROM cdr_msg_links e JOIN secure_cdr_msg_runs_v r ON r.run_id=e.run_id
 JOIN secure_cdr_msg_nodes_v a ON a.run_id=e.run_id AND a.node_key=e.from_key JOIN secure_cdr_msg_nodes_v b ON b.run_id=e.run_id AND b.node_key=e.to_key
 WHERE e.message_key IS NULL OR EXISTS(SELECT 1 FROM secure_cdr_msg_records_v m WHERE m.run_id=e.run_id AND m.message_key=e.message_key)`);
 await c.execute(`CREATE OR REPLACE PROPERTY GRAPH cdr_msg_graph_v1
 VERTEX TABLES (secure_cdr_msg_nodes_v KEY(node_key) LABEL conversation_node PROPERTIES(node_key,run_id,node_ref,node_kind,node_label))
 EDGE TABLES (secure_cdr_msg_links_v KEY(edge_key)
 SOURCE KEY(from_key) REFERENCES secure_cdr_msg_nodes_v(node_key)
 DESTINATION KEY(to_key) REFERENCES secure_cdr_msg_nodes_v(node_key)
 LABEL conversation_link PROPERTIES(edge_key,run_id,edge_ref,edge_kind,message_count)) OPTIONS(TRUSTED MODE)`);
 console.log('Messages: four additive tables, scoped views and CDR_MSG_GRAPH_V1 are ready. No agent or money-flow objects changed.');
}
if(require.main===module)(async()=>{const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});try{await setup(c);}finally{await c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup};
