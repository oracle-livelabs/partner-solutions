'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const real=require('../backend/data-room-board');
const snapshot={fingerprint:'fp',manifest:[{ref:'S01',path:'a.txt',descriptionRunId:'d1'},{ref:'S02',path:'b.txt',descriptionRunId:'d2'}],sources:[{source_id:'S01',description:'A saved source description for the first file.'},{source_id:'S02',description:'A saved source description for the second file.'}]};
function fixture({visible=true,current=true,archived=false,changeDuring=false}={}){
 const routes=new Map(),sql=[],updatedAt=new Date('2026-10-18T01:00:00Z');let modelCalls=0;
 const filename=path.resolve(__dirname,'../backend/data-room-expert.js'),m=new Module(filename,module),nativeRequire=m.require.bind(m);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
 m.require=id=>id==='./data-room-learning'?{currentSnapshot:async()=>({...snapshot,fingerprint:changeDuring&&modelCalls?'changed':'fp'}),learningDetail:async()=>({result:current?{title:'Brief'}:null,isCurrent:current})}:id==='./ai-ops-telemetry'?{context:async(meta,fn)=>fn()}:id==='./data-room-board'?{...real,generateSuggestions:async()=>{modelCalls++;return {summary:'Review required',suggestions:[],model:'fixture'};}}:nativeRequire(id);
 m._compile(fs.readFileSync(filename,'utf8'),filename);
 const c={execute:async query=>{sql.push(query);if(query.startsWith('SELECT batch_id'))return {rows:visible?[{BATCH_ID:'B'}]:[]};if(query.startsWith('SELECT summary_brief'))return {rows:[{SUMMARY_BRIEF:'Saved private summary',DETAILED_BRIEF:'Saved private details',EDGES_JSON:'[]',REVIEW_STATUS:archived?'archived':'draft',SOURCE_FINGERPRINT:'fp',UPDATED_AT:updatedAt}]};if(query.startsWith('SELECT updated_at'))return {rows:[{UPDATED_AT:updatedAt}]};throw Error(query);}};
 m.exports.registerExpert({get(){},put(){},post:(url,handler)=>routes.set(url,handler)},async(user,fn)=>fn(c),fn=>fn);
 const request=async(user='statewide_admin',body={expectedSourceFingerprint:'fp',expectedUpdatedAt:updatedAt.toISOString()})=>{let result;await routes.get('/batches/:id/expert/board/suggestions')({demoUser:user,params:{id:'B'},body},{set(){},json:r=>{result=r;}});return result;};
 return {request,sql,get calls(){return modelCalls;}};
}
test('suggestion route reads a scoped private board and never saves relationships',async()=>{const f=fixture(),r=await f.request();assert.equal(f.calls,1);assert.equal(r.persisted,false);assert.deepEqual(r.suggestions,[]);assert(f.sql.every(s=>s.startsWith('SELECT')));assert(f.sql.some(s=>s.includes('secure_cdr_expert_boards_v')));});
test('hidden, read-only, unready, archived and changed-board requests never call the model',async()=>{
 for(const [options,user,body,status] of [[{visible:false},'statewide_admin',undefined,404],[{},'read_only_viewer',undefined,403],[{current:false},'statewide_admin',undefined,409],[{archived:true},'statewide_admin',undefined,409],[{},'statewide_admin',{expectedSourceFingerprint:'old',expectedUpdatedAt:'bad'},409]]){const f=fixture(options);await assert.rejects(f.request(user,body),e=>e.status===status);assert.equal(f.calls,0);}
});
test('a source change during inference rejects suggestions instead of making them available to accept',async()=>{const f=fixture({changeDuring:true});await assert.rejects(f.request(),e=>e.status===409);assert.equal(f.calls,1);assert(f.sql.every(s=>s.startsWith('SELECT')));});
test('structured generation uses a schema, bounded budget and exact excerpt validation',async()=>{
 let captured;const result=await real.generateSuggestions(snapshot,{title:'Brief'},{edges:[]},async options=>{captured=options;return options.validate('{"summary":"No supported link","suggestions":[]}');});assert.equal(captured.maxTokens,8192);assert.equal(captured.operationId,'cdr.board.suggestions');assert.equal(captured.schema.properties.suggestions.maxItems,5);assert(result.model);assert.deepEqual(result.suggestions,[]);assert.throws(()=>captured.validate('{"suggestions":['));
});
