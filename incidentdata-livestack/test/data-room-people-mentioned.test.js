'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {inputFromItems,validate,loadInput,peopleCapability,registerPeopleMentioned,SCHEMA}=require('../backend/data-room-people-mentioned');
const text='Mara Bell, a middle-aged female witness, spoke to an unnamed senior male driver.';
const item=(id='one',value=text)=>({ITEM_ID:id,ORIGINAL_PATH:id+'.txt',CONTENT_TYPE:'txt',SHA256:id+'-hash',BYTE_COUNT:Buffer.byteLength(value),PREFIX:Buffer.from(value)});
const empty=()=>({value:'',quote:''});
const person=(sourceRef='S01')=>({sourceRef,mentionQuote:text,name:{value:'Mara Bell',quote:text},gender:{value:'female',quote:text},age:{value:'middle-aged',quote:text},role:{value:'witness',quote:text}});
test('provider schema avoids the Gemini array complexity failure while local validation caps mentions',()=>{
 assert.equal(SCHEMA.properties.people.maxItems,undefined);
 assert.throws(()=>validate(JSON.stringify({people:Array.from({length:61},()=>person())}),inputFromItems([item()])),/Invalid people list/);
});
test('text-only sources enable people discovery and partial coverage is explicit',()=>{
 assert.equal(peopleCapability([item()],'ready').available,true);
 assert.equal(peopleCapability([{CONTENT_TYPE:'png'}],'ready').available,false);
 const data=inputFromItems([...Array.from({length:5},(_,i)=>item(String(i),'a'.repeat(30000))),{ITEM_ID:'photo',CONTENT_TYPE:'jpg',ORIGINAL_PATH:'scene.jpg'}]);
 assert.equal(data.sources.reduce((n,s)=>n+s.text.length,0),80000);assert(data.coverage.some(s=>s.truncated));assert(data.coverage.some(s=>s.reason==='Combined text limit reached.'));assert.equal(data.coverage.at(-1).basis,'excluded');
});
test('named and unnamed people retain only quoted attributes and stay separate across sources',()=>{
 const input=inputFromItems([item(),item('two')]);
 const unnamed={sourceRef:'S01',mentionQuote:'an unnamed senior male driver',name:empty(),gender:{value:'male',quote:'senior male driver'},age:{value:'senior',quote:'senior male driver'},role:{value:'driver',quote:'senior male driver'}};
 const result=validate(JSON.stringify({people:[person(),unnamed,person('S02')]}),input);
 assert.equal(result.people.length,3);assert.equal(result.people[1].attributes.name,null);assert.match(result.people[1].label,/Unnamed/);assert.notEqual(result.people[0].id,result.people[2].id);
});
test('invented identities, demographics, citations and paraphrased quotes fail validation',()=>{
 const input=inputFromItems([item()]);
 for(const change of [{sourceRef:'S99'},{mentionQuote:'Invented mention'},{gender:{value:'nonbinary',quote:text}},{gender:{value:'male',quote:'female witness'}},{age:{value:'middle aged',quote:'Mara Bell, a middle aged female witness'}}])assert.throws(()=>validate(JSON.stringify({people:[{...person(),...change}]}),input));
 assert.throws(()=>validate(JSON.stringify({people:[person(),person()]}),input),/Duplicate/);
 assert.deepEqual(validate('{"people":[]}',input),{people:[]});
});
test('transcript versions affect freshness and images never become people evidence',()=>{
 const audio={ITEM_ID:'audio',ORIGINAL_PATH:'voice.m4a',CONTENT_TYPE:'m4a',SHA256:'audio',TRANSCRIPT:{text,transcriptSha256:'v1'}};
 const first=inputFromItems([audio]);assert.equal(first.sources[0].basis,'unreviewed_machine_transcript');
 assert.notEqual(first.fingerprint,inputFromItems([{...audio,TRANSCRIPT:{text,transcriptSha256:'v2'}}]).fingerprint);
 assert.equal(inputFromItems([{...audio,TRANSCRIPT:null}]).sources.length,0);
});
test('batch scope is checked before content is read',async()=>{
 const queries=[];await assert.rejects(loadInput({execute:async sql=>{queries.push(sql);return {rows:[]};}},'hidden'),e=>e.status===404);assert.equal(queries.length,1);
});
function fixture({changed=false}={}){
 const routes=new Map();let reads=0,calls=0;
 const db=async(user,fn)=>fn({execute:async sql=>sql.includes('secure_cdr_batches_v')?{rows:[{BATCH_ID:'B',STATUS:'ready'}]}:sql.includes('secure_persons_of_interest_v')?{rows:[{PERSON_REF:'P1',DISPLAY_NAME:'Mara Bell',PORTRAIT_ASSET_URI:'/poi/mara.jpg'}]}:{rows:[item('one',changed&&++reads>1?'Different text':text)]}});
 registerPeopleMentioned({get:(p,fn)=>routes.set('GET',fn),post:(p,fn)=>routes.set('POST',fn)},db,fn=>fn,async options=>{calls++;return options.validate(JSON.stringify({people:[person()]}));});
 return {routes,get calls(){return calls;}};
}
test('read-only users cannot invoke extraction; GET never invokes a model',async()=>{
 const f=fixture(),res={set(){},json(r){this.body=r;}};
 await assert.rejects(f.routes.get('POST')({demoUser:'read_only_viewer',params:{id:'B'}},res),e=>e.status===403);
 await f.routes.get('GET')({demoUser:'statewide_admin',params:{id:'B'}},res);assert.equal(f.calls,0);assert.equal(res.body.sources.length,1);assert(!('text' in res.body.sources[0]));
});
test('extraction rechecks source freshness before returning its result',async()=>{
 const res={set(){},json(r){this.body=r;}},req={demoUser:'statewide_admin',params:{id:'B'}};
 const f=fixture();await f.routes.get('POST')(req,res);assert.equal(res.body.people.length,1);assert.equal(res.body.people[0].poi.person_ref,'P1');assert.equal(res.body.people[0].mentions.length,1);assert.equal(res.body.mentionCount,1);assert.equal(f.calls,1);
 const stale=fixture({changed:true});await assert.rejects(stale.routes.get('POST')(req,res),e=>e.status===409);
});

