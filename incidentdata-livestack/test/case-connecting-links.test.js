const test=require('node:test'),assert=require('node:assert/strict');
const modulePromise=import('../frontend/src/case-connecting-links.mjs');
const node=id=>({id,type:'incident',label:id,detail:'Synthetic fixture'});
const edge=(source,target,score=.8)=>({source,target,score,type:'semantic similarity',reason:'Recorded fixture reason'});
test('groups strong incident comparisons and highlights crossing links without mutating data',async()=>{
 const {caseConnectingLinks}=await modulePromise;
 const network={nodes:['a','b','c','d','e'].map(node),edges:[edge('a','b'),edge('c','d'),edge('b','c',.7),edge('c','e',.6)]},before=JSON.stringify(network);
 const result=caseConnectingLinks(network);
 assert.deepEqual(result.groups,[['a','b'],['c','d'],['e']]);assert.equal(result.connections.length,2);assert.equal(result.network.edges.length,4);
 assert.equal(result.connections[0].reason,'Recorded fixture reason');assert.equal(result.connections[0].sourceGroup,1);assert.equal(result.connections[0].targetGroup,2);
 assert.equal(result.network.connectionFocus,true);assert.deepEqual(result.network.nodes.map(n=>n.connectionGroup),[1,1,2,2,3]);
 assert.equal(JSON.stringify(network),before);
});
test('case, people and evidence hubs do not collapse independent incident groups',async()=>{
 const {caseConnectingLinks}=await modulePromise;
 const network={nodes:[...['a','b'].map(node),{id:'case',type:'case'},{id:'person',type:'person'},{id:'evidence',type:'evidence'}],edges:[{source:'case',target:'a',type:'case involves'},{source:'case',target:'b',type:'case involves'},edge('person','a'),edge('a','evidence'),edge('a','b',.7)]};
 const result=caseConnectingLinks(network);assert.equal(result.groups.length,2);assert.equal(result.connections.length,1);assert.equal(result.network.nodes.length,2);assert.equal(result.omittedEdges,2);
});
test('redundant low-score edges inside a strong group are not connecting links; arrows are preserved',async()=>{
 const {caseConnectingLinks}=await modulePromise;
 const result=caseConnectingLinks({nodes:['a','b','c'].map(node),edges:[edge('b','a'),edge('c','b'),edge('a','c',.6),edge('a','a',.4)]});
 assert.equal(result.groups.length,1);assert.equal(result.connections.length,0);assert.equal(result.network.edges[0].source,'b');assert.equal(result.network.edges[0].target,'a');
});
test('reciprocal and parallel cross-group comparisons are retained, not mislabelled as sole bridges',async()=>{
 const {caseConnectingLinks}=await modulePromise;
 const result=caseConnectingLinks({nodes:['a','b'].map(node),edges:[edge('a','b',.6),edge('b','a',.6),edge('a','b',.6)]});
 assert.equal(result.connections.length,3);assert.equal(new Set(result.connections.map(e=>e.connectionId)).size,3);
});
test('threshold boundary, isolated nodes, invalid scores and bounded endpoints fail closed',async()=>{
 const {caseConnectingLinks}=await modulePromise;
 const result=caseConnectingLinks({nodes:['a','b','c','d'].map(node),edges:[edge('a','b',.75),edge('a','outside'),edge('b','c',null),edge('c','d','0.8'),edge('a','d',1.5)]});
 assert.deepEqual(result.groups,[['a','b'],['c'],['d']]);assert.equal(result.connections.length,0);assert.equal(result.unscoredEdges,3);assert.equal(result.omittedEdges,1);
 assert.equal(caseConnectingLinks({nodes:['a','b'].map(node),edges:[edge('a','b',.75)]},.76).connections.length,1);
 assert.equal(caseConnectingLinks(null).groups.length,0);
 for(const value of [NaN,-1,2,'0.75'])assert.throws(()=>caseConnectingLinks(null,value));
});
test('group membership is stable on reorder and is recomputed from the current scope only',async()=>{
 const {caseConnectingLinks}=await modulePromise;
 const network={nodes:['a','b','c','d'].map(node),edges:[edge('a','b'),edge('b','c'),edge('c','d',.6)]};
 assert.deepEqual(caseConnectingLinks(network).groups,caseConnectingLinks({nodes:[...network.nodes].reverse(),edges:[...network.edges].reverse()}).groups);
 assert.deepEqual(caseConnectingLinks({nodes:[node('c')],edges:network.edges}).groups,[['c']]);
 assert.equal(caseConnectingLinks({nodes:[node('c')],edges:network.edges}).network.nodes[0].connectionGroup,1);
});
