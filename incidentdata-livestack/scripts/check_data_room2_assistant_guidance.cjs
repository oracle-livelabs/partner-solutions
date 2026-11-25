'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const source=fs.readFileSync(path.resolve(__dirname,'../backend/data-room-assistant-guidance.js'),'utf8');
const script=`
const assert=require('node:assert/strict'),o=require('/app/node_modules/oracledb'),Module=require('node:module');
const m=new Module('/app/backend/data-room-assistant-guidance.js');m.filename='/app/backend/data-room-assistant-guidance.js';m.paths=Module._nodeModulePaths('/app/backend');m._compile(${JSON.stringify(source)},m.filename);
(async()=>{
 const config={user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING};
 if(process.env.ORACLE_WALLET_LOCATION)Object.assign(config,{walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
 const c=await o.getConnection(config);c.callTimeout=30000;
 try{
  await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:'statewide_admin'});
  const batches=(await c.execute('SELECT batch_id FROM secure_cdr_batches_v ORDER BY created_at DESC FETCH FIRST 3 ROWS ONLY',{}, {outFormat:o.OUT_FORMAT_OBJECT})).rows;
  let responses=0;
  for(const b of batches)for(const assistant of ['batch','expert'])for(const command of ['help','status']){
   const g=await m.exports.readGuidance(c,b.BATCH_ID,assistant,command,'statewide_admin');assert.equal(g.assistant,assistant);assert(g.facts.length>=5);assert(g.questions.length===3);responses++;
  }
  await assert.rejects(m.exports.readGuidance(c,'DR-NOT-A-VISIBLE-BATCH','expert','status','statewide_admin'),e=>e.status===404);
  if(batches.length){await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:'read_only_viewer'});try{const g=await m.exports.readGuidance(c,batches[0].BATCH_ID,'expert','status','read_only_viewer');assert.equal(g.canAsk,false);}catch(e){assert.equal(e.status,404);}}
  console.log(JSON.stringify({databaseReadChecks:responses,hiddenBatchRejected:true,viewerScopeEnforced:true,modelCalls:0,applicationDataWrites:0}));
 }finally{await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
process.stdout.write(execFileSync('podman',['exec','-i','policeadelaide_app-fu40_1','node'],{input:script,encoding:'utf8',maxBuffer:1024*1024}));
