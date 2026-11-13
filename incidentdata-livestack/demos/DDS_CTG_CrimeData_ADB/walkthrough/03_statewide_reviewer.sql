/* Connect as aci_c_statewide_reviewer. */
SET PAGES 100 LINES 220

PROMPT === PARENT ALLOWED: statewide incident rows directly granted ===
SELECT area_code, incident_ref, suburb, category_name
FROM crime_data.aci_c_incident_parent_product_v
FETCH FIRST 9 ROWS ONLY;

PROMPT === CHILD ALLOWED: report access inherits statewide parent access ===
SELECT area_code, incident_ref, DBMS_LOB.SUBSTR(report_text, 100, 1) AS report_extract
FROM crime_data.aci_c_report_child_product_v
FETCH FIRST 9 ROWS ONLY;
