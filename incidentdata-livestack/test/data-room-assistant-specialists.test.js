'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
function load(name,stubs){const filename=path.resolve(__dirname,'../backend/'+name+'.js'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));const original=m.require.bind(m);m.require=id=>id in stubs?stubs[id]:original(id);m._compile(fs.readFileSync(filename,'utf8'),filename);return m.exports;}
const manifest=[{ref:'S01',path:'invoice.csv'}],snapshot={manifest,sources:[{source_id:'S01',description:'A saved invoice description.'}],fingerprint:'current'};
function expertFixture({current=true}={}){
 const posts=new Map(),prompts=[],queries=[];
 const ops={context:async(meta,fn)=>fn(),current:()=>({runId:'run-test'}),nativeExecute:async(c,meta,sql,binds)=>{prompts.push(binds.prompt.val);return {rows:[{ANSWER:'Check the invoice [S01].'}]};}};
 const expert=load('data-room-expert',{'./ai-ops-telemetry':ops,'./data-room-learning':{currentSnapshot:async()=>snapshot,learningDetail:async()=>({result:current?{title:'Invoice batch'}:null,isCurrent:current})}});
 const c={commit:async()=>{},execute:async(sql)=>{queries.push(sql);if(sql.startsWith('SELECT batch_id FROM secure_cdr_batches_v'))return {rows:[{BATCH_ID:'B'}]};if(sql.includes('FROM secure_cdr_expert_boards_v'))return {rows:[{SUMMARY_BRIEF:'Saved analyst proposal',DETAILED_BRIEF:'Possible alternative explanation',EDGES_JSON:'[{"from":"S01","to":"S02","label":"proposed"}]',REVIEW_STATUS:'draft',SOURCE_FINGERPRINT:'current'}]};if(sql.includes('CREATE_CONVERSATION'))return {rows:[{ID:'native-test'}]};if(sql.startsWith('BEGIN')||sql.startsWith('INSERT INTO cdr_expert_assistant_runs'))return {rowsAffected:1};throw Error(sql);}};
 expert.registerExpert({get(){},put(){},post:(url,handler)=>posts.set(url,handler)},async(user,fn)=>fn(c),fn=>fn);
 const ask=async(body,user='statewide_admin',route='/batches/:id/expert/assistant')=>{let result;await posts.get(route)({demoUser:user,params:{id:'B'},body},{json:r=>{result=r;}});return result;};
 return {ask,prompts,queries};
}
test('specialist detective requests include saved descriptions and private saved board as proposals',async()=>{
 const f=expertFixture();await f.ask({question:'What alternatives?',assistantMode:'specialist-v1'});const prompt=f.prompts[0];assert.match(prompt,/hypothesis testing/);assert.match(prompt,/A saved invoice description/);assert.match(prompt,/Saved analyst proposal/);assert.match(prompt,/proposedRelationships/);assert.match(prompt,/sourcesCurrent":true/);assert(f.queries.some(s=>s.includes('FROM secure_cdr_expert_boards_v')));
});
test('original detective requests retain their previous context; first cut uses the specialist role only when selected',async()=>{
 const old=expertFixture();await old.ask({question:'What is here?'});assert(!old.prompts[0].includes('savedBoard'));assert(!old.queries.some(s=>s.includes('FROM secure_cdr_expert_boards_v')));
 const first=expertFixture();await first.ask({assistantMode:'specialist-v1'},'statewide_admin','/batches/:id/expert/first-cut');assert.match(first.prompts[0],/Reasons it may be wrong/);
});
test('detective prerequisites and permissions stop all model calls',async()=>{
 const missing=expertFixture({current:false});await assert.rejects(missing.ask({question:'Explain',assistantMode:'specialist-v1'}),e=>e.status===409);assert.equal(missing.prompts.length,0);
 const viewer=expertFixture();await assert.rejects(viewer.ask({question:'Explain',assistantMode:'specialist-v1'},'read_only_viewer'),e=>e.status===403);assert.equal(viewer.prompts.length,0);assert.equal(viewer.queries.length,0);
});
test('batch chat persists its specialist mode with the queued input and leaves original inputs unchanged',async()=>{
 const inserted=[];
 const workspace=load('data-room-workspace',{'./embeddings':{},'./data-room-learning':{currentSnapshot:async()=>snapshot,learningDetail:async()=>({result:{title:'Invoice batch'},isCurrent:true,run:{run_id:'brief'}})}});
 const c={commit:async()=>{},execute:async(sql,b)=>{
  if(sql.startsWith('SELECT batch_id FROM secure_cdr_batches_v'))return {rows:[{BATCH_ID:'B'}]};
  if(sql.includes('FOR UPDATE'))return {rows:[]};
  if(sql.startsWith('SELECT thread_id FROM secure_cdr_chat_threads_v'))return {rows:[{THREAD_ID:'T'}]};
  if(sql.startsWith('SELECT COUNT(*) n'))return {rows:[{N:0}]};
  if(sql.startsWith('SELECT question,result_json')||sql.includes('FROM cdr_workspace_runs WHERE'))return {rows:[]};
  if(sql.startsWith('INSERT INTO cdr_workspace_runs')){inserted.push(JSON.parse(b.input.val));return {rowsAffected:1};}
  throw Error(sql);
 }};
 const w=workspace.createWorkspace(async(user,fn)=>fn(c));
 await w.queue('B','statewide_admin','chat','T','Find sources','specialist-v1');
 await w.queue('B','statewide_admin','chat','T','Find sources');
 assert.equal(inserted[0].assistantMode,'specialist-v1');assert(!('assistantMode' in inserted[1]));
 await assert.rejects(w.queue('B','statewide_admin','chat','T','Find sources','unknown'),e=>e.status===400);
});
