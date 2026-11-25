/* Connect as aci_b_strategy_viewer. */
SET PAGES 100 LINES 220
PROMPT === ALLOWED: aggregate activity only ===
SELECT area_code, occurred_day, SUM(incident_count) AS incidents
FROM crime_data.aci_b_activity_product_v GROUP BY area_code, occurred_day
ORDER BY occurred_day DESC FETCH FIRST 10 ROWS ONLY;
PROMPT === EXPECTED DENIAL: incident-level product is not granted ===
SELECT incident_ref FROM crime_data.aci_b_incident_product_v FETCH FIRST 1 ROW ONLY;
