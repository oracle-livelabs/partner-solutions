/* Connect as aci_c_report_only_probe. */
SET PAGES 100 LINES 220

PROMPT === EXPECTED DENIAL: no direct parent authorization means no child authorization ===
SELECT incident_ref
FROM crime_data.aci_c_report_child_product_v
FETCH FIRST 1 ROW ONLY;
