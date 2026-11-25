/*
 * Run as CRIME_DATA after 02. Each predicate checks the active end-user
 * entitlement at query time; no client-provided area or clearance is trusted.
 */
WHENEVER SQLERROR EXIT SQL.SQLCODE

CREATE DATA ROLE IF NOT EXISTS aci_a_field_analyst_role;
CREATE DATA ROLE IF NOT EXISTS aci_a_case_lead_role;
CREATE DATA ROLE IF NOT EXISTS aci_a_command_role;

CREATE OR REPLACE DATA GRANT aci_a_field_incidents
  AS SELECT ON aci_a_field_incident_product_v
  WHERE EXISTS (
    SELECT 1 FROM aci_a_end_user_scope s
    WHERE s.end_user_name = ORA_END_USER_CONTEXT.username
      AND s.persona_code = 'FIELD'
      AND s.clearance_code = 'FIELD'
      AND s.patrol_area_code = area_code
      AND s.active_flag = 'Y'
      AND s.valid_from <= SYSTIMESTAMP
      AND (s.valid_to IS NULL OR s.valid_to > SYSTIMESTAMP)
  )
  TO aci_a_field_analyst_role;

CREATE OR REPLACE DATA GRANT aci_a_case_detail
  AS SELECT ON aci_a_case_product_v
  WHERE EXISTS (
    SELECT 1 FROM aci_a_end_user_scope s
    WHERE s.end_user_name = ORA_END_USER_CONTEXT.username
      AND s.persona_code = 'CASE'
      AND s.clearance_code = 'CASE'
      AND s.patrol_area_code = area_code
      AND s.active_flag = 'Y'
      AND s.valid_from <= SYSTIMESTAMP
      AND (s.valid_to IS NULL OR s.valid_to > SYSTIMESTAMP)
  )
  TO aci_a_case_lead_role;

CREATE OR REPLACE DATA GRANT aci_a_command_activity
  AS SELECT ON aci_a_command_activity_product_v
  WHERE EXISTS (
    SELECT 1 FROM aci_a_end_user_scope s
    WHERE s.end_user_name = ORA_END_USER_CONTEXT.username
      AND s.persona_code = 'COMMAND'
      AND s.clearance_code = 'COMMAND'
      AND s.patrol_area_code IS NULL
      AND s.active_flag = 'Y'
      AND s.valid_from <= SYSTIMESTAMP
      AND (s.valid_to IS NULL OR s.valid_to > SYSTIMESTAMP)
  )
  TO aci_a_command_role;

/* SQLcl parses top-level SET as its own command; submit Deep Sec DDL dynamically. */
BEGIN
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON aci_a_field_incident_product_v ENABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON aci_a_case_product_v ENABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON aci_a_command_activity_product_v ENABLED';
END;
/

PROMPT Advanced ADB data roles and entitlement-aware Data Grants are ready.
