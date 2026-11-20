/* Connect as aci_ds_south. */
SET PAGES 100 LINES 220
PROMPT === South: only South patrol-area incidents ===
SELECT p.area_name, COUNT(*) AS incident_count
FROM crime_incidents i
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
GROUP BY p.area_name ORDER BY p.area_name;
PROMPT === South: out-of-scope Central predicate returns no rows ===
SELECT i.incident_ref
FROM crime_incidents i JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
WHERE p.area_code = 'CENTRAL' FETCH FIRST 3 ROWS ONLY;
PROMPT === South: excluded incident columns are DDS-masked ===
SELECT incident_ref, vehicle_descriptor, incident_attributes FROM crime_incidents FETCH FIRST 3 ROWS ONLY;
PROMPT === South: reports inherit authorised incident rows; raw report fields are DDS-masked ===
SELECT r.report_id, r.report_summary, r.report_text FROM incident_reports r FETCH FIRST 3 ROWS ONLY;
