'use strict';
const assert=require('node:assert/strict');
const {connect,rows}=require('../evidence-intelligence/connection.cjs');
const {OUT,PROFILE,PACK,save,read,sha256,canonical}=require('./common.cjs');
const {protectedState,savedCounts}=require('./capture.cjs');
async function main(){const c=await connect();try{await c.execute('SET TRANSACTION READ ONLY');
  assert.equal((await rows(c,`SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`))[0].PROFILE_CODE,PROFILE);
  const protectedHashes=await protectedState(c);assert.deepEqual(protectedHashes,read(OUT,'preflight.json').protected);
  const snapshot={at:new Date().toISOString(),profileCode:PROFILE,packCode:PACK,protectedHashes,savedCounts:await savedCounts(c),tables:{}};
  const queries={liveEvidence:`SELECT * FROM evidence_items WHERE JSON_VALUE(evidence_metadata,'$.pack_code')='${PACK}' ORDER BY evidence_id`,savedEvidence:`SELECT * FROM z_base_evidence_items WHERE dataset_profile_id=30 AND JSON_VALUE(evidence_metadata,'$.pack_code')='${PACK}' ORDER BY evidence_id`,
    livePeople:"SELECT * FROM persons_of_interest WHERE person_ref IN ('POI-AMS-CARE-W01','POI-AMS-CARE-X01') ORDER BY person_ref",savedPeople:"SELECT * FROM z_base_persons WHERE dataset_profile_id=30 AND person_ref IN ('POI-AMS-CARE-W01','POI-AMS-CARE-X01') ORDER BY person_ref",
    liveLinks:"SELECT l.*,p.person_ref,i.incident_ref FROM person_incident_links l JOIN persons_of_interest p ON p.person_id=l.person_id JOIN crime_incidents i ON i.incident_id=l.incident_id WHERE p.person_ref IN ('POI-AMS-CARE-W01','POI-AMS-CARE-X01') ORDER BY p.person_ref,i.incident_ref",
    savedLinks:"SELECT l.*,p.person_ref,i.incident_ref FROM z_base_person_incident_links l JOIN z_base_persons p ON p.person_id=l.person_id AND p.dataset_profile_id=l.dataset_profile_id JOIN z_base_crime_incidents i ON i.incident_id=l.incident_id AND i.dataset_profile_id=l.dataset_profile_id WHERE l.dataset_profile_id=30 AND p.person_ref IN ('POI-AMS-CARE-W01','POI-AMS-CARE-X01') ORDER BY p.person_ref,i.incident_ref",
    evidenceVectors:"SELECT profile_code,evidence_ref,source_sha256,model,VECTOR_SERIALIZE(embedding RETURNING CLOB) embedding FROM ei_text_vectors WHERE profile_code='AMSTERDAM_DATA_V1' AND evidence_ref LIKE 'EV-AMS-H__' ORDER BY evidence_ref",
    livePersonVectors:"SELECT p.person_ref,v.embedding_model,v.source_sha256,VECTOR_SERIALIZE(v.embedding RETURNING CLOB) embedding FROM person_narrative_embeddings v JOIN persons_of_interest p ON p.person_id=v.person_id WHERE p.person_ref IN ('POI-AMS-CARE-W01','POI-AMS-CARE-X01') ORDER BY p.person_ref",
    savedPersonVectors:"SELECT p.person_ref,v.embedding_model,v.source_sha256,VECTOR_SERIALIZE(v.embedding RETURNING CLOB) embedding FROM z_base_person_narrative_vec v JOIN z_base_persons p ON p.person_id=v.person_id AND p.dataset_profile_id=v.dataset_profile_id WHERE v.dataset_profile_id=30 AND p.person_ref IN ('POI-AMS-CARE-W01','POI-AMS-CARE-X01') ORDER BY p.person_ref"};
  for(const[name,sql]of Object.entries(queries))snapshot.tables[name]=await rows(c,sql);
  assert.equal(snapshot.tables.liveEvidence.length,16);assert.equal(snapshot.tables.savedEvidence.length,16);assert.equal(snapshot.tables.livePeople.length,2);assert.equal(snapshot.tables.savedLinks.length,3);
  save(OUT,'postload-backup.json',snapshot,true);save(OUT,'postload-backup-manifest.json',{at:snapshot.at,sha256:sha256(canonical(snapshot)),tables:Object.fromEntries(Object.entries(snapshot.tables).map(([n,r])=>[n,r.length])),protectedHashesMatch:true},true);
  console.log('Recoverable Care-Trust rows and vectors exported; pre-existing records still match baseline.');
}finally{await c.rollback();await c.close();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
