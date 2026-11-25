const assert=require('node:assert/strict');
const batch='DR-20260913-e8c04a3b-ea5f-4fb2',base='http://127.0.0.1:8706/api/data-room';
async function call(path,body,user='statewide_admin'){
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'X-Demo-User':user,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};
}
(async()=>{
 const before=await call(`/batches/${batch}/workspace`);assert.equal(before.status,200);
 const source=await call(`/batches/${batch}`);assert.equal(source.status,200);
 const route=id=>`/batches/${batch}/items/${id}/poi-candidates`;
 const narrative=await call(route('b9d434e4e9df1cc2ccdb4a5307f7c961'),{mode:'narrative'});assert.equal(narrative.status,200,JSON.stringify(narrative.data));
 assert.equal(narrative.data.query.basis,'original_text_excerpt');assert.equal(narrative.data.candidates.length,3);
 const visual=await call(route('aa0b11d1b8b9285964d199e1d135f6f1'),{mode:'visual',region:{x:0.25,y:0.06,width:0.38,height:0.6}});assert.equal(visual.status,200,JSON.stringify(visual.data));
 assert.equal(visual.data.query.basis,'manual_scene_region');assert.match(visual.data.cropDataUrl,/^data:image\/png/);assert.equal(visual.data.candidates.length,3);
 assert.equal((await call(route('aa0b11d1b8b9285964d199e1d135f6f1'),{mode:'visual',region:{x:2,y:0,width:1,height:1}})).status,400);
 assert.equal((await call(route('b9d434e4e9df1cc2ccdb4a5307f7c961'),{mode:'narrative'},'read_only_viewer')).status,403);
 assert.equal((await call('/batches/not-this-batch/items/b9d434e4e9df1cc2ccdb4a5307f7c961/poi-candidates',{mode:'narrative'})).status,404);
 const after=await call(`/batches/${batch}/workspace`);assert.deepEqual(after.data,before.data);
 const sourceAfter=await call(`/batches/${batch}`);assert.deepEqual(sourceAfter.data,source.data);
 for(const r of [narrative,visual])assert.equal(new Set(r.data.candidates.map(p=>p.person_ref)).size,3);
 console.log(JSON.stringify({narrative:narrative.data.candidates.map(p=>({ref:p.person_ref,score:p.score})),visual:visual.data.candidates.map(p=>({ref:p.person_ref,score:p.score})),sourceAndGraphUnchanged:true,readOnlyAndCrossBatchBlocked:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
