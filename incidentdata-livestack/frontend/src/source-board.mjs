export const BOARD_VERSION='source-board-v2';
export const emptyRelationship=()=>({from:'',to:'',label:'',basis:'',uncertainty:'',alternative:'',test:'',supportRefs:[],support:[],status:'proposed',reviewNote:'',origin:'analyst'});
export function normaliseEdges(edges=[]){return edges.map((e,i)=>({...emptyRelationship(),...e,id:e.id||`legacy-${i}-${e.from}-${e.to}`,status:e.status==='reviewed'?'reviewed':'proposed',supportRefs:[...new Set([e.from,e.to,...(e.supportRefs||[])])]}));}
export function sourceNodes(sources){return sources.map(s=>({id:s.ref,label:s.path,kind:'source',sourceRefs:[s.ref],itemId:s.itemId,descriptionRunId:s.descriptionRunId,status:'unreviewed'}));}
export function validateDraft(edge,nodes){
 const ids=new Set(nodes.map(n=>n.id));
 if(!ids.has(edge.from)||!ids.has(edge.to)||edge.from===edge.to)return 'Choose two different source files.';
 if(!edge.label.trim()||!edge.basis.trim()||!edge.uncertainty.trim())return 'Record a relationship label, its supporting basis and what remains uncertain.';
 if(edge.status==='reviewed'&&edge.reviewNote.trim().length<5)return 'Record a review note of at least five characters before marking a relationship reviewed.';
 return '';
}
