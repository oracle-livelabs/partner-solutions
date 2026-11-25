/* Connect as aci_a_field_central. */
SET PAGES 100 LINES 220
PROMPT === ALLOWED: Central field product only ===
SELECT area_code, incident_ref, suburb, category_name
FROM crime_data.aci_a_field_incident_product_v FETCH FIRST 5 ROWS ONLY;
PROMPT === EXPECTED EMPTY: a query filter cannot expand to North ===
SELECT incident_ref FROM crime_data.aci_a_field_incident_product_v WHERE area_code = 'NORTH';
PROMPT === EXPECTED DENIAL: case narrative product is not a field product ===
SELECT report_text FROM crime_data.aci_a_case_product_v FETCH FIRST 1 ROW ONLY;
