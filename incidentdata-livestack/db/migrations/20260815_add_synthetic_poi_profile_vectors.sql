/* Add tutorial-safe fictional portrait metadata and profile vectors to a running demo database. */
ALTER TABLE persons_of_interest ADD (
  portrait_asset_uri VARCHAR2(500),
  portrait_alt_text VARCHAR2(240)
);

UPDATE persons_of_interest
SET portrait_alt_text = 'Generated fictional portrait profile for teaching only; not a photograph of a real person.'
WHERE portrait_alt_text IS NULL;

CREATE OR REPLACE VIEW secure_persons_of_interest_v AS
SELECT DISTINCT p.*
FROM persons_of_interest p
JOIN person_incident_links l ON l.person_id = p.person_id
JOIN secure_crime_incidents_v i ON i.incident_id = l.incident_id;

CREATE TABLE person_profile_embeddings (
  person_id NUMBER PRIMARY KEY REFERENCES persons_of_interest(person_id),
  embedding_model VARCHAR2(100) DEFAULT 'synthetic_poi_profile_v1' NOT NULL,
  embedding VECTOR(8, FLOAT32) NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

INSERT INTO person_profile_embeddings(person_id, embedding)
SELECT person_id,
       TO_VECTOR(CASE MOD(person_id - 1, 6)
         WHEN 0 THEN '[1,0,0,0,1,0,0,0]'
         WHEN 1 THEN '[0,1,0,0,0,1,0,0]'
         WHEN 2 THEN '[0,0,1,0,0,0,1,0]'
         WHEN 3 THEN '[0,0,0,1,1,0,0,0]'
         WHEN 4 THEN '[1,0,0,0,0,1,0,0]'
         ELSE '[0,1,0,0,0,0,1,0]'
       END)
FROM persons_of_interest;

COMMENT ON COLUMN persons_of_interest.portrait_asset_uri IS 'Optional location of a generated fictional portrait asset. Never use a real-person image.';
COMMENT ON TABLE person_profile_embeddings IS 'Synthetic fictional profile vectors for a teaching-only Similar POI Search. Not facial-recognition or biometric embeddings.';
COMMIT;
