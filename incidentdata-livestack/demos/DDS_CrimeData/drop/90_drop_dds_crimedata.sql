/*
 * Destructive to the DDS_CrimeData tutorial objects only.
 * Run as SYS or an equivalent PDB administrator in FREEPDB1 after tutorial
 * users have disconnected. Does not drop IncidentData application tables/views.
 */
WHENEVER SQLERROR EXIT SQL.SQLCODE
ALTER SESSION SET CONTAINER = FREEPDB1;

DROP END USER IF EXISTS aci_ds_statewide;
DROP END USER IF EXISTS aci_ds_central;
DROP END USER IF EXISTS aci_ds_north;
DROP END USER IF EXISTS aci_ds_south;

DROP DATA GRANT IF EXISTS CRIME_DATA.aci_ds_statewide_reports;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_ds_regional_reports;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_ds_central_reports;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_ds_north_reports;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_ds_south_reports;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_ds_patrol_areas;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_ds_categories;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_ds_south_incidents;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_ds_north_incidents;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_ds_central_incidents;
DROP DATA GRANT IF EXISTS CRIME_DATA.aci_ds_statewide_incidents;

DROP DATA ROLE IF EXISTS aci_ds_statewide_role;
DROP DATA ROLE IF EXISTS aci_ds_central_role;
DROP DATA ROLE IF EXISTS aci_ds_north_role;
DROP DATA ROLE IF EXISTS aci_ds_south_role;
DROP ROLE IF EXISTS aci_ds_direct_login_role;


PROMPT DDS_CrimeData tutorial objects were removed. Crime data and app objects remain intact.