test('repeat names group across sources while each quote and attribute stays with its source',()=>{
 const {groupPeople}=require('../backend/data-room-people-mentioned');
 const mentions=validate(JSON.stringify({people:[person(),person('S02')]}),inputFromItems([item(),item('two')])).people;
 const grouped=groupPeople(mentions);
 assert.equal(grouped.length,1);assert.equal(grouped[0].mentions.length,2);
 assert.deepEqual(grouped[0].mentions,mentions);
 assert.equal(groupPeople([{...mentions[0],attributes:{...mentions[0].attributes,name:{value:'MARA  BELL'}}},mentions[1]]).length,1);
});
test('unique registered names and aliases share a card and reuse the register portrait',()=>{
 const {groupPeople}=require('../backend/data-room-people-mentioned');
 const mentions=validate(JSON.stringify({people:[person(),person('S02')]}),inputFromItems([item(),item('two')])).people;
 mentions[1].attributes.name={value:'M. Bell',quote:'M. Bell'};
 const profile={person_ref:'P1',display_name:'Mara Bell',alias_name:'M. Bell',portrait_asset_uri:'/poi/mara.jpg'};
 const [card]=groupPeople(mentions,[profile]);
 assert.equal(card.mentions.length,2);assert.equal(card.poi.portrait_asset_uri,'/poi/mara.jpg');assert.equal(card.poiCandidates.length,1);
 assert.equal(card.groupingBasis,'registered_name_or_alias');
});
test('ambiguous register matches never choose a portrait and unnamed people never collapse',()=>{
 const {groupPeople}=require('../backend/data-room-people-mentioned');
 const [mention]=validate(JSON.stringify({people:[person()]}),inputFromItems([item()])).people;
 const profiles=[{person_ref:'P1',display_name:'Mara Bell'},{person_ref:'P2',alias_name:'Mara Bell'}];
 const [card]=groupPeople([mention],profiles);assert.equal(card.poi,null);assert.equal(card.poiCandidates.length,2);
 const unnamed=id=>({...mention,id,attributes:{...mention.attributes,name:null}});
 assert.equal(groupPeople([unnamed('u1'),unnamed('u2')],profiles).length,2);
 assert.equal(groupPeople([{...mention,attributes:{...mention.attributes,name:{value:'Mara'}}}],profiles)[0].poi,null);
});

