'use strict';
// Curated synthetic content only. No DDL, city restore, evidence or vector writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect,rows}=require('./evidence-intelligence/connection.cjs');
const {prepare,normalize}=require('../backend/poi-identifiers');
const pack=require('../testdata/poi-profile-quality/20261029.json');
const LEGACY='synthetic:city-poi-identifiers:v1:2026-10-20';
const END=new Date('2026-10-29T00:00:00Z');
const RECEIPTS='/home/opc/scratch/poi-quality-20261029';
const wanted=new Map(pack.people.map(p=>[p.personRef,p]));
function validate(){
 assert.equal(wanted.size,pack.people.length);
 for(const p of pack.people){
  assert(p.aliases.length>=1&&p.aliases.length<=3);
  assert.equal(new Set(p.aliases.map(v=>normalize('alias',v,'general'))).size,p.aliases.length);
  assert(Buffer.byteLength(p.aliases[0])<=120);
  assert(Buffer.byteLength(p.summary)<=500&&p.summary.length>=140,p.personRef);
  for(const value of p.aliases)assert(value===value.trim()&&value.length>=2&&!/[;|\n]/.test(value));
 }
}
function assertion(person,profileId,value){return prepare({personRef:person.personRef,type:'alias',value,status:'declared',sourceRef:pack.sourceRef,
 sourceNote:'Curated fictional nickname or name variant for synthetic profile quality. Generated at scenario-owner request; not extracted from messages, evidence or a real account. Primary display alias: '+person.aliases[0]+'.',
 recordedBy:'Synthetic POI profile editorial revision 2026-10-29'},profileId);}
