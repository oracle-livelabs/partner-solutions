/* Synthetic IncidentData LiveStack schema. No real persons or incidents. */
SET DEFINE OFF
CREATE TABLE security_users (
  user_name VARCHAR2(80) PRIMARY KEY, role_name VARCHAR2(30) NOT NULL,
  display_name VARCHAR2(120) NOT NULL, is_active NUMBER(1) DEFAULT 1 NOT NULL
);
CREATE TABLE patrol_areas (
  patrol_area_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  area_code VARCHAR2(30) UNIQUE NOT NULL, area_name VARCHAR2(100) NOT NULL,
  region_group VARCHAR2(30) NOT NULL, centre_lat NUMBER(9,6), centre_lon NUMBER(9,6)
);
CREATE TABLE security_user_geo_entitlements (
  user_name VARCHAR2(80) REFERENCES security_users(user_name),
  patrol_area_id NUMBER REFERENCES patrol_areas(patrol_area_id),
  PRIMARY KEY(user_name, patrol_area_id)
);
CREATE TABLE incident_categories (
  category_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_code VARCHAR2(40) UNIQUE NOT NULL, category_name VARCHAR2(100) NOT NULL,
  severity_band VARCHAR2(12) CHECK (severity_band IN ('low','medium','high')),
  locality_code VARCHAR2(40) DEFAULT 'UNSPECIFIED' NOT NULL,
  category_description VARCHAR2(300),
  executive_group_code VARCHAR2(40) DEFAULT 'UNMAPPED' NOT NULL,
  executive_group_label VARCHAR2(100) DEFAULT 'Unmapped' NOT NULL,
  person_property_class VARCHAR2(20) DEFAULT 'OTHER' NOT NULL,
  synthetic_profile_code VARCHAR2(60),
  display_order NUMBER DEFAULT 999 NOT NULL,
  display_color VARCHAR2(7) DEFAULT '#437C94' NOT NULL,
  active NUMBER(1) DEFAULT 1 NOT NULL CHECK (active IN (0,1))
);
CREATE TABLE crime_incidents (
  incident_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_ref VARCHAR2(24) UNIQUE NOT NULL, category_id NUMBER NOT NULL REFERENCES incident_categories(category_id),
  patrol_area_id NUMBER NOT NULL REFERENCES patrol_areas(patrol_area_id),
  incident_status VARCHAR2(30) NOT NULL CHECK (incident_status IN ('reported','under_review','assigned','resolved','closed_no_further_action')),
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL, location_type VARCHAR2(60),
  suburb VARCHAR2(100) NOT NULL, latitude NUMBER(9,6), longitude NUMBER(9,6),
  address_line_1 VARCHAR2(160), address_locality VARCHAR2(100), address_region VARCHAR2(100),
  address_postcode VARCHAR2(12), address_country_code CHAR(2) DEFAULT 'AU' NOT NULL,
  address_precision VARCHAR2(40) DEFAULT 'approximate_suburb' NOT NULL
    CHECK (address_precision IN ('approximate_suburb','locality_only','masked_vicinity')),
  address_enrichment_source VARCHAR2(40) DEFAULT NULL,
  modus_operandi VARCHAR2(80), property_category VARCHAR2(80), vehicle_descriptor VARCHAR2(100),
  incident_attributes JSON, created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);
CREATE TABLE incident_reports (
  report_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id NUMBER NOT NULL REFERENCES crime_incidents(incident_id),
  report_summary VARCHAR2(1000) NOT NULL, report_text CLOB NOT NULL, embedding_text VARCHAR2(1000), enrichments JSON,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);
CREATE TABLE persons_of_interest (
  person_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  person_ref VARCHAR2(24) UNIQUE NOT NULL,
  display_name VARCHAR2(120) NOT NULL,
  alias_name VARCHAR2(120),
  person_status VARCHAR2(30) NOT NULL CHECK (person_status IN ('person_of_interest','suspect','associate')),
  portrait_variant VARCHAR2(24) DEFAULT 'synthetic-avatar-1' NOT NULL,
  portrait_asset_uri VARCHAR2(500),
  portrait_alt_text VARCHAR2(240),
  narrative_summary VARCHAR2(500),
  narrative_text CLOB,
  profile_attributes JSON,
  owning_patrol_area_id NUMBER REFERENCES patrol_areas(patrol_area_id),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);
