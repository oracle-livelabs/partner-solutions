'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect,rows}=require('./evidence-intelligence/connection.cjs');
const {normalize,match}=require('../backend/poi-identifiers');
const {canonicalSourceRef}=require('../backend/poi-identifier-sources');
const root='/home/opc/scratch/poi-identifiers-quality-20261030';
const SOURCES={standard:'synthetic:city-poi-identifiers:v1:2026-10-20',curated:'synthetic:poi-profile-quality:v1:2026-10-29',proposed:'scenario-owner-chat:2026-10-20:additional-alias-examples',declared:'DR-20261020-68ed95d9-8383-401c:scenario-owner-chat'};
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
function note(row,person){
 assert(person,'Missing saved person for '+row.PERSON_REF);
 const who=person.DISPLAY_NAME;
 if(canonicalSourceRef(row.SOURCE_REF)===canonicalSourceRef(SOURCES.curated)){
  assert.equal(row.IDENTIFIER_TYPE,'alias');
  return `Alias ${row.IDENTIFIER_VALUE} listed for ${who}. Primary register alias: ${person.ALIAS_NAME}. This is a declared register association; it has not been independently established from messages or source evidence.`;
 }
 if(row.SOURCE_REF===SOURCES.proposed){
  assert.equal(row.IDENTIFIER_TYPE,'alias');assert.equal(row.REVIEW_STATUS,'proposed');
  return `Candidate alias ${row.IDENTIFIER_VALUE} supplied by the register owner for ${who}. Pending review; excluded from automatic matching.`;
 }
 if(row.SOURCE_REF===SOURCES.declared){
  assert.equal(row.IDENTIFIER_TYPE,'username');assert.equal(row.REVIEW_STATUS,'declared');
  return `The register owner associated account label ${row.IDENTIFIER_VALUE} with ${who}. Recorded as a declared association; independent account ownership and message authorship have not been established.`;
 }
 assert.equal(canonicalSourceRef(row.SOURCE_REF),canonicalSourceRef(SOURCES.standard),'Unknown provenance; review before rewriting');
 switch(row.IDENTIFIER_TYPE){
  case 'alias':return `Alias ${row.IDENTIFIER_VALUE} listed for ${who}. ${row.VALID_TO?'Retained as an earlier register entry; its validity has ended and it is excluded from current matching.':'Recorded as a declared association; independent use of the alias has not been established from source evidence.'}`;
  case 'username':return `Account label listed for ${who} under ${row.NAMESPACE}. No live platform account was searched or created. Account ownership and control remain unverified.`;
  case 'email':return `Email-format identifier listed for ${who}. The reserved .test domain does not represent a verified working mailbox. Ownership and use have not been established.`;
  case 'phone':return `Contact-number entry listed for ${who}. Uses the UK drama-reserved range; no subscriber association has been verified. The country code does not establish a place of residence.`;
  default:throw Error('Unknown identifier type');
 }
}
async function snapshot(c){return {identifiers:await rows(c,'SELECT * FROM poi_identifiers ORDER BY identifier_id'),active:await rows(c,'SELECT * FROM z_base_active_dataset_profile ORDER BY control_id'),live:await rows(c,'SELECT * FROM persons_of_interest ORDER BY person_ref'),saved:await rows(c,'SELECT * FROM z_base_persons ORDER BY dataset_profile_id,person_ref')};}
function candidates(state){
 const people=new Map(state.saved.map(p=>[p.DATASET_PROFILE_ID+'|'+p.PERSON_REF,p]));
 return state.identifiers.map(row=>{
  assert.equal(normalize(row.IDENTIFIER_TYPE,row.IDENTIFIER_VALUE,row.NAMESPACE),row.NORMALIZED_VALUE,'Stored normalization mismatch');
  const value=note(row,people.get(row.DATASET_PROFILE_ID+'|'+row.PERSON_REF));
  assert(value.length<=1000&&value.length>50);
  assert(!/fictional|ficitional|synthetic|scenario|demonstration|teaching/iu.test(value));
  return {...row,SOURCE_NOTE:value};
 });
}
function verify(before,after){
 for(const key of ['active','live','saved'])assert.equal(canonical(before[key]),canonical(after[key]),key+' changed');
 assert.equal(canonical(after.identifiers),canonical(candidates(before)),'Identifier fields differ from expected notes-only revision');
}
async function lookupChecks(c){
 const current=await match(c,{type:'alias',value:'Tone'});assert.equal(current.length,1);assert.equal(current[0].PERSON_REF,'POI-V2-TONY');
 const proposed=await match(c,{type:'alias',value:'pippy'});assert.equal(proposed.length,0);
 const expired=await match(c,{type:'alias',value:'Slate Pipit'});assert.equal(expired.length,0);
 const declared=await match(c,{type:'username',value:'kappa66'});assert.equal(declared.length,1);assert.equal(declared[0].PERSON_REF,'POI-NBNW-GEORGE');
 return {currentAliasResolves:true,proposedAndExpiredAliasesExcluded:true,declaredUsernameResolves:true};
}
async function run(mode){
 const c=await connect();try{
  for(const table of ['z_base_active_dataset_profile','z_base_persons','persons_of_interest'])await c.execute('LOCK TABLE '+table+' IN SHARE MODE NOWAIT');
  await c.execute('LOCK TABLE poi_identifiers IN EXCLUSIVE MODE NOWAIT');
  const before=await snapshot(c),expected=candidates(before);
  if(mode!=='--check'){
   const capture=JSON.parse(fs.readFileSync(path.join(root,'inspection.json'),'utf8'));
   for(const key of ['identifiers','active','live','saved'])assert.equal(canonical(before[key]),canonical(capture[key]),'State changed since capture: '+key);
  }
  if(mode==='--apply')fs.writeFileSync(path.join(root,'before-apply.json'),JSON.stringify(before,null,2)+'\n',{flag:'wx',mode:0o600});
  if(mode!=='--check')await c.executeMany('UPDATE poi_identifiers SET source_note=:note WHERE identifier_id=:id',expected.map(p=>({note:p.SOURCE_NOTE,id:p.IDENTIFIER_ID})));
  const after=await snapshot(c);verify(before,after);const lookups=await lookupChecks(c);
  const receipt={mode,committed:mode==='--apply',identifierNotes:after.identifiers.length,profiles:new Set(after.identifiers.map(p=>p.DATASET_PROFILE_ID)).size,onlySourceNoteChanged:true,identifierValuesNormalizationReviewAndValidityUnchanged:true,sourceReferencesAndRecorderAttributionUnchanged:true,liveAndSavedPeopleAndActiveProfileUnchanged:true,editorialTermsRemaining:after.identifiers.filter(p=>/fictional|synthetic|scenario|demonstration|teaching/iu.test(p.SOURCE_NOTE)).length,...lookups};
  if(mode==='--apply')await c.commit();else await c.rollback();
  fs.writeFileSync(path.join(root,mode.slice(2)+'-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
 }catch(e){await c.rollback();throw e;}finally{await c.close();}
}
if(require.main===module){const mode=process.argv[2]||'--dry-run';if(!['--dry-run','--apply','--check'].includes(mode))throw Error('Use --dry-run, --apply or --check');run(mode).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={note,candidates,verify};
