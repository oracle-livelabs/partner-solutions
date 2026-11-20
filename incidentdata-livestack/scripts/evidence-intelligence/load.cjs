'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect,rows,oracle}=require('./connection.cjs');
const {canonical,sha256,validate}=require('./contract.cjs');
const ROOT=path.resolve(__dirname,'../../'),DIR=path.join(ROOT,'testdata/evidence-intelligence/v1'),OUT=path.join(ROOT,'evidence_intelligence_20260924');
const read=n=>JSON.parse(fs.readFileSync(path.join(DIR,n)));
const pack=read('pack.json'),anchors=read('anchors.json'),vectors=read('embeddings.json');
async function counts(c){return rows(c,`SELECT 'ACTIVE' scope,COUNT(*) n FROM evidence_items UNION ALL SELECT p.profile_code,COUNT(*) FROM z_base_evidence_items e JOIN z_base_dataset_profiles p ON p.dataset_profile_id=e.dataset_profile_id GROUP BY p.profile_code`);}
async function load(c,apply=false){
  assert(validate(pack,anchors,p=>fs.readFileSync(path.join(DIR,p))).valid);
  assert.equal(vectors.packSha256,sha256(canonical(pack)));
  // DDL setup is separate: this data transaction can always be rolled back.
  await c.execute('LOCK TABLE z_base_active_dataset_profile,crime_incidents,case_incident_links,person_incident_links,z_base_crime_incidents IN SHARE MODE NOWAIT');
  await c.execute('LOCK TABLE evidence_items,z_base_evidence_items,ei_text_vectors,ei_image_vectors IN EXCLUSIVE MODE NOWAIT');
  const active=(await rows(c,`SELECT p.profile_code,p.dataset_profile_id FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`))[0];
  assert.equal(active.PROFILE_CODE,pack.profileCode);
  const before=await counts(c),profile=active.DATASET_PROFILE_ID;
  for(const i of anchors.incidents){
    const found=await rows(c,`SELECT i.incident_ref,i.suburb,i.occurred_at FROM crime_incidents i
      JOIN case_incident_links l ON l.incident_id=i.incident_id JOIN case_files cf ON cf.case_id=l.case_id
      JOIN person_incident_links pl ON pl.incident_id=i.incident_id JOIN persons_of_interest p ON p.person_id=pl.person_id
      WHERE i.incident_ref=:ref AND cf.case_ref=:caseRef AND p.person_ref=:person`,{ref:i.INCIDENT_REF,caseRef:i.CASE_REF,person:anchors.links.find(l=>l.INCIDENT_REF===i.INCIDENT_REF).PERSON_REF});
    assert.equal(found.length,1,i.INCIDENT_REF);assert.equal(found[0].SUBURB,i.SUBURB);assert.equal(found[0].OCCURRED_AT.toISOString(),i.OCCURRED_AT);
    const saved=await rows(c,'SELECT incident_id FROM z_base_crime_incidents WHERE dataset_profile_id=:p AND incident_ref=:r',{p:profile,r:i.INCIDENT_REF});assert.equal(saved.length,1);
  }
  let addedLive=0,addedSaved=0,addedVectors=0;
  for(const item of pack.items){
    const metadata={pack_code:pack.packageCode,profile_code:pack.profileCode,evidence_ref:item.evidenceRef,record_sha256:sha256(canonical(item)),synthetic_record:true,observed_detail:item.description,shared_marker:item.markers.map(m=>m.namespace+':'+m.value).join(' / ')||null,asset_uri:null,asset_caption:item.asset.caption,evidence_intelligence:item};
    const doc={val:JSON.stringify(metadata),type:oracle.CLOB};
    for(const saved of [false,true]){
      const table=saved?'z_base_evidence_items':'evidence_items';
      const binds={ref:item.evidenceRef,...(saved?{profile}:{})};
      const existing=await rows(c,`SELECT JSON_SERIALIZE(evidence_metadata RETURNING CLOB) metadata FROM ${table} WHERE JSON_VALUE(evidence_metadata,'$.evidence_ref')=:ref ${saved?'AND dataset_profile_id=:profile':''}`,binds);
      assert(existing.length<=1,'Duplicate '+item.evidenceRef);
      if(existing.length){assert.deepEqual(JSON.parse(existing[0].METADATA),metadata);continue;}
      const r=await c.execute(saved?`INSERT INTO z_base_evidence_items(dataset_profile_id,evidence_id,incident_id,evidence_type,evidence_metadata,created_at)
        SELECT :profile,(SELECT NVL(MAX(evidence_id),0)+1 FROM z_base_evidence_items WHERE dataset_profile_id=:profile),i.incident_id,:kind,JSON(:doc),SYSTIMESTAMP
        FROM z_base_crime_incidents i WHERE dataset_profile_id=:profile AND incident_ref=:incident`:
        `INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata) SELECT incident_id,:kind,JSON(:doc) FROM crime_incidents WHERE incident_ref=:incident`,
        {kind:item.kind,doc,incident:item.incidentRef,...(saved?{profile}:{})});
      assert.equal(r.rowsAffected,1);if(saved)addedSaved++;else addedLive++;
    }
  }
  for(const v of vectors.vectors){
    const item=pack.items.find(e=>e.evidenceRef===v.evidenceRef),table=v.modality==='text'?'ei_text_vectors':'ei_image_vectors';
    assert.equal(v.sourceSha256,v.modality==='text'?item.indexTextSha256:item.asset.sha256);
    assert.equal(v.values.length,v.modality==='text'?384:512);assert(v.values.every(Number.isFinite));
    const binds={profile:pack.profileCode,ref:v.evidenceRef};
    const existing=await rows(c,`SELECT source_sha256,model FROM ${table} WHERE profile_code=:profile AND evidence_ref=:ref`,binds);
    if(existing.length){assert.equal(existing[0].SOURCE_SHA256,v.sourceSha256);assert.equal(existing[0].MODEL,v.model);continue;}
    await c.execute(`INSERT INTO ${table}(profile_code,evidence_ref,source_sha256,model,embedding) VALUES(:profile,:ref,:hash,:model,TO_VECTOR(:v))`,{...binds,hash:v.sourceSha256,model:v.model,v:{val:JSON.stringify(v.values),type:oracle.CLOB}});addedVectors++;
  }
  const after=await counts(c);
  for(const r of before)assert.equal(after.find(a=>a.SCOPE===r.SCOPE).N,r.N+(r.SCOPE==='ACTIVE'?addedLive:r.SCOPE===pack.profileCode?addedSaved:0));
  assert.equal((await rows(c,'SELECT COUNT(*) n FROM secure_ei_items_v'))[0].N,32);
  if(apply)await c.commit();else await c.rollback();
  return {at:new Date().toISOString(),mode:apply?'committed':'rolled_back',profile:pack.profileCode,addedLive,addedSaved,addedVectors,before,stagedAfter:after,profileSwitch:false,existingRowsOverwritten:0};
}
if(require.main===module)(async()=>{const apply=process.argv.includes('--apply'),c=await connect();try{
  const receipt=path.join(OUT,apply?'load-committed.json':'load-check.json');assert(!fs.existsSync(receipt),'Receipt already exists; inspect before retry');
  const result=await load(c,apply);fs.writeFileSync(receipt,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}finally{await c.rollback();await c.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={load};
