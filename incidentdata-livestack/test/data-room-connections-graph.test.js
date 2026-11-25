const test=require('node:test'),assert=require('node:assert/strict');
const {reconcile,validateRunId,createConnectionsGraph}=require('../backend/data-room-connections-graph');
const snapshot={graph:{nodes:[{id:'a',label:'One',kind:'item'},{id:'b',label:'Two',kind:'reference'},{id:'isolated',label:'Isolated source',kind:'item'}],edges:[{source:'a',target:'b',kind:'literal_reference',label:'Reference',sourceRefs:['S01'],basis:'Exact original',quote:{quote:'DEMO-X'}},{source:'a',target:'b',kind:'description_similarity',label:'Similarity',sourceRefs:['S01'],basis:'Vector comparison',score:.5}]}};
const nodes=snapshot.graph.nodes.map(n=>({NODE_REF:n.id,NODE_LABEL:n.label,NODE_KIND:n.kind}));
const edges=snapshot.graph.edges.map((e,i)=>({EDGE_KEY:'run:'+i,EDGE_NO:i+1,SOURCE_REF:e.source,TARGET_REF:e.target,EDGE_KIND:e.kind,EDGE_LABEL:e.label,BASIS:e.basis,SCORE:e.score}));
test('native graph reconciliation preserves isolated nodes, parallel edges and supporting quotes',()=>{const g=reconcile(snapshot,nodes,edges);assert.equal(g.nodes.length,3);assert.equal(g.edges.length,2);assert.equal(g.edges[0].quote.quote,'DEMO-X');assert.notEqual(g.edges[0].id,g.edges[1].id);});
test('incomplete or changed graph results cannot masquerade as the source snapshot',()=>{
 for(const bad of [edges.slice(0,1),[edges[0],edges[0]],[edges[0],{...edges[1],SOURCE_REF:'other'}],[edges[0],{...edges[1],SCORE:.7}]])assert.throws(()=>reconcile(snapshot,nodes,bad),/match/);
 assert.throws(()=>reconcile(snapshot,nodes.slice(0,2),edges),/match/);assert.throws(()=>reconcile(snapshot,[nodes[0],nodes[0],nodes[2]],edges),/match/);
});
test('graph reads verify authorised batch and completed run before issuing native queries',async()=>{
 const calls=[];const graph=createConnectionsGraph(async(user,fn)=>{assert.equal(user,'northern_analyst');return fn({execute:async(sql,binds)=>{calls.push({sql,binds});return{rows:[]};}});});
 await assert.rejects(()=>graph.read('northern_analyst','hidden','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),e=>e.status===404);assert.equal(calls.length,1);assert.match(calls[0].sql,/secure_cdr_workspace_runs_v/);assert.match(calls[0].sql,/batch_id=:id AND run_id=:rid/);
 assert.throws(()=>validateRunId("x' OR 1=1"),e=>e.status===400);
});
test('Oracle visualizer conversion retains edge types and focus filters',async()=>{
 const {oracleConnectionsGraph}=await import('../frontend/src/oracle-connections-graph.mjs');const g=reconcile(snapshot,nodes,edges),all=oracleConnectionsGraph(g),literal=oracleConnectionsGraph(g,'literal_reference');
 assert.equal(all.data.vertices.length,3);assert.equal(all.data.edges.length,2);assert.equal(literal.data.vertices.length,2);assert.equal(literal.data.edges.length,1);assert.equal(all.edgeById.get('run:0').quote.quote,'DEMO-X');
 assert.equal(oracleConnectionsGraph(g,'all','isolated').data.vertices.length,1);
});
