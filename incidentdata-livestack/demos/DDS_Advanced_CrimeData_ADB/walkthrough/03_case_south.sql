/* Connect as aci_a_case_south. */
SET PAGES 100 LINES 220
PROMPT === ALLOWED: South case product including report detail ===
SELECT area_code, incident_ref, vehicle_descriptor,
       DBMS_LOB.SUBSTR(report_text, 120, 1) AS report_extract
FROM crime_data.aci_a_case_product_v FETCH FIRST 5 ROWS ONLY;
PROMPT === EXPECTED EMPTY: a query filter cannot expand to Central ===
SELECT incident_ref FROM crime_data.aci_a_case_product_v WHERE area_code = 'CENTRAL';
PROMPT === EXPECTED DENIAL: aggregate command product is not granted ===
SELECT incident_count FROM crime_data.aci_a_command_activity_product_v FETCH FIRST 1 ROW ONLY;
