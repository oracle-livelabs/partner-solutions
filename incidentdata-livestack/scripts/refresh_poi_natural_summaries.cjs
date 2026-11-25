'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect,rows}=require('./evidence-intelligence/connection.cjs');
const pack=require('../testdata/poi-profile-quality/20261029-natural-summaries.json');
const root='/home/opc/scratch/poi-quality-20261029/natural-summaries';
const summaries=pack.summaries;
function validate(){for(const [ref,text] of Object.entries(summaries)){
 assert(text.length>100&&Buffer.byteLength(text)<=500,ref+' column limit');
 assert(!/fictional|ficitional|synthetic|scenario|backstory|demonstration|teaching/iu.test(text),ref+' contains editorial terminology');
}}
async function snapshot(c){return {live:await rows(c,'SELECT * FROM persons_of_interest ORDER BY person_ref'),saved:await rows(c,'SELECT * FROM z_base_persons ORDER BY dataset_profile_id,person_ref'),active:await rows(c,'SELECT * FROM z_base_active_dataset_profile ORDER BY control_id'),identifiers:await rows(c,'SELECT * FROM poi_identifiers ORDER BY identifier_id')};}
function verify(before,after){
 for(const name of ['active','identifiers'])assert.deepEqual(after[name],before[name],name+' changed');
 for(const name of ['live','saved']){
  assert.equal(before[name].length,after[name].length);
  for(let i=0;i<before[name].length;i++){
   const original=before[name][i];
   assert.deepEqual(after[name][i],{...original,...(summaries[original.PERSON_REF]?{NARRATIVE_SUMMARY:summaries[original.PERSON_REF]}:{})},name+' unexpected field change');
  }
 }
}
async function run(mode){
 validate();const c=await connect();
 try{
  await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  for(const t of ['z_base_active_dataset_profile','z_base_persons','persons_of_interest','poi_identifiers'])await c.execute('LOCK TABLE '+t+' IN EXCLUSIVE MODE NOWAIT');
  const before=await snapshot(c);
  assert.deepEqual(before.live.map(p=>p.PERSON_REF).sort(),Object.keys(summaries).sort(),'Live membership changed');
  const copies=before.saved.filter(p=>Object.hasOwn(summaries,p.PERSON_REF));
  fs.mkdirSync(root,{recursive:true});
  if(mode==='--apply')fs.writeFileSync(path.join(root,'before-apply.json'),JSON.stringify(before,null,2)+'\n',{flag:'wx',mode:0o600});
  if(mode!=='--check'){
   await c.executeMany('UPDATE persons_of_interest SET narrative_summary=:summary WHERE person_ref=:ref',Object.entries(summaries).map(([ref,summary])=>({ref,summary})));
   await c.executeMany('UPDATE z_base_persons SET narrative_summary=:summary WHERE dataset_profile_id=:pid AND person_ref=:ref',copies.map(p=>({summary:summaries[p.PERSON_REF],pid:p.DATASET_PROFILE_ID,ref:p.PERSON_REF})));
  }
  const after=await snapshot(c);verify(before,after);
  const receipt={mode,committed:mode==='--apply',liveSummaries:after.live.length,savedCopies:copies.length,savedProfiles:new Set(copies.map(p=>p.DATASET_PROFILE_ID)).size,onlyNarrativeSummaryChanged:true,aliasesAndIdentifiersUnchanged:true,activeProfileUnchanged:true,editorialTermsRemaining:after.live.filter(p=>/fictional|ficitional|synthetic|scenario|backstory|demonstration|teaching/iu.test(p.NARRATIVE_SUMMARY)).length,maxSummaryBytes:Math.max(...Object.values(summaries).map(v=>Buffer.byteLength(v)))};
  if(mode==='--apply')await c.commit();else await c.rollback();
  fs.writeFileSync(path.join(root,mode.slice(2)+'-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
 }catch(e){await c.rollback();throw e;}finally{await c.close();}
}
if(require.main===module){const mode=process.argv[2]||'--dry-run';if(!['--dry-run','--apply','--check'].includes(mode))throw Error('Expected --dry-run, --apply or --check');run(mode).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={validate};
