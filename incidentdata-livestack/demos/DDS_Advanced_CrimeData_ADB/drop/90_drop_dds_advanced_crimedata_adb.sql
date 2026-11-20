/* Remove Advanced ADB DDS artifacts only. Run as ADMIN after users disconnect. */
WHENEVER SQLERROR EXIT SQL.SQLCODE

DROP END USER IF EXISTS aci_a_field_central;
DROP END USER IF EXISTS aci_a_field_north;
DROP END USER IF EXISTS aci_a_case_south;
DROP END USER IF EXISTS aci_a_case_central;
DROP END USER IF EXISTS aci_a_command;

DROP DATA GRANT IF EXISTS CRIME_DATA.aci_a_field_incidents;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_a_case_detail;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_a_command_activity;
DROP DATA ROLE IF EXISTS aci_a_field_analyst_role;
DROP DATA ROLE IF EXISTS aci_a_case_lead_role;
DROP DATA ROLE IF EXISTS aci_a_command_role;
DROP ROLE IF EXISTS aci_a_direct_login_role;

BEGIN
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON CRIME_DATA.aci_a_field_incident_product_v DISABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON CRIME_DATA.aci_a_case_product_v DISABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON CRIME_DATA.aci_a_command_activity_product_v DISABLED';
END;
/
DROP VIEW IF EXISTS CRIME_DATA.aci_a_field_incident_product_v;
DROP VIEW IF EXISTS CRIME_DATA.aci_a_case_product_v;
DROP VIEW IF EXISTS CRIME_DATA.aci_a_command_activity_product_v;
DROP TABLE IF EXISTS CRIME_DATA.aci_a_end_user_scope PURGE;

PROMPT Advanced ADB DDS objects were removed. Basic kit and IncidentData remain intact.
