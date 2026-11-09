/* Connect as aci_c_investigator_central. */
SET PAGES 100 LINES 220

PROMPT === PARENT ALLOWED: Central incident rows directly granted ===
SELECT area_code, incident_ref, suburb, category_name
FROM crime_data.aci_c_incident_parent_product_v
FETCH FIRST 5 ROWS ONLY;

PROMPT === CHILD ALLOWED: matching reports inherited through the CTG ===
SELECT area_code, incident_ref, DBMS_LOB.SUBSTR(report_text, 120, 1) AS report_extract
FROM crime_data.aci_c_report_child_product_v
FETCH FIRST 5 ROWS ONLY;

PROMPT === EXPECTED EMPTY: a child filter cannot expand to North ===
SELECT incident_ref
FROM crime_data.aci_c_report_child_product_v
WHERE area_code = 'NORTH';
