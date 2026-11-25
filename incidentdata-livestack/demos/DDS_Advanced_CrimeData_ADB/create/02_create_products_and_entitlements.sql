/* Run as CRIME_DATA. Creates data products and the entitlement register. */
WHENEVER SQLERROR EXIT SQL.SQLCODE

CREATE TABLE IF NOT EXISTS aci_a_end_user_scope (
  scope_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  end_user_name VARCHAR2(128) NOT NULL,
  patrol_area_code VARCHAR2(30),
  persona_code VARCHAR2(20) NOT NULL,
  clearance_code VARCHAR2(20) NOT NULL,
  active_flag CHAR(1) DEFAULT 'Y' NOT NULL CHECK (active_flag IN ('Y', 'N')),
  valid_from TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  valid_to TIMESTAMP,
  CONSTRAINT aci_a_scope_persona_ck CHECK (persona_code IN ('FIELD', 'CASE', 'COMMAND')),
  CONSTRAINT aci_a_scope_clearance_ck CHECK (clearance_code IN ('FIELD', 'CASE', 'COMMAND')),
  CONSTRAINT aci_a_scope_validity_ck CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT aci_a_scope_uq UNIQUE (end_user_name, patrol_area_code, persona_code)
);

CREATE OR REPLACE VIEW aci_a_field_incident_product_v AS
SELECT i.incident_id, i.incident_ref, p.area_code, p.area_name,
       c.category_code, c.category_name, c.severity_band,
       i.incident_status, i.occurred_at, i.location_type, i.suburb,
       i.latitude, i.longitude, i.address_precision, i.modus_operandi,
       i.property_category, i.created_at
FROM crime_incidents i
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
JOIN incident_categories c ON c.category_id = i.category_id;

CREATE OR REPLACE VIEW aci_a_case_product_v AS
SELECT i.incident_id, i.incident_ref, p.area_code, p.area_name,
       c.category_code, c.category_name, i.incident_status, i.occurred_at,
       i.suburb, i.address_precision, i.modus_operandi, i.property_category,
       i.vehicle_descriptor, r.report_id, r.report_summary, r.report_text,
       r.embedding_text, r.created_at
FROM crime_incidents i
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
JOIN incident_categories c ON c.category_id = i.category_id
LEFT JOIN incident_reports r ON r.incident_id = i.incident_id;

CREATE OR REPLACE VIEW aci_a_command_activity_product_v AS
SELECT p.area_code, p.area_name, c.category_code, c.category_name,
       TRUNC(CAST(i.occurred_at AS DATE)) AS occurred_day,
       COUNT(*) AS incident_count,
       COUNT(CASE WHEN i.incident_status IN ('under_review', 'assigned') THEN 1 END) AS active_count
FROM crime_incidents i
JOIN patrol_areas p ON p.patrol_area_id = i.patrol_area_id
JOIN incident_categories c ON c.category_id = i.category_id
GROUP BY p.area_code, p.area_name, c.category_code, c.category_name,
         TRUNC(CAST(i.occurred_at AS DATE));

MERGE INTO aci_a_end_user_scope target
USING (
  SELECT 'ACI_A_FIELD_CENTRAL' end_user_name, 'CENTRAL' patrol_area_code, 'FIELD' persona_code, 'FIELD' clearance_code FROM dual
  UNION ALL SELECT 'ACI_A_FIELD_NORTH', 'NORTH', 'FIELD', 'FIELD' FROM dual
  UNION ALL SELECT 'ACI_A_CASE_SOUTH', 'SOUTH', 'CASE', 'CASE' FROM dual
  UNION ALL SELECT 'ACI_A_CASE_CENTRAL', 'CENTRAL', 'CASE', 'CASE' FROM dual
  UNION ALL SELECT 'ACI_A_COMMAND', CAST(NULL AS VARCHAR2(30)), 'COMMAND', 'COMMAND' FROM dual
) source
ON (target.end_user_name = source.end_user_name
    AND target.persona_code = source.persona_code
    AND (target.patrol_area_code = source.patrol_area_code
         OR (target.patrol_area_code IS NULL AND source.patrol_area_code IS NULL)))
WHEN MATCHED THEN UPDATE SET target.clearance_code = source.clearance_code,
                             target.active_flag = 'Y', target.valid_from = SYSTIMESTAMP,
                             target.valid_to = NULL
WHEN NOT MATCHED THEN INSERT (end_user_name, patrol_area_code, persona_code, clearance_code)
VALUES (source.end_user_name, source.patrol_area_code, source.persona_code, source.clearance_code);
COMMIT;

PROMPT Advanced ADB data products and active entitlement records are ready.
