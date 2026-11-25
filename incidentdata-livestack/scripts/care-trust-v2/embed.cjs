'use strict';
const {DIR,read,save,canonical,sha256,validate}=require('./fixture.cjs');
(async()=>{const pack=read(DIR,'pack.json');validate(pack);
  const {pipeline,env}=await import('@huggingface/transformers');env.cacheDir='/home/opc/.cache/policeAdelaide-transformers';env.allowRemoteModels=false;
  const model='Xenova/all-MiniLM-L6-v2',extractor=await pipeline('feature-extraction',model,{dtype:'q8',session_options:{intraOpNumThreads:2,interOpNumThreads:1}});
  try{const vectors=[];for(const e of pack.items)vectors.push({evidenceRef:e.evidenceRef,sourceSha256:e.indexTextSha256,model,values:Array.from((await extractor(e.indexText,{pooling:'mean',normalize:true})).data)});
    save(DIR,'embeddings.json',{packSha256:sha256(canonical(pack)),model,vectors,remoteCalls:0});console.log('Six local 384-dimensional source embeddings created.');
  }finally{await extractor.dispose();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
