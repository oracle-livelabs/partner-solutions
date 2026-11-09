/* Connect as aci_ds_north. */
SET PAGES 100 LINES 220
PROMPT === North: only North patrol-area incidents ===
SELECT p.area_name, COUNT(*) AS incident_count
FROM crime_incidents i
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
GROUP BY p.area_name ORDER BY p.area_name;
PROMPT === North: out-of-scope Central predicate returns no rows ===
SELECT i.incident_ref
FROM crime_incidents i JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
WHERE p.area_code = 'CENTRAL' FETCH FIRST 3 ROWS ONLY;
PROMPT === North: excluded incident columns are DDS-masked ===
SELECT incident_ref, vehicle_descriptor, incident_attributes FROM crime_incidents FETCH FIRST 3 ROWS ONLY;
PROMPT === North: reports inherit authorised incident rows; raw report fields are DDS-masked ===
SELECT r.report_id, r.report_summary, r.report_text FROM incident_reports r FETCH FIRST 3 ROWS ONLY;
