'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {VERSION,validateBoard,validateSuggestions,suggestionPrompt}=require('../backend/data-room-board');
const snapshot={fingerprint:'fp',manifest:[{ref:'S01',path:'invoices.csv',itemId:'a',descriptionRunId:'d1'},{ref:'S02',path:'messages.txt',itemId:'b',descriptionRunId:'d2'}],sources:[{source_id:'S01',headline:'Invoice records',description:'Invoice 104 records a training payment.',details:[]},{source_id:'S02',headline:'Conversation export',description:'A message mentions invoice 104 and delivery.',details:[]}]};
const suggestion={from:'S01',to:'S02',label:'Possible invoice-reference overlap',basis:'The descriptions mention invoice 104.',uncertainty:'The invoice reference may be reused.',alternative:'The message could concern a different payment.',test:'Check the exact invoice reference in both original files.',support:[{sourceRef:'S01',quote:'Invoice 104 records a training payment.'},{sourceRef:'S02',quote:'A message mentions invoice 104 and delivery.'}]};
const existing={UPDATED_AT:new Date('2026-10-18T01:00:00Z'),EDGES_JSON:'[]'};
const payload=()=>({boardVersion:VERSION,expectedSourceFingerprint:'fp',expectedUpdatedAt:existing.UPDATED_AT.toISOString(),summaryBrief:'Private draft',detailedBrief:'Analyst review notes',nodes:snapshot.manifest.map(s=>({id:s.ref,label:'client cannot replace path'})),edges:[],reviewStatus:'draft'});
const edge=()=>({id:'e1',from:'S01',to:'S02',label:'Possible shared reference',basis:'Check invoice 104 in both originals.',uncertainty:'Descriptions may omit context.',alternative:'A reused reference.',test:'Compare source rows.',supportRefs:['S01','S02'],support:[],status:'proposed',reviewNote:'',origin:'analyst'});

test('suggestions require exact saved-description excerpts for both real endpoints',()=>{
 const result=validateSuggestions(JSON.stringify({summary:'Review originals.',suggestions:[suggestion]}),snapshot);assert.equal(result.suggestions.length,1);assert.equal(result.suggestions[0].status,'proposed');assert.equal(result.suggestions[0].support[0].descriptionRunId,'d1');assert.equal(result.suggestions[0].support[0].grounding,'saved_ai_description');assert.deepEqual(validateSuggestions('{"summary":"Insufficient support","suggestions":[]}',snapshot).suggestions,[]);
 for(const change of [{from:'S99'},{to:'S01'},{support:[suggestion.support[0],{sourceRef:'S02',quote:'An invented supporting quote.'}]},{support:[suggestion.support[0]]}])assert.throws(()=>validateSuggestions(JSON.stringify({suggestions:[{...suggestion,...change}]}),snapshot));
 assert.throws(()=>validateSuggestions(JSON.stringify({suggestions:[suggestion,suggestion]}),snapshot),/Duplicate/);assert.throws(()=>validateSuggestions('model prose',snapshot),e=>e.status===422);
});
test('suggestion prompt requests source-level hypotheses and permits no suggestions',()=>{
 const p=suggestionPrompt(snapshot,{title:'Brief'},{edges:[]});assert.match(p,/0–5/);assert.match(p,/Do not identify people/);assert.match(p,/exact 8–400 character quote/);assert.match(p,/untrusted data/);assert.match(p,/not external records/);
});
test('new board saves preserve every real source and reject silent truncation or invented endpoints',()=>{
 const p=payload();p.edges=[edge()];const result=validateBoard(p,snapshot,'central_analyst',existing);assert.equal(result.nodes[0].label,'invoices.csv');assert.equal(result.nodes[0].descriptionRunId,'d1');assert.equal(result.edges[0].status,'proposed');assert(!result.edges[0].reviewedBy);
 for(const change of [{nodes:[p.nodes[0]]},{nodes:[p.nodes[0],p.nodes[0]]},{edges:[{...edge(),to:'S99'}]},{edges:[edge(),{...edge(),id:'e2'}]}])assert.throws(()=>validateBoard({...p,...change},snapshot,'central_analyst',existing));
});
test('source changes and concurrent saves reject the new save before it can replace the board',()=>{
 assert.throws(()=>validateBoard({...payload(),expectedSourceFingerprint:'old'},snapshot,'central_analyst',existing),e=>e.status===409);assert.throws(()=>validateBoard({...payload(),expectedUpdatedAt:'2026-10-17T01:00:00Z'},snapshot,'central_analyst',existing),e=>e.status===409);
});
test('reviewed relationships need a rationale; reviewer metadata is set by the server',()=>{
 const p=payload();p.edges=[{...edge(),status:'reviewed',reviewedBy:'someone else',reviewedAt:'fake'}];assert.throws(()=>validateBoard(p,snapshot,'central_analyst',existing),/review note/);
 p.edges[0].reviewNote='Checked both original references; association remains a hypothesis.';const result=validateBoard(p,snapshot,'central_analyst',existing);assert.equal(result.edges[0].reviewedBy,'central_analyst');assert.notEqual(result.edges[0].reviewedAt,'fake');
 const prior={...existing,EDGES_JSON:JSON.stringify(result.edges)};p.edges=result.edges;assert.equal(validateBoard(p,snapshot,'statewide_admin',prior).edges[0].reviewedBy,'central_analyst');
});
test('accepted AI excerpts are revalidated against source versions when saving',()=>{
 const p=payload();p.edges=validateSuggestions(JSON.stringify({suggestions:[suggestion]}),snapshot).suggestions;const result=validateBoard(p,snapshot,'central_analyst',existing);assert.equal(result.edges[0].support.length,2);assert.equal(result.edges[0].origin,'ai_suggestion');
 p.edges[0].support[0].descriptionRunId='old-description';assert.throws(()=>validateBoard(p,snapshot,'central_analyst',existing),e=>e.status===409);
});
test('client draft validation blocks self-links and does not upgrade legacy proposals to reviewed',async()=>{
 const {normaliseEdges,validateDraft,sourceNodes}=await import('../frontend/src/source-board.mjs');const nodes=sourceNodes(snapshot.manifest);assert.equal(nodes.length,2);assert.equal(normaliseEdges([{from:'S01',to:'S02',label:'Legacy'}])[0].status,'proposed');assert.match(validateDraft({...edge(),to:'S01'},nodes),/different/);assert.match(validateDraft({...edge(),status:'reviewed',reviewNote:''},nodes),/review note/);assert.equal(validateDraft(edge(),nodes),'');
});
