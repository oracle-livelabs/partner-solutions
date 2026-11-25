export const TYPE_COLORS={alias:'#277e78',username:'#3b76ab',email:'#8663a6',phone:'#ad7838'};
export function identifierState(row,at=new Date()){
 const time=+new Date(at),from=row.VALID_FROM?Date.parse(row.VALID_FROM):null,to=row.VALID_TO?Date.parse(row.VALID_TO):null;
 if(row.REVIEW_STATUS==='rejected')return 'Rejected';
 if(row.REVIEW_STATUS==='proposed')return 'Proposed';
 if(from!==null&&from>time)return 'Not yet valid';
 if(to!==null&&to<=time)return 'Expired';
 return ['declared','confirmed'].includes(row.REVIEW_STATUS)?'Current':'Unreviewed';
}
export function filterIdentifiers(rows,{query='',type='all',state='all'}={}){
 const q=query.trim().toLocaleLowerCase();
 return rows.filter(r=>(type==='all'||r.IDENTIFIER_TYPE===type)&&(state==='all'||identifierState(r)===state)&&(!q||[r.IDENTIFIER_VALUE,r.NAMESPACE,r.RECORDED_BY,r.REVIEWED_BY,r.SOURCE_REF].some(v=>String(v||'').toLocaleLowerCase().includes(q))));
}
export function identifierNetwork(person,rows,actors=true){
 const central={id:'person:'+person.PERSON_REF,label:person.DISPLAY_NAME||person.PERSON_REF,kind:'person'};
 const nodes=[central],edges=[],known=new Set([central.id]);
 for(const row of rows){
  const id='identifier:'+row.IDENTIFIER_ID;nodes.push({id,label:row.IDENTIFIER_VALUE,kind:row.IDENTIFIER_TYPE,row});
  edges.push({id:id+':person',source:central.id,target:id,kind:'association'});
  if(actors)for(const [field,kind]of [['RECORDED_BY','capture'],['REVIEWED_BY','review']]){
   const actor=row[field];if(!actor)continue;const actorId='actor:'+actor;
   if(!known.has(actorId)){known.add(actorId);nodes.push({id:actorId,label:actor,kind:'actor'});}
   edges.push({id:id+':'+kind,source:actorId,target:id,kind});
  }
 }
 return {nodes,edges};
}
export function timeDomain(rows){
 const values=rows.flatMap(r=>[r.CREATED_AT,r.REVIEWED_AT,r.VALID_FROM,r.VALID_TO]).filter(Boolean).map(Date.parse).filter(Number.isFinite);
 const fallback=Date.now();const first=values.length?Math.min(...values):fallback,last=values.length?Math.max(...values):fallback;
 const padding=Math.max(86400000*3,(last-first)*.04);
 return [new Date(first-padding),new Date(last+padding)];
}
