'use strict';
const assert=require('node:assert/strict');
const {connect,rows,oracle}=require('../evidence-intelligence/connection.cjs');
const {DIR,OUT,PROFILE,PID,PACK,PATTERN,CASE,KNOWLEDGE,read,save,canonical,sha256}=require('./common.cjs');
const {validate}=require('./fixture.cjs'),{protectedState}=require('./capture.cjs'),{savedCounts}=require('../care-trust/capture.cjs');
const clob=v=>({val:typeof v==='string'?v:JSON.stringify(v),type:oracle.CLOB});
async function active(c){return (await rows(c,'SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE control_id=1'))[0].PROFILE_CODE;}
async function schema(c){
  const pre=read(OUT,'preflight.json');assert.equal(await active(c),pre.active[0].PROFILE_CODE);
  const before=(await rows(c,"SELECT text FROM user_views WHERE view_name='SECURE_EI_ITEMS_V'"))[0].TEXT;assert.equal(before,pre.view);
  const old="'EI_AMSTERDAM_V1','EI_AMSTERDAM_CARE_V1','EI_AMSTERDAM_CARE_V2'";assert(before.includes(old));
  const after=before.replace(old,old+",'EI_ADELAIDE_CARE_V1'");
  await c.execute('CREATE OR REPLACE VIEW secure_ei_items_v AS '+after);save(OUT,'schema.json',{at:new Date().toISOString(),before,after,profileAndScopePredicatesUnchanged:true});
  console.log('Adelaide pack allowlisted; active-profile and secure-incident predicates unchanged.');
}
async function verifySaved(c){
  const pack=read(DIR,'pack.json'),checks=[];const check=(name,value)=>{assert(value,name);checks.push(name);};
  const data=await rows(c,`SELECT e.incident_id,i.incident_ref,JSON_SERIALIZE(e.evidence_metadata RETURNING CLOB) doc FROM z_base_evidence_items e JOIN z_base_crime_incidents i ON i.dataset_profile_id=e.dataset_profile_id AND i.incident_id=e.incident_id WHERE e.dataset_profile_id=:p AND JSON_VALUE(e.evidence_metadata,'$.pack_code')=:pack ORDER BY JSON_VALUE(e.evidence_metadata,'$.evidence_ref')`,{p:PID,pack:PACK});
  check('21 saved evidence documents resolve to exact saved incidents',data.length===21);
  for(const r of data){const e=JSON.parse(r.DOC),item=pack.items.find(i=>i.evidenceRef===e.evidence_ref);assert(item);assert.deepEqual(e.evidence_intelligence,item);assert.equal(e.record_sha256,sha256(canonical(item)));assert.equal(r.INCIDENT_REF,item.incidentRef);}
  check('saved source hashes and original incident bindings match',true);
  const vector=await rows(c,`SELECT evidence_ref,1-VECTOR_DISTANCE(embedding,(SELECT embedding FROM ei_text_vectors WHERE profile_code=:p AND evidence_ref='EV-ADL-H19'),COSINE) score FROM ei_text_vectors WHERE profile_code=:p AND evidence_ref<>'EV-ADL-H19' ORDER BY score DESC FETCH FIRST 6 ROWS ONLY`,{p:PROFILE});
  check('native Oracle vector ranking retrieves the qualifying financial addendum',vector.some(e=>e.EVIDENCE_REF==='EV-ADL-H20'));
  check('seven exact saved watch memberships remain',(await rows(c,'SELECT COUNT(*) n FROM z_base_watched_pattern_incidents WHERE dataset_profile_id=:p AND pattern_code=:w',{p:PID,w:PATTERN}))[0].N===7);
  check('resolved Mitchell Park anchor remains resolved',(await rows(c,"SELECT incident_status FROM z_base_crime_incidents WHERE dataset_profile_id=6 AND incident_ref='ACI-V2-2026-0005'"))[0].INCIDENT_STATUS==='resolved');
  check('only two new public signals have reviewed incident edges',(await rows(c,"SELECT COUNT(*) n FROM z_base_social_post_incident_links WHERE dataset_profile_id=6 AND post_ref LIKE 'SYN-ADL-CARE-POST-%' AND review_status='reviewed'"))[0].N===2);
  check('funding-awareness post has no incident edge',(await rows(c,"SELECT COUNT(*) n FROM z_base_social_post_incident_links WHERE dataset_profile_id=6 AND post_ref='SYN-ADL-CARE-POST-03'"))[0].N===0);
  check('Amsterdam remains active for other sessions',await active(c)==='AMSTERDAM_DATA_V1');
  return {status:'passed',checks,vector};
}
async function load(c,apply=false){
  const pack=read(DIR,'pack.json'),vec=read(DIR,'embeddings.json'),pre=read(OUT,'preflight.json');validate(pack);assert.equal(vec.packSha256,sha256(canonical(pack)));
  await c.execute('LOCK TABLE z_base_active_dataset_profile IN SHARE MODE NOWAIT');
  await c.execute('LOCK TABLE z_base_evidence_items,z_base_persons,z_base_person_incident_links,z_base_social_media_posts,z_base_social_post_incident_links,z_base_watched_pattern_posts,z_base_person_narrative_vec,ei_text_vectors IN EXCLUSIVE MODE NOWAIT');
  await c.execute('LOCK TABLE z_base_crime_incidents,z_base_incident_reports,z_base_watched_pattern_incidents,z_base_case_files,z_base_case_incident_links IN SHARE MODE NOWAIT');
  assert.equal(await active(c),pre.active[0].PROFILE_CODE);assert.notEqual(await active(c),PROFILE,'This saved-only loader must not run while Adelaide V2 is active');
  assert.deepEqual(await protectedState(c),pre.protected,'Original data changed since capture');
  const before=await savedCounts(c),added={evidence:0,people:0,personLinks:0,posts:0,postLinks:0,watchPosts:0,evidenceVectors:0,personVectors:0};
  for(const p of pack.people){
    const attrs={synthetic_record:true,generated_fictional:true,knowledge_set_id:KNOWLEDGE,pack_code:PACK,dataset_profile_code:PROFILE,recorded_role:p.role,source_evidence_refs:p.sourceRefs,stored_narrative_sha256:sha256(p.narrativeText),portrait_policy:'no_photo_supplied',association_is_not_evidence:true,synthetic_notice:'Wholly fictional documentary contact, not an identified offender.'};
    const old=await rows(c,'SELECT display_name,narrative_summary,narrative_text,profile_attributes FROM z_base_persons WHERE dataset_profile_id=:p AND person_ref=:r',{p:PID,r:p.personRef});
    if(old.length){assert.equal(old.length,1);assert.deepEqual(old[0],{DISPLAY_NAME:p.displayName,NARRATIVE_SUMMARY:p.narrativeSummary,NARRATIVE_TEXT:p.narrativeText,PROFILE_ATTRIBUTES:attrs});continue;}
    await c.execute(`INSERT INTO z_base_persons(dataset_profile_id,person_id,person_ref,display_name,alias_name,person_status,portrait_variant,portrait_alt_text,narrative_summary,narrative_text,profile_attributes,owning_patrol_area_id,created_at) VALUES(:p,(SELECT NVL(MAX(person_id),0)+1 FROM z_base_persons WHERE dataset_profile_id=:p),:r,:name,:alias,'associate','synthetic-avatar-1','No photograph supplied; wholly fictional documentary contact.',:summary,:text,JSON(:attrs),3,SYSTIMESTAMP)`,{p:PID,r:p.personRef,name:p.displayName,alias:p.role==='care_worker'?'Fictional care contact':'Fictional outside contact',summary:p.narrativeSummary,text:clob(p.narrativeText),attrs:clob(attrs)});added.people++;
  }
  for(const l of pack.newLinks){
    const ids=await rows(c,'SELECT p.person_id,i.incident_id FROM z_base_persons p CROSS JOIN z_base_crime_incidents i WHERE p.dataset_profile_id=6 AND i.dataset_profile_id=6 AND p.person_ref=:p AND i.incident_ref=:i',{p:l.personRef,i:l.incidentRef});assert.equal(ids.length,1);const binds={p:ids[0].PERSON_ID,i:ids[0].INCIDENT_ID};
    const old=await rows(c,'SELECT connection_type,link_summary FROM z_base_person_incident_links WHERE dataset_profile_id=6 AND person_id=:p AND incident_id=:i',binds);
    if(old.length){assert.deepEqual(old,[{CONNECTION_TYPE:'associate',LINK_SUMMARY:l.summary}]);continue;}
    await c.execute("INSERT INTO z_base_person_incident_links(dataset_profile_id,person_id,incident_id,connection_type,link_summary,created_at) VALUES(6,:p,:i,'associate',:s,SYSTIMESTAMP)",{...binds,s:l.summary});added.personLinks++;
  }
  for(const item of pack.items){
    const metadata={pack_code:PACK,profile_code:PROFILE,evidence_ref:item.evidenceRef,record_sha256:sha256(canonical(item)),synthetic_record:true,knowledge_set_id:KNOWLEDGE,evidence_intelligence:item,observed_detail:item.description};
    const old=await rows(c,"SELECT JSON_SERIALIZE(evidence_metadata RETURNING CLOB) doc FROM z_base_evidence_items WHERE dataset_profile_id=6 AND JSON_VALUE(evidence_metadata,'$.evidence_ref')=:r",{r:item.evidenceRef});
    if(old.length){assert.equal(old.length,1);assert.deepEqual(JSON.parse(old[0].DOC),metadata);continue;}
    assert.equal((await c.execute(`INSERT INTO z_base_evidence_items(dataset_profile_id,evidence_id,incident_id,evidence_type,evidence_metadata,created_at) SELECT 6,(SELECT NVL(MAX(evidence_id),0)+1 FROM z_base_evidence_items WHERE dataset_profile_id=6),incident_id,:kind,JSON(:doc),SYSTIMESTAMP FROM z_base_crime_incidents WHERE dataset_profile_id=6 AND incident_ref=:r`,{r:item.incidentRef,kind:item.kind,doc:clob(metadata)})).rowsAffected,1);added.evidence++;
  }
  for(const p of pack.posts){
    const attrs={synthetic_record:true,knowledge_set_id:KNOWLEDGE,story_version:'ADELAIDE_CARE_V1',city_profile:PROFILE,comparison_only:true,source_context_incident_ref:p.incidentRef,engagement_metrics:'Illustrative fixture values, not measured activity or risk',location_source:'Public post has no geolocation',original_statement_status:'unverified'};
    const old=await rows(c,'SELECT post_text,post_attributes FROM z_base_social_media_posts WHERE dataset_profile_id=6 AND post_ref=:r',{r:p.ref});
    if(old.length){assert.deepEqual(old,[{POST_TEXT:p.text,POST_ATTRIBUTES:attrs}]);}else{
      await c.execute(`INSERT INTO z_base_social_media_posts(dataset_profile_id,post_ref,source_code,posted_at,post_text,topic_code,topic_label,executive_group_code,suburb,patrol_area_code,latitude,longitude,geo_precision,reach_count,reshare_count,reply_count,signal_score,momentum_flag,verification_status,post_attributes,created_at) VALUES(6,:r,'SRC-NEIGHBOURHOOD',TO_TIMESTAMP_TZ(:at,'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM'),:text,:pattern,'Care-Trust: safeguarding questions',NULL,NULL,'SOUTH',NULL,NULL,'unknown',12,0,1,35,'normal',:status,JSON(:attrs),SYSTIMESTAMP)`,{r:p.ref,at:p.date.replace('Z','+00:00'),text:p.text,pattern:PATTERN,status:p.incidentRef?'incident_link_reviewed':'unverified',attrs:clob(attrs)});added.posts++;
    }
    const label=p.incidentRef?'Safeguarding concern with separately recorded comparison basis':'Related awareness only; no incident relationship';
    const w=await rows(c,'SELECT relationship_label FROM z_base_watched_pattern_posts WHERE dataset_profile_id=6 AND pattern_code=:p AND post_ref=:r',{p:PATTERN,r:p.ref});
    if(w.length)assert.deepEqual(w,[{RELATIONSHIP_LABEL:label}]);else{await c.execute('INSERT INTO z_base_watched_pattern_posts(dataset_profile_id,pattern_code,post_ref,relationship_label) VALUES(6,:p,:r,:l)',{p:PATTERN,r:p.ref,l:label});added.watchPosts++;}
    if(p.incidentRef){const link=await rows(c,'SELECT link_summary,review_status FROM z_base_social_post_incident_links WHERE dataset_profile_id=6 AND post_ref=:r AND incident_ref=:i',{r:p.ref,i:p.incidentRef});if(link.length)assert.deepEqual(link,[{LINK_SUMMARY:p.basis,REVIEW_STATUS:'reviewed'}]);else{
      await c.execute("INSERT INTO z_base_social_post_incident_links(dataset_profile_id,post_ref,incident_ref,link_type,link_confidence,link_summary,review_status,reviewed_by,reviewed_at) VALUES(6,:r,:i,'analyst_comparison',50,:s,'reviewed','statewide_admin',TIMESTAMP '2026-06-26 02:30:00')",{r:p.ref,i:p.incidentRef,s:p.basis});added.postLinks++;
    }}
  }
  for(const v of vec.vectors){assert.equal(v.values.length,384);assert(v.values.every(Number.isFinite));assert.equal(v.sourceSha256,pack.items.find(e=>e.evidenceRef===v.evidenceRef).indexTextSha256);
    const old=await rows(c,'SELECT source_sha256,model FROM ei_text_vectors WHERE profile_code=:p AND evidence_ref=:r',{p:PROFILE,r:v.evidenceRef});if(old.length){assert.deepEqual(old,[{SOURCE_SHA256:v.sourceSha256,MODEL:v.model}]);continue;}
    await c.execute('INSERT INTO ei_text_vectors(profile_code,evidence_ref,source_sha256,model,embedding) VALUES(:p,:r,:s,:m,TO_VECTOR(:v))',{p:PROFILE,r:v.evidenceRef,s:v.sourceSha256,m:v.model,v:clob(v.values)});added.evidenceVectors++;
  }
  for(const v of vec.people){assert.equal(v.values.length,384);assert(v.values.every(Number.isFinite));assert.equal(v.sourceSha256,sha256(pack.people.find(p=>p.personRef===v.personRef).narrativeText));
    const old=await rows(c,'SELECT v.source_sha256,v.embedding_model FROM z_base_person_narrative_vec v JOIN z_base_persons p ON p.dataset_profile_id=v.dataset_profile_id AND p.person_id=v.person_id WHERE v.dataset_profile_id=6 AND p.person_ref=:r',{r:v.personRef});
    if(old.length){assert.deepEqual(old,[{SOURCE_SHA256:v.sourceSha256,EMBEDDING_MODEL:v.model}]);continue;}
    await c.execute('INSERT INTO z_base_person_narrative_vec(dataset_profile_id,person_id,embedding_model,source_sha256,embedding,created_at) SELECT 6,person_id,:m,:s,TO_VECTOR(:v),SYSTIMESTAMP FROM z_base_persons WHERE dataset_profile_id=6 AND person_ref=:r',{r:v.personRef,m:v.model,s:v.sourceSha256,v:clob(v.values)});added.personVectors++;
  }
  const verification=await verifySaved(c);assert.deepEqual(await protectedState(c),pre.protected);
  const after=await savedCounts(c);for(const b of before)assert.deepEqual(after.find(a=>a.PROFILE_CODE===b.PROFILE_CODE),{...b,EVIDENCE:b.EVIDENCE+(b.PROFILE_CODE===PROFILE?added.evidence:0),PEOPLE:b.PEOPLE+(b.PROFILE_CODE===PROFILE?added.people:0),LINKS:b.LINKS+(b.PROFILE_CODE===PROFILE?added.personLinks:0)});
  if(apply)await c.commit();else await c.rollback();return {at:new Date().toISOString(),mode:apply?'committed_saved_profile_only':'rolled_back',added,verification,protectedHashesMatch:true,activeProfileUnchanged:true};
}
if(require.main===module)(async()=>{const c=await connect();try{const mode=process.argv[2];if(mode==='schema')return await schema(c);const name=mode==='apply'?'load-committed.json':mode==='idempotence'?'idempotence.json':'staged.json';const result=await load(c,mode==='apply');save(OUT,name,result);console.log(JSON.stringify(result));}finally{await c.rollback();await c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={verifySaved,active,load};
