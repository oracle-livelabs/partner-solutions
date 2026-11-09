const test=require('node:test');
const assert=require('node:assert/strict');
const {createDescriptionWorker}=require('../backend/data-room-descriptions');
function fixture({visible=true,pending=2,stage='pending',active=null}={}) {
 const inserts=[];
 const c={commit:async()=>{},execute:async(sql,binds)=>{
  if(sql.startsWith('SELECT batch_id,status,file_count'))return {rows:visible?[{BATCH_ID:'B',STATUS:'ready',FILE_COUNT:2}]:[]};
  if(sql.includes('FOR UPDATE'))return {rows:[]};
  if(sql.startsWith('SELECT run_id,status'))return {rows:active?[{RUN_ID:active,STATUS:'running'}]:[]};
  if(sql.startsWith('SELECT COUNT(*) n'))return {rows:[{N:pending}]};
  if(sql.startsWith('SELECT status FROM secure_cdr_stages'))return {rows:[{STATUS:stage}]};
  if(sql.startsWith('INSERT INTO cdr_ai_runs')){inserts.push(binds);return {rowsAffected:1};}
  if(sql.startsWith('UPDATE cdr_stages'))return {rowsAffected:1};
  if(sql.startsWith('SELECT * FROM cdr_ai_runs'))return {rows:[]};
  throw new Error(`Unexpected SQL: ${sql}`);
 }};
 return {worker:createDescriptionWorker(async(user,fn)=>fn(c)),inserts};
}
test('read-only and invisible batches cannot enqueue descriptions',async()=>{
 await assert.rejects(fixture().worker.queue('B','read_only_viewer'),e=>e.status===403);
 await assert.rejects(fixture({visible:false}).worker.queue('B','northern_analyst'),e=>e.status===404);
});
test('an active run is reused instead of enqueuing duplicate inference',async()=>{
 const f=fixture({active:'existing-run'});assert.deepEqual(await f.worker.queue('B','statewide_admin'),{runId:'existing-run',status:'running'});assert.equal(f.inserts.length,0);
});
test('retry schedules only the missing count and pins model provenance',async()=>{
 const f=fixture({pending:1});await f.worker.queue('B','statewide_admin');
 assert.equal(f.inserts[0].total,1);assert.equal(f.inserts[0].usr,'statewide_admin');assert(f.inserts[0].textModel);assert(f.inserts[0].imageModel);assert(f.inserts[0].version);
});
test('completed stages cannot be recharged, but failed finalisation can be repaired without inference',async()=>{
 await assert.rejects(fixture({pending:0,stage:'complete'}).worker.queue('B','statewide_admin'),e=>e.status===409);
 const f=fixture({pending:0,stage:'failed'});await f.worker.queue('B','statewide_admin');assert.equal(f.inserts[0].total,0);
});
