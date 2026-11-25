'use strict';
const {hash}=require('./data-room-archive');
const fs=require('node:fs/promises');
const path=require('node:path');

const VERSION='cdr-connections-v1';
// Only the packaged, explicitly fictional scene assets have declared cast.
// File names supplied by an upload never establish a cast association.
const CAST=[
  ['eve-philip-gallery.png',[['POI-NBNW-EVE','Eve Kendall'],['POI-NBNW-PHILIP','Philip Vandamm']]],
  ['george-eve-coffee.png',[['POI-NBNW-GEORGE','George Kaplan'],['POI-NBNW-EVE','Eve Kendall']]],
];
async function declaredCast(){
  const out=new Map();
  for(const [file,people] of CAST){
    for(const root of ['dist','public']){
      try{out.set(hash(await fs.readFile(path.join(__dirname,'../frontend',root,'poi/nbynw/case-images',file))),people);break;}
      catch(e){if(e.code!=='ENOENT')throw e;}
    }
  }
  return out;
}
function buildGraph(items,cast=new Map(),similarities=[]){
  const nodes=items.map(i=>({id:i.itemId,label:i.path,kind:'item',contentType:i.type,sourceRef:i.ref,sha256:i.sourceSha256}));
  const edges=[],refs=new Map(),timeline=[];
  for(const i of items){
    // Literal references from original bounded text, with exact UTF-16 offsets.
    // This deliberately avoids treating arbitrary names as verified identities.
    for(const m of (i.originalText||'').matchAll(/\b(?:DEMO-[A-Z0-9]+(?:-[A-Z0-9]+)*|\d{4}-\d{2}-\d{2})\b/g)){
      const key=m[0],entry=refs.get(key)||new Map();
      if(!entry.has(i.itemId))entry.set(i.itemId,{itemId:i.itemId,sourceRef:i.ref,quote:key,start:m.index,end:m.index+key.length,...(i.textBasis==='machine_transcript'?{textBasis:'unreviewed_machine_transcript',transcriptSha256:i.transcription?.sha256}:{})});
      refs.set(key,entry);
    }
    for(const [personRef,name] of cast.get(i.sourceSha256)||[]){
      if(!nodes.some(n=>n.id===personRef))nodes.push({id:personRef,label:name,kind:'declared_person'});
      edges.push({source:personRef,target:i.itemId,kind:'declared_cast',label:'Declared synthetic cast',sourceRefs:[i.ref],basis:'Exact SHA-256 match to the packaged staged scene and its declared cast. No face matching.'});
    }
  }
  for(const [value,occurrences] of [...refs].sort(([a],[b])=>a.localeCompare(b))){
    if(/^\d{4}-/.test(value))timeline.push({date:value,occurrences:[...occurrences.values()]});
    if(occurrences.size<2)continue;
    const id='ref-'+hash(Buffer.from(value)).slice(0,20);
    nodes.push({id,label:value,kind:'reference'});
    for(const occurrence of occurrences.values())edges.push({source:occurrence.itemId,target:id,kind:'literal_reference',label:'Contains the same literal reference',sourceRefs:[occurrence.sourceRef],basis:occurrence.textBasis==='unreviewed_machine_transcript'?'Exact machine-transcript occurrence; check against the original audio. A shared reference does not establish an incident relationship.':'Exact source-text occurrence; a shared reference does not establish an incident relationship.',quote:occurrence});
  }
  const allowed=new Map(items.map(i=>[i.itemId,i.ref]));
  for(const s of similarities){
    if(!allowed.has(s.source)||!allowed.has(s.target)||s.source===s.target||!Number.isFinite(s.score)||s.score<0||s.score>1)throw Error('Invalid vector comparison.');
    edges.push({...s,kind:s.modality==='image'?'scene_similarity':'description_similarity',label:s.modality==='image'?'Whole-scene similarity':'Description similarity',sourceRefs:[allowed.get(s.source),allowed.get(s.target)],basis:'Cosine similarity from stored vectors; comparison candidate only.'});
  }
  if(nodes.length>1500||edges.length>3000)throw Error('Connection graph exceeds this demonstration limit. Use a smaller batch.');
  return {version:VERSION,nodes,edges,timeline:timeline.sort((a,b)=>a.date.localeCompare(b.date)),coverage:{items:items.length,textCharactersPerItem:24000,originalTextTruncated:items.filter(i=>i.originalTruncated).length},notice:'Draft connections for review. Literal references, declared synthetic cast and vector similarity are different kinds of support.'};
}
function csv(rows){
  // Spreadsheet formula neutralisation is part of the export boundary.
  return rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n')+'\r\n';
}
module.exports={VERSION,declaredCast,buildGraph,csv};
