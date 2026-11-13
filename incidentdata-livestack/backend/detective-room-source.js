'use strict';
const oracle=require('oracledb');
const {inspectArchive}=require('./data-room-archive');
const {sha,fail,ENGINE,batchId}=require('./detective-room-store');
const {transcriptInputs,transcriptFingerprint,analysisSources}=require('./detective-room-transcripts');
const {associationContext}=require('./detective-room-associations');
const options={outFormat:oracle.OUT_FORMAT_OBJECT};
async function visible(c,id){
 batchId(id);
 const result=await c.execute(`SELECT batch_id,filename,status,archive_sha256,archive_bytes,file_count,synthetic_only FROM secure_cdr_batches_v WHERE batch_id=:id`,{id},options);
 const batch=result.rows[0];if(!batch)throw fail(404,'Batch not found in your authorised scope.');
 if(batch.SYNTHETIC_ONLY!=='Y')throw fail(403,'Room generation is restricted to explicitly synthetic training batches.');
 return batch;
}
// Inputs are originals, not private conversations or mutable AI descriptions.
const fingerprint=b=>sha(JSON.stringify([ENGINE,b.BATCH_ID,b.ARCHIVE_SHA256,b.ARCHIVE_BYTES,b.FILE_COUNT]));
async function generationContext(c,batch){
 const items=(await c.execute("SELECT item_id,original_path,content_type,sha256 FROM secure_cdr_items_v WHERE batch_id=:id AND content_type IN ('mp3','m4a','mp4') ORDER BY original_path",{id:batch.BATCH_ID},options)).rows;
 const transcripts=await transcriptInputs(c,items);
 const analysisFingerprint=transcriptFingerprint(fingerprint(batch),transcripts),associations=await associationContext(c,batch);
 return {transcripts,analysisFingerprint,associations,fingerprint:associations.fingerprint?sha(JSON.stringify([analysisFingerprint,associations.fingerprint])):analysisFingerprint};
}
async function snapshot(c,id){
 const batch=await visible(c,id);if(batch.STATUS!=='ready')throw fail(409,'Wait for the complete batch inventory.');
 const result=await c.execute('SELECT archive_blob FROM secure_cdr_batches_v WHERE batch_id=:id',{id},{...options,fetchInfo:{ARCHIVE_BLOB:{type:oracle.BUFFER}}});
 const archive=result.rows[0]?.ARCHIVE_BLOB;
 if(!Buffer.isBuffer(archive)||archive.length!==batch.ARCHIVE_BYTES||sha(archive)!==batch.ARCHIVE_SHA256)throw fail(409,'Original archive checksum or size mismatch.');
 const inventory=await inspectArchive(archive);
 const stored=(await c.execute('SELECT item_id,original_path,content_type,byte_count,sha256 FROM secure_cdr_items_v WHERE batch_id=:id ORDER BY original_path',{id},options)).rows;
 if(stored.length!==batch.FILE_COUNT||stored.length!==inventory.files.length)throw fail(409,'Archive and database item counts differ.');
 const metadata=new Map(stored.map(i=>[i.ORIGINAL_PATH,i]));
 for(const f of inventory.files){const i=metadata.get(f.path);if(!i||i.SHA256!==f.sha256||i.BYTE_COUNT!==f.bytes)throw fail(409,'Archive and item inventory do not match.');f.itemId=i.ITEM_ID;}
 const transcripts=await transcriptInputs(c,stored),analysis=analysisSources(inventory.files,transcripts);
 const analysisFingerprint=transcriptFingerprint(fingerprint(batch),transcripts),associations=await associationContext(c,batch);
 return {batch,archive,files:inventory.files,...analysis,transcripts,analysisFingerprint,associations,ignored:inventory.ignored,fingerprint:associations.fingerprint?sha(JSON.stringify([analysisFingerprint,associations.fingerprint])):analysisFingerprint};
}
module.exports={visible,fingerprint,snapshot,generationContext};
