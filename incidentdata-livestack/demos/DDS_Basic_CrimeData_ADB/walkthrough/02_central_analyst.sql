/* Connect as aci_b_central_analyst. */
SET PAGES 100 LINES 220
PROMPT === ALLOWED: Central safe incident rows only ===
SELECT area_code, incident_ref, suburb, category_name FROM crime_data.aci_b_incident_product_v
FETCH FIRST 5 ROWS ONLY;
PROMPT === EXPECTED EMPTY: explicit North filter cannot expand scope ===
SELECT incident_ref FROM crime_data.aci_b_incident_product_v WHERE area_code = 'NORTH';
PROMPT === ALLOWED: summaries, not raw report text ===
SELECT incident_ref, report_summary FROM crime_data.aci_b_report_summary_product_v FETCH FIRST 3 ROWS ONLY;
PROMPT === EXPECTED DENIAL: command report product is not granted ===
SELECT report_text FROM crime_data.aci_b_command_report_product_v FETCH FIRST 1 ROW ONLY;
