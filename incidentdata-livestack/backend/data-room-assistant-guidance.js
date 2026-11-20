'use strict';
const o=require('oracledb');
const {learningDetail}=require('./data-room-learning');
const fail=(status,message)=>Object.assign(Error(message),{status});
const rows=async(c,sql,binds,options={})=>(await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT,...options})).rows;
function guidance({assistant,command,batch,stages,counts,brief,board=null,historyCount=0,readOnly=false}){
 const expert=assistant==='expert',name=expert?'Crime Expert Assistant':'Batch Assistant';
 const current=!!brief.result&&brief.isCurrent;
 const facts=[{label:'Batch',value:batch.FILENAME},{label:'Inventory',value:batch.STATUS},{label:'Descriptions complete',value:`${counts.COMPLETE || 0} of ${counts.TOTAL || 0}`},{label:'Description failures',value:String(counts.FAILED || 0)},{label:'Batch Brief',value:!brief.result?'Not available':current?'Current saved brief':'Out of date'}];
 if(brief.coverage)facts.push({label:'Brief coverage',value:`${brief.coverage.partialTextCount || 0} partial original-text analyses; ${brief.coverage.condensedCount || 0} descriptions condensed`});
 if(expert){
  facts.push({label:'Private board',value:board?`${board.REVIEW_STATUS}; ${board.NODE_COUNT || 0} source nodes; ${board.EDGE_COUNT || 0} proposed relationships`:'Not created'});
  if(board)facts.push({label:'Board source versions',value:current?(board.SOURCE_FINGERPRINT===brief.run?.input_fingerprint?'Match current descriptions':'Changed — review the saved board'):'Complete a current brief before checking the board against it'});
  facts.push({label:'Saved detective replies',value:String(historyCount)});
 }else{
  const s=stages.find(s=>s.STAGE_NO===6);facts.push({label:'Connections stage',value:s?.STATUS || 'Not started'});
 }
 const nextSteps=[];
 if(batch.STATUS!=='ready')nextSteps.push('Open batch processing status and resolve ingestion before running AI questions.');
 else if(!current)nextSteps.push(Number(counts.COMPLETE)<Number(counts.TOTAL)?'Complete Identify/Describe in Files, then create a current Batch Brief.':'Create a current Batch Brief in Brief & Connections.');
 else if(expert&&!board)nextSteps.push('Use Generate detective first cut to create a private board, or ask a question below.');
 else if(expert)nextSteps.push('Review the saved board, test an alternative explanation and save any edits before asking about them.');
 else nextSteps.push('Ask for the sources behind a theme, inspect originals and check coverage before drawing conclusions.');
 if(readOnly)nextSteps.push('This demo user can read guidance and saved work; AI questions and board changes are disabled.');
 const theme=brief.result?.themes?.[0]?.title,source=brief.manifest?.[0]?.path;
 const questions=expert?['What alternative explanations fit this batch, and what would distinguish them?',theme?`What evidence supports or challenges the theme “${theme}”?`:'Which statements in the brief need stronger source support?',board?'Review the saved board: what counterevidence should I look for?':'What is a cautious first-cut explanation, and why might it be wrong?']:['What does this batch contain, and which sources should I read first?',theme?`Which source files support the theme “${theme}”, and what needs checking?`:'Which source files support the main themes in the brief?',source?`What does “${source}” contribute, and what should I verify in the original?`:'What coverage limits should I check in the original files?'];
 return {assistant,command,title:`${name} · ${command==='help'?'Help':'Status'}`,summary:command==='help'?(expert?'I can draft a cautious possible explanation, compare alternatives, review your saved private board, identify counterevidence and suggest source checks. Type status for readiness and next steps.':'I can summarise this batch, locate sources behind themes or references, explain saved descriptions and flag coverage gaps. Type status for readiness and next steps.'):expert?'Live batch readiness and your private investigation workspace.':'Live inventory, description coverage and brief readiness.',facts,nextSteps,questions,canAsk:current&&!readOnly&&batch.STATUS==='ready',notes:expert?'AI questions use saved descriptions, the current brief and the saved board. Unsaved edits and previous detective questions are not included automatically. Save board edits first.':'AI questions use saved descriptions and the current brief, plus the previous five completed turns in the selected conversation. They do not reread every original.',checkedAt:new Date().toISOString(),source:'Application state · no AI call',persisted:false};
}
async function readGuidance(c,id,assistant,command,user,readBrief=learningDetail){
 if(!['batch','expert'].includes(assistant)||!['help','status'].includes(command))throw fail(400,'Choose batch or expert, and help or status.');
 const batch=(await rows(c,'SELECT batch_id,filename,status FROM secure_cdr_batches_v WHERE batch_id=:id',{id}))[0];
 if(!batch)throw fail(404,'Batch not found in your authorised scope.');
 const stages=await rows(c,'SELECT stage_no,status FROM secure_cdr_stages_v WHERE batch_id=:id ORDER BY stage_no',{id});
 const counts=(await rows(c,`SELECT COUNT(*) total,SUM(CASE WHEN a.status='complete' THEN 1 ELSE 0 END) complete,SUM(CASE WHEN a.status='failed' THEN 1 ELSE 0 END) failed FROM secure_cdr_items_v i LEFT JOIN (SELECT item_id,status,ROW_NUMBER() OVER(PARTITION BY item_id ORDER BY created_at DESC,run_id DESC) rn FROM secure_cdr_ai_results_v) a ON a.item_id=i.item_id AND a.rn=1 WHERE i.batch_id=:id`,{id}))[0]||{};
 const brief=await readBrief(c,id);
 let board=null,historyCount=0;
 if(assistant==='expert'){
  board=(await rows(c,`SELECT review_status,source_fingerprint,nodes_json,edges_json FROM secure_cdr_expert_boards_v WHERE batch_id=:id`,{id},{fetchInfo:{NODES_JSON:{type:o.STRING},EDGES_JSON:{type:o.STRING}}}))[0]||null;
  if(board){board.NODE_COUNT=JSON.parse(board.NODES_JSON||'[]').length;board.EDGE_COUNT=JSON.parse(board.EDGES_JSON||'[]').length;}
  historyCount=(await rows(c,'SELECT COUNT(*) n FROM secure_cdr_expert_assistant_runs_v WHERE batch_id=:id',{id}))[0]?.N||0;
 }
 return guidance({assistant,command,batch,stages,counts,brief,board,historyCount,readOnly:user==='read_only_viewer'});
}
function registerGuidance(router,db,route){
 router.get('/batches/:id/assistants/:assistant/:command',route(async(req,res)=>{res.set('Cache-Control','no-store');res.json(await db(req.demoUser,c=>readGuidance(c,req.params.id,req.params.assistant,req.params.command,req.demoUser)));}));
}
module.exports={guidance,readGuidance,registerGuidance};
