/* Add incident-to-incident similarity edges to the Case Relationships graph. */
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

CREATE OR REPLACE VIEW incident_evidence_links_v AS
SELECT incident_id, evidence_id, evidence_type
FROM evidence_items;

CREATE OR REPLACE PROPERTY GRAPH crime_case_network
  VERTEX TABLES (
    case_files KEY (case_id)
      LABEL case_file
      PROPERTIES (case_id, case_ref, case_status, pattern_label, patrol_area_id),
    crime_incidents KEY (incident_id)
      LABEL incident
      PROPERTIES (incident_id, incident_ref, incident_status, occurred_at,
                  suburb, modus_operandi, patrol_area_id),
    persons_of_interest KEY (person_id)
      LABEL person_of_interest
      PROPERTIES (person_id, person_ref, display_name, alias_name,
                  person_status, portrait_variant, portrait_asset_uri),
    evidence_items KEY (evidence_id)
      LABEL evidence
      PROPERTIES (evidence_id, evidence_type, created_at)
  )
  EDGE TABLES (
    case_incident_links
      KEY (case_id, incident_id)
      SOURCE KEY (case_id) REFERENCES case_files (case_id)
      DESTINATION KEY (incident_id) REFERENCES crime_incidents (incident_id)
      LABEL case_involves,
    person_incident_links
      KEY (person_id, incident_id)
      SOURCE KEY (person_id) REFERENCES persons_of_interest (person_id)
      DESTINATION KEY (incident_id) REFERENCES crime_incidents (incident_id)
      LABEL person_linked_to_incident
      PROPERTIES (connection_type, link_summary),
    incident_evidence_links_v
      KEY (evidence_id)
      SOURCE KEY (incident_id) REFERENCES crime_incidents (incident_id)
      DESTINATION KEY (evidence_id) REFERENCES evidence_items (evidence_id)
      LABEL incident_has_evidence
      PROPERTIES (evidence_type),
    semantic_matches
      KEY (match_id)
      SOURCE KEY (source_incident_id) REFERENCES crime_incidents (incident_id)
      DESTINATION KEY (matched_incident_id) REFERENCES crime_incidents (incident_id)
      LABEL incident_similar_to
      PROPERTIES (similarity_score, match_reason)
  );

COMMENT ON PROPERTY GRAPH crime_case_network IS
  'Synthetic case, incident, person, evidence, and incident-similarity relationships for governed SQL/PGQ demonstrations.';

EXIT SUCCESS;
