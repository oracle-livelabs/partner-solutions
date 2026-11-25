/*
  Refine existing May/June demonstration-profile labels without changing
  provenance, counts, category calibration, relationships, or embeddings.
*/
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

UPDATE crime_incidents
SET vehicle_descriptor=REPLACE(vehicle_descriptor,'fictional ','');

UPDATE crime_incidents
SET incident_attributes=JSON_OBJECT(
  'synthetic_record' VALUE true,
  'profile' VALUE 'sapol_may_jun_2026_demonstration',
  'statistics_source' VALUE JSON_VALUE(incident_attributes,'$.statistics_source'),
  'report_month' VALUE JSON_VALUE(incident_attributes,'$.report_month'),
  'sapol_category' VALUE JSON_VALUE(incident_attributes,'$.sapol_category'),
  'sapol_subcategory' VALUE JSON_VALUE(incident_attributes,'$.sapol_subcategory'),
  'investigation_series' VALUE JSON_VALUE(incident_attributes,'$.investigation_series'),
  'link_token' VALUE JSON_VALUE(incident_attributes,'$.link_token'),
  'spatial_precision' VALUE 'approximate suburb-level demonstration point'
);

UPDATE persons_of_interest
SET display_name=REPLACE(display_name,'Fictional Profile ','Profile '),
    portrait_alt_text='Generated profile for demonstration use only; not a photograph of a real person.',
    narrative_summary='Profile used to demonstrate governed relationship, graph, and vector queries. It has no real-world referent.';

UPDATE person_incident_links
SET link_summary=CASE
  WHEN link_summary LIKE 'Fictional teaching relationship: recurring%' THEN 'Demonstration relationship: recurring fabricated reference appears in the linked record.'
  WHEN link_summary LIKE 'Fictional teaching relationship: a fabricated dispatch%' THEN 'Demonstration relationship: a fabricated dispatch-style notation appears in the linked record.'
  WHEN link_summary LIKE 'Fictional teaching relationship: a shared fabricated stock%' THEN 'Demonstration relationship: a shared fabricated stock-list marker appears in the linked record.'
  WHEN link_summary='Fictional teaching relationship for bounded graph demonstrations only.' THEN 'Demonstration relationship for bounded graph exploration only.'
  ELSE link_summary
END;

UPDATE evidence_items
SET evidence_metadata=JSON_OBJECT(
  'synthetic_record' VALUE true,
  'series' VALUE JSON_VALUE(evidence_metadata,'$.series'),
  'shared_marker' VALUE JSON_VALUE(evidence_metadata,'$.shared_marker'),
  'source' VALUE NVL(JSON_VALUE(evidence_metadata,'$.source'),'demonstration profile'),
  'description' VALUE NVL(JSON_VALUE(evidence_metadata,'$.description'),'Non-identifying demonstration artefact')
)
WHERE JSON_EXISTS(evidence_metadata,'$.synthetic_record');

UPDATE semantic_matches
SET match_reason=REPLACE(match_reason,'Fictional series:','Linked series:');

UPDATE incident_report_embeddings
SET embedding_model='adelaide_pattern_demo_v1';

UPDATE person_profile_embeddings
SET embedding_model='adelaide_profile_demo_v1';

COMMIT;
