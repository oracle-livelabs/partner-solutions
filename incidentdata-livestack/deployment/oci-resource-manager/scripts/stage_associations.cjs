'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {connect,rows}=require('../../../scripts/evidence-intelligence/connection.cjs');
(async()=>{
 const c=await connect();try{
  const batches=await rows(c,"SELECT batch_id FROM cdr_batches WHERE synthetic_only='Y' AND status='ready'");
  const source='/home/opc/livestack/detective-room/data/associations',target=path.resolve(__dirname,'../artifacts/associations');await fs.mkdir(target,{recursive:true,mode:0o700});
  let staged=0;
  for(const batch of batches){
   if(!/^DR-[A-Za-z0-9-]+$/.test(batch.BATCH_ID))throw Error('Unexpected synthetic batch identity');
   let bytes;try{bytes=await fs.readFile(path.join(source,batch.BATCH_ID+'.json'));}catch(e){if(e.code==='ENOENT')continue;throw e;}
   const value=JSON.parse(bytes);if(value.version!==1||value.batchId!==batch.BATCH_ID||!Array.isArray(value.links)||value.links.length>40)throw Error('Invalid scenario association');
   const safe={version:1,batchId:value.batchId,declaredBy:'demo-scenario-author',links:value.links.map(link=>({handle:link.handle,personRef:link.personRef,reason:link.reason}))};
   if(value.declaredAt)safe.declaredAt=value.declaredAt;
   await fs.writeFile(path.join(target,batch.BATCH_ID+'.json'),JSON.stringify(safe,null,2)+'\n',{mode:0o600});staged++;
  }
  console.log(JSON.stringify({syntheticBatches:batches.length,associationDocuments:staged,privateHistoryIncluded:false}));
 }finally{await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
