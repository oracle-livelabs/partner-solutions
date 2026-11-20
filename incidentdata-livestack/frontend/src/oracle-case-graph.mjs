// Convert authorised API results only. No querying, identity matching or inference.
export const ORACLE_GRAPH_VERSION='26.4.0';
export const GRAPH_TYPES={case:{label:'Case file',color:'#3d667d',shape:'roundedRectangle'},incident:{label:'Incident',color:'#b47735',shape:'circle'},person:{label:'Person of interest',color:'#567a67',shape:'circle'},evidence:{label:'Evidence',color:'#79648e',shape:'diamond'}};
const text=value=>typeof value==='string'?value:typeof value==='number'&&Number.isFinite(value)?String(value):'';
const safePortrait=value=>typeof value==='string'&&/^\/poi\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(png|jpe?g|webp)$/i.test(value)?value:null;
const digest=value=>{let h=14695981039346656037n;for(const char of value)h=BigInt.asUintN(64,(h^BigInt(char.codePointAt(0)))*1099511628211n);return h.toString(16);};
export function oracleLayoutChoice(requested,canCluster){
 if(requested==='clustered')return canCluster?'clustered':'force';
 return ['hierarchical','force','radial'].includes(requested)?requested:'hierarchical';
}
export function oracleCaseGraph(network){
 if(!Array.isArray(network?.nodes)||!Array.isArray(network?.edges))throw Error('The case network is not available.');
 const ids=new Set(),vertices=network.nodes.map(n=>{
  if(!text(n.id)||ids.has(text(n.id))||!Object.hasOwn(GRAPH_TYPES,n.type))throw Error('The case network contains an invalid or duplicate node.');
  const id=text(n.id);ids.add(id);const type=GRAPH_TYPES[n.type],portrait=n.type==='person'?safePortrait(n.PORTRAIT_ASSET_URI):null;
  const group=network.connectionFocus===true&&n.type==='incident'&&Number.isSafeInteger(n.connectionGroup)&&n.connectionGroup>0&&n.connectionGroup<=network.nodes.length?`Group ${n.connectionGroup}`:null;
  return {id,labels:[type.label],properties:{name:text(n.label)||id,kind:type.label,detail:text(n.detail),...(group?{comparison_group:group}:{}),...(n.address?{address:text(n.address)}:{}),...(portrait?{portrait}:{})},style:{color:type.color,shape:type.shape,size:n.type==='case'?32:24,...(portrait?{image:{url:portrait,scale:1}}:{})}};
 });
 let omittedEdges=0;const seen=new Map(),keys=new Map();
 const records=network.edges.flatMap(e=>{const source=text(e.source),target=text(e.target);if(!ids.has(source)||!ids.has(target)){omittedEdges++;return [];}
  const label=text(e.type)||'Recorded relationship',key=JSON.stringify([source,target,label,e.score??null,text(e.reason)]);return [{source,target,label,key,original:e}];
 }).sort((a,b)=>a.key.localeCompare(b.key));
 const edges=records.map(e=>{const count=seen.get(e.key)||0;seen.set(e.key,count+1);const id=`relationship-${digest(e.key)}-${count}`;
  if(keys.has(id)&&keys.get(id)!==e.key)throw Error('Relationship identifiers could not be reconciled.');keys.set(id,e.key);
  const similarity=e.original.type==='semantic similarity';
  const connecting=e.original.connectionHighlight===true,focused=e.original.connectionMode===true;
  const label=focused?(connecting?'Connecting comparison':'Context comparison'):e.label;
  return {id,source:e.source,target:e.target,labels:[label],properties:{relationship:label,...(connecting?{connection_id:text(e.original.connectionId)}:{}),...(Number.isFinite(e.original.score)?{similarity_score:e.original.score}:{}),...(e.original.reason?{reason:text(e.original.reason)}:{})},style:{color:connecting?'#b7501f':focused?'#82939b':similarity?'#92773d':'#6a8797',width:connecting?5:similarity?1.5:2,...(similarity&&!connecting?{dasharray:'5 4'}:{})}};
 });
 // Oracle's native clustered force layout needs at least one recorded edge.
 const canCluster=network.connectionFocus===true&&vertices.length>0&&edges.length>0&&vertices.every(v=>v.properties.comparison_group);
 return {data:{vertices,edges,numResults:vertices.length,isLastResultSet:true},omittedEdges,canCluster,groupCount:canCluster?new Set(vertices.map(v=>v.properties.comparison_group)).size:0};
}