async function snapshot(c){return {
 active:await rows(c,'SELECT * FROM z_base_active_dataset_profile ORDER BY control_id'),
 live:await rows(c,'SELECT * FROM persons_of_interest ORDER BY person_ref'),
 saved:await rows(c,'SELECT * FROM z_base_persons ORDER BY dataset_profile_id,person_ref'),
 identifiers:await rows(c,'SELECT * FROM poi_identifiers ORDER BY identifier_id')
};}
function project(person){return Object.fromEntries(Object.entries(person).filter(([k])=>!['ALIAS_NAME','NARRATIVE_SUMMARY'].includes(k)));}
function checkRows(before,after){
 assert.equal(before.length,after.length);
 for(let i=0;i<before.length;i++){
  const original=before[i],actual=after[i],p=wanted.get(original.PERSON_REF);
  assert.deepEqual(project(original),project(actual),'Unrelated person fields changed');
  if(p){assert.equal(actual.ALIAS_NAME,p.aliases[0]);assert.equal(actual.NARRATIVE_SUMMARY,p.summary);}
  else assert.deepEqual(original,actual,'Out-of-scope person changed');
 }
}
async function run(mode){
 validate();const c=await connect();
 try{
  await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  // NOWAIT avoids queuing behind another profile editor or restore.
  for(const table of ['z_base_active_dataset_profile','z_base_persons','persons_of_interest','poi_identifiers'])
   await c.execute('LOCK TABLE '+table+' IN EXCLUSIVE MODE NOWAIT');
  const before=await snapshot(c);
  assert.deepEqual(before.live.map(p=>p.PERSON_REF).sort(),[...wanted.keys()].sort(),'Active POI membership changed; review pack');
  const activeId=before.active.find(p=>p.CONTROL_ID===1).DATASET_PROFILE_ID;
  assert.deepEqual(before.live.map(p=>[p.PERSON_REF,p.DISPLAY_NAME]),before.saved.filter(p=>p.DATASET_PROFILE_ID===activeId).map(p=>[p.PERSON_REF,p.DISPLAY_NAME]),'Live and saved active people differ');
  const saved=before.saved.filter(p=>wanted.has(p.PERSON_REF));
  const keys=new Set(saved.map(p=>p.DATASET_PROFILE_ID+'|'+p.PERSON_REF));
  const superseded=before.identifiers.filter(p=>p.SOURCE_REF===LEGACY&&p.IDENTIFIER_TYPE==='alias'&&keys.has(p.DATASET_PROFILE_ID+'|'+p.PERSON_REF));
  for(const row of superseded){
   assert.equal(row.REVIEW_STATUS,'declared','Reviewed legacy alias changed; review before superseding');
   assert(row.VALID_TO===null||row.VALID_TO.getTime()===END.getTime(),'Unexpected legacy alias end date');
  }
  const priorIds=new Set(before.identifiers.map(p=>p.IDENTIFIER_ID));
  const expected=saved.flatMap(p=>wanted.get(p.PERSON_REF).aliases.map(a=>assertion(wanted.get(p.PERSON_REF),p.DATASET_PROFILE_ID,a)));
  const additions=expected.filter(p=>!priorIds.has(p.id));
  if(mode!=='--check'){
   fs.mkdirSync(RECEIPTS,{recursive:true});
   if(mode==='--apply'){
    const backup=path.join(RECEIPTS,'before-apply.json');
    assert(!fs.existsSync(backup),'Backup already exists; use --check to verify completed apply');
    fs.writeFileSync(backup,JSON.stringify(before,null,2)+'\n',{flag:'wx',mode:0o600});
   }
   await c.executeMany('UPDATE persons_of_interest SET alias_name=:alias,narrative_summary=:summary WHERE person_ref=:ref',pack.people.map(p=>({alias:p.aliases[0],summary:p.summary,ref:p.personRef})));
   await c.executeMany('UPDATE z_base_persons SET alias_name=:alias,narrative_summary=:summary WHERE dataset_profile_id=:pid AND person_ref=:ref',saved.map(p=>({alias:wanted.get(p.PERSON_REF).aliases[0],summary:wanted.get(p.PERSON_REF).summary,pid:p.DATASET_PROFILE_ID,ref:p.PERSON_REF})));
   const expires=superseded.filter(p=>p.VALID_TO===null);
   if(expires.length)await c.executeMany('UPDATE poi_identifiers SET valid_to=:endAt WHERE identifier_id=:id',expires.map(p=>({endAt:END,id:p.IDENTIFIER_ID})));
   if(additions.length)await c.executeMany(`INSERT INTO poi_identifiers(identifier_id,dataset_profile_id,person_ref,identifier_type,namespace,identifier_value,normalized_value,review_status,source_ref,source_note,recorded_by,reviewed_by,reviewed_at,valid_from,valid_to)
    VALUES(:id,:profileId,:personRef,:type,:namespace,:value,:normalized,:status,:sourceRef,:sourceNote,:recordedBy,:reviewedBy,:reviewedAt,:validFrom,:validTo)`,additions);
  }
  const after=await snapshot(c);
  checkRows(before.live,after.live);checkRows(before.saved,after.saved);assert.deepEqual(before.active,after.active);
  const current=new Map(after.identifiers.map(p=>[p.IDENTIFIER_ID,p]));
  const {assertStored}=require('./setup_poi_identifiers.cjs');
  for(const p of expected)assertStored(p,current.get(p.id));
  for(const p of before.identifiers){
   const expectedOld={...p};if(superseded.some(s=>s.IDENTIFIER_ID===p.IDENTIFIER_ID))expectedOld.VALID_TO=END;
   assert.deepEqual(current.get(p.IDENTIFIER_ID),expectedOld,'Existing identifier history changed unexpectedly');
  }
  assert.equal(after.identifiers.length,before.identifiers.length+(mode==='--check'?0:additions.length));
  const dist={1:0,2:0,3:0};
  for(const person of saved){
   const aliases=after.identifiers.filter(p=>p.DATASET_PROFILE_ID===person.DATASET_PROFILE_ID&&p.PERSON_REF===person.PERSON_REF&&p.IDENTIFIER_TYPE==='alias'&&['declared','confirmed'].includes(p.REVIEW_STATUS)&&(!p.VALID_FROM||p.VALID_FROM<=END)&&(!p.VALID_TO||p.VALID_TO>END)).map(p=>p.NORMALIZED_VALUE).sort();
   assert.deepEqual(aliases,wanted.get(person.PERSON_REF).aliases.map(a=>normalize('alias',a,'general')).sort(),'Eligible aliases differ from curated set');
   if(person.DATASET_PROFILE_ID===activeId)dist[aliases.length]++;
  }
  const receipt={mode,committed:mode==='--apply',livePeople:after.live.length,savedPersonCopies:saved.length,savedProfiles:new Set(saved.map(p=>p.DATASET_PROFILE_ID)).size,activeProfileId:activeId,aliasesPerLivePerson:dist,aliasAssertionsAdded:mode==='--check'?0:additions.length,legacyAliasesRetainedWithEndDate:superseded.length,activeProfileUnchanged:true,unrelatedPersonFieldsUnchanged:true,unrelatedIdentifiersUnchanged:true,maxSummaryBytes:Math.max(...pack.people.map(p=>Buffer.byteLength(p.summary)))};
  if(mode==='--apply')await c.commit();else await c.rollback();
  fs.mkdirSync(RECEIPTS,{recursive:true});fs.writeFileSync(path.join(RECEIPTS,mode.slice(2)+'-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
 }catch(e){await c.rollback();throw e;}finally{await c.close();}
}
if(require.main===module){const mode=process.argv[2]||'--dry-run';if(!['--dry-run','--apply','--check'].includes(mode))throw Error('Use --dry-run, --apply or --check');run(mode).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={validate,run};
