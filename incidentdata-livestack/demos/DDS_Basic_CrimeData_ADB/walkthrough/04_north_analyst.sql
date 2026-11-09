/* Connect as aci_b_north_analyst. */
SET PAGES 100 LINES 220
PROMPT === ALLOWED: North safe incident rows only ===
SELECT area_code, incident_ref, suburb, category_name FROM crime_data.aci_b_incident_product_v
FETCH FIRST 5 ROWS ONLY;
PROMPT === EXPECTED EMPTY: Central is outside this identity's scope ===
SELECT incident_ref FROM crime_data.aci_b_incident_product_v WHERE area_code = 'CENTRAL';
PROMPT === EXPECTED DENIAL: raw command report product is not granted ===
SELECT report_text FROM crime_data.aci_b_command_report_product_v FETCH FIRST 1 ROW ONLY;