CREATE TABLE case_files (
  case_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, case_ref VARCHAR2(24) UNIQUE NOT NULL,
  case_status VARCHAR2(30) NOT NULL, pattern_label VARCHAR2(120), patrol_area_id NUMBER REFERENCES patrol_areas(patrol_area_id),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);
CREATE TABLE case_incident_links (case_id NUMBER REFERENCES case_files(case_id), incident_id NUMBER REFERENCES crime_incidents(incident_id), PRIMARY KEY(case_id, incident_id));
CREATE TABLE evidence_items (
  evidence_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, incident_id NUMBER REFERENCES crime_incidents(incident_id),
  evidence_type VARCHAR2(60), evidence_metadata JSON, created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);
CREATE TABLE person_incident_links (
  person_id NUMBER NOT NULL REFERENCES persons_of_interest(person_id),
  incident_id NUMBER NOT NULL REFERENCES crime_incidents(incident_id),
  connection_type VARCHAR2(40) NOT NULL CHECK (connection_type IN ('person_of_interest','suspect','associate')),
  link_summary VARCHAR2(300),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  PRIMARY KEY(person_id, incident_id)
);
CREATE TABLE semantic_matches (
  match_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, source_incident_id NUMBER REFERENCES crime_incidents(incident_id),
  matched_incident_id NUMBER REFERENCES crime_incidents(incident_id), similarity_score NUMBER(5,4), match_reason VARCHAR2(200)
);
CREATE TABLE analyst_actions (
  action_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_name VARCHAR2(80), action_type VARCHAR2(80),
  payload JSON, created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);
CREATE INDEX ix_incident_area_time ON crime_incidents(patrol_area_id, occurred_at DESC);
CREATE INDEX ix_incident_category ON crime_incidents(category_id);
CREATE INDEX ix_report_incident ON incident_reports(incident_id);
CREATE INDEX ix_person_incident ON person_incident_links(incident_id);

CREATE OR REPLACE VIEW secure_crime_incidents_v AS
SELECT i.* FROM crime_incidents i
WHERE SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER') = 'statewide_admin'
   OR EXISTS (SELECT 1 FROM security_user_geo_entitlements e
              WHERE e.user_name = SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')
                AND e.patrol_area_id = i.patrol_area_id);

CREATE OR REPLACE VIEW secure_incident_reports_v AS
SELECT r.* FROM incident_reports r JOIN secure_crime_incidents_v i ON i.incident_id = r.incident_id;

CREATE OR REPLACE VIEW secure_persons_of_interest_v AS
SELECT p.* FROM persons_of_interest p
WHERE SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER') = 'statewide_admin'
   OR EXISTS (SELECT 1 FROM security_user_geo_entitlements e
              WHERE e.user_name = SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')
                AND e.patrol_area_id = p.owning_patrol_area_id)
   OR EXISTS (SELECT 1 FROM person_incident_links l
              JOIN secure_crime_incidents_v i ON i.incident_id=l.incident_id
              WHERE l.person_id=p.person_id);

COMMENT ON TABLE crime_incidents IS 'Synthetic, non-identifying Adelaide incident records for a safety-limited demonstration. Do not use for operational decisions.';
COMMENT ON COLUMN crime_incidents.modus_operandi IS 'Synthetic pattern descriptor for semantic and graph demonstrations; never evidence of person identity.';
COMMENT ON COLUMN crime_incidents.address_line_1 IS 'Synthetic or masked locality label only; never a real street, dwelling, workplace, or incident address.';
COMMENT ON COLUMN crime_incidents.address_precision IS 'Precision of the synthetic address representation. Coordinates remain approximate training points.';
COMMENT ON COLUMN crime_incidents.address_enrichment_source IS 'Address enrichment method; null means the address enrichment script has not processed the row.';
COMMENT ON TABLE persons_of_interest IS 'Fictional teaching entities only. No row represents a real person or operational police intelligence.';
COMMENT ON COLUMN persons_of_interest.portrait_asset_uri IS 'Optional location of a generated fictional portrait asset. Never use a real-person image.';
