/* Connect as aci_b_statewide_command. */
SET PAGES 100 LINES 220
PROMPT === ALLOWED: statewide incident product ===
SELECT area_code, COUNT(*) AS incidents FROM crime_data.aci_b_incident_product_v
GROUP BY area_code ORDER BY area_code;
PROMPT === ALLOWED: full command report product ===
SELECT incident_ref, report_summary, DBMS_LOB.SUBSTR(report_text, 120, 1) AS report_extract
FROM crime_data.aci_b_command_report_product_v FETCH FIRST 3 ROWS ONLY;
PROMPT === EXPECTED DENIAL: base table is not a product ===
SELECT incident_ref, vehicle_descriptor FROM crime_data.crime_incidents FETCH FIRST 1 ROW ONLY;
