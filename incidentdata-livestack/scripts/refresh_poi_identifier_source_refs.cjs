'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {connect,rows}=require('./evidence-intelligence/connection.cjs');
const {canonicalSourceRef,sourceIdentity}=require('../backend/poi-identifier-sources');
const {match}=require('../backend/poi-identifiers');
const root='/home/opc/scratch/poi-identifier-source-refs-20261030';
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
async function snapshot(c){return {identifiers:await rows(c,'SELECT * FROM poi_identifiers ORDER BY identifier_id'),active:await rows(c,'SELECT * FROM z_base_active_dataset_profile ORDER BY control_id')};}
function verify(before,after){
 assert.equal(canonical(before.active),canonical(after.active),'Active profile changed');
 assert.equal(after.identifiers.length,before.identifiers.length);
 const unique=new Set();
 before.identifiers.forEach((old,i)=>{
  const expected={...old,SOURCE_REF:canonicalSourceRef(old.SOURCE_REF)},actual=after.identifiers[i];
  assert.equal(canonical(actual),canonical(expected),'Unexpected identifier field change');
  const logical=[actual.DATASET_PROFILE_ID,actual.PERSON_REF,actual.IDENTIFIER_TYPE,actual.NAMESPACE,actual.NORMALIZED_VALUE,actual.SOURCE_REF];
  const key=JSON.stringify(logical);assert(!unique.has(key),'Duplicate source association');unique.add(key);
  logical[5]=sourceIdentity(actual.SOURCE_REF);
  assert.equal(createHash('sha256').update(JSON.stringify(logical)).digest('hex'),actual.IDENTIFIER_ID,'Deterministic identifier identity mismatch');
 });
}
async function run(mode){
 const c=await connect();try{
  await c.execute('LOCK TABLE z_base_active_dataset_profile IN SHARE MODE NOWAIT');
  await c.execute('LOCK TABLE poi_identifiers IN EXCLUSIVE MODE NOWAIT');
  const before=await snapshot(c);
  if(mode!=='--check'){
   const initial=JSON.parse(fs.readFileSync(path.join(root,'inspection.json'),'utf8'));
   for(const key of ['identifiers','active'])assert.equal(canonical(before[key]),canonical(initial[key]),'State changed since capture: '+key);
  }
  const changes=before.identifiers.filter(p=>p.SOURCE_REF!==canonicalSourceRef(p.SOURCE_REF));
  if(mode==='--apply')fs.writeFileSync(path.join(root,'before-apply.json'),JSON.stringify(before,null,2)+'\n',{flag:'wx',mode:0o600});
  if(mode!=='--check'&&changes.length)await c.executeMany('UPDATE poi_identifiers SET source_ref=:source WHERE identifier_id=:id',changes.map(p=>({source:canonicalSourceRef(p.SOURCE_REF),id:p.IDENTIFIER_ID})));
  const after=await snapshot(c);verify(before,after);
  assert(!after.identifiers.some(p=>/^synthetic:/i.test(p.SOURCE_REF)),'Legacy prefix remains');
  const tone=await match(c,{type:'alias',value:'Tone'});assert.equal(tone.length,1);assert.equal(tone[0].PERSON_REF,'POI-V2-TONY');assert.equal(tone[0].SOURCE_REF,'register:poi-profile-quality:v1:2026-10-29');
  assert.equal((await match(c,{type:'alias',value:'pippy'})).length,0);
  assert.equal((await match(c,{type:'alias',value:'Slate Pipit'})).length,0);
  const sources=await rows(c,'SELECT source_ref,COUNT(*) n FROM poi_identifiers GROUP BY source_ref ORDER BY source_ref');
  const receipt={mode,committed:mode==='--apply',totalRecords:after.identifiers.length,referencesChanged:changes.length,onlySourceRefChanged:true,identifierIdsValuesNotesReviewAttributionAndValidityPreserved:true,noDuplicateAssociations:true,allDeterministicIdentifiersValid:true,activeProfileUnchanged:true,currentAliasResolves:true,proposedAndExpiredAliasesExcluded:true,sources};
  if(mode==='--apply')await c.commit();else await c.rollback();
  fs.writeFileSync(path.join(root,mode.slice(2)+'-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
 }catch(e){await c.rollback();throw e;}finally{await c.close();}
}
if(require.main===module){const mode=process.argv[2]||'--dry-run';if(!['--dry-run','--apply','--check'].includes(mode))throw Error('Use --dry-run, --apply or --check');run(mode).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={verify};
