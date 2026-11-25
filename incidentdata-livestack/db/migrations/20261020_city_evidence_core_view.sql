-- Additive evidence pack allowlist; preserve incident scope and active-profile filtering.
CREATE OR REPLACE VIEW secure_ei_items_v AS
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
  WHERE a.control_id=1 AND JSON_VALUE(e.evidence_metadata,'$.pack_code') IN ('EI_AMSTERDAM_V1','EI_AMSTERDAM_CARE_V1','EI_AMSTERDAM_CARE_V2','EI_ADELAIDE_CARE_V1','EI_PERTH_WATCH_V1','EI_BRISBANE_WATCH_V1','EI_BOSTON_WATCH_V1','EI_CHICAGO_WATCH_V1','EI_LAS_VEGAS_WATCH_V1','EI_CITY_CORE_V1')
    AND JSON_VALUE(e.evidence_metadata,'$.profile_code')=p.profile_code;
