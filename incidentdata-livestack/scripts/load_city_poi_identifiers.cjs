'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {prepare}=require('../backend/poi-identifiers');
const {insert,assertStored}=require('./setup_poi_identifiers.cjs');
const {build,SOURCE}=require('./build_city_poi_identifiers.cjs');
const ROOT=path.join(__dirname,'../testdata/poi-identifiers');
function validatePack(pack,catalogue){
 assert.deepEqual(pack,build(catalogue),'Pack differs from deterministic source catalogue');
 const keys=new Set();
 for(const person of pack.people){
  assert(person.identifiers.length>=3&&person.identifiers.length<=7,'Expected 3–7 additional identifiers');
  for(const record of person.identifiers){
   const row=prepare(record,1),key=JSON.stringify([row.type,row.namespace,row.normalized]);
   assert(!keys.has(key),'Accidental duplicate identifier across people');keys.add(key);
  }
 }
 return pack;
}
async function run(mode){
 const {connect,rows}=require('./evidence-intelligence/connection.cjs');
 const pack=validatePack(JSON.parse(fs.readFileSync(path.join(ROOT,'city-standard-v1.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(ROOT,'city-catalogue.json'),'utf8')));
 const {FOUNDATION_PROFILES}=await import('../frontend/src/foundation-profiles.mjs');
 const c=await connect();
 try{
  await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  if(mode!=='--check'){
   await c.execute('LOCK TABLE z_base_persons IN SHARE MODE NOWAIT');
   await c.execute('LOCK TABLE persons_of_interest IN SHARE MODE NOWAIT');
   await c.execute('LOCK TABLE poi_identifiers IN EXCLUSIVE MODE NOWAIT');
  }
  const activeBefore=await rows(c,'SELECT * FROM z_base_active_dataset_profile WHERE control_id=1 FOR UPDATE');
  const profiles=await rows(c,'SELECT dataset_profile_id,profile_code FROM z_base_dataset_profiles');
  const savedBefore=await rows(c,`SELECT dataset_profile_id,person_ref,display_name,alias_name FROM z_base_persons ORDER BY dataset_profile_id,person_ref`);
  const liveBefore=await rows(c,'SELECT * FROM persons_of_interest ORDER BY person_ref');
  const activeSaved=savedBefore.filter(p=>p.DATASET_PROFILE_ID===activeBefore[0].DATASET_PROFILE_ID);
  assert.deepEqual(liveBefore.map(p=>[p.PERSON_REF,p.DISPLAY_NAME]).sort(),activeSaved.map(p=>[p.PERSON_REF,p.DISPLAY_NAME]).sort(),'Live POIs differ from saved active profile; review coverage first');
  const before=await rows(c,'SELECT * FROM poi_identifiers ORDER BY identifier_id');
  const prior=new Map(before.map(r=>[r.IDENTIFIER_ID,r]));
  let added=0,expected=0;const distribution=[];
  for(const profile of FOUNDATION_PROFILES){
   const saved=profiles.find(p=>p.PROFILE_CODE===profile.code);assert(saved,`Missing city ${profile.code}`);
   const sourcePeople=pack.people.filter(p=>p.profileCodes.includes(profile.code));
   const databasePeople=savedBefore.filter(p=>p.DATASET_PROFILE_ID===saved.DATASET_PROFILE_ID);
   assert.deepEqual(sourcePeople.map(p=>[p.personRef,p.displayName]).sort(),databasePeople.map(p=>[p.PERSON_REF,p.DISPLAY_NAME]).sort(),`POI coverage changed for ${profile.code}; review catalogue and regenerate`);
   let identifiers=0;
   for(const person of sourcePeople)for(const record of person.identifiers){
    const prepared=prepare(record,saved.DATASET_PROFILE_ID);identifiers++;expected++;
    if(prior.has(prepared.id))assertStored(prepared,prior.get(prepared.id));
    else if(mode==='--check')throw Error(`Missing identifier for ${profile.code}: ${person.personRef}`);
    else added+=await insert(c,{...record,profileId:saved.DATASET_PROFILE_ID});
   }
   distribution.push({profileCode:profile.code,people:sourcePeople.length,additionalIdentifiers:identifiers});
  }
  const after=await rows(c,'SELECT * FROM poi_identifiers ORDER BY identifier_id');
  const actual=after.filter(r=>r.SOURCE_REF===SOURCE);
  assert.equal(actual.length,expected);
  for(const row of before)assert.deepEqual(after.find(r=>r.IDENTIFIER_ID===row.IDENTIFIER_ID),row,'Existing identifier assertion changed');
  assert.deepEqual(await rows(c,'SELECT * FROM persons_of_interest ORDER BY person_ref'),liveBefore,'Live POI register changed');
  assert.deepEqual(await rows(c,`SELECT dataset_profile_id,person_ref,display_name,alias_name FROM z_base_persons ORDER BY dataset_profile_id,person_ref`),savedBefore,'Saved POI keys or names changed');
  assert.deepEqual(await rows(c,'SELECT * FROM z_base_active_dataset_profile WHERE control_id=1'),activeBefore,'Active city changed');
  // Every shared person must have exactly the same identifier assertions in every city.
  for(const person of pack.people){
   let reference;
   for(const code of person.profileCodes){
    const pid=profiles.find(p=>p.PROFILE_CODE===code).DATASET_PROFILE_ID;
    const values=actual.filter(r=>r.DATASET_PROFILE_ID===pid&&r.PERSON_REF===person.personRef).map(r=>JSON.stringify([r.IDENTIFIER_TYPE,r.NAMESPACE,r.IDENTIFIER_VALUE,r.NORMALIZED_VALUE,r.REVIEW_STATUS,r.SOURCE_REF,r.SOURCE_NOTE,r.RECORDED_BY])).sort();
    if(reference)assert.deepEqual(values,reference,'Shared person differs across cities');else reference=values;
   }
  }
  if(mode==='--apply')await c.commit();else await c.rollback();
  return {mode,committed:mode==='--apply',distinctPeople:pack.people.length,personCityRecords:distribution.reduce((n,p)=>n+p.people,0),additionalIdentifiers:expected,added,existingAssertionsPreserved:before.length,totalAssertions:after.length,identifiersPerPerson:{minimum:Math.min(...pack.people.map(p=>p.identifiers.length)),maximum:Math.max(...pack.people.map(p=>p.identifiers.length))},sharedPeopleConsistent:true,activeProfileUnchanged:true,liveAndSavedPoiRegistersUnchanged:true,distribution};
 }catch(e){await c.rollback();throw e;}finally{await c.close();}
}
if(require.main===module){
 const args=process.argv.slice(2);if(args.length>1||args.length&&!['--apply','--dry-run','--check'].includes(args[0])){console.error('Usage: node scripts/load_city_poi_identifiers.cjs [--dry-run|--apply|--check]');process.exitCode=1;}
 else run(args[0]||'--dry-run').then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
module.exports={validatePack,run};
