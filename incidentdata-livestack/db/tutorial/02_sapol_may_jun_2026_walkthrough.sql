/*
  May/June 2026 teaching-profile investigation walkthrough

  All records and clues below are fictional.  They are deliberately included
  to demonstrate governed database capabilities, not to identify a person,
  establish responsibility, or support an operational policing decision.

  Prerequisite: run ../demo/01_load_sapol_may_jun_2026.sql.
*/

/* 1. Verify the public-statistics calibration. */
SELECT TO_CHAR(occurred_at,'YYYY-MM') report_month, COUNT(*) incidents
FROM crime_incidents
GROUP BY TO_CHAR(occurred_at,'YYYY-MM')
ORDER BY report_month;

SELECT TO_CHAR(i.occurred_at,'YYYY-MM') report_month, c.category_name, COUNT(*) incidents
FROM crime_incidents i JOIN incident_categories c ON c.category_id=i.category_id
GROUP BY TO_CHAR(i.occurred_at,'YYYY-MM'),c.category_name
ORDER BY report_month,incidents DESC;

/* 2. Begin with a broad semantic clue in Crime Pattern Signals:
      “after-hours entry or property damage”.  The 8d demonstration vectors
      surface the planted cross-area records near the top. */
SELECT i.incident_ref,i.suburb,i.occurred_at,c.category_name,r.report_summary,
       ROUND(1-VECTOR_DISTANCE(e.embedding,TO_VECTOR('[1,0,0,1,0,0,0,0]'),COSINE),4) similarity
FROM incident_report_embeddings e
JOIN crime_incidents i ON i.incident_id=e.incident_id
JOIN incident_categories c ON c.category_id=i.category_id
JOIN incident_reports r ON r.incident_id=i.incident_id
ORDER BY VECTOR_DISTANCE(e.embedding,TO_VECTOR('[1,0,0,1,0,0,0,0]'),COSINE)
FETCH FIRST 20 ROWS ONLY;

/* 3. Inspect the JSON provenance and the deliberately shared teaching token.
      This is a fabricated clue, not an evidence or identity assertion. */
SELECT incident_ref,suburb,incident_attributes.investigation_series.string() series,
       incident_attributes.link_token.string() link_token
FROM crime_incidents
WHERE incident_attributes.investigation_series.string()='CROSS_AREA_0147'
ORDER BY occurred_at;

/* 4. Follow the relational links to the case, fictional people, and evidence. */
SELECT c.case_ref,c.pattern_label,i.incident_ref,i.suburb,p.person_ref,p.alias_name,
       e.evidence_type
FROM case_files c
JOIN case_incident_links cil ON cil.case_id=c.case_id
JOIN crime_incidents i ON i.incident_id=cil.incident_id
LEFT JOIN person_incident_links pil ON pil.incident_id=i.incident_id
LEFT JOIN persons_of_interest p ON p.person_id=pil.person_id
LEFT JOIN evidence_items e ON e.incident_id=i.incident_id
WHERE c.case_ref='CASE-2026-0147'
ORDER BY i.occurred_at,p.person_ref,e.evidence_type;

/* 5. In the application, open Case Relationships and select CASE-2026-0147.
      Depth 2 reveals case -> incident -> evidence/person links.  Change the
      demo user to observe Deep Data Security's geographic scope filtering. */

/* 6. Optional SQL/PGQ starting point in environments that permit graph query:
SELECT *
FROM GRAPH_TABLE (crime_case_network
  MATCH (c IS case_file)-[ci IS case_involves]->(i IS incident)
  WHERE c.case_ref='CASE-2026-0147'
  COLUMNS (c.case_ref, i.incident_ref, i.suburb)
);
*/