test('unsupported optional attributes are omitted without discarding exact person mentions',()=>{
 const input=inputFromItems([item()]),draft=person();
 draft.role={value:'participant',quote:'Mara Bell'};
 draft.gender={value:'male',quote:'female witness'};
 const result=validate(JSON.stringify({people:[draft]}),input,{omitUnsupportedAttributes:true});
 assert.equal(result.people.length,1);assert.equal(result.people[0].attributes.name.value,'Mara Bell');
 assert.equal(result.people[0].attributes.role,null);assert.equal(result.people[0].attributes.gender,null);
 assert.equal(result.warnings.length,2);assert.equal(result.warnings[0].sourceRef,'S01');
 assert.throws(()=>validate(JSON.stringify({people:[{...draft,mentionQuote:'invented person'}]}),input,{omitUnsupportedAttributes:true}),/mention quote/);
 assert.throws(()=>validate(JSON.stringify({people:[{...draft,sourceRef:'S99'}]}),input,{omitUnsupportedAttributes:true}),/mention quote/);
});
test('unsupported names cannot be used for grouping or POI matches during attribute recovery',()=>{
 const {groupPeople}=require('../backend/data-room-people-mentioned'),draft=person();draft.name={value:'Invented Name',quote:text};
 const result=validate(JSON.stringify({people:[draft]}),inputFromItems([item()]),{omitUnsupportedAttributes:true});
 const [card]=groupPeople(result.people,[{person_ref:'P1',display_name:'Invented Name'}]);
 assert.equal(card.poi,null);assert.equal(card.mentions[0].attributes.name,null);assert.match(card.label,/Unnamed/);
});

test('run usage counts failed attempts and provider totals without adding reasoning twice',()=>{
 const {runUsage,generationError}=require('../backend/data-room-people-mentioned');
 const result=runUsage({attempts:[{status:'failed',elapsedMs:10,usage:{promptTokens:100,completionTokens:10,completionTokensDetails:{reasoningTokens:90},totalTokens:200}},{status:'complete',elapsedMs:20,usage:{promptTokens:100,completionTokens:30,completionTokensDetails:{reasoningTokens:70},totalTokens:200}}]});
 assert.deepEqual(result,{attempts:2,retries:1,elapsedMs:30,tokenStatus:'measured',inputTokens:200,outputTokens:40,reasoningTokens:160,totalTokens:400});
 assert.equal(runUsage({attempts:[{}]}).totalTokens,null);
 assert.equal(runUsage({attempts:[{}, {usage:{totalTokens:10}}]}).tokenStatus,'partial');
 assert.match(generationError(Error('Output truncated at the token limit')),/output limit/);
});
test('model failures return a specific error, trace and measured usage',async()=>{
 const routes=new Map(),o=require('../backend/ai-ops-telemetry');
 const db=async(user,fn)=>fn({execute:async sql=>sql.includes('secure_cdr_batches_v')?{rows:[{STATUS:'ready'}]}:{rows:[item()]}});
 registerPeopleMentioned({get(){},post:(p,fn)=>routes.set('POST',fn)},db,fn=>fn,async options=>{
  assert.equal(options.maxTokens,32768);assert.equal(options.maxTokenCap,32768);assert.equal(options.deadlineMs,180000);
  throw Object.assign(Error('Output truncated at the token limit'),{generation:{attempts:[{status:'failed',elapsedMs:123,usage:{totalTokens:200}}]}});
 });
 const res={set(){},status(code){this.code=code;return this;},json(body){this.body=body;}};
 await o.context({traceId:'test-trace'},()=>routes.get('POST')({demoUser:'statewide_admin',params:{id:'B'}},res));
 assert.equal(res.code,502);assert.match(res.body.error,/output limit/);assert.equal(res.body.traceId,'test-trace');assert.equal(res.body.usage.totalTokens,200);assert.equal(res.body.llm.operationId,'cdr.people.mentioned');
});

