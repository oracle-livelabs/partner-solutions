export const CONNECTION_LABELS={declared_cast:'Declared synthetic cast',literal_reference:'Literal source reference',description_similarity:'Description similarity',scene_similarity:'Whole-scene similarity'};
const nodeTypes={item:{label:'Source file',color:'#276899'},reference:{label:'Shared literal reference',color:'#8156a3'},declared_person:{label:'Declared fictional person',color:'#3d8062'}};
export function oracleConnectionsGraph(graph,kind='all',focus=''){
 if(!Array.isArray(graph?.nodes)||!Array.isArray(graph?.edges))throw Error('Oracle connection graph is unavailable.');
 const edges=graph.edges.filter(e=>(kind==='all'||e.kind===kind)&&(!focus||e.source===focus||e.target===focus)),connected=new Set(edges.flatMap(e=>[e.source,e.target]));
 const nodes=kind==='all'&&!focus?graph.nodes:graph.nodes.filter(n=>connected.has(n.id)||n.id===focus);
 const known=new Set(),nodeById=new Map(),edgeById=new Map();
 const vertices=nodes.map(n=>{const type=nodeTypes[n.kind];if(!type||!n.id||known.has(n.id))throw Error('Invalid or duplicate Oracle graph vertex.');known.add(n.id);nodeById.set(n.id,n);return{id:n.id,labels:[type.label],properties:{name:n.label,kind:type.label,source_ref:n.sourceRef||'',content_type:n.contentType||''},style:{color:type.color,size:n.kind==='item'?26:21,shape:n.kind==='reference'?'diamond':'circle'}};});
 const convertedEdges=edges.map(e=>{if(!e.id||edgeById.has(e.id)||!known.has(e.source)||!known.has(e.target)||!CONNECTION_LABELS[e.kind])throw Error('Invalid Oracle graph relationship.');edgeById.set(e.id,e);const similarity=e.kind.endsWith('similarity');return{id:e.id,source:e.source,target:e.target,labels:[CONNECTION_LABELS[e.kind]],properties:{relationship:CONNECTION_LABELS[e.kind],selection_id:e.id,basis:e.basis||'',...(Number.isFinite(e.score)?{cosine_similarity:e.score}:{})},style:{color:similarity?'#b57a32':e.kind==='declared_cast'?'#43815d':'#6799bf',width:2,...(similarity?{dasharray:'5 4'}:{})}};});
 return{data:{vertices,edges:convertedEdges,numResults:vertices.length,isLastResultSet:true},nodeById,edgeById};
}
