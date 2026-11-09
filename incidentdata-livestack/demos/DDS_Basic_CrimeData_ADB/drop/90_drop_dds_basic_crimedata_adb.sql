/* Remove the Basic ADB DDS kit only. Run as ADMIN after users disconnect. */
WHENEVER SQLERROR EXIT SQL.SQLCODE

DROP END USER IF EXISTS aci_b_statewide_command;
DROP END USER IF EXISTS aci_b_central_analyst;
DROP END USER IF EXISTS aci_b_north_analyst;
DROP END USER IF EXISTS aci_b_south_analyst;
DROP END USER IF EXISTS aci_b_strategy_viewer;

DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_command_incidents;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_command_reports;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_command_activity;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_central_incidents;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_north_incidents;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_south_incidents;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_central_report_summaries;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_north_report_summaries;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_south_report_summaries;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_central_activity;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_north_activity;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_south_activity;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_b_strategy_activity;

DROP DATA ROLE IF EXISTS aci_b_statewide_command_role;
DROP DATA ROLE IF EXISTS aci_b_regional_analyst_role;
DROP DATA ROLE IF EXISTS aci_b_strategy_viewer_role;
DROP ROLE IF EXISTS aci_b_direct_login_role;

BEGIN
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON CRIME_DATA.aci_b_incident_product_v DISABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON CRIME_DATA.aci_b_report_summary_product_v DISABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON CRIME_DATA.aci_b_command_report_product_v DISABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON CRIME_DATA.aci_b_activity_product_v DISABLED';
END;
/
DROP VIEW IF EXISTS CRIME_DATA.aci_b_incident_product_v;
DROP VIEW IF EXISTS CRIME_DATA.aci_b_report_summary_product_v;
DROP VIEW IF EXISTS CRIME_DATA.aci_b_command_report_product_v;
DROP VIEW IF EXISTS CRIME_DATA.aci_b_activity_product_v;

PROMPT Basic ADB DDS objects were removed. IncidentData remains intact.
