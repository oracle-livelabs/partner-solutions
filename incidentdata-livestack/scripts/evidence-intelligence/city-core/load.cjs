'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect,rows,oracle}=require('../connection.cjs');
const {PACK,sha,canonical,validate}=require('./contract.cjs');
const DIR=path.resolve(__dirname,'../../../testdata/evidence-intelligence/city-core-v1');
async function main(){
 const apply=process.argv.includes('--apply'),pack=JSON.parse(fs.readFileSync(path.join(DIR,'pack.json'))),vectors=JSON.parse(fs.readFileSync(path.join(DIR,'embeddings.json'))),anchors=JSON.parse(fs.readFileSync(path.join(DIR,'anchors.json')));
 validate(pack,p=>fs.readFileSync(path.join(DIR,p)));assert.equal(vectors.packSha256,sha(canonical(pack)));assert.equal(pack.anchorSnapshotSha256,sha(canonical(anchors)));
 assert.equal(vectors.vectors.length,252);
 const c=await connect();
 const counts=async()=>({evidence:await rows(c,`SELECT p.profile_code,COUNT(e.evidence_id) n FROM z_base_dataset_profiles p LEFT JOIN z_base_evidence_items e ON e.dataset_profile_id=p.dataset_profile_id GROUP BY p.profile_code ORDER BY p.profile_code`),
  live:(await rows(c,'SELECT COUNT(*) n FROM evidence_items'))[0].N,
  vectors:await rows(c,"SELECT 'text' modality,profile_code,COUNT(*) n FROM ei_text_vectors GROUP BY profile_code UNION ALL SELECT 'image',profile_code,COUNT(*) FROM ei_image_vectors GROUP BY profile_code ORDER BY 1,2")});
 try{
  await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  const active=(await rows(c,'SELECT a.*,p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1 FOR UPDATE OF a.dataset_profile_id NOWAIT'))[0];
  assert(pack.cities.some(p=>p.profileCode===active.PROFILE_CODE));
  await c.execute('LOCK TABLE evidence_items,z_base_evidence_items,ei_text_vectors,ei_image_vectors IN EXCLUSIVE MODE NOWAIT');
  await c.execute('LOCK TABLE z_base_crime_incidents,z_base_case_incident_links,z_base_person_incident_links,crime_incidents IN SHARE MODE NOWAIT');
  const before=await counts(),added={},addedVectors={text:0,image:0};let addedLive=0;
  for(const city of pack.cities){
   const p=(await rows(c,'SELECT dataset_profile_id FROM z_base_dataset_profiles WHERE profile_code=:p',{p:city.profileCode}))[0];assert(p);
   const expected=anchors.cities.find(p=>p.profileCode===city.profileCode);assert.equal(p.DATASET_PROFILE_ID,expected.id);
   for(const a of expected.anchors){
    const current=(await rows(c,'SELECT incident_id,suburb,occurred_at,latitude,longitude FROM z_base_crime_incidents WHERE dataset_profile_id=:pid AND incident_ref=:ref',{pid:p.DATASET_PROFILE_ID,ref:a.INCIDENT_REF}))[0];
    assert(current);assert.equal(current.INCIDENT_ID,a.INCIDENT_ID);assert.equal(current.SUBURB,a.SUBURB);assert.equal(current.OCCURRED_AT.toISOString(),a.OCCURRED_AT);assert.equal(current.LATITUDE,a.LATITUDE);assert.equal(current.LONGITUDE,a.LONGITUDE);
    if(a.CASE_REF)assert.equal((await rows(c,`SELECT COUNT(*) n FROM z_base_case_incident_links l JOIN z_base_case_files f ON f.dataset_profile_id=l.dataset_profile_id AND f.case_id=l.case_id WHERE l.dataset_profile_id=:pid AND l.incident_id=:id AND f.case_ref=:ref`,{pid:p.DATASET_PROFILE_ID,id:a.INCIDENT_ID,ref:a.CASE_REF}))[0].N,1);
    for(const person of a.people)assert.equal((await rows(c,`SELECT COUNT(*) n FROM z_base_person_incident_links l JOIN z_base_persons f ON f.dataset_profile_id=l.dataset_profile_id AND f.person_id=l.person_id WHERE l.dataset_profile_id=:pid AND l.incident_id=:id AND f.person_ref=:ref`,{pid:p.DATASET_PROFILE_ID,id:a.INCIDENT_ID,ref:person.PERSON_REF}))[0].N,1);
   }
   added[city.profileCode]=0;
   for(const item of city.items){
    const metadata={pack_code:PACK,profile_code:city.profileCode,evidence_ref:item.evidenceRef,record_sha256:sha(canonical(item)),synthetic_record:true,observed_detail:item.description,evidence_intelligence:item};
    for(const saved of [true,false]){
     if(!saved&&city.profileCode!==active.PROFILE_CODE)continue;
     const table=saved?'z_base_evidence_items':'evidence_items',binds={ref:item.evidenceRef,...(saved?{pid:p.DATASET_PROFILE_ID}:{})};
     const existing=await rows(c,`SELECT JSON_SERIALIZE(evidence_metadata RETURNING CLOB) metadata FROM ${table} WHERE JSON_VALUE(evidence_metadata,'$.evidence_ref')=:ref ${saved?'AND dataset_profile_id=:pid':''}`,binds);
     assert(existing.length<=1);
     if(existing.length){assert.deepEqual(JSON.parse(existing[0].METADATA),metadata,'Differing duplicate '+item.evidenceRef);continue;}
     const common={kind:item.kind,doc:{val:JSON.stringify(metadata),type:oracle.CLOB},incident:item.incidentRef};
     const result=await c.execute(saved?`INSERT INTO z_base_evidence_items(dataset_profile_id,evidence_id,incident_id,evidence_type,evidence_metadata,created_at)
      SELECT :pid,(SELECT NVL(MAX(evidence_id),0)+1 FROM z_base_evidence_items WHERE dataset_profile_id=:pid),i.incident_id,:kind,JSON(:doc),SYSTIMESTAMP FROM z_base_crime_incidents i WHERE dataset_profile_id=:pid AND incident_ref=:incident`:
      'INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata) SELECT incident_id,:kind,JSON(:doc) FROM crime_incidents WHERE incident_ref=:incident',
      {...common,...(saved?{pid:p.DATASET_PROFILE_ID}:{})});
     assert.equal(result.rowsAffected,1);if(saved)added[city.profileCode]++;else addedLive++;
    }
   }
  }
  for(const v of vectors.vectors){
   const city=pack.cities.find(p=>p.profileCode===v.profileCode),item=city.items.find(e=>e.evidenceRef===v.evidenceRef);assert(item);
   const image=v.modality==='image';assert.equal(v.values.length,image?512:384);assert(v.values.every(Number.isFinite));
   assert.equal(v.sourceSha256,image?item.asset.sha256:item.indexTextSha256);assert.equal(v.model,image?vectors.imageModel:vectors.textModel);
   const table=image?'ei_image_vectors':'ei_text_vectors',binds={profile:v.profileCode,ref:v.evidenceRef};
   const existing=await rows(c,`SELECT source_sha256,model FROM ${table} WHERE profile_code=:profile AND evidence_ref=:ref`,binds);
   if(existing.length){assert.equal(existing[0].SOURCE_SHA256,v.sourceSha256);assert.equal(existing[0].MODEL,v.model);continue;}
   await c.execute(`INSERT INTO ${table}(profile_code,evidence_ref,source_sha256,model,embedding) VALUES(:profile,:ref,:hash,:model,TO_VECTOR(:v))`,{...binds,hash:v.sourceSha256,model:v.model,v:{val:JSON.stringify(v.values),type:oracle.CLOB}});addedVectors[v.modality]++;
  }
  const after=await counts();for(const p of before.evidence)assert.equal(after.evidence.find(a=>a.PROFILE_CODE===p.PROFILE_CODE).N,p.N+(added[p.PROFILE_CODE]||0));
  assert.equal(after.live,before.live+addedLive);
  for(const city of pack.cities){
   const result=await rows(c,`SELECT COUNT(*) n FROM z_base_evidence_items e JOIN z_base_dataset_profiles p ON p.dataset_profile_id=e.dataset_profile_id WHERE p.profile_code=:p AND JSON_VALUE(e.evidence_metadata,'$.pack_code')=:pack`,{p:city.profileCode,pack:PACK});assert.equal(result[0].N,24);
   for(const table of ['ei_text_vectors','ei_image_vectors'])assert.equal((await rows(c,`SELECT COUNT(*) n FROM ${table} WHERE profile_code=:p AND evidence_ref LIKE :ref`,{p:city.profileCode,ref:city.items[0].evidenceRef.slice(0,-2)+'%'}))[0].N,table==='ei_text_vectors'?24:4);
  }
  assert.deepEqual((await rows(c,'SELECT a.*,p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1'))[0],active);
  if(apply)await c.commit();else {await c.rollback();assert.deepEqual(await counts(),before);}
  console.log(JSON.stringify({mode:apply?'committed':'rolled_back',activeUnchanged:active,addedSaved:added,addedLive,addedVectors,before,after,existingRecordsOverwritten:0,at:new Date().toISOString()},null,2));
 }catch(e){await c.rollback();throw e;}finally{await c.rollback();await c.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
