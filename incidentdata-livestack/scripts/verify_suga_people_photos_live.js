'use strict';
// Explicit synthetic SUGA comparisons; saves candidates only, never accepts a link.
const assert=require('node:assert/strict'),o=require('oracledb');
const {createPeoplePhotos}=require('../backend/data-room-people-photos'),{hash}=require('../backend/data-room-archive');
const batchId='DR-20260914-13f650e8-dfa8-450e';
// Regions selected by scene location before any vector query, not by filenames or POI IDs.
const regions=[
 ['905c661e967ac86e3af524d1e566ebe8','cafe-left',{x:.10,y:.08,width:.24,height:.55}],
 ['905c661e967ac86e3af524d1e566ebe8','cafe-centre',{x:.36,y:.13,width:.28,height:.51}],
 ['905c661e967ac86e3af524d1e566ebe8','cafe-right',{x:.73,y:.08,width:.25,height:.56}],
 ['eb3ec6aee857cb8787a35a3f775cbe64','workshop-left',{x:.095,y:.09,width:.205,height:.49}],
 ['eb3ec6aee857cb8787a35a3f775cbe64','workshop-centre',{x:.36,y:.12,width:.22,height:.48}],
 ['eb3ec6aee857cb8787a35a3f775cbe64','workshop-right',{x:.68,y:.065,width:.27,height:.53}],
 ['38206d6df68897aa06c65b5a24669d8e','networking-front-left',{x:.085,y:.125,width:.275,height:.53}],
 ['38206d6df68897aa06c65b5a24669d8e','networking-front-right',{x:.70,y:.19,width:.285,height:.58}],
 ['38206d6df68897aa06c65b5a24669d8e','networking-back-left',{x:.34,y:.018,width:.19,height:.44}],
 ['38206d6df68897aa06c65b5a24669d8e','networking-back-right',{x:.535,y:.005,width:.2,height:.43}],
];
(async()=>{
 if(process.env.ORACLE_USER!=='CRIME_DATA'||!/fu40/i.test(process.env.ORACLE_CONNECTION_STRING||''))throw Error('Expected CRIME_DATA on FU40.');
 const w=process.env.ORACLE_WALLET_LOCATION,pool=await o.createPool({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:w,configDir:w,walletPassword:process.env.ORACLE_WALLET_PASSWORD,poolMin:0,poolMax:2});
 const db=async(user,fn)=>{const c=await pool.getConnection();try{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');c.callTimeout=20000;return await fn(c);}finally{await c.close();}};
 const rows=async(c,sql,b={},opts={})=>(await c.execute(sql,b,{outFormat:o.OUT_FORMAT_OBJECT,...opts})).rows;
 async function originalState(){return db('statewide_admin',async c=>{
  const items=await rows(c,'SELECT item_id,sha256,content_blob FROM secure_cdr_items_v WHERE batch_id=:id ORDER BY item_id',{id:batchId},{fetchInfo:{CONTENT_BLOB:{type:o.BUFFER}}});
  assert.equal(items.length,7);for(const i of items)assert.equal(hash(i.CONTENT_BLOB),i.SHA256);
  const stages=await rows(c,'SELECT * FROM cdr_stages WHERE batch_id=:id ORDER BY stage_no',{id:batchId});
  const snapshots={};for(const table of ['cdr_money_runs','cdr_msg_runs','cdr_workspace_runs','cdr_money_ai_runs'])snapshots[table]=await rows(c,`SELECT run_id,created_at FROM ${table} WHERE batch_id=:id ORDER BY run_id`,{id:batchId});
  const vectors=await rows(c,"SELECT person_id,asset_ref,asset_sha256,embedding_model,created_at FROM person_visual_embeddings WHERE asset_kind='reference_portrait' ORDER BY person_id,asset_ref");
  return {items:items.map(({CONTENT_BLOB,...i})=>i),stages,snapshots,vectors};
 });}
 try{
  const before=await originalState(),photos=createPeoplePhotos(db),initial=await photos.read('statewide_admin',batchId);assert.equal(initial.photos.length,3);assert.equal(initial.catalogue.visualReady,13);assert.equal(initial.catalogue.registered,15);
  const checks=[];
  for(const [itemId,label,region] of regions){
   const existing=initial.searches.find(s=>s.itemId===itemId&&!s.staleReason&&s.query.region.left===Math.floor(region.x*s.query.imageWidth)&&s.query.region.top===Math.floor(region.y*s.query.imageHeight)&&s.query.region.width===Math.ceil((region.x+region.width)*s.query.imageWidth)-Math.floor(region.x*s.query.imageWidth)&&s.query.region.height===Math.ceil((region.y+region.height)*s.query.imageHeight)-Math.floor(region.y*s.query.imageHeight));
   const saved=existing?{searchId:existing.id,reused:true}:await photos.compare('statewide_admin',batchId,itemId,{region});
   const result=await photos.read('statewide_admin',batchId),s=result.searches.find(s=>s.id===saved.searchId);assert(s&&!s.staleReason);assert.equal(s.dimensions,512);assert.equal(s.candidates.length,3);assert.equal(new Set(s.candidates.map(p=>p.person_ref)).size,3);assert.equal(hash(await photos.crop('statewide_admin',batchId,s.id)),s.query.cropSha256);
   assert.equal(result.edges.filter(e=>e.search_id===s.id).length,4);
   const summary={label,searchId:s.id,reused:saved.reused,region:s.query.region,candidates:s.candidates.map(p=>({name:p.display_name,score:Number(p.score.toFixed(3)),status:p.decision}))};checks.push(summary);console.log(JSON.stringify(summary));
  }
  // Bad regions fail before embedding and cannot add a saved search.
  const countBefore=(await photos.read('statewide_admin',batchId)).searches.length;
  await assert.rejects(()=>photos.compare('statewide_admin',batchId,regions[0][0],{region:{x:.9,y:0,width:.2,height:.5}}),e=>e.status===400);
  await assert.rejects(()=>photos.compare('statewide_admin',batchId,regions[0][0],{region:{x:0,y:0,width:.001,height:.001}}),e=>e.status===400);
  assert.equal((await photos.read('statewide_admin',batchId)).searches.length,countBefore);
  await assert.rejects(()=>photos.read('southern_analyst',batchId),e=>e.status===404);
  assert.deepEqual(await originalState(),before);
  console.log(JSON.stringify({sugaPhotos:3,preselectedRegions:checks.length,originalFilesAndStages:'unchanged',moneyMessagesAndAgents:'unchanged',poiPortraitsAndVectors:'unchanged',invalidRegions:'rejected',reviewDecisionsWritten:0,coverage:'13/15',rankingNote:'Recorded nearest neighbours only; not an accuracy benchmark or verified identity.'}));
 }finally{await pool.close(0);}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={regions};
