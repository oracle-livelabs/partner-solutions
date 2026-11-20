'use strict';
// Read-only by default. --build explicitly builds/reuses this one synthetic batch.
const assert=require('node:assert/strict');
const {normalize,hash,VERSION}=require('../backend/data-room-messages-model');
const batchId='DR-20260929-94b1c772-d24d-4813',base='http://127.0.0.1:8706/api/data-room';
async function request(path,options={},user='statewide_admin'){
 const r=await fetch(base+path,{...options,headers:{'X-Demo-User':user}});
 return {status:r.status,data:await r.json()};
}
async function get(path){const r=await request(path);assert.equal(r.status,200);return r.data;}
async function fixture(){
 const before=await get(`/batches/${batchId}`);assert.equal(before.batch.filename,'RedDirt_LargeTotal.zip');assert.equal(before.batch.status,'ready');
 const inputs=[],originals=new Map();
 for(const item of before.items){
  const r=await fetch(`${base}/batches/${batchId}/items/${item.item_id}/download`,{headers:{'X-Demo-User':'statewide_admin'}});assert.equal(r.status,200);
  const bytes=Buffer.from(await r.arrayBuffer());assert.equal(hash(bytes),item.sha256);originals.set(item.item_id,bytes.toString('utf8'));
  inputs.push({ITEM_ID:item.item_id,ORIGINAL_PATH:item.original_path,CONTENT_TYPE:item.content_type,SHA256:item.sha256,CONTENT_BLOB:bytes});
 }
 inputs.sort((a,b)=>a.ITEM_ID.localeCompare(b.ITEM_ID));
 const parsed=normalize(inputs),expected=inputs.reduce((n,i)=>n+[...i.CONTENT_BLOB.toString('utf8').matchAll(/^(?:\*\*)?\[[^\]\r\n]+\](?:\*\*)?[ \t]*\r?$/gm)].length,0);
 assert.equal(parsed.messages.length,expected);assert.equal(expected,160);assert.equal(parsed.skipped.length,0);
 for(const m of parsed.messages){const original=originals.get(m.source.itemId);assert.equal(original.slice(m.source.start,m.source.end),m.text);assert.equal(original.slice(m.source.blockStart,m.source.blockEnd),m.raw);}
 return {before,parsed,originals};
}
async function main(){
 const {before,parsed,originals}=await fixture(),stem=`/batches/${batchId}`,money=await get(stem+'/money-flows');
 if(process.argv.includes('--build')){const b=await request(stem+'/messages',{method:'POST'});assert.equal(b.status,200);}
 const graph=await get(stem+'/messages');assert.equal(graph.run?.version,VERSION);assert.equal(graph.stale,false);
 assert.deepEqual(graph.counts,{threads:17,participants:4,messages:160,participations:52,directMessages:0});assert.equal(graph.links.length,52);assert.equal(graph.sources.length,17);assert.deepEqual(graph.skipped,[]);
 assert.deepEqual(graph.participants,parsed.participants);
 let verified=0;
 for(const t of graph.threads){
  const r=await get(stem+`/messages/threads/${t.id}?runId=${graph.run.id}`);assert.equal(r.order,'source');assert.equal(r.messages.length,t.messageCount);
  for(const m of r.messages){const original=originals.get(m.source.itemId);assert.equal(original.slice(m.source.start,m.source.end),m.text);assert.equal(original.slice(m.source.blockStart,m.source.blockEnd),m.raw);assert.equal(m.time.utc,null);assert.deepEqual(m,parsed.messages.find(p=>p.id===m.id));verified++;}
 }
 const sample=parsed.messages[0],q=sample.text.slice(0,30),hits=parsed.messages.filter(m=>m.text.toLowerCase().includes(q.toLowerCase()));
 const search=await get(stem+'/messages?q='+encodeURIComponent(q));assert.equal(search.matchCount,hits.length);
 const context=await get(stem+`/messages/threads/${sample.threadId}?q=${encodeURIComponent(q)}`);assert.equal(context.messages.length,parsed.messages.filter(m=>m.threadId===sample.threadId).length);assert.equal(context.matches.length,hits.filter(m=>m.threadId===sample.threadId).length);
 if(process.argv.includes('--build')){const reused=await request(stem+'/messages',{method:'POST'});assert.equal(reused.data.runId,graph.run.id);assert.equal(reused.data.reused,true);}
 assert.equal((await request(stem+'/messages',{method:'POST'},'read_only_viewer')).status,403);
 for(const path of [stem+'/messages',stem+`/messages/threads/${sample.threadId}`,stem+'/capabilities'])assert.equal((await request(path,{},'northern_analyst')).status,404);
 const caps=await get(stem+'/capabilities'),cap=caps.capabilities.find(c=>c.id==='messages');assert.equal(cap.status,'results');assert.equal(cap.coverage.recognisedSources,17);assert.equal(cap.snapshot.id,graph.run.id);
 assert.deepEqual(await get(stem),before);assert.deepEqual(await get(stem+'/money-flows'),money);
 console.log(JSON.stringify({batchId,runId:graph.run.id,version:VERSION,counts:graph.counts,verifiedOriginalMessages:verified,skipped:0,searchWithContext:'passed',scopeChecks:'passed',sourcesStagesDescriptionsAndMoney:'unchanged'}));
}
module.exports={fixture,request,get,batchId};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
