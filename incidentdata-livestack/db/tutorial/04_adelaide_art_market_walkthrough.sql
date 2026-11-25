/*
  CASE-2026-0421: art-market payment comparative-review walkthrough.

  All names, images, reports, transactions, and relationships are fictional
  teaching data. A graph connection is a review lead, not an attribution.
*/
SET PAGESIZE 100
SET LINESIZE 240
SET LONG 2000
SET VERIFY OFF

PROMPT 1. Confirm the active profile and invariant incident count.
SELECT p.profile_code,p.profile_name,COUNT(i.incident_id) incident_count
FROM z_base_active_dataset_profile a
JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id
CROSS JOIN crime_incidents i
WHERE a.control_id=1
GROUP BY p.profile_code,p.profile_name;

PROMPT 2. Begin with eight reports. The shared pattern is not yet obvious.
SELECT i.incident_ref,to_char(i.occurred_at,'YYYY-MM-DD HH24:MI') occurred_at,
       i.suburb,c.executive_group_label executive_category,r.report_summary
FROM case_files cf
JOIN case_incident_links l ON l.case_id=cf.case_id
JOIN crime_incidents i ON i.incident_id=l.incident_id
JOIN incident_categories c ON c.category_id=i.category_id
JOIN incident_reports r ON r.incident_id=i.incident_id
WHERE cf.case_ref='CASE-2026-0421'
ORDER BY i.occurred_at;

PROMPT 3. Follow document evidence and compare repeated markers.
SELECT JSON_VALUE(e.evidence_metadata,'$.shared_marker') shared_marker,
       COUNT(*) appearances,
       LISTAGG(i.incident_ref,', ') WITHIN GROUP (ORDER BY i.incident_ref) incidents
FROM case_files cf
JOIN case_incident_links l ON l.case_id=cf.case_id
JOIN crime_incidents i ON i.incident_id=l.incident_id
JOIN evidence_items e ON e.incident_id=i.incident_id
WHERE cf.case_ref='CASE-2026-0421'
  AND JSON_VALUE(e.evidence_metadata,'$.clue_family')<>'public-setting image'
GROUP BY JSON_VALUE(e.evidence_metadata,'$.shared_marker')
ORDER BY appearances DESC,shared_marker;

PROMPT 4. Expand to people. Read link summaries before drawing conclusions.
SELECT p.person_ref,p.display_name,i.incident_ref,l.connection_type,l.link_summary
FROM case_files cf
JOIN case_incident_links cl ON cl.case_id=cf.case_id
JOIN crime_incidents i ON i.incident_id=cl.incident_id
JOIN person_incident_links l ON l.incident_id=i.incident_id
JOIN persons_of_interest p ON p.person_id=l.person_id
WHERE cf.case_ref='CASE-2026-0421'
ORDER BY p.person_ref,i.occurred_at;

PROMPT 5. Identify public-setting images and their graph incidents.
SELECT i.incident_ref,e.evidence_type,
       JSON_VALUE(e.evidence_metadata,'$.shared_marker') profiles,
       JSON_VALUE(e.evidence_metadata,'$.asset_uri') asset_uri
FROM case_files cf
JOIN case_incident_links l ON l.case_id=cf.case_id
JOIN crime_incidents i ON i.incident_id=l.incident_id
JOIN evidence_items e ON e.incident_id=i.incident_id
WHERE cf.case_ref='CASE-2026-0421'
  AND JSON_VALUE(e.evidence_metadata,'$.asset_uri') IS NOT NULL
ORDER BY i.occurred_at;

PROMPT 6. At three hops, similarity edges connect the clue pairs.
SELECT a.incident_ref source_ref,b.incident_ref matched_ref,
       s.similarity_score,s.match_reason
FROM semantic_matches s
JOIN crime_incidents a ON a.incident_id=s.source_incident_id
JOIN crime_incidents b ON b.incident_id=s.matched_incident_id
WHERE s.match_reason LIKE 'Art-market review:%'
ORDER BY s.similarity_score DESC;

PROMPT 7. Confirm four unique POIs and eight case-image vector associations.
SELECT COUNT(DISTINCT p.person_id) people,
       COUNT(*) case_image_vectors,
       COUNT(DISTINCT v.asset_uri) unique_scene_images,
       MIN(v.embedding_model) embedding_model
FROM person_visual_embeddings v
JOIN persons_of_interest p ON p.person_id=v.person_id
WHERE v.asset_ref LIKE 'NBNW-%'
  AND v.asset_kind='case_image';

PROMPT UI PATH
PROMPT Case Relationships -> search art-market -> CASE-2026-0421
PROMPT 1 hop: eight incidents. 2 hops: people, evidence, and scene images.
PROMPT 3 hops: similarity edges exposing AR-17, OE-24, P-441, and DS-8.
PROMPT Open an image evidence node to view its generated fictional scene.
PROMPT Person Intelligence -> upload that scene for visual candidate ranking.

