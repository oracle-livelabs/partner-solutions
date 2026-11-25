'use strict';
require('dotenv').config();
const o=require('oracledb');
const statements=[
`CREATE OR REPLACE VIEW secure_cdr_conn_nodes_v AS
 SELECT r.run_id,r.batch_id,r.run_id||':'||j.node_ref node_key,j.node_ref,j.node_label,j.node_kind,j.content_type,j.source_ref,j.source_sha256
 FROM secure_cdr_workspace_runs_v r,
 JSON_TABLE(r.result_json,'$.graph.nodes[*]' COLUMNS(
 node_ref VARCHAR2(256) PATH '$.id' ERROR ON ERROR,
 node_label VARCHAR2(2000) PATH '$.label' ERROR ON ERROR,
 node_kind VARCHAR2(40) PATH '$.kind' ERROR ON ERROR,
 content_type VARCHAR2(40) PATH '$.contentType',source_ref VARCHAR2(40) PATH '$.sourceRef',source_sha256 VARCHAR2(64) PATH '$.sha256')) j
 WHERE r.kind='connections' AND r.status='complete'`,
`CREATE OR REPLACE VIEW secure_cdr_conn_edges_v AS
 SELECT r.run_id,r.batch_id,r.run_id||':edge:'||TO_CHAR(j.edge_no,'FM9999990') edge_key,j.edge_no,
 r.run_id||':'||j.source_ref from_key,r.run_id||':'||j.target_ref to_key,j.source_ref,j.target_ref,j.edge_kind,j.edge_label,j.score,j.basis
 FROM secure_cdr_workspace_runs_v r,
 JSON_TABLE(r.result_json,'$.graph.edges[*]' COLUMNS(
 edge_no FOR ORDINALITY,source_ref VARCHAR2(256) PATH '$.source' ERROR ON ERROR,target_ref VARCHAR2(256) PATH '$.target' ERROR ON ERROR,
 edge_kind VARCHAR2(40) PATH '$.kind' ERROR ON ERROR,edge_label VARCHAR2(240) PATH '$.label' ERROR ON ERROR,
 score NUMBER PATH '$.score',basis VARCHAR2(4000) PATH '$.basis' ERROR ON ERROR)) j
 WHERE r.kind='connections' AND r.status='complete'`,
`CREATE OR REPLACE PROPERTY GRAPH cdr_connections_graph_v1
 VERTEX TABLES (secure_cdr_conn_nodes_v KEY(node_key) LABEL connection_node
 PROPERTIES(node_key,run_id,batch_id,node_ref,node_label,node_kind,content_type,source_ref,source_sha256))
 EDGE TABLES (secure_cdr_conn_edges_v KEY(edge_key)
 SOURCE KEY(from_key) REFERENCES secure_cdr_conn_nodes_v(node_key)
 DESTINATION KEY(to_key) REFERENCES secure_cdr_conn_nodes_v(node_key)
 LABEL connection_link PROPERTIES(edge_key,run_id,batch_id,edge_no,edge_kind,edge_label,score,basis)) OPTIONS(TRUSTED MODE)`
];
async function setup(c){for(const sql of statements)await c.execute(sql);console.log('CDR_CONNECTIONS_GRAPH_V1 ready: two scoped JSON_TABLE views over completed Stage 6 snapshots. No source rows changed.');}
if(require.main===module)(async()=>{if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected FU40 IncidentData application schema.');const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});try{await setup(c);}finally{await c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup,statements};
