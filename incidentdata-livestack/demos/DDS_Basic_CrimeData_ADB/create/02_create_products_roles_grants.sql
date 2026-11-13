/*
 * Basic ADB DDS products, roles, and grants. Run as CRIME_DATA.
 * No application base table is altered: only tutorial product views are put
 * into USE DATA GRANTS ONLY mode.
 */
WHENEVER SQLERROR EXIT SQL.SQLCODE

CREATE OR REPLACE VIEW aci_b_incident_product_v AS
SELECT i.incident_id, i.incident_ref, p.area_code, p.area_name,
       c.category_code, c.category_name, c.severity_band,
       i.incident_status, i.occurred_at, i.location_type, i.suburb,
       i.latitude, i.longitude, i.address_precision,
       i.modus_operandi, i.property_category, i.created_at
FROM crime_incidents i
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
JOIN incident_categories c ON c.category_id = i.category_id;

CREATE OR REPLACE VIEW aci_b_report_summary_product_v AS
SELECT r.report_id, i.incident_id, i.incident_ref, p.area_code,
       r.report_summary, r.created_at
FROM incident_reports r
JOIN crime_incidents i ON i.incident_id = r.incident_id
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id;

CREATE OR REPLACE VIEW aci_b_command_report_product_v AS
SELECT r.report_id, i.incident_id, i.incident_ref, p.area_code,
       r.report_summary, r.report_text, r.embedding_text, r.enrichments,
       r.created_at
FROM incident_reports r
JOIN crime_incidents i ON i.incident_id = r.incident_id
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id;

CREATE OR REPLACE VIEW aci_b_activity_product_v AS
SELECT p.area_code, p.area_name, c.category_code, c.category_name,
       TRUNC(CAST(i.occurred_at AS DATE)) AS occurred_day,
       COUNT(*) AS incident_count
FROM crime_incidents i
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
JOIN incident_categories c ON c.category_id = i.category_id
GROUP BY p.area_code, p.area_name, c.category_code, c.category_name,
         TRUNC(CAST(i.occurred_at AS DATE));

CREATE DATA ROLE IF NOT EXISTS aci_b_statewide_command_role;
CREATE DATA ROLE IF NOT EXISTS aci_b_regional_analyst_role;
CREATE DATA ROLE IF NOT EXISTS aci_b_strategy_viewer_role;

CREATE OR REPLACE DATA GRANT aci_b_command_incidents
  AS SELECT ON aci_b_incident_product_v
  TO aci_b_statewide_command_role;
CREATE OR REPLACE DATA GRANT aci_b_command_reports
  AS SELECT ON aci_b_command_report_product_v
  TO aci_b_statewide_command_role;
CREATE OR REPLACE DATA GRANT aci_b_command_activity
  AS SELECT ON aci_b_activity_product_v
  TO aci_b_statewide_command_role;

CREATE OR REPLACE DATA GRANT aci_b_central_incidents
  AS SELECT ON aci_b_incident_product_v
  WHERE area_code = 'CENTRAL'
    AND ORA_END_USER_CONTEXT.username = 'ACI_B_CENTRAL_ANALYST'
  TO aci_b_regional_analyst_role;
CREATE OR REPLACE DATA GRANT aci_b_north_incidents
  AS SELECT ON aci_b_incident_product_v
  WHERE area_code = 'NORTH'
    AND ORA_END_USER_CONTEXT.username = 'ACI_B_NORTH_ANALYST'
  TO aci_b_regional_analyst_role;
CREATE OR REPLACE DATA GRANT aci_b_south_incidents
  AS SELECT ON aci_b_incident_product_v
  WHERE area_code = 'SOUTH'
    AND ORA_END_USER_CONTEXT.username = 'ACI_B_SOUTH_ANALYST'
  TO aci_b_regional_analyst_role;
CREATE OR REPLACE DATA GRANT aci_b_central_report_summaries
  AS SELECT ON aci_b_report_summary_product_v
  WHERE area_code = 'CENTRAL'
    AND ORA_END_USER_CONTEXT.username = 'ACI_B_CENTRAL_ANALYST'
  TO aci_b_regional_analyst_role;
CREATE OR REPLACE DATA GRANT aci_b_north_report_summaries
  AS SELECT ON aci_b_report_summary_product_v
  WHERE area_code = 'NORTH'
    AND ORA_END_USER_CONTEXT.username = 'ACI_B_NORTH_ANALYST'
  TO aci_b_regional_analyst_role;
CREATE OR REPLACE DATA GRANT aci_b_south_report_summaries
  AS SELECT ON aci_b_report_summary_product_v
  WHERE area_code = 'SOUTH'
    AND ORA_END_USER_CONTEXT.username = 'ACI_B_SOUTH_ANALYST'
  TO aci_b_regional_analyst_role;
CREATE OR REPLACE DATA GRANT aci_b_central_activity
  AS SELECT ON aci_b_activity_product_v
  WHERE area_code = 'CENTRAL'
    AND ORA_END_USER_CONTEXT.username = 'ACI_B_CENTRAL_ANALYST'
  TO aci_b_regional_analyst_role;
CREATE OR REPLACE DATA GRANT aci_b_north_activity
  AS SELECT ON aci_b_activity_product_v
  WHERE area_code = 'NORTH'
    AND ORA_END_USER_CONTEXT.username = 'ACI_B_NORTH_ANALYST'
  TO aci_b_regional_analyst_role;
CREATE OR REPLACE DATA GRANT aci_b_south_activity
  AS SELECT ON aci_b_activity_product_v
  WHERE area_code = 'SOUTH'
    AND ORA_END_USER_CONTEXT.username = 'ACI_B_SOUTH_ANALYST'
  TO aci_b_regional_analyst_role;
CREATE OR REPLACE DATA GRANT aci_b_strategy_activity
  AS SELECT ON aci_b_activity_product_v
  TO aci_b_strategy_viewer_role;

/* SQLcl treats a top-level SET as a client command. Use dynamic SQL so ADB
 * receives the Deep Sec SET USE DATA GRANTS ONLY statements. */
BEGIN
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON aci_b_incident_product_v ENABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON aci_b_report_summary_product_v ENABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON aci_b_command_report_product_v ENABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON aci_b_activity_product_v ENABLED';
END;
/

PROMPT Basic ADB DDS products, roles, and grants are ready.
