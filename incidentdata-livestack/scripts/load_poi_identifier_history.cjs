'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect,rows}=require('./evidence-intelligence/connection.cjs');
const {build,FIELDS,logical,validateRow}=require('./build_poi_identifier_history.cjs');
const spec=require('../testdata/poi-identifier-history/20261030-spec.json');
const root='/home/opc/scratch/poi-identifier-history-20261030';
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
async function snapshot(c){return {identifiers:await rows(c,'SELECT * FROM poi_identifiers ORDER BY identifier_id'),profiles:await rows(c,'SELECT dataset_profile_id,profile_code FROM z_base_dataset_profiles ORDER BY dataset_profile_id'),active:await rows(c,'SELECT * FROM z_base_active_dataset_profile ORDER BY control_id'),people:await rows(c,'SELECT dataset_profile_id,person_ref,display_name FROM z_base_persons ORDER BY dataset_profile_id,person_ref')};}
function verify(before,after,prepared){
 for(const key of ['profiles','active','people'])assert.equal(canonical(after[key]),canonical(before[key]),key+' changed');
 assert.equal(after.identifiers.length,before.identifiers.length);
 const expected=new Map(prepared.map(p=>[p.identifierId,p]));
 const shared=new Map();
 before.identifiers.forEach((old,i)=>{
  const h=expected.get(old.IDENTIFIER_ID),newRow=after.identifiers[i];assert(h);
  const wanted={...old,...Object.fromEntries(FIELDS.map(k=>[k,h[k]]))};
  assert.equal(canonical(wanted),canonical(newRow),'Unexpected field or timestamp change: '+old.IDENTIFIER_ID);
  validateRow(newRow,h);
  const key=logical(newRow),value=Object.fromEntries(FIELDS.map(k=>[k,h[k]]));
  if(shared.has(key))assert.deepEqual(value,shared.get(key),'City copies disagree');else shared.set(key,value);
 });
}
const eligibleAt=(state,at)=>state.identifiers.filter(p=>['declared','confirmed'].includes(p.REVIEW_STATUS)&&(!p.VALID_FROM||new Date(p.VALID_FROM)<=at)&&(!p.VALID_TO||new Date(p.VALID_TO)>at)).map(p=>p.IDENTIFIER_ID).sort();
async function run(mode){
 const c=await connect();try{
  for(const t of ['z_base_active_dataset_profile','z_base_persons'])await c.execute('LOCK TABLE '+t+' IN SHARE MODE NOWAIT');
  await c.execute('LOCK TABLE poi_identifiers IN EXCLUSIVE MODE NOWAIT');
  const before=await snapshot(c),prepared=build(before.identifiers);
  const captured=JSON.parse(fs.readFileSync(path.join(root,'inspection.json'),'utf8'));
  if(mode!=='--check')for(const key of ['identifiers','profiles','active','people'])assert.equal(canonical(before[key]),canonical(captured[key]),'State changed since history capture: '+key);
  const now=new Date();
  if(mode==='--apply')fs.writeFileSync(path.join(root,'before-apply.json'),JSON.stringify(before,null,2)+'\n',{flag:'wx',mode:0o600});
  if(mode!=='--check'){
   // Bind explicit UTC-offset strings; timestamp-with-time-zone values must
   // not inherit the SQL client's session timezone.
   const date=s=>s===null?null:s.replace(/Z$/,'+00:00');
   await c.executeMany(`UPDATE poi_identifiers SET recorded_by=:recorder,reviewed_by=:reviewer,
    reviewed_at=TO_TIMESTAMP_TZ(:reviewed,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
    valid_from=TO_TIMESTAMP_TZ(:validFrom,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
    valid_to=TO_TIMESTAMP_TZ(:validTo,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
    created_at=TO_TIMESTAMP_TZ(:created,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM') WHERE identifier_id=:id`,prepared.map(p=>({recorder:p.RECORDED_BY,reviewer:p.REVIEWED_BY,reviewed:date(p.REVIEWED_AT),validFrom:date(p.VALID_FROM),validTo:date(p.VALID_TO),created:date(p.CREATED_AT),id:p.identifierId})));
  }
  const after=await snapshot(c);verify(before,after,prepared);
  assert.deepEqual(eligibleAt(after,now),eligibleAt(captured,now),'Today\'s matching eligibility changed');
  const unique=[...new Map(prepared.map(p=>[p.logicalAssertion,p])).values()];
  const months={};for(const p of unique){const month=new Intl.DateTimeFormat('en-CA',{timeZone:spec.timezone,year:'numeric',month:'2-digit'}).format(new Date(p.CREATED_AT));months[month]=(months[month]||0)+1;}
  const receipt={mode,committed:mode==='--apply',records:prepared.length,distinctAssertions:unique.length,profiles:new Set(prepared.map(p=>p.profileId)).size,windowStart:spec.windowStart,windowEndExclusive:spec.windowEndExclusive,recorders:[...new Set(prepared.map(p=>p.RECORDED_BY))].sort(),reviewers:[...new Set(prepared.map(p=>p.REVIEWED_BY).filter(Boolean))].sort(),reviewedRecords:prepared.filter(p=>p.REVIEWED_AT).length,pendingReviewRecords:prepared.filter(p=>!p.REVIEWED_AT).length,expiredRecords:prepared.filter(p=>p.VALID_TO).length,openEndedRecords:prepared.filter(p=>!p.VALID_TO).length,distinctMonthlyCaptures:months,onlyRequestedSixFieldsChanged:true,reviewStatusesValuesSourceNotesAndIdsUnchanged:true,todaysMatchingEligibilityUnchanged:true,sharedCityHistoryConsistent:true,allPopulatedDatesBefore30June2026:true,allChronologyChecksPassed:true};
  if(mode==='--apply')await c.commit();else await c.rollback();
  fs.writeFileSync(path.join(root,mode.slice(2)+'-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
 }catch(e){await c.rollback();throw e;}finally{await c.close();}
}
if(require.main===module){const mode=process.argv[2]||'--dry-run';if(!['--dry-run','--apply','--check'].includes(mode))throw Error('Use --dry-run, --apply or --check');run(mode).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={verify,eligibleAt};
