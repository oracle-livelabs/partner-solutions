/*
  Adelaide service-corridor linkage walkthrough

  All incidents, addresses, people, clues, and relationships are synthetic.
  The exercise demonstrates a comparative-review workflow. It does not prove
  identity, responsibility, risk, or a basis for operational action.

  Prerequisites:
    @../migrations/20260825_add_semantic_case_graph_edges.sql
    @../demo/16_add_adelaide_service_corridor_series.sql APPLY
*/
SET PAGES 200 LINES 260
WHENEVER SQLERROR EXIT SQL.SQLCODE

/* Breadcrumb 1: start with the seed report, without knowing a case exists. */
SELECT i.incident_ref,c.category_name,i.occurred_at,i.suburb,
       i.address_line_1,i.address_postcode,i.address_precision,
       r.report_summary
FROM crime_incidents i
JOIN incident_categories c ON c.category_id=i.category_id
JOIN incident_reports r ON r.incident_id=i.incident_id
WHERE i.incident_ref='ACI-2026-07569';

/* Breadcrumb 2: search broad after-hours service-access language. The result
   is deliberately noisy; shared wording alone is not the linkage. */
SELECT i.incident_ref,c.category_name,i.occurred_at,i.suburb,
       r.report_summary
FROM crime_incidents i
JOIN incident_categories c ON c.category_id=i.category_id
JOIN incident_reports r ON r.incident_id=i.incident_id
WHERE i.occurred_at >= TIMESTAMP '2026-05-01 00:00:00'
  AND i.occurred_at <  TIMESTAMP '2026-07-01 00:00:00'
  AND c.category_name='SCT - Non-Residence'
  AND TO_NUMBER(TO_CHAR(i.occurred_at,'HH24')) IN
      (0,1,2,3,4,19,20,21,22,23)
  AND (LOWER(r.report_text) LIKE '%service%'
    OR LOWER(r.report_text) LIKE '%rear%'
    OR LOWER(r.report_text) LIKE '%after closing%')
ORDER BY CASE WHEN i.incident_ref='ACI-2026-07569' THEN 0 ELSE 1 END,
         i.occurred_at
FETCH FIRST 40 ROWS ONLY;

/* Breadcrumb 3: compare structured evidence. Five weak clue families emerge,
   each occurring in more than one otherwise separate report. */
SELECT JSON_VALUE(e.evidence_metadata,'$.clue_family') clue_family,
       JSON_VALUE(e.evidence_metadata,'$.shared_marker') shared_marker,
       COUNT(*) observations,
       LISTAGG(i.incident_ref,', ') WITHIN GROUP (ORDER BY i.occurred_at)
         incident_refs
FROM evidence_items e
JOIN crime_incidents i ON i.incident_id=e.incident_id
WHERE JSON_VALUE(e.evidence_metadata,'$.teaching_series')=
      'ADL_SERVICE_CORRIDOR_0317'
GROUP BY JSON_VALUE(e.evidence_metadata,'$.clue_family'),
         JSON_VALUE(e.evidence_metadata,'$.shared_marker')
ORDER BY MIN(i.occurred_at);

/* Breadcrumb 4: lay out time and masked address context. The locations span
   three DDS areas and do not form a simple same-suburb cluster. */
SELECT i.incident_ref,TO_CHAR(i.occurred_at,'DD Mon HH24:MI') occurred,
       p.area_name,i.suburb,i.address_line_1,i.address_postcode,
       c.category_name
FROM crime_incidents i
JOIN incident_categories c ON c.category_id=i.category_id
JOIN patrol_areas p ON p.patrol_area_id=i.patrol_area_id
WHERE JSON_VALUE(i.incident_attributes,'$.investigation_series')=
      'ADL_SERVICE_CORRIDOR_0317'
ORDER BY i.occurred_at;

/* Breadcrumb 5: inspect moderate incident-comparison edges. Scores are
   teaching values and reasons remain hypotheses requiring expert review. */
SELECT source_i.incident_ref source_ref,matched_i.incident_ref matched_ref,
       s.similarity_score,s.match_reason
FROM semantic_matches s
JOIN crime_incidents source_i ON source_i.incident_id=s.source_incident_id
JOIN crime_incidents matched_i ON matched_i.incident_id=s.matched_incident_id
WHERE s.match_reason LIKE 'Service-corridor review:%'
ORDER BY s.similarity_score DESC;

/* Breadcrumb 6: Oracle SQL/PGQ returns the linked case-to-incident paths. */
SELECT *
FROM GRAPH_TABLE (crime_case_network
  MATCH (c IS case_file)-[ci IS case_involves]->(i IS incident)
  WHERE c.case_ref='CASE-2026-0317'
  COLUMNS (
    c.case_ref AS case_ref,
    i.incident_ref AS incident_ref,
    i.suburb AS suburb,
    i.modus_operandi AS modus_operandi
  )
)
ORDER BY incident_ref;

/* Breadcrumb 7: SQL/PGQ exposes incident-to-incident comparison paths that
   join the otherwise separate clue families. */
SELECT *
FROM GRAPH_TABLE (crime_case_network
  MATCH (a IS incident)-[s IS incident_similar_to]->(b IS incident)
  WHERE s.match_reason LIKE 'Service-corridor review:%'
  COLUMNS (
    a.incident_ref AS source_ref,
    b.incident_ref AS matched_ref,
    s.similarity_score AS similarity_score,
    s.match_reason AS match_reason
  )
)
ORDER BY similarity_score DESC;

/* Breadcrumb 8: confirm the graph remains a review aid, not a conclusion. */
SELECT c.case_ref,c.case_status,c.pattern_label,
       COUNT(DISTINCT l.incident_id) linked_incidents,
       COUNT(DISTINCT e.evidence_id) evidence_items,
       COUNT(DISTINCT pil.person_id) context_profiles
FROM case_files c
JOIN case_incident_links l ON l.case_id=c.case_id
JOIN crime_incidents i ON i.incident_id=l.incident_id
LEFT JOIN evidence_items e ON e.incident_id=i.incident_id
LEFT JOIN person_incident_links pil ON pil.incident_id=i.incident_id
WHERE c.case_ref='CASE-2026-0317'
GROUP BY c.case_ref,c.case_status,c.pattern_label;

/* Application walkthrough:
   1. Open Case Relationships as Statewide Administrator.
   2. Search for "after-hours property" and select CASE-2026-0317.
   3. Choose 1 Hop: note 12 dispersed incidents across several categories.
   4. Choose 2 Hops: inspect evidence nodes and the two context-only profiles.
   5. Click incident nodes to compare masked addresses, reports, and MO text.
   6. Choose 3 Hops: dashed red similarity edges reveal connected sub-clusters.
   7. Change demo user to a regional analyst and observe DDS remove paths whose
      incidents fall outside that user's authorised geography.
*/

EXIT SUCCESS;
