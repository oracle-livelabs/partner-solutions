'use strict';
const assert=require('node:assert/strict'),o=require('oracledb'),{randomUUID}=require('node:crypto');
const {createConnectionsGraph,NODE_SQL}=require(process.env.CDR_GRAPH_MODULE||'../backend/data-room-connections-graph');
(async()=>{
 if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected FU40.');
 const w=process.env.ORACLE_WALLET_LOCATION,c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
 const db=async(user,fn)=>{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});return fn(c);},api=createConnectionsGraph(db);
 try{
 const live=await api.read('statewide_admin','DR-20261018-6363d783-dacc-4f81','ba476f70-a634-466b-a7cd-97df1c59d355');assert.equal(live.graph.nodes.length,16);assert.equal(live.graph.edges.length,30);
 const graph={nodes:[{id:'a',label:'One',kind:'item'},{id:'b',label:'Two',kind:'item'},{id:'alone',label:'No edges',kind:'item'}],edges:[0,1].map(()=>({source:'a',target:'b',kind:'description_similarity',label:'Description similarity',basis:'Rollback-only fixture',score:.5,sourceRefs:['S01','S02']})),coverage:{items:3,originalTextTruncated:0}};
 const ids=[];
 for(const owner of ['northern_analyst','central_analyst']){
  const id='DR-GRAPH-TEST-'+randomUUID().slice(0,18),rid=randomUUID();ids.push({id,rid,owner});
  await c.execute("INSERT INTO cdr_batches(batch_id,filename,loaded_by,status,archive_bytes,headline) VALUES(:id,'rollback-only-graph.zip',:owner,'ready',1,'Uncommitted graph verification')",{id,owner});
  await c.execute("INSERT INTO cdr_workspace_runs(run_id,batch_id,requested_by,kind,status,fingerprint,version,result_json) VALUES(:rid,:id,:owner,'connections','complete',:fp,'cdr-connections-v1',:result)",{rid,id,owner,fp:'a'.repeat(64),result:{val:JSON.stringify({graph}),type:o.CLOB}});
 }
 const a=await api.read(ids[0].owner,ids[0].id,ids[0].rid);assert.equal(a.graph.nodes.length,3);assert.equal(a.graph.edges.length,2);assert.notEqual(a.graph.edges[0].id,a.graph.edges[1].id);
 await assert.rejects(()=>api.read(ids[0].owner,ids[1].id,ids[1].rid),e=>e.status===404);
 await assert.rejects(()=>api.read(ids[0].owner,ids[0].id,ids[1].rid),e=>e.status===404);
 const hidden=await c.execute(NODE_SQL,{rid:ids[1].rid});assert.equal(hidden.rows.length,0);
 const b=await api.read('statewide_admin',ids[1].id,ids[1].rid);assert.equal(b.graph.nodes.length,3);assert.notEqual(b.graph.edges[0].id,a.graph.edges[0].id);
 console.log(JSON.stringify({nativeGraph:live.graphName,liveVertices:16,liveEdges:30,scopeIsolation:true,runIsolation:true,parallelEdges:true,isolatedNodes:true,fixtureWrites:'rolled back',sourceDataChanged:false}));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
