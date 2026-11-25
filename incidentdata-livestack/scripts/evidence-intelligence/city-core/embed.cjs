'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {sha,canonical,validate}=require('./contract.cjs');
const DIR=path.resolve(__dirname,'../../../testdata/evidence-intelligence/city-core-v1');
(async()=>{
 const pack=JSON.parse(fs.readFileSync(path.join(DIR,'pack.json')));validate(pack,p=>fs.readFileSync(path.join(DIR,p)));
 const {pipeline,env}=await import('@huggingface/transformers');
 env.cacheDir=process.env.TRANSFORMERS_CACHE||'/home/opc/.cache/policeAdelaide-transformers';env.allowRemoteModels=false;env.allowLocalModels=true;
 const textModel='Xenova/all-MiniLM-L6-v2',imageModel='Xenova/clip-vit-base-patch32';
 const text=await pipeline('feature-extraction',textModel,{dtype:'q8',session_options:{intraOpNumThreads:2,interOpNumThreads:1}});
 const existing=JSON.parse(fs.readFileSync(path.join(DIR,'../v1/embeddings.json'))).vectors.filter(v=>v.modality==='image'&&v.model===imageModel);
 const vectors=[];
 for(const city of pack.cities){
  for(const e of city.items){
   const v=await text(e.indexText,{pooling:'mean',normalize:true});const values=Array.from(v.data);
   assert.equal(values.length,384);assert(values.every(Number.isFinite));
   vectors.push({profileCode:city.profileCode,evidenceRef:e.evidenceRef,modality:'text',model:textModel,dimensions:384,sourceSha256:e.indexTextSha256,values});
   if(e.asset.mimeType==='image/png'){
    const image=existing.find(v=>v.sourceSha256===e.asset.sha256);assert(image,'No exact cached image embedding');
    vectors.push({...image,profileCode:city.profileCode,evidenceRef:e.evidenceRef});
   }
  }
  console.log(city.city+': 24 text + 4 image vectors ready');
 }
 fs.writeFileSync(path.join(DIR,'embeddings.json'),JSON.stringify({packSha256:sha(canonical(pack)),textModel,imageModel,vectors})+'\n');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
