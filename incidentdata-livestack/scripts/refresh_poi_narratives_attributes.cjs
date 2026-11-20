'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {connect,rows,oracle}=require('./evidence-intelligence/connection.cjs');
const pack=require('../testdata/poi-profile-quality/20261030-narratives-attributes.json');
const root='/home/opc/scratch/poi-quality-20261030';
const people=new Map(pack.people.map(p=>[p.personRef,p]));
const hash=s=>createHash('sha256').update(s).digest('hex');
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const clob=s=>({val:s,type:oracle.CLOB});
function attributes(row,p){
 const old=row.PROFILE_ATTRIBUTES||{};
 const next={...old,...p.attributes};
 // Keep stable identifiers, source references, safety flags and asset policies.
 // The verbose old notice remains in the immutable before-change backup.
 delete next.synthetic_notice;
 Object.assign(next,{synthetic_record:true,association_is_not_evidence:true,narrative_basis:'editorial_revision_of_retained_profile_account',
  narrative_revision:pack.revision,stored_narrative_sha256:hash(p.narrative),embedding_text_policy:'complete_current_narrative_text',embedding_text_sha256:hash(p.narrative)});
 return next;
}
function validate(vectors){
 assert.equal(people.size,17);
 for(const p of people.values()){
  assert(p.narrative.length>=400&&p.narrative.length<4000,p.personRef+' narrative length');
  assert(!/fictional|ficitional|synthetic|scenario|backstory|demonstration|teaching/iu.test(p.narrative),p.personRef+' editorial language');
  assert(!/fictional|scenario|demonstration|teaching/iu.test(JSON.stringify(p.attributes)),p.personRef+' descriptive attributes');
  const v=vectors.find(v=>v.personRef===p.personRef);assert(v&&v.sourceSha256===hash(p.narrative),'Vector source mismatch');
  assert.equal(v.model,'Xenova/all-MiniLM-L6-v2');assert.equal(v.values.length,384);assert(v.values.every(Number.isFinite));
  assert(Math.abs(v.values.reduce((n,x)=>n+x*x,0)-1)<0.001,'Vector normalization');
 }
}
const vectorSQL=(table,saved)=>`SELECT ${saved?'dataset_profile_id,':''}person_id,embedding_model,source_sha256,VECTOR_SERIALIZE(embedding RETURNING CLOB) vector_text,created_at FROM ${table} ORDER BY ${saved?'dataset_profile_id,':''}person_id,embedding_model`;
async function snapshot(c){return {
 live:await rows(c,'SELECT * FROM persons_of_interest ORDER BY person_ref'),saved:await rows(c,'SELECT * FROM z_base_persons ORDER BY dataset_profile_id,person_ref'),
 active:await rows(c,'SELECT * FROM z_base_active_dataset_profile ORDER BY control_id'),identifiers:await rows(c,'SELECT * FROM poi_identifiers ORDER BY identifier_id'),
 links:await rows(c,'SELECT * FROM person_incident_links ORDER BY person_id,incident_id'),savedLinks:await rows(c,'SELECT * FROM z_base_person_incident_links ORDER BY dataset_profile_id,person_id,incident_id'),
 liveVectors:await rows(c,vectorSQL('person_narrative_embeddings',false)),savedVectors:await rows(c,vectorSQL('z_base_person_narrative_vec',true)),
 visual:await rows(c,'SELECT person_id,asset_ref,asset_kind,asset_uri,mime_type,asset_sha256,asset_caption,embedding_model,VECTOR_SERIALIZE(embedding RETURNING CLOB) vector_text,created_at FROM person_visual_embeddings ORDER BY person_id,asset_ref'),
 savedVisual:await rows(c,'SELECT dataset_profile_id,person_id,asset_ref,asset_kind,asset_uri,mime_type,asset_sha256,asset_caption,embedding_model,VECTOR_SERIALIZE(embedding RETURNING CLOB) vector_text,created_at FROM z_base_person_visual_vec ORDER BY dataset_profile_id,person_id,asset_ref')
};}
function key(p,saved){return (saved?p.DATASET_PROFILE_ID+'|':'')+p.PERSON_ID+'|'+p.EMBEDDING_MODEL;}
function verify(before,after,vectors){
 for(const name of ['active','identifiers','links','savedLinks','visual','savedVisual'])assert.deepEqual(after[name],before[name],name+' changed');
 for(const name of ['live','saved']){
  assert.equal(before[name].length,after[name].length);
  before[name].forEach((row,i)=>{
   const p=people.get(row.PERSON_REF),actual=after[name][i];
   const expected=p?{...row,NARRATIVE_TEXT:p.narrative,PROFILE_ATTRIBUTES:attributes(row,p)}:row;
   assert.equal(canonical(actual),canonical(expected),name+' unexpected person change: '+row.PERSON_REF);
   if(p){
    const old=row.PROFILE_ATTRIBUTES||{},a=actual.PROFILE_ATTRIBUTES;
    for(const field of ['knowledge_set_id','pack_code','dataset_profile_code','source_evidence_refs','source_file','source_file_sha256','source_filename','scenario','portrait_sha256','portrait_policy','generated_fictional','identity_basis','shared_cast_version'])
     if(Object.hasOwn(old,field))assert.equal(canonical(a[field]),canonical(old[field]),'Technical/source metadata changed: '+field);
   }
  });
 }
 let refreshed=0,savedRefreshed=0;
 for(const [name,saved,register] of [['liveVectors',false,'live'],['savedVectors',true,'saved']]){
  assert.equal(before[name].length,after[name].length,'Vector coverage changed');
  const actual=new Map(after[name].map(v=>[key(v,saved),v]));
  for(const original of before[name]){
   const row=before[register].find(p=>p.PERSON_ID===original.PERSON_ID&&(!saved||p.DATASET_PROFILE_ID===original.DATASET_PROFILE_ID));
   const p=people.get(row?.PERSON_REF),value=actual.get(key(original,saved));assert(value);
   if(!p){assert.deepEqual(value,original);continue;}
   const v=vectors.find(v=>v.personRef===p.personRef);assert.equal(original.EMBEDDING_MODEL,v.model,'Unsupported current model');
   assert.deepEqual({...value,SOURCE_SHA256:original.SOURCE_SHA256,VECTOR_TEXT:original.VECTOR_TEXT},original,'Vector metadata changed');
   assert.equal(value.SOURCE_SHA256,v.sourceSha256);const stored=JSON.parse(value.VECTOR_TEXT);assert.equal(stored.length,384);
   assert(stored.every((x,i)=>Math.abs(x-v.values[i])<0.000001),'Stored vector differs');
   if(saved)savedRefreshed++;else refreshed++;
  }
 }
 return {refreshed,savedRefreshed};
}
async function run(mode){
 const vectors=JSON.parse(fs.readFileSync(path.join(root,'vectors.json'),'utf8'));validate(vectors);
 const c=await connect();
 try{
  await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  for(const t of ['z_base_active_dataset_profile','z_base_persons','persons_of_interest','person_narrative_embeddings','z_base_person_narrative_vec','poi_identifiers'])await c.execute('LOCK TABLE '+t+' IN EXCLUSIVE MODE NOWAIT');
  const before=await snapshot(c);
  assert.deepEqual(before.live.map(p=>p.PERSON_REF).sort(),[...people.keys()].sort(),'Active person membership changed');
  const pre=JSON.parse(fs.readFileSync(path.join(root,'inspection.json'),'utf8'));
  if(mode!=='--check')for(const name of ['live','saved','active'])assert.equal(canonical(before[name]),canonical(pre[name]),'Database changed since editorial capture: '+name);
  fs.mkdirSync(root,{recursive:true});
  if(mode==='--apply')fs.writeFileSync(path.join(root,'before-apply.json'),JSON.stringify(before,null,2)+'\n',{flag:'wx',mode:0o600});
  if(mode!=='--check'){
   for(const [name,saved,table] of [['live',false,'persons_of_interest'],['saved',true,'z_base_persons']]){
    for(const row of before[name]){
     const p=people.get(row.PERSON_REF);if(!p)continue;
     const binds={ref:p.personRef,text:clob(p.narrative),attrs:clob(JSON.stringify(attributes(row,p))),...(saved?{pid:row.DATASET_PROFILE_ID}:{})};
     const result=await c.execute(`UPDATE ${table} SET narrative_text=:text,profile_attributes=JSON(:attrs) WHERE person_ref=:ref ${saved?'AND dataset_profile_id=:pid':''}`,binds);assert.equal(result.rowsAffected,1);
    }
   }
   for(const [name,saved,table,register] of [['liveVectors',false,'person_narrative_embeddings','live'],['savedVectors',true,'z_base_person_narrative_vec','saved']]){
    for(const row of before[name]){
     const person=before[register].find(p=>p.PERSON_ID===row.PERSON_ID&&(!saved||p.DATASET_PROFILE_ID===row.DATASET_PROFILE_ID));
     const p=people.get(person?.PERSON_REF);if(!p)continue;
     const v=vectors.find(v=>v.personRef===p.personRef);assert.equal(row.EMBEDDING_MODEL,v.model);
     const result=await c.execute(`UPDATE ${table} SET source_sha256=:sha,embedding=TO_VECTOR(:vec) WHERE person_id=:id AND embedding_model=:model ${saved?'AND dataset_profile_id=:pid':''}`,{sha:v.sourceSha256,vec:clob(JSON.stringify(v.values)),id:row.PERSON_ID,model:v.model,...(saved?{pid:row.DATASET_PROFILE_ID}:{})});assert.equal(result.rowsAffected,1);
    }
   }
  }
  const after=await snapshot(c),counts=verify(before,after,vectors);
  const receipt={mode,committed:mode==='--apply',livePeople:after.live.length,savedCopies:after.saved.filter(p=>people.has(p.PERSON_REF)).length,savedProfiles:new Set(after.saved.filter(p=>people.has(p.PERSON_REF)).map(p=>p.DATASET_PROFILE_ID)).size,narrativeVectorsRefreshed:counts.refreshed,savedNarrativeVectorsRefreshed:counts.savedRefreshed,dimensions:384,onlyNarrativesAttributesAndBoundVectorsChanged:true,aliasesSummariesPortraitsAndIdentifiersUnchanged:true,incidentLinksAndActiveProfileUnchanged:true,sourceReferencesAndTechnicalFlagsPreserved:true,narrativeEditorialTermsRemaining:after.live.filter(p=>/fictional|synthetic|scenario|backstory|demonstration|teaching/iu.test(p.NARRATIVE_TEXT)).length};
  if(mode==='--apply')await c.commit();else await c.rollback();
  fs.writeFileSync(path.join(root,mode.slice(2)+'-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
 }catch(e){await c.rollback();throw e;}finally{await c.close();}
}
if(require.main===module){const mode=process.argv[2]||'--dry-run';if(!['--dry-run','--apply','--check'].includes(mode))throw Error('Use --dry-run, --apply or --check');run(mode).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={attributes,validate,verify};
