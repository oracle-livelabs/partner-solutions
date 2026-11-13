const test=require('node:test'),assert=require('node:assert/strict');
const adapter=import('../frontend/src/oracle-case-graph.mjs');
const nodes=[{id:'case-1',type:'case',label:'Case 1',detail:'Synthetic case'},{id:'person-1',type:'person',label:'Example Person',detail:'Recorded link',PORTRAIT_ASSET_URI:'/poi/example/person.png'}];
test('Oracle graph preserves authorised nodes and recorded relationships without mutating input',async()=>{
 const {oracleCaseGraph}=await adapter,network={nodes,edges:[{source:'case-1',target:'person-1',type:'linked to'}]},before=JSON.stringify(network),{data}=oracleCaseGraph(network);
 assert.equal(JSON.stringify(network),before);assert.equal(data.vertices.length,2);assert.equal(data.edges.length,1);assert.deepEqual(data.vertices.map(v=>v.id),nodes.map(n=>n.id));
 assert.equal(data.vertices[1].style.image.url,'/poi/example/person.png');assert.equal(data.edges[0].properties.relationship,'linked to');assert.equal(data.isLastResultSet,true);
});
test('edge identifiers survive reorder and preserve parallel, duplicate and reciprocal relationships',async()=>{
 const {oracleCaseGraph}=await adapter,e={source:'case-1',target:'person-1',type:'linked to'},edges=[e,{...e},{...e,type:'mentions'},{...e,source:e.target,target:e.source}];
 const a=oracleCaseGraph({nodes,edges}).data.edges,b=oracleCaseGraph({nodes,edges:[...edges].reverse()}).data.edges;
 assert.deepEqual(a,b);assert.equal(new Set(a.map(e=>e.id)).size,4);
});
test('dangling relationships are counted and excluded without inventing nodes',async()=>{
 const {oracleCaseGraph}=await adapter,r=oracleCaseGraph({nodes,edges:[{source:'case-1',target:'missing',type:'linked'}]});
 assert.equal(r.omittedEdges,1);assert.equal(r.data.edges.length,0);assert.equal(r.data.vertices.length,2);
});
test('portraits accept only local POI raster assets; labels remain literal data',async()=>{
 const {oracleCaseGraph}=await adapter;
 for(const uri of ['https://example.test/p.png','//example.test/p.png','/poi/../p.png','/poi/%2e%2e/p.png','/poi/p.svg','data:image/png;base64,a','/poi/p.png?q=a']){
  const v=oracleCaseGraph({nodes:[{...nodes[1],PORTRAIT_ASSET_URI:uri,label:'<img onerror=alert(1)>'}],edges:[]}).data.vertices[0];assert.equal(v.style.image,undefined);assert.equal(v.properties.name,'<img onerror=alert(1)>');
 }
});
test('invalid networks fail closed and similarity retains its recorded meaning',async()=>{
 const {oracleCaseGraph}=await adapter;
 for(const input of [null,{}, {nodes:[nodes[0],nodes[0]],edges:[]},{nodes:[{...nodes[0],type:'unknown'}],edges:[]}])assert.throws(()=>oracleCaseGraph(input));
 const e=oracleCaseGraph({nodes,edges:[{source:'case-1',target:'person-1',type:'semantic similarity',score:.62,reason:'Recorded comparison'}]}).data.edges[0];
 assert.equal(e.properties.similarity_score,.62);assert.equal(e.properties.reason,'Recorded comparison');assert.equal(e.style.dasharray,'5 4');
});
test('connecting comparisons carry explicit visual styles and a selection key without executable reasons',async()=>{
 const {oracleCaseGraph}=await adapter;
 const reason='${globalThis.injected=1}<img src=x onerror=alert(1)>';
 const base={source:'case-1',target:'person-1',type:'semantic similarity',score:.7,reason};
 const original=oracleCaseGraph({nodes,edges:[base]}).data.edges[0];
 const focused=oracleCaseGraph({nodes,edges:[{...base,connectionMode:true,connectionHighlight:true,connectionId:'comparison-1'}]}).data.edges[0];
 assert.equal(original.id,focused.id);assert.equal(focused.properties.connection_id,'comparison-1');assert.equal(focused.properties.reason,reason);assert.equal(focused.style.width,5);assert.equal(focused.style.color,'#b7501f');assert.equal(focused.style.dasharray,undefined);assert.deepEqual(focused.labels,['Connecting comparison']);
});
test('cluster metadata comes from numeric incident groups in a focused network only',async()=>{
 const {oracleCaseGraph}=await adapter,{caseConnectingLinks}=await import('../frontend/src/case-connecting-links.mjs');
 const network={nodes:['a','b','c'].map(id=>({id,type:'incident',label:id})),edges:[{source:'a',target:'b',type:'semantic similarity',score:.8},{source:'b',target:'c',type:'semantic similarity',score:.6}]};
 const focused=caseConnectingLinks(network).network,before=JSON.stringify(focused),converted=oracleCaseGraph(focused);
 assert.equal(converted.canCluster,true);assert.equal(converted.groupCount,2);assert.deepEqual(converted.data.vertices.map(v=>v.properties.comparison_group),['Group 1','Group 1','Group 2']);assert.equal(JSON.stringify(focused),before);
 assert.equal(oracleCaseGraph({...focused,connectionFocus:false}).canCluster,false);assert(oracleCaseGraph({...focused,connectionFocus:false}).data.vertices.every(v=>!v.properties.comparison_group));
 for(const value of [null,0,-1,1.1,4,'__proto__','${alert(1)}','1']){
  const invalid=oracleCaseGraph({...focused,nodes:focused.nodes.map(n=>({...n,connectionGroup:value}))});assert.equal(invalid.canCluster,false);assert(invalid.data.vertices.every(v=>!v.properties.comparison_group));
 }
 assert.equal(oracleCaseGraph({nodes:[],edges:[],connectionFocus:true}).canCluster,false);
 assert.equal(oracleCaseGraph({...focused,edges:[]}).canCluster,false);
});
test('layout choices keep the default and safely leave clustering outside the focus layer',async()=>{
 const {oracleLayoutChoice}=await adapter;
 for(const layout of ['hierarchical','force','radial'])assert.equal(oracleLayoutChoice(layout,false),layout);
 assert.equal(oracleLayoutChoice('clustered',true),'clustered');assert.equal(oracleLayoutChoice('clustered',false),'force');
 for(const value of [undefined,'geographical','__proto__','${alert(1)}'])assert.equal(oracleLayoutChoice(value,true),'hierarchical');
});
