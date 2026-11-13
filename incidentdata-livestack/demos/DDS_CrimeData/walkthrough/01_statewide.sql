/* Connect as aci_ds_statewide. */
SET PAGES 100 LINES 220
PROMPT === Statewide: all synthetic patrol areas ===
SELECT p.area_name, COUNT(*) AS incident_count
FROM crime_incidents i
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
GROUP BY p.area_name ORDER BY p.area_name;
PROMPT === Statewide: full synthetic incident record includes authorised sensitive columns ===
SELECT incident_ref, suburb, vehicle_descriptor, incident_attributes
FROM crime_incidents FETCH FIRST 3 ROWS ONLY;
PROMPT === Statewide: full report product ===
SELECT i.incident_ref, r.report_summary, r.report_text
FROM crime_incidents i JOIN incident_reports r ON r.incident_id = i.incident_id
FETCH FIRST 3 ROWS ONLY;