test('a bad mention quote uses only an independently verified name excerpt and retains other people',()=>{
 const input=inputFromItems([item()]),draft={...person(),mentionQuote:'Paraphrased statement about Mara'};
 const result=validate(JSON.stringify({people:[draft]}),input,{omitUnsupportedAttributes:true,recoverMentions:true});
 assert.equal(result.people.length,1);assert.equal(result.people[0].mentionQuote,text);assert.match(result.warnings[0].reason,/verified name excerpt/);
 const unsupported={...draft,name:{value:'Invented Name',quote:'Invented Name'}};
 const partial=validate(JSON.stringify({people:[person(),unsupported]}),input,{omitUnsupportedAttributes:true,recoverMentions:true});
 assert.equal(partial.people.length,1);assert.match(partial.warnings[0].reason,/mention omitted/);
 assert.equal(partial.people[0].attributes.name.value,'Mara Bell');
 const anonymous=validate(JSON.stringify({people:[{...draft,name:empty()}]}),input,{recoverMentions:true});
 assert.equal(anonymous.people.length,0);assert.equal(anonymous.warnings.length,1);
});
test('duplicate extraction mentions combine without retrying the entire batch',()=>{
 const input=inputFromItems([item()]);
 const result=validate(JSON.stringify({people:[person(),person()]}),input,{recoverMentions:true});
 assert.equal(result.people.length,1);assert.match(result.warnings[0].reason,/Duplicate/);
});
test('registered POI_IDENTIFIERS aliases match with their validity and every supporting source',()=>{
 const {groupPeople}=require('../backend/data-room-people-mentioned');
 const mentions=validate(JSON.stringify({people:[person(),person('S02')]}),inputFromItems([item(),item('two')])).people;
 mentions[1].attributes.name={value:'Amber Finch',quote:'Amber Finch'};
 const profile={person_ref:'P1',display_name:'Mara Bell',alias_name:'Bell',portrait_asset_uri:'/poi/mara.jpg',registered_aliases:[{value:'Amber Finch',reviewStatus:'declared',validFrom:'2025-10-23T18:16:43.000Z',validTo:'2026-04-11T07:56:07.000Z',registerSource:'synthetic:test'}]};
 const [card]=groupPeople(mentions,[profile]);
 assert.equal(card.mentions.length,2);assert.equal(card.poi.person_ref,'P1');assert.equal(card.groupingBasis,'registered_name_or_alias');
 assert(!('registered_aliases' in card.poi));
 assert.deepEqual(card.poi.matches.map(m=>[m.basis,m.value,m.foundIn]),[['display_name','Mara Bell',['S01']],['registered_alias','Amber Finch',['S02']]]);
 assert.equal(card.poi.matches[1].validTo,'2026-04-11T07:56:07.000Z');
});
test('a registered alias identical to the primary alias is reported once, with its register detail',()=>{
 const {groupPeople}=require('../backend/data-room-people-mentioned');
 const [mention]=validate(JSON.stringify({people:[person()]}),inputFromItems([item()])).people;
 mention.attributes.name={value:'Skids',quote:'Skids'};
 const [card]=groupPeople([mention],[{person_ref:'P1',display_name:'Tony Kapoor',alias_name:'Skids',registered_aliases:[{value:'Skids',reviewStatus:'declared',validFrom:'2026-04-07T05:47:56.000Z',validTo:null}]}]);
 assert.deepEqual(card.poi.matches.map(m=>m.basis),['registered_alias']);
});
test('a registered alias shared by two POIs lists both candidates without choosing a portrait',()=>{
 const {groupPeople}=require('../backend/data-room-people-mentioned');
 const [mention]=validate(JSON.stringify({people:[person()]}),inputFromItems([item()])).people;
 mention.attributes.name={value:'Eli',quote:'Eli'};
 const alias={value:'Eli',reviewStatus:'declared'};
 const [card]=groupPeople([mention],[{person_ref:'P1',display_name:'Elias Grant',registered_aliases:[alias]},{person_ref:'P2',display_name:'Eli Moss',alias_name:'Eli',registered_aliases:[]}]);
 assert.equal(card.poi,null);assert.deepEqual(card.poiCandidates.map(c=>[c.person_ref,c.matches[0].basis]),[['P1','registered_alias'],['P2','primary_alias']]);
});
test('only declared or confirmed alias identifiers are loaded for matching',async()=>{
 const routes=new Map(),queries=[];
 const db=async(user,fn)=>fn({execute:async sql=>{queries.push(sql);return sql.includes('secure_cdr_batches_v')?{rows:[{STATUS:'ready'}]}:sql.includes('secure_poi_identifiers_v')?{rows:[{PERSON_REF:'P1',IDENTIFIER_VALUE:'Amber Finch',REVIEW_STATUS:'declared',SOURCE_REF:'s'}]}:sql.includes('secure_persons_of_interest_v')?{rows:[{PERSON_REF:'P1',DISPLAY_NAME:'Profile Alder'}]}:{rows:[item()]};}});
 registerPeopleMentioned({get(){},post:(p,fn)=>routes.set('POST',fn)},db,fn=>fn,async options=>options.validate(JSON.stringify({people:[{...person(),name:{value:'Mara Bell',quote:'Mara Bell'}}]})));
 const res={set(){},json(r){this.body=r;}};
 await routes.get('POST')({demoUser:'statewide_admin',params:{id:'B'}},res);
 const sql=queries.find(q=>q.includes('secure_poi_identifiers_v'));
 assert.match(sql,/identifier_type='alias'/);assert.match(sql,/review_status IN \('declared','confirmed'\)/);
});
