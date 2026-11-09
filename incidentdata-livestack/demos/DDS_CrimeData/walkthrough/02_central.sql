/* Connect as aci_ds_central. */
SET PAGES 100 LINES 220
PROMPT === Central: only Central patrol-area incidents ===
SELECT p.area_name, COUNT(*) AS incident_count
FROM crime_incidents i
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
GROUP BY p.area_name ORDER BY p.area_name;
PROMPT === Central: out-of-scope North predicate returns no rows ===
SELECT i.incident_ref
FROM crime_incidents i JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
WHERE p.area_code = 'NORTH' FETCH FIRST 3 ROWS ONLY;
PROMPT === Central: excluded incident columns are DDS-masked ===
SELECT incident_ref, vehicle_descriptor, incident_attributes FROM crime_incidents FETCH FIRST 3 ROWS ONLY;
PROMPT === Central: reports inherit authorised incident rows; raw report fields are DDS-masked ===
SELECT r.report_id, r.report_summary, r.report_text, r.enrichments FROM incident_reports r FETCH FIRST 3 ROWS ONLY;
