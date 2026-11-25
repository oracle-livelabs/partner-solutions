/* Remove CTG ADB DDS artifacts only. Run as ADMIN after users disconnect. */
WHENEVER SQLERROR EXIT SQL.SQLCODE

DROP END USER IF EXISTS aci_c_investigator_central;
DROP END USER IF EXISTS aci_c_investigator_north;
DROP END USER IF EXISTS aci_c_statewide_reviewer;
DROP END USER IF EXISTS aci_c_report_only_probe;

/* Drop child first because it references the parent product in its CTG clause. */
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_c_reports_by_incident;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_c_central_incident_parent;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_c_north_incident_parent;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_c_statewide_incident_parent;

DROP DATA ROLE IF EXISTS aci_c_central_investigator_role;
DROP DATA ROLE IF EXISTS aci_c_north_investigator_role;
DROP DATA ROLE IF EXISTS aci_c_statewide_reviewer_role;
DROP DATA ROLE IF EXISTS aci_c_probe_login_role;
DROP ROLE IF EXISTS aci_c_direct_login_role;

BEGIN
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON CRIME_DATA.aci_c_report_child_product_v DISABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON CRIME_DATA.aci_c_incident_parent_product_v DISABLED';
END;
/

DROP VIEW IF EXISTS CRIME_DATA.aci_c_report_child_product_v;
DROP VIEW IF EXISTS CRIME_DATA.aci_c_incident_parent_product_v;

PROMPT CTG ADB DDS objects were removed. Basic, Advanced, and IncidentData remain intact.
