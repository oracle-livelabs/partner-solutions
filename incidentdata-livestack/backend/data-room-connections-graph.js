'use strict';
const o=require('oracledb');
const GRAPH='CDR_CONNECTIONS_GRAPH_V1';
const NODE_SQL=`SELECT * FROM GRAPH_TABLE(cdr_connections_graph_v1 MATCH (n IS connection_node)
 WHERE n.run_id=:rid COLUMNS(n.node_ref AS node_ref,n.node_label AS node_label,n.node_kind AS node_kind,
 n.content_type AS content_type,n.source_ref AS source_ref,n.source_sha256 AS source_sha256)) ORDER BY node_ref`;
const EDGE_SQL=`SELECT * FROM GRAPH_TABLE(cdr_connections_graph_v1 MATCH (a IS connection_node)-[e IS connection_link]->(b IS connection_node)
 WHERE a.run_id=:rid AND e.run_id=:rid AND b.run_id=:rid
 COLUMNS(e.edge_key AS edge_key,e.edge_no AS edge_no,a.node_ref AS source_ref,b.node_ref AS target_ref,
 e.edge_kind AS edge_kind,e.edge_label AS edge_label,e.score AS score,e.basis AS basis)) ORDER BY edge_no`;
const rows=async(c,sql,binds={},options={})=>(await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT,...options})).rows;
const fail=(status,message)=>Object.assign(Error(message),{status});
function validateRunId(value){if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))throw fail(400,'Choose a valid completed connection run.');return value;}
function reconcile(snapshot,nodes,edges){
 const g=snapshot?.graph;
 if(!Array.isArray(g?.nodes)||!Array.isArray(g?.edges)||g.nodes.length>1500||g.edges.length>3000)throw fail(409,'Saved connection graph is invalid or exceeds this view’s limits.');
 const byId=new Map(g.nodes.map(n=>[n.id,n]));
 if(byId.size!==g.nodes.length||nodes.length!==g.nodes.length||edges.length!==g.edges.length||new Set(nodes.map(n=>n.NODE_REF)).size!==nodes.length||new Set(edges.map(e=>e.EDGE_NO)).size!==edges.length)throw fail(409,'Oracle graph counts do not match the saved Stage 6 snapshot.');
 for(const n of nodes){const s=byId.get(n.NODE_REF);if(!s||s.label!==n.NODE_LABEL||s.kind!==n.NODE_KIND||(s.contentType||null)!==(n.CONTENT_TYPE||null)||(s.sourceRef||null)!==(n.SOURCE_REF||null)||(s.sha256||null)!==(n.SOURCE_SHA256||null))throw fail(409,'Oracle vertex properties do not match the saved snapshot.');}
 for(const e of edges){const s=g.edges[e.EDGE_NO-1];if(!s||s.source!==e.SOURCE_REF||s.target!==e.TARGET_REF||s.kind!==e.EDGE_KIND||s.label!==e.EDGE_LABEL||(s.score??null)!==(e.SCORE??null)||(s.basis||null)!==(e.BASIS||null))throw fail(409,'Oracle edge properties do not match the saved snapshot.');}
 return {...g,nodes:nodes.map(n=>({...byId.get(n.NODE_REF),id:n.NODE_REF,label:n.NODE_LABEL,kind:n.NODE_KIND})),edges:edges.map(e=>({...g.edges[e.EDGE_NO-1],id:e.EDGE_KEY,source:e.SOURCE_REF,target:e.TARGET_REF,kind:e.EDGE_KIND,label:e.EDGE_LABEL,...(e.SCORE==null?{}:{score:e.SCORE})}))};
}
function createConnectionsGraph(db){return {async read(user,batchId,runId){
 validateRunId(runId);
 return db(user,async c=>{
  const run=(await rows(c,`SELECT run_id,batch_id,fingerprint,created_at,finished_at,result_json FROM secure_cdr_workspace_runs_v WHERE batch_id=:id AND run_id=:rid AND kind='connections' AND status='complete'`,{id:batchId,rid:runId},{fetchInfo:{RESULT_JSON:{type:o.STRING}}}))[0];
  if(!run)throw fail(404,'Completed connection run not found in your authorised batch scope.');
  const snapshot=JSON.parse(run.RESULT_JSON),nodes=await rows(c,NODE_SQL,{rid:runId}),edges=await rows(c,EDGE_SQL,{rid:runId});
  return {runId,graphName:GRAPH,engine:'Oracle SQL Property Graph · GRAPH_TABLE',source:'CDR_WORKSPACE_RUNS.RESULT_JSON → $.graph',storage:'Two scoped JSON_TABLE views; no duplicate node or edge storage.',graph:reconcile(snapshot,nodes,edges),queries:{vertices:NODE_SQL,edges:EDGE_SQL},model:{vertexView:'SECURE_CDR_CONN_NODES_V',edgeView:'SECURE_CDR_CONN_EDGES_V',vertexKey:'node_key = run_id + node ID',edgeKey:'edge_key = run_id + edge ordinal',labels:['connection_node','connection_link']}};
 });
}};}
function registerConnectionsGraph(router,db,route){const graph=createConnectionsGraph(db);router.get('/batches/:id/connections/graph',route(async(req,res)=>{res.set('Cache-Control','no-store');res.json(await graph.read(req.demoUser,req.params.id,req.query.runId));}));return graph;}
module.exports={GRAPH,NODE_SQL,EDGE_SQL,validateRunId,reconcile,createConnectionsGraph,registerConnectionsGraph};
