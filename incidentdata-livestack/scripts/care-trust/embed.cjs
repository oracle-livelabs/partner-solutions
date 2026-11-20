'use strict';
const fs=require('node:fs'),path=require('node:path');
const {DIR,OUT,read,save,canonical,sha256}=require('./common.cjs');
const {validate}=require('./validate.cjs');
const {cosine}=require('../evidence-intelligence/contract.cjs');
async function main(){const pack=read(DIR,'pack.json'),expected=read(DIR,'expected.json');validate(pack,read(DIR,'anchors.json'),p=>fs.readFileSync(path.join(DIR,p)));
  const {pipeline,env}=await import('@huggingface/transformers');env.cacheDir='/home/opc/.cache/policeAdelaide-transformers';env.allowRemoteModels=false;env.allowLocalModels=true;
  const model='Xenova/all-MiniLM-L6-v2',extractor=await pipeline('feature-extraction',model,{dtype:'q8',session_options:{intraOpNumThreads:2,interOpNumThreads:1}});
  const embed=async text=>Array.from((await extractor(text,{pooling:'mean',normalize:true})).data);
  try{const vectors=[],people=[],queries=[];
    for(const e of pack.items)vectors.push({evidenceRef:e.evidenceRef,model,dimensions:384,sourceSha256:e.indexTextSha256,values:await embed(e.indexText)});
    for(const p of pack.people)people.push({personRef:p.personRef,model,dimensions:384,sourceSha256:sha256(p.narrativeText),values:await embed(p.narrativeText)});
    for(const q of expected.textProbes)queries.push({...q,values:await embed(q.query)});
    save(DIR,'embeddings.json',{packSha256:sha256(canonical(pack)),model,remoteCalls:0,vectors,people,queries});
    const baseline=read(path.resolve(DIR,'../v1'),'embeddings.json').vectors.filter(v=>v.modality==='text');
    const probes=queries.map(q=>{const ranked=[...vectors,...baseline].map(v=>({ref:v.evidenceRef,score:cosine(q.values,v.values)})).sort((a,b)=>b.score-a.score);return {id:q.id,required:q.required,topK:q.topK,top:ranked.slice(0,q.topK),passed:q.required.every(r=>ranked.slice(0,q.topK).some(x=>x.ref===r))};});
    save(OUT,'offline-retrieval.json',{status:probes.every(p=>p.passed)?'passed':'failed',probes});console.log(JSON.stringify({textVectors:vectors.length,personVectors:people.length,queries:queries.length,probes}));
    if(probes.some(p=>!p.passed))process.exitCode=1;
  }finally{await extractor.dispose();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
