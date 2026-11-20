'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const source=fs.readFileSync(path.resolve(__dirname,'../backend/data-room-board.js'),'utf8');
const code=`
const o=require('/app/node_modules/oracledb'),Module=require('node:module');
const m=new Module('/app/backend/data-room-board.js');m.filename='/app/backend/data-room-board.js';m.paths=Module._nodeModulePaths('/app/backend');m._compile(${JSON.stringify(source)},m.filename);
const {currentSnapshot,learningDetail}=require('/app/backend/data-room-learning'),{nativeAnswer}=require('/app/backend/data-room-expert'),ops=require('/app/backend/ai-ops-telemetry');
(async()=>{
 const config={user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING};
 if(process.env.ORACLE_WALLET_LOCATION)Object.assign(config,{walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
 const c=await o.getConnection(config);c.callTimeout=180000;
 try{
  await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:'statewide_admin'});
  const boards=(await c.execute('SELECT batch_id,summary_brief,detailed_brief,edges_json FROM secure_cdr_expert_boards_v ORDER BY updated_at DESC FETCH FIRST 15 ROWS ONLY',{}, {outFormat:o.OUT_FORMAT_OBJECT,fetchInfo:{SUMMARY_BRIEF:{type:o.STRING},DETAILED_BRIEF:{type:o.STRING},EDGES_JSON:{type:o.STRING}}})).rows;
  let chosen,brief,snapshot;for(const b of boards){const l=await learningDetail(c,b.BATCH_ID);if(l.isCurrent){chosen=b;brief=l;break;}}
  if(!chosen)throw Error('No current prepared board for this one-call check.');snapshot=await currentSnapshot(c,chosen.BATCH_ID);
  const result=await ops.context({actor:'statewide_admin',area:'Crime Data Room',batchId:chosen.BATCH_ID,feature:'Private board suggestion validation'},()=>m.exports.generateSuggestions(snapshot,brief.result,{summary:chosen.SUMMARY_BRIEF,detail:chosen.DETAILED_BRIEF,edges:JSON.parse(chosen.EDGES_JSON)}));
  console.log(JSON.stringify({structuredRequest:true,providerAttempts:result.generation?.attempts?.length,suggestions:result.suggestions.length,matchedDescriptionExcerpts:result.suggestions.reduce((n,s)=>n+s.support.length,0),model:result.model,boardWrites:0,sourceFilesChanged:false}));
 }finally{try{await c.execute('BEGIN DBMS_CLOUD_AI.CLEAR_CONVERSATION_ID; END;');}finally{await c.close();}}
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
process.stdout.write(execFileSync('podman',['exec','-i','policeadelaide_app-fu40_1','node'],{input:code,encoding:'utf8',maxBuffer:1024*1024}));
