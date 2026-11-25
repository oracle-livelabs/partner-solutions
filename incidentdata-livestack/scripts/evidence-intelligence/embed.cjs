'use strict';
// Offline local models only. Writes a fixture embedding artifact, never the DB.
const fs=require('node:fs'),path=require('node:path');
const {sha256,canonical}=require('./contract.cjs');
const ROOT=path.resolve(__dirname,'../../testdata/evidence-intelligence/v1');
async function main() {
  const pack=JSON.parse(fs.readFileSync(path.join(ROOT,'pack.json')));
  const expected=JSON.parse(fs.readFileSync(path.join(ROOT,'expected.json')));
  const {pipeline,env}=await import('@huggingface/transformers');
  env.cacheDir=process.env.TRANSFORMERS_CACHE||'/home/opc/.cache/policeAdelaide-transformers';
  env.allowRemoteModels=false;env.allowLocalModels=true;
  const options={dtype:'q8',session_options:{intraOpNumThreads:2,interOpNumThreads:1}};
  const textModel='Xenova/all-MiniLM-L6-v2',imageModel='Xenova/clip-vit-base-patch32';
  const text=await pipeline('feature-extraction',textModel,options);
  const image=await pipeline('image-feature-extraction',imageModel,options);
  const vectors=[];
  function add(e,modality,model,dimensions,values) {
    if(values.length!==dimensions)throw Error('Unexpected dimensions');
    const norm=Math.sqrt(values.reduce((s,v)=>s+v*v,0));
    vectors.push({evidenceRef:e.evidenceRef,modality,model,dimensions,dtype:'q8',
      sourceSha256:modality==='text'?e.indexTextSha256:e.asset.sha256,values:values.map(v=>v/norm)});
  }
  for(const e of pack.items) {
    const output=await text(e.indexText,{pooling:'mean',normalize:true});
    add(e,'text',textModel,384,Array.from(output.data));
    if(e.asset.mimeType==='image/png') {
      const output=await image(path.join(ROOT,e.asset.path));
      add(e,'image',imageModel,512,Array.from(output.data));
    }
  }
  const queries=[];
  for(const probe of expected.textProbes){const out=await text(probe.query,{pooling:'mean',normalize:true});queries.push({id:probe.id,query:probe.query,model:textModel,dimensions:384,values:Array.from(out.data)});}
  const runtimeVersion=JSON.parse(fs.readFileSync(path.resolve(path.dirname(require.resolve('@huggingface/transformers')),'../package.json'))).version;
  const result={packSha256:sha256(canonical(pack)),runtime:'@huggingface/transformers '+runtimeVersion,
    generatedAt:new Date().toISOString(),remoteModelsAllowed:false,rankingEngine:'offline cosine reference; Oracle ranking pending',vectors,queries};
  fs.writeFileSync(path.join(ROOT,'embeddings.json'),JSON.stringify(result)+'\n');
  await text.dispose();await image.dispose();
  console.log(JSON.stringify({textVectors:32,imageVectors:4,queryVectors:queries.length,remoteCalls:0}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
