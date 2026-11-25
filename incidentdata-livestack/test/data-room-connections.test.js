'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildGraph,csv}=require('../backend/data-room-connections');
const {validateAnswer}=require('../backend/data-room-workspace');
const items=[{itemId:'a',ref:'S1',path:'one.txt',type:'txt',sourceSha256:'a',originalText:'😀 DEMO-P01 on 2026-09-10.'},{itemId:'b',ref:'S2',path:'two.csv',type:'csv',sourceSha256:'b',originalText:'DEMO-P01,2026-09-10'},{itemId:'c',ref:'S3',path:'eve-philip-gallery.png',type:'png',sourceSha256:'c'}];
test('literal connections cite exact original offsets and never infer a named person',()=>{
  const g=buildGraph(items);assert.equal(g.edges.length,4);assert.equal(g.timeline.length,1);
  for(const e of g.edges){const item=items.find(i=>i.itemId===e.source);assert.equal(item.originalText.slice(e.quote.start,e.quote.end),e.quote.quote);}
  assert(!g.nodes.some(n=>n.kind==='declared_person'));
});
test('declared cast depends on known image bytes, never upload filename',()=>{
  const g=buildGraph(items,new Map([['c',[['POI-EVE','Eve']]]]));assert.equal(g.edges.filter(e=>e.kind==='declared_cast').length,1);
  const changed=buildGraph(items.map(i=>i.type==='png'?{...i,sourceSha256:'different'}:i),new Map([['c',[['POI-EVE','Eve']]]]));assert(!changed.edges.some(e=>e.kind==='declared_cast'));
});
test('similarities cannot create out-of-batch links and remain typed candidates',()=>{
  assert.throws(()=>buildGraph(items,new Map(),[{source:'a',target:'other-batch',score:.9}]),/Invalid/);
  const g=buildGraph(items,new Map(),[{source:'a',target:'b',modality:'text',score:.6}]);assert.equal(g.edges.at(-1).kind,'description_similarity');
});
test('exports quote fields and neutralise spreadsheet formulas',()=>{
  assert.equal(csv([['=SUM(1,2)','line\n"quote"','safe']]),'"\'=SUM(1,2)","line\n""quote""","safe"\r\n');
});
test('Select AI answers reject invented source references and empty output',()=>{
  assert.equal(validateAnswer('See [S1].',items),'See [S1].');
  assert.equal(validateAnswer('See [S1].',[{ref:'S01'}]),'See [S01].');
  assert.throws(()=>validateAnswer('See [S99].',items),/unknown/);assert.throws(()=>validateAnswer('',items),/empty/);
});
