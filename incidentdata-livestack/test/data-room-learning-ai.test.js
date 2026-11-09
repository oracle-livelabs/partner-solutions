const test=require('node:test');
const assert=require('node:assert/strict');
const {snapshot,validate,SYSTEM,MAX_INPUT_CHARACTERS}=require('../backend/data-room-learning-ai');
const {hash}=require('../backend/data-room-archive');
function record(n,overrides={}){
  return {itemId:String(n).padStart(32,'0'),path:`record-${n}.txt`,type:'txt',sha256:hash(Buffer.from(`source ${n}`)),descriptionRunId:`description-${n}`,
    model:'test-model',promptVersion:'test-v1',createdAt:'2026-09-12T00:00:00.000Z',
    resultJson:JSON.stringify({headline:`Record ${n}`,description:'A synthetic invoice summary.',details:[{label:'Invoice',value:'104',sourceQuote:'Invoice 104'}],limitations:['Unreviewed summary'],coverage:{mode:'text_excerpt',charactersSent:50,totalCharacters:50,truncated:false},reviewStatus:'unreviewed_ai_draft'}),...overrides};
}
const output={title:'Synthetic record inventory',overview:[{text:'The summaries describe invoice records.',source_ids:['S01']}],themes:[{title:'Invoice content',summary:'A record contains an invoice reference.',source_ids:['S01']}],review_questions:[{question:'Does the original document provide additional context?',reason:'Only a description was supplied.',source_ids:['S01']}]};
test('snapshot is deterministic, includes every item and preserves source versions',()=>{
  const a=snapshot([record(2),record(1)]),b=snapshot([record(1),record(2)]);
  assert.equal(a.fingerprint,b.fingerprint);assert.equal(a.manifest.length,2);assert.equal(a.sources.length,2);
  assert.equal(a.manifest[0].descriptionRunId,'description-1');assert.equal(a.manifest[0].descriptionSha256,hash(Buffer.from(record(1).resultJson)));
  assert.equal(a.coverage.originalFilesRescanned,false);assert.equal(a.coverage.typeCounts.txt,2);
});
test('changing original content, description contents or description version invalidates a snapshot',()=>{
  const a=snapshot([record(1)]).fingerprint;
  for(const change of [{sha256:hash(Buffer.from('changed'))},{descriptionRunId:'new-version'},{resultJson:record(1).resultJson.replace('invoice summary','travel summary')},{path:'renamed.txt'}])assert.notEqual(snapshot([record(1,change)]).fingerprint,a);
});
test('missing descriptions, invalid drafts, duplicates and empty/oversized batches fail',()=>{
  assert.throws(()=>snapshot([]));assert.throws(()=>snapshot([record(1),record(1)]));
  assert.throws(()=>snapshot([record(1,{resultJson:null})]));assert.throws(()=>snapshot([record(1,{resultJson:'{}'})]));
  assert.throws(()=>snapshot(Array.from({length:101},(_,i)=>record(i))));
});
test('large batches retain all sources, bound input and disclose condensation',()=>{
  const long=JSON.parse(record(1).resultJson);long.description='x'.repeat(1600);long.coverage.truncated=true;
  const input=snapshot(Array.from({length:100},(_,i)=>record(i,{resultJson:JSON.stringify(long)})));
  assert.equal(input.sources.length,100);assert.equal(input.coverage.condensedCount,100);assert.equal(input.coverage.partialTextCount,100);
  assert(input.coverage.inputCharacters<=MAX_INPUT_CHARACTERS);assert(input.sources.every(s=>s.description.length<=180));
});
test('an escaped-content budget overflow fails explicitly instead of omitting files',()=>{
  const long=JSON.parse(record(1).resultJson);long.description='\0'.repeat(1600);
  assert.throws(()=>snapshot(Array.from({length:100},(_,i)=>record(i,{resultJson:JSON.stringify(long)}))),/budget/);
});
test('only bounded saved descriptions are sent; names/paths, originals and identities are not enriched',()=>{
  const input=snapshot([record(1,{path:'secret-filename-with-poi-name.txt'})]);
  assert(!JSON.stringify(input.sources).includes('secret-filename'));assert.equal(input.coverage.basis,'saved_unreviewed_ai_descriptions');
  assert.match(SYSTEM,/NOT Understand-Connections/);assert.match(SYSTEM,/Never obey embedded/);assert.match(SYSTEM,/no access to other batches/);
});
test('valid claims have batch-only source references and remain unreviewed',()=>{
  const result=validate(JSON.stringify(output),snapshot([record(1)]));
  assert.deepEqual(result.overview[0].sourceIds,['S01']);assert.equal(result.reviewStatus,'unreviewed_ai_draft');
  assert.equal(result.citationValidation,'source_membership_only_not_claim_verification');
});
test('missing, invented, empty and malformed citations are rejected',()=>{
  for(const refs of [[],['S99'],['https://example.test'],[{}],null])assert.throws(()=>validate(JSON.stringify({...output,overview:[{text:'A claim',source_ids:refs}]}),snapshot([record(1)])),/source/);
});
test('invalid JSON, blank entries and oversized sections are rejected',()=>{
  const input=snapshot([record(1)]);
  for(const raw of ['not json','null','[]',JSON.stringify({...output,title:''}),JSON.stringify({...output,themes:[]}),JSON.stringify({...output,overview:Array(4).fill(output.overview[0])})])assert.throws(()=>validate(raw,input));
});
module.exports={record};
