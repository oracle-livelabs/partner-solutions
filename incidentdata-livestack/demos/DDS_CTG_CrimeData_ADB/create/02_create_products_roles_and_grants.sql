/*
 * Run as CRIME_DATA after preflight.
 * ACI_C_REPORTS_BY_INCIDENT is deliberately a cross-table Data Grant: it has
 * no TO clause and inherits its effective grantees from the incident parent.
 */
WHENEVER SQLERROR EXIT SQL.SQLCODE

CREATE OR REPLACE VIEW aci_c_incident_parent_product_v AS
SELECT i.incident_id, i.incident_ref, p.area_code, p.area_name,
       c.category_code, c.category_name, c.severity_band,
       i.incident_status, i.occurred_at, i.location_type, i.suburb,
       i.address_precision, i.modus_operandi, i.property_category, i.created_at
FROM crime_incidents i
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
JOIN incident_categories c ON c.category_id = i.category_id;

CREATE OR REPLACE VIEW aci_c_report_child_product_v AS
SELECT r.report_id, r.incident_id, i.incident_ref, p.area_code, p.area_name,
       r.report_summary, r.report_text, r.embedding_text, r.created_at
FROM incident_reports r
JOIN crime_incidents i ON i.incident_id = r.incident_id
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id;

CREATE DATA ROLE IF NOT EXISTS aci_c_central_investigator_role;
CREATE DATA ROLE IF NOT EXISTS aci_c_north_investigator_role;
CREATE DATA ROLE IF NOT EXISTS aci_c_statewide_reviewer_role;

/* These are the direct parent grants. They name the only data roles in CTG. */
CREATE OR REPLACE DATA GRANT aci_c_central_incident_parent
  AS SELECT (incident_id, incident_ref, area_code, area_name, category_code,
             category_name, severity_band, incident_status, occurred_at,
             location_type, suburb, address_precision, modus_operandi,
             property_category, created_at)
  ON aci_c_incident_parent_product_v
  WHERE area_code = 'CENTRAL'
  TO aci_c_central_investigator_role;

CREATE OR REPLACE DATA GRANT aci_c_north_incident_parent
  AS SELECT (incident_id, incident_ref, area_code, area_name, category_code,
             category_name, severity_band, incident_status, occurred_at,
             location_type, suburb, address_precision, modus_operandi,
             property_category, created_at)
  ON aci_c_incident_parent_product_v
  WHERE area_code = 'NORTH'
  TO aci_c_north_investigator_role;

CREATE OR REPLACE DATA GRANT aci_c_statewide_incident_parent
  AS SELECT (incident_id, incident_ref, area_code, area_name, category_code,
             category_name, severity_band, incident_status, occurred_at,
             location_type, suburb, address_precision, modus_operandi,
             property_category, created_at)
  ON aci_c_incident_parent_product_v
  TO aci_c_statewide_reviewer_role;

/*
 * Child authorization is inherited, not granted directly. The parent column
 * requirement makes incident_id both the authorization anchor and join key.
 */
CREATE OR REPLACE DATA GRANT aci_c_reports_by_incident
  AS SELECT (report_id, incident_id, incident_ref, area_code, area_name,
             report_summary, report_text, embedding_text, created_at)
  ON aci_c_report_child_product_v
  WHEN SELECT (incident_id) GRANTED ON aci_c_incident_parent_product_v
  WHERE crime_data.aci_c_report_child_product_v.incident_id =
        crime_data.aci_c_incident_parent_product_v.incident_id;

/* Submit Deep Sec SET statements dynamically so SQLcl does not parse them. */
BEGIN
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON aci_c_incident_parent_product_v ENABLED';
  EXECUTE IMMEDIATE 'SET USE DATA GRANTS ONLY ON aci_c_report_child_product_v ENABLED';
END;
/

PROMPT CTG ADB parent products, child cross-table grant, and roles are ready.
