'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {connect,rows}=require('./evidence-intelligence/connection.cjs');
const {visible,snapshot}=require('../backend/detective-room-source'),{normalize}=require('../backend/detective-room-normalize');
const {declarations}=require('../backend/detective-room-associations'),{atomic}=require('../backend/detective-room-store');
(async()=>{
 assert(process.env.CDR_ROOM_ROOT&&path.isAbsolute(process.env.CDR_ROOM_ROOT),'Set the absolute private CDR_ROOM_ROOT');assert(process.argv[2],'Supply the fictional scenario annotation JSON');
 const doc=JSON.parse(await fs.readFile(process.argv[2],'utf8')),c=await connect();
 try{
  await c.execute('SET TRANSACTION READ ONLY');await visible(c,doc.batchId);const data=await snapshot(c,doc.batchId),normal=normalize(data.analysisFiles);
  const profiles=await rows(c,'SELECT person_ref,display_name FROM secure_persons_of_interest_v');const links=declarations(doc,doc.batchId,profiles);assert.equal(links.length,doc.links.length,'Every declared profile must be visible');
  for(const link of links)assert(normal.people.some(p=>p.name===link.handle),'Handle absent from source conversation membership: '+link.handle);
  const dir=path.join(process.env.CDR_ROOM_ROOT,'associations'),file=path.join(dir,doc.batchId+'.json');
  if(process.argv.includes('--apply')){await fs.mkdir(dir,{recursive:true,mode:0o700});let previous;try{previous=JSON.parse(await fs.readFile(file));}catch(e){if(e.code!=='ENOENT')throw e;}if(previous)await atomic(path.join(dir,doc.batchId+'.before-'+Date.now()+'.json'),previous);await atomic(file,doc);}
  console.log(JSON.stringify({applied:process.argv.includes('--apply'),batchId:doc.batchId,links:links.map(l=>({handle:l.handle,displayName:l.displayName,basis:l.basis})),originalFilesUnchanged:true}));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
