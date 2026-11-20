/* Connect as aci_a_field_north. */
SET PAGES 100 LINES 220
PROMPT === ALLOWED: North field product only ===
SELECT area_code, incident_ref, suburb, category_name
FROM crime_data.aci_a_field_incident_product_v FETCH FIRST 5 ROWS ONLY;
PROMPT === EXPECTED EMPTY: a query filter cannot expand to Central ===
SELECT incident_ref FROM crime_data.aci_a_field_incident_product_v WHERE area_code = 'CENTRAL';
