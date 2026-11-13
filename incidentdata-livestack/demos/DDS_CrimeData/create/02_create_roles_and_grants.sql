/*
 * DDS_CrimeData -- roles and declarative data grants.
 * Run as CRIME_DATA in FREEPDB1 after 01_grant_deepsec_administration.sql.
 */
WHENEVER SQLERROR EXIT SQL.SQLCODE

CREATE DATA ROLE IF NOT EXISTS aci_ds_statewide_role;
CREATE DATA ROLE IF NOT EXISTS aci_ds_central_role;
CREATE DATA ROLE IF NOT EXISTS aci_ds_north_role;
CREATE DATA ROLE IF NOT EXISTS aci_ds_south_role;

/*
 * Native JSON columns cannot be used with ALL COLUMNS EXCEPT in this build.
 * Use an explicit approved scalar-column list instead. DDS then masks the
 * excluded cells as NULL while applying each patrol-area row predicate.
 */
DROP DATA GRANT IF EXISTS aci_ds_regional_reports;
DROP DATA GRANT IF EXISTS aci_ds_central_reports;
DROP DATA GRANT IF EXISTS aci_ds_north_reports;
DROP DATA GRANT IF EXISTS aci_ds_south_reports;
DROP DATA GRANT IF EXISTS aci_ds_central_incidents;
DROP DATA GRANT IF EXISTS aci_ds_north_incidents;
DROP DATA GRANT IF EXISTS aci_ds_south_incidents;
DROP VIEW IF EXISTS aci_ds_regional_reports_v;
DROP VIEW IF EXISTS aci_ds_regional_incidents_v;

CREATE OR REPLACE DATA GRANT aci_ds_statewide_incidents AS
  SELECT ON crime_incidents
  TO aci_ds_statewide_role;

CREATE OR REPLACE DATA GRANT aci_ds_central_incidents AS
  SELECT (incident_id, incident_ref, category_id, patrol_area_id, incident_status,
          occurred_at, location_type, suburb, latitude, longitude,
          address_line_1, address_locality, address_region, address_postcode,
          address_country_code, address_precision, address_enrichment_source,
          modus_operandi, property_category, created_at)
  ON crime_incidents
  WHERE patrol_area_id = (
    SELECT patrol_area_id FROM patrol_areas WHERE area_code = 'CENTRAL'
  )
  TO aci_ds_central_role;

CREATE OR REPLACE DATA GRANT aci_ds_north_incidents AS
  SELECT (incident_id, incident_ref, category_id, patrol_area_id, incident_status,
          occurred_at, location_type, suburb, latitude, longitude,
          address_line_1, address_locality, address_region, address_postcode,
          address_country_code, address_precision, address_enrichment_source,
          modus_operandi, property_category, created_at)
  ON crime_incidents
  WHERE patrol_area_id = (
    SELECT patrol_area_id FROM patrol_areas WHERE area_code = 'NORTH'
  )
  TO aci_ds_north_role;

CREATE OR REPLACE DATA GRANT aci_ds_south_incidents AS
  SELECT (incident_id, incident_ref, category_id, patrol_area_id, incident_status,
          occurred_at, location_type, suburb, latitude, longitude,
          address_line_1, address_locality, address_region, address_postcode,
          address_country_code, address_precision, address_enrichment_source,
          modus_operandi, property_category, created_at)
  ON crime_incidents
  WHERE patrol_area_id = (
    SELECT patrol_area_id FROM patrol_areas WHERE area_code = 'SOUTH'
  )
  TO aci_ds_south_role;

CREATE OR REPLACE DATA GRANT aci_ds_categories AS
  SELECT ON incident_categories
  TO aci_ds_statewide_role, aci_ds_central_role, aci_ds_north_role, aci_ds_south_role;

CREATE OR REPLACE DATA GRANT aci_ds_patrol_areas AS
  SELECT ON patrol_areas
  TO aci_ds_statewide_role, aci_ds_central_role, aci_ds_north_role, aci_ds_south_role;

/*
 * This local Free 26ai build rejects the WHEN ... GRANTED ON cross-table
 * syntax at parse time. Mirror the authorised parent incident predicate here
 * so report rows remain consistently scoped on this runnable local demo.
 */
CREATE OR REPLACE DATA GRANT aci_ds_central_reports AS
  SELECT (report_id, incident_id, report_summary, embedding_text, created_at)
  ON incident_reports
  WHERE incident_id IN (
    SELECT i.incident_id FROM crime_incidents i
    JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
    WHERE p.area_code = 'CENTRAL'
  )
  TO aci_ds_central_role;

CREATE OR REPLACE DATA GRANT aci_ds_north_reports AS
  SELECT (report_id, incident_id, report_summary, embedding_text, created_at)
  ON incident_reports
  WHERE incident_id IN (
    SELECT i.incident_id FROM crime_incidents i
    JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
    WHERE p.area_code = 'NORTH'
  )
  TO aci_ds_north_role;

CREATE OR REPLACE DATA GRANT aci_ds_south_reports AS
  SELECT (report_id, incident_id, report_summary, embedding_text, created_at)
  ON incident_reports
  WHERE incident_id IN (
    SELECT i.incident_id FROM crime_incidents i
    JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
    WHERE p.area_code = 'SOUTH'
  )
  TO aci_ds_south_role;

CREATE OR REPLACE DATA GRANT aci_ds_statewide_reports AS
  SELECT ON incident_reports
  TO aci_ds_statewide_role;

PROMPT DDS_CrimeData roles and data grants are ready.
