'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect,rows,oracle}=require('../evidence-intelligence/connection.cjs');
const {DIR,OUT,PROFILE,PACK,KNOWLEDGE,read,save,sha256,canonical}=require('./common.cjs');
const {protectedState,savedCounts}=require('./capture.cjs'),{validate}=require('./validate.cjs');
const clob=value=>({val:typeof value==='string'?value:JSON.stringify(value),type:oracle.CLOB});
async function load(c,apply=false,verify=null){
  const pack=read(DIR,'pack.json'),anchors=read(DIR,'anchors.json'),vectors=read(DIR,'embeddings.json'),pre=read(OUT,'preflight.json');
  validate(pack,anchors,p=>fs.readFileSync(path.join(DIR,p)));assert.equal(vectors.packSha256,sha256(canonical(pack)));assert.equal(vectors.vectors.length,16);assert.equal(vectors.people.length,2);
  await c.execute('LOCK TABLE z_base_active_dataset_profile,crime_incidents,incident_reports,case_files,case_incident_links,security_user_geo_entitlements,watched_crime_patterns,watched_pattern_incidents IN SHARE MODE NOWAIT');
  await c.execute('LOCK TABLE evidence_items,z_base_evidence_items,persons_of_interest,z_base_persons,person_incident_links,z_base_person_incident_links,ei_text_vectors,person_narrative_embeddings,z_base_person_narrative_vec IN EXCLUSIVE MODE NOWAIT');
  const active=(await rows(c,`SELECT p.profile_code,p.dataset_profile_id FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`))[0];assert.equal(active.PROFILE_CODE,PROFILE);assert.equal(active.DATASET_PROFILE_ID,pre.profileId);
  assert.deepEqual(await protectedState(c),pre.protected,'Existing records changed since baseline; do not load');
  const profile=active.DATASET_PROFILE_ID,before=await savedCounts(c),added={liveEvidence:0,savedEvidence:0,livePeople:0,savedPeople:0,liveLinks:0,savedLinks:0,evidenceVectors:0,personVectors:0,savedPersonVectors:0};
  // Full source-row and saved-row guards, not only counts or titles.
  for(const i of anchors.incidents){const saved=await rows(c,'SELECT * FROM z_base_crime_incidents WHERE dataset_profile_id=:p AND incident_ref=:r',{p:profile,r:i.INCIDENT_REF});assert.equal(saved.length,1);assert.equal(canonical(saved[0]),canonical(anchors.savedIncidents.find(s=>s.INCIDENT_REF===i.INCIDENT_REF)));}
  for(const p of pack.people){
    const attrs={synthetic_record:true,generated_fictional:true,knowledge_set_id:KNOWLEDGE,pack_code:PACK,dataset_profile_code:PROFILE,recorded_role:p.role,source_evidence_refs:p.sourceRefs,stored_narrative_sha256:sha256(p.narrativeText),portrait_policy:'no_photo_supplied',association_is_not_evidence:true,synthetic_notice:'Wholly fictional documentary contact, not a real person. No allegation or finding of responsibility.'};
    const assigned=anchors.incidents.find(i=>i.INCIDENT_REF==='SYN-AMS-2026-12200'),savedAssigned=anchors.savedIncidents.find(i=>i.INCIDENT_REF===assigned.INCIDENT_REF);
    for(const saved of [false,true]){
      const table=saved?'z_base_persons':'persons_of_interest',binds={r:p.personRef,...(saved?{profile}:{})};
      const found=await rows(c,`SELECT person_ref,display_name,narrative_summary,narrative_text,profile_attributes FROM ${table} WHERE person_ref=:r ${saved?'AND dataset_profile_id=:profile':''}`,binds);
      assert(found.length<=1);if(found.length){assert.equal(found[0].DISPLAY_NAME,p.displayName);assert.equal(found[0].NARRATIVE_SUMMARY,p.narrativeSummary);assert.equal(found[0].NARRATIVE_TEXT,p.narrativeText);assert.equal(canonical(found[0].PROFILE_ATTRIBUTES),canonical(attrs));continue;}
      const sql=`INSERT INTO ${table}(${saved?'dataset_profile_id,person_id,':''}person_ref,display_name,alias_name,person_status,portrait_variant,portrait_alt_text,narrative_summary,narrative_text,profile_attributes,owning_patrol_area_id,created_at)
        VALUES(${saved?':profile,(SELECT NVL(MAX(person_id),0)+1 FROM z_base_persons WHERE dataset_profile_id=:profile),':''}:r,:name,:alias,'associate','synthetic-avatar-1','No photograph supplied; fictional teaching contact.',:summary,:narrative,JSON(:attrs),:area,SYSTIMESTAMP)`;
      await c.execute(sql,{...binds,name:p.displayName,alias:p.role==='care_worker'?'Care Worker A':'Outside Contact B',summary:p.narrativeSummary,narrative:clob(p.narrativeText),attrs:clob(attrs),area:saved?savedAssigned.PATROL_AREA_ID:assigned.PATROL_AREA_ID});added[saved?'savedPeople':'livePeople']++;
    }
  }
  for(const l of pack.newLinks)for(const saved of [false,true]){
    const table=saved?'z_base_person_incident_links':'person_incident_links',pt=saved?'z_base_persons':'persons_of_interest',it=saved?'z_base_crime_incidents':'crime_incidents',binds={person:l.personRef,incident:l.incidentRef,...(saved?{profile}:{})};
    const ids=(await rows(c,`SELECT p.person_id,i.incident_id FROM ${pt} p CROSS JOIN ${it} i WHERE p.person_ref=:person AND i.incident_ref=:incident ${saved?'AND p.dataset_profile_id=:profile AND i.dataset_profile_id=:profile':''}`,binds));assert.equal(ids.length,1);
    const id={person:ids[0].PERSON_ID,incident:ids[0].INCIDENT_ID,...(saved?{profile}:{})};
    const existing=await rows(c,`SELECT connection_type,link_summary FROM ${table} WHERE person_id=:person AND incident_id=:incident ${saved?'AND dataset_profile_id=:profile':''}`,id);
    if(existing.length){assert.equal(existing.length,1);assert.equal(existing[0].CONNECTION_TYPE,'associate');assert.equal(existing[0].LINK_SUMMARY,l.summary);continue;}
    await c.execute(`INSERT INTO ${table}(${saved?'dataset_profile_id,':''}person_id,incident_id,connection_type,link_summary,created_at) VALUES(${saved?':profile,':''}:person,:incident,'associate',:summary,SYSTIMESTAMP)`,{...id,summary:l.summary});added[saved?'savedLinks':'liveLinks']++;
  }
  for(const item of pack.items){
    const metadata={pack_code:PACK,profile_code:PROFILE,evidence_ref:item.evidenceRef,record_sha256:sha256(canonical(item)),synthetic_record:true,knowledge_set_id:KNOWLEDGE,observed_detail:item.description,shared_marker:item.markers.map(m=>m.namespace+':'+m.value).join(' / ')||null,asset_uri:null,asset_caption:item.asset.caption,evidence_intelligence:item};
    for(const saved of [false,true]){
      const table=saved?'z_base_evidence_items':'evidence_items',binds={r:item.evidenceRef,...(saved?{profile}:{})};
      const found=await rows(c,`SELECT JSON_SERIALIZE(evidence_metadata RETURNING CLOB) metadata FROM ${table} WHERE JSON_VALUE(evidence_metadata,'$.evidence_ref')=:r ${saved?'AND dataset_profile_id=:profile':''}`,binds);assert(found.length<=1);
      if(found.length){assert.deepEqual(JSON.parse(found[0].METADATA),metadata);continue;}
      const sql=saved?`INSERT INTO z_base_evidence_items(dataset_profile_id,evidence_id,incident_id,evidence_type,evidence_metadata,created_at) SELECT :profile,(SELECT NVL(MAX(evidence_id),0)+1 FROM z_base_evidence_items WHERE dataset_profile_id=:profile),incident_id,:kind,JSON(:doc),SYSTIMESTAMP FROM z_base_crime_incidents WHERE dataset_profile_id=:profile AND incident_ref=:incident`:
        `INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata) SELECT incident_id,:kind,JSON(:doc) FROM crime_incidents WHERE incident_ref=:incident`;
      const result=await c.execute(sql,{kind:item.kind,doc:clob(metadata),incident:item.incidentRef,...(saved?{profile}:{})});assert.equal(result.rowsAffected,1);added[saved?'savedEvidence':'liveEvidence']++;
    }
  }
  for(const v of vectors.vectors){const item=pack.items.find(e=>e.evidenceRef===v.evidenceRef);assert(item);assert.equal(v.sourceSha256,item.indexTextSha256);assert.equal(v.values.length,384);assert(v.values.every(Number.isFinite));
    const found=await rows(c,'SELECT source_sha256,model FROM ei_text_vectors WHERE profile_code=:p AND evidence_ref=:r',{p:PROFILE,r:v.evidenceRef});
    if(found.length){assert.equal(found[0].SOURCE_SHA256,v.sourceSha256);assert.equal(found[0].MODEL,v.model);continue;}
    await c.execute('INSERT INTO ei_text_vectors(profile_code,evidence_ref,source_sha256,model,embedding) VALUES(:p,:r,:hash,:model,TO_VECTOR(:v))',{p:PROFILE,r:v.evidenceRef,hash:v.sourceSha256,model:v.model,v:clob(v.values)});added.evidenceVectors++;
  }
  for(const v of vectors.people){assert.equal(v.sourceSha256,sha256(pack.people.find(p=>p.personRef===v.personRef).narrativeText));assert.equal(v.values.length,384);assert(v.values.every(Number.isFinite));
    for(const saved of [false,true]){const table=saved?'z_base_person_narrative_vec':'person_narrative_embeddings',pt=saved?'z_base_persons':'persons_of_interest';
      const binds={ref:v.personRef,...(saved?{profile}:{})},found=await rows(c,`SELECT v.source_sha256,v.embedding_model FROM ${table} v JOIN ${pt} p ON p.person_id=v.person_id ${saved?'AND p.dataset_profile_id=v.dataset_profile_id':''} WHERE p.person_ref=:ref ${saved?'AND p.dataset_profile_id=:profile':''}`,binds);
      if(found.length){assert.equal(found.length,1);assert.equal(found[0].SOURCE_SHA256,v.sourceSha256);assert.equal(found[0].EMBEDDING_MODEL,v.model);continue;}
      await c.execute(`INSERT INTO ${table}(${saved?'dataset_profile_id,':''}person_id,embedding_model,source_sha256,embedding,created_at) SELECT ${saved?':profile,':''}person_id,:model,:hash,TO_VECTOR(:v),SYSTIMESTAMP FROM ${pt} WHERE person_ref=:ref ${saved?'AND dataset_profile_id=:profile':''}`,{...binds,model:v.model,hash:v.sourceSha256,v:clob(v.values)});added[saved?'savedPersonVectors':'personVectors']++;
    }
  }
  assert.deepEqual(await protectedState(c),pre.protected,'Existing records were modified');
  const after=await savedCounts(c);for(const b of before){const a=after.find(x=>x.PROFILE_CODE===b.PROFILE_CODE);assert.deepEqual(a,{...b,EVIDENCE:b.EVIDENCE+(b.PROFILE_CODE===PROFILE?added.savedEvidence:0),PEOPLE:b.PEOPLE+(b.PROFILE_CODE===PROFILE?added.savedPeople:0),LINKS:b.LINKS+(b.PROFILE_CODE===PROFILE?added.savedLinks:0)});}
  assert.equal((await rows(c,'SELECT COUNT(*) n FROM secure_ei_items_v'))[0].N,48);
  const verification=verify?await verify(c):null;
  if(apply)await c.commit();else await c.rollback();
  return {at:new Date().toISOString(),mode:apply?'committed':'rolled_back',profileCode:PROFILE,packSha256:sha256(canonical(pack)),added,before,after,verification,existingRowsOverwritten:0,profileSwitch:false,entitlementsChanged:false,protectedHashesMatch:true};
}
if(require.main===module)(async()=>{const apply=process.argv.includes('--apply'),name=process.argv.includes('--idempotence')?'idempotence.json':apply?'load-committed.json':'load-check.json';assert(!fs.existsSync(path.join(OUT,name)),'Receipt exists; inspect it before retrying');const c=await connect();try{const r=await load(c,apply);save(OUT,name,r,true);console.log(JSON.stringify(r));}finally{await c.rollback();await c.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={load};
