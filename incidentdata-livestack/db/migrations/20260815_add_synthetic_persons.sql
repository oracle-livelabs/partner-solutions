/* One-time migration for an already-bootstrapped Police Adelaide database. */
CREATE TABLE persons_of_interest (
  person_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  person_ref VARCHAR2(24) UNIQUE NOT NULL,
  display_name VARCHAR2(120) NOT NULL,
  alias_name VARCHAR2(120),
  person_status VARCHAR2(30) NOT NULL CHECK (person_status IN ('person_of_interest','suspect','associate')),
  portrait_variant VARCHAR2(24) DEFAULT 'synthetic-avatar-1' NOT NULL,
  narrative_summary VARCHAR2(500),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE TABLE person_incident_links (
  person_id NUMBER NOT NULL REFERENCES persons_of_interest(person_id),
  incident_id NUMBER NOT NULL REFERENCES crime_incidents(incident_id),
  connection_type VARCHAR2(40) NOT NULL CHECK (connection_type IN ('person_of_interest','suspect','associate')),
  link_summary VARCHAR2(300),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  PRIMARY KEY(person_id, incident_id)
);
CREATE INDEX ix_person_incident ON person_incident_links(incident_id);

INSERT INTO persons_of_interest(person_ref,display_name,alias_name,person_status,portrait_variant,narrative_summary)
SELECT 'POI-'||LPAD(LEVEL,4,'0'),
       'Synthetic Subject '||LPAD(LEVEL,2,'0'),
       'Alias Echo-'||LPAD(LEVEL,2,'0'),
       CASE MOD(LEVEL,3) WHEN 0 THEN 'suspect' WHEN 1 THEN 'person_of_interest' ELSE 'associate' END,
       'synthetic-avatar-'||(MOD(LEVEL-1,6)+1),
       'Fictional teaching entity used only to demonstrate case, incident, and evidence relationships.'
FROM dual CONNECT BY LEVEL <= 60;

INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary)
SELECT MOD(i.incident_id-1,60)+1,
       i.incident_id,
       CASE MOD(i.incident_id,3) WHEN 0 THEN 'suspect' WHEN 1 THEN 'person_of_interest' ELSE 'associate' END,
       'Synthetic relationship for graph and teaching demonstrations only.'
FROM crime_incidents i
WHERE MOD(i.incident_id,4) <> 0;

CREATE OR REPLACE VIEW secure_persons_of_interest_v AS
SELECT DISTINCT p.*
FROM persons_of_interest p
JOIN person_incident_links l ON l.person_id = p.person_id
JOIN secure_crime_incidents_v i ON i.incident_id = l.incident_id;

COMMENT ON TABLE persons_of_interest IS 'Fictional teaching entities only. No row represents a real person or operational police intelligence.';
COMMIT;
