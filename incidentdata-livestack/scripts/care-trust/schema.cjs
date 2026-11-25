'use strict';
const assert=require('node:assert/strict');
const {connect,rows}=require('../evidence-intelligence/connection.cjs');
const {PROFILE,OUT,read,save}=require('./common.cjs');
const SQL=`CREATE OR REPLACE VIEW secure_ei_items_v AS
  SELECT e.evidence_id,e.incident_id,e.evidence_type,e.created_at,i.incident_ref,i.occurred_at,i.suburb,i.latitude,i.longitude,
    p.profile_code,JSON_VALUE(e.evidence_metadata,'$.evidence_ref') evidence_ref,
    JSON_VALUE(e.evidence_metadata,'$.evidence_intelligence.title') title,
    JSON_VALUE(e.evidence_metadata,'$.evidence_intelligence.caseRef') case_ref,
    JSON_VALUE(e.evidence_metadata,'$.evidence_intelligence.indexTextSha256') text_sha256,
    JSON_VALUE(e.evidence_metadata,'$.evidence_intelligence.asset.sha256') asset_sha256,
    JSON_QUERY(e.evidence_metadata,'$.evidence_intelligence' RETURNING CLOB) document,
    JSON_VALUE(e.evidence_metadata,'$.pack_code') pack_code
  FROM evidence_items e JOIN secure_crime_incidents_v i ON i.incident_id=e.incident_id
  CROSS JOIN z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id
  WHERE a.control_id=1 AND JSON_VALUE(e.evidence_metadata,'$.pack_code') IN ('EI_AMSTERDAM_V1','EI_AMSTERDAM_CARE_V1')
    AND JSON_VALUE(e.evidence_metadata,'$.profile_code')=p.profile_code`;
async function main(){const c=await connect();try{
  const active=(await rows(c,`SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`))[0];assert.equal(active.PROFILE_CODE,PROFILE);
  const before=(await rows(c,"SELECT text FROM user_views WHERE view_name='SECURE_EI_ITEMS_V'"))[0].TEXT;
  const pre=read(OUT,'preflight.json');assert(before===pre.priorView||before.trim()===SQL.slice(SQL.indexOf('SELECT')).trim(),'Unexpected view change');
  await c.execute(SQL);
  assert.equal((await rows(c,"SELECT COUNT(*) n FROM user_errors WHERE name='SECURE_EI_ITEMS_V'"))[0].N,0);
  save(OUT,'schema.json',{at:new Date().toISOString(),status:'passed',change:'Add explicit Care-Trust pack allowlist and pack_code projection; retain active-profile and secure-incident joins',before,after:SQL},true);
  console.log('Scoped evidence view supports both Amsterdam packs; access entitlements unchanged.');
}finally{await c.close();}}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={SQL};
