/* Connect as aci_a_command. */
SET PAGES 100 LINES 220
PROMPT === ALLOWED: statewide aggregate activity ===
SELECT area_code, occurred_day, SUM(incident_count) AS incidents,
       SUM(active_count) AS active_incidents
FROM crime_data.aci_a_command_activity_product_v
GROUP BY area_code, occurred_day ORDER BY occurred_day DESC FETCH FIRST 12 ROWS ONLY;
PROMPT === EXPECTED DENIAL: no incident-level or report-detail product ===
SELECT incident_ref FROM crime_data.aci_a_case_product_v FETCH FIRST 1 ROW ONLY;
