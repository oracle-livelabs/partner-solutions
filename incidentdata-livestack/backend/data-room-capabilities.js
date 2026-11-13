'use strict';
const o=require('oracledb'),{parse}=require('csv-parse/sync');
const money=require('./data-room-money-model'),messages=require('./data-room-messages-model'),travel=require('./data-room-travel');
const {attachTranscripts,sourceIdentity}=require('./data-room-message-sources');
const VERSION='cdr-capabilities-v7',PREFIX_BYTES=32767;
const rows=async(c,sql,binds={},options={})=>(await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT,...options})).rows;
const definitions=[{id:'money',title:'Money Flows',version:money.VERSION,types:['csv','json'],endpoint:'money-flows'},
 {id:'messages',title:'Messages',version:messages.VERSION,types:['csv','json','txt','mp3','m4a'],endpoint:'messages'},
 {id:'travel',title:'Travel',version:travel.VERSION,types:['csv','json','txt'],endpoint:'travel'}];
function fingerprint(kind,items){const entries=items.filter(i=>definitions.find(d=>d.id===kind).types.includes(i.CONTENT_TYPE)).map(i=>kind==='messages'?sourceIdentity(i):[i.ITEM_ID,i.SHA256]);return kind==='money'?money.digest(JSON.stringify([money.VERSION,entries])):kind==='messages'?messages.id(messages.VERSION,entries):money.digest(JSON.stringify([travel.VERSION,entries]));}
// Discovery recognises format signatures, not the validity of every record.
// JSON membership is checked by Oracle against the whole bounded document;
// quoted mentions of "messages" inside ordinary prose cannot enable a tile.
function discover(item){
 const text=Buffer.from(item.PREFIX||'').toString('utf8').replace(/^\uFEFF/,''),result={money:'none',messages:'none',travel:'none'};
 if(item.CONTENT_TYPE==='csv'){
  try{
   const header=parse(text,{bom:true,skip_empty_lines:true,to:1,max_record_size:64000})[0]||[],keys=header.map(h=>h.trim().toLowerCase());
   if(money.columnsFor(keys.map(k=>k.toUpperCase())))result.money='recognised';
   if(messages.csvColumns(keys))result.messages='recognised';
   if(new Set(keys).size!==keys.length)for(const kind of ['money','messages'])if(result[kind]==='recognised')result[kind]='check';
  }catch{result.money=result.messages='check';}
  if(item.BYTE_COUNT>PREFIX_BYTES&&!/[\r\n]/.test(text))result.money=result.messages='check';
 }else if(['mp3','m4a'].includes(item.CONTENT_TYPE))result.messages=item.TRANSCRIPT&&require('./data-room-transcription').validTurns(item.TRANSCRIPT)?'recognised':'check';
 else if(item.CONTENT_TYPE==='txt')result.messages=messages.textFormat(text)?'recognised':'none';
 else if(item.CONTENT_TYPE==='json'){
  result.messages=item.HAS_MESSAGES===1?'recognised':item.JSON_VALID===0||item.BYTE_COUNT>messages.LIMITS.sourceBytes?'check':'none';
  try{const value=JSON.parse(text),records=money.jsonRecords(value),keys=[...new Set(records.flatMap(r=>r&&typeof r==='object'?Object.keys(r).map(k=>k.trim().toUpperCase()):[]))];if(money.columnsFor(keys))result.money='recognised';}catch{if(item.JSON_VALID===0)result.money='check';}
 }
 result.travel=travel.discover(item);
 return result;
}
function describe(def,items,saved,failure,batchStatus){
 const relevant=items.filter(i=>def.types.includes(i.CONTENT_TYPE)),fp=fingerprint(def.id,items);
 const sources=relevant.map(i=>({itemId:i.ITEM_ID,path:i.ORIGINAL_PATH,sha256:i.SHA256,bytes:def.id==='messages'?messages.analysisBytes(i):i.BYTE_COUNT,discovery:discover(i)[def.id],...(def.id==='messages'&&['mp3','m4a'].includes(i.CONTENT_TYPE)&&!require('./data-room-transcription').validTurns(i.TRANSCRIPT)?{reason:'Run Stage 4 Identify/Describe to generate the audio dialogue.'}:{})}));
 const recognised=sources.filter(s=>s.discovery==='recognised'),uncertain=sources.filter(s=>s.discovery==='check');
 const stale=!!saved&&saved.fingerprint!==fp,currentFailure=failure?.FINGERPRINT===fp?{message:failure.ERROR_TEXT,at:failure.FAILED_AT}:null;
 let status=batchStatus!=='ready'?'waiting':saved?'results':recognised.length?'ready':uncertain.length?'needs_attention':'unavailable';
 if(stale)status='stale';if(currentFailure)status='needs_attention';
 const oversized=sources.some(s=>s.bytes>(def.id==='money'?money.LIMITS.csvBytes:def.id==='messages'?messages.LIMITS.sourceBytes:travel.LIMITS.sourceBytes));
 const overTotal=def.id==='messages'&&sources.reduce((n,s)=>n+s.bytes,0)>messages.LIMITS.totalBytes;
 const warnings=[];
 if(stale)warnings.push('Sources or analysis version changed. Rebuild before using these results.');
 if(currentFailure)warnings.push(currentFailure.message);
 if(oversized||overTotal){warnings.push('Source size exceeds this analysis limit; inspect coverage before building.');if(batchStatus==='ready')status='needs_attention';}
 if(uncertain.length)warnings.push(`${uncertain.length} source format${uncertain.length===1?' needs':'s need'} inspection; discovery is incomplete.`);
 const skippedCandidates=saved?.coverage.skipped.filter(s=>sources.find(source=>source.itemId===s.itemId)?.discovery!=='none')||[];
 if(skippedCandidates.length)warnings.push(`${skippedCandidates.length} source${skippedCandidates.length===1?' was':'s were'} not imported. See coverage.`);
 return {id:def.id,title:def.title,available:!!saved||!!currentFailure||recognised.length>0||uncertain.length>0,status,
  sourceFingerprint:fp,analysisVersion:def.version,snapshot:saved?{id:saved.id,version:saved.version,fingerprint:saved.fingerprint,createdAt:saved.createdAt}:null,
  counts:saved?.counts||null,coverage:{recognisedSources:recognised.length,uncertainSources:uncertain.length,sources,imported:saved?.coverage.sources||[],skipped:saved?.coverage.skipped||[]},
  warnings,failure:currentFailure,actions:{open:def.endpoint,canBuild:batchStatus==='ready'},
  summary:saved?(def.id==='money'?`${saved.counts.transfers} transactions · ${saved.counts.accounts} accounts`:`${saved.counts.threads} conversations · ${saved.counts.messages} messages`):recognised.length?`${recognised.length} recognised source${recognised.length===1?'':'s'} · ${def.id==='travel'?'ready to map':'not analysed yet'}`:uncertain.length?'Source format needs inspection':'No supported source format recognised'};
}
async function capabilitySummary(c,batchId){
 const batch=(await rows(c,'SELECT batch_id,filename,status FROM secure_cdr_batches_v WHERE batch_id=:id',{id:batchId}))[0];
 if(!batch)throw money.fail(404,'Batch not found in your authorised scope.');
 let items=await rows(c,`SELECT item_id,original_path,content_type,sha256,byte_count,
 CASE WHEN content_type IN ('csv','txt') THEN DBMS_LOB.SUBSTR(content_blob,${PREFIX_BYTES},1) END prefix,
 CASE WHEN content_type='json' AND byte_count<=${messages.LIMITS.sourceBytes} THEN CASE WHEN JSON_EXISTS(content_blob FORMAT JSON,'$.messages' FALSE ON ERROR) OR JSON_EXISTS(content_blob FORMAT JSON,'$.conversations[*].messages' FALSE ON ERROR) THEN 1 ELSE 0 END END has_messages,
 CASE WHEN content_type='json' AND byte_count<=${messages.LIMITS.sourceBytes} THEN CASE WHEN content_blob IS JSON THEN 1 ELSE 0 END END json_valid
 FROM secure_cdr_items_v WHERE batch_id=:id ORDER BY item_id`,{id:batchId});
 items=await attachTranscripts(c,batchId,items);
 const failures=await rows(c,'SELECT capability,fingerprint,error_text,failed_at FROM secure_cdr_cap_failures_v WHERE batch_id=:id',{id:batchId});
 const capabilities=[];
 for(const def of definitions){
  if(def.id==='travel'){capabilities.push(describe(def,items,null,failures.find(f=>f.CAPABILITY===def.id),batch.STATUS));continue;}
  const table=def.id==='money'?'secure_cdr_money_runs_v':'secure_cdr_msg_runs_v';
  const counts=def.id==='money'?`(SELECT COUNT(*) FROM secure_cdr_money_accounts_v a WHERE a.run_id=r.run_id) account_count,(SELECT COUNT(*) FROM secure_cdr_money_transfers_v t WHERE t.run_id=r.run_id) transfer_count`:`JSON_VALUE(result_json,'$.counts.threads' RETURNING NUMBER) thread_count,JSON_VALUE(result_json,'$.counts.messages' RETURNING NUMBER) message_count,JSON_VALUE(result_json,'$.counts.participants' RETURNING NUMBER) participant_count`;
  const run=(await rows(c,`SELECT run_id,version,fingerprint,created_at,${counts},JSON_QUERY(result_json,'$.sources' RETURNING CLOB) sources_json,JSON_QUERY(result_json,'$.skipped' RETURNING CLOB) skipped_json FROM ${table} r WHERE batch_id=:id AND ${def.id==='messages'?"version IN ('cdr-messages-v1','cdr-messages-v2','cdr-messages-v3','cdr-messages-v4','cdr-messages-v5',:version)":'version=:version'} ORDER BY created_at DESC FETCH FIRST 1 ROW ONLY`,{id:batchId,version:def.version},{fetchInfo:{SOURCES_JSON:{type:o.STRING},SKIPPED_JSON:{type:o.STRING}}}))[0];
  const saved=run?{id:run.RUN_ID,version:run.VERSION,fingerprint:run.FINGERPRINT,createdAt:run.CREATED_AT,counts:def.id==='money'?{accounts:run.ACCOUNT_COUNT,transfers:run.TRANSFER_COUNT}:{threads:run.THREAD_COUNT,messages:run.MESSAGE_COUNT,participants:run.PARTICIPANT_COUNT},coverage:{sources:JSON.parse(run.SOURCES_JSON||'[]'),skipped:JSON.parse(run.SKIPPED_JSON||'[]')}}:null;
  capabilities.push(describe(def,items,saved,failures.find(f=>f.CAPABILITY===def.id),batch.STATUS));
 }
 capabilities.push(require('./data-room-people-mentioned').peopleCapability(items,batch.STATUS));
 capabilities.push(await require('./data-room-people-photos').photoCapability(c,batchId,items,batch.STATUS));
 return {version:VERSION,batch:{id:batchId,filename:batch.FILENAME,status:batch.STATUS},capabilities,discovery:'Format signatures, photo inventory and saved comparison metadata; no graph query, model call or automatic analysis. Photo inventory does not detect people. Unrecognised content is not proof that evidence is absent.'};
}
async function clearFailure(c,batchId,kind){await c.execute('DELETE FROM cdr_cap_failures WHERE batch_id=:id AND capability=:kind',{id:batchId,kind});}
async function recordFailure(c,batchId,kind,fp,error){
 if(!fp)return;
 try{
  await c.execute(`MERGE INTO cdr_cap_failures f USING (SELECT batch_id FROM secure_cdr_batches_v WHERE batch_id=:id) b ON (f.batch_id=b.batch_id AND f.capability=:kind)
  WHEN MATCHED THEN UPDATE SET fingerprint=:fp,error_text=:message,failed_at=SYSTIMESTAMP
  WHEN NOT MATCHED THEN INSERT(batch_id,capability,fingerprint,error_text) VALUES(b.batch_id,:kind,:fp,:message)`,{id:batchId,kind,fp,message:String(error.message||'Analysis failed.').slice(0,1800)});
  await c.commit();
 }catch(e){await c.rollback();console.error('Could not record capability failure:',e.errorNum||'database error');}
}
function registerCapabilities(router,db,route){router.get('/batches/:id/capabilities',route(async(req,res)=>res.json(await db(req.demoUser,c=>capabilitySummary(c,req.params.id)))));}
module.exports={VERSION,definitions,discover,describe,fingerprint,capabilitySummary,recordFailure,clearFailure,registerCapabilities};
