/* Synthetic scenario vectors for the Crime Pattern Signals demonstration.
   These compact vectors represent the four seeded fictional scenarios only;
   they are not person, risk, or prediction embeddings. */
CREATE TABLE incident_report_embeddings (
  incident_id NUMBER PRIMARY KEY REFERENCES crime_incidents(incident_id),
  embedding_model VARCHAR2(100) DEFAULT 'synthetic_pattern_v1' NOT NULL,
  embedding VECTOR(8, FLOAT32) NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

INSERT INTO incident_report_embeddings(incident_id, embedding)
SELECT incident_id,
       TO_VECTOR(CASE modus_operandi
         WHEN 'rear-access-forced-window' THEN '[1,0,0,0,0,0,0,0]'
         WHEN 'vehicle-recovery-cloned-plate' THEN '[0,1,0,0,0,0,0,0]'
         WHEN 'payment-diversion-phishing' THEN '[0,0,1,0,0,0,0,0]'
         WHEN 'overnight-property-damage' THEN '[0,0,0,1,0,0,0,0]'
         ELSE '[0,0,0,0,1,0,0,0]'
       END)
FROM crime_incidents;

COMMENT ON TABLE incident_report_embeddings IS
  'Synthetic scenario vectors for the non-operational Crime Pattern Signals demo. Vector matches are descriptive only.';

/* These are synthetic profile vectors, not face, biometric, identity, risk, or
   surveillance embeddings. They make the Similar POI Search tutorial repeatable. */
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

COMMENT ON TABLE person_profile_embeddings IS
  'Synthetic fictional profile vectors for a teaching-only Similar POI Search. Not facial-recognition or biometric embeddings.';

CREATE TABLE person_narrative_embeddings (
  person_id NUMBER PRIMARY KEY REFERENCES persons_of_interest(person_id),
  embedding_model VARCHAR2(160) NOT NULL,
  source_sha256 VARCHAR2(64) NOT NULL,
  embedding VECTOR(384, FLOAT32) NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE TABLE person_visual_embeddings (
  person_id NUMBER NOT NULL REFERENCES persons_of_interest(person_id),
  asset_ref VARCHAR2(80) NOT NULL,
  asset_kind VARCHAR2(30) NOT NULL CHECK (asset_kind IN ('reference_portrait','case_image')),
  asset_uri VARCHAR2(500) NOT NULL,
  mime_type VARCHAR2(80) NOT NULL,
  asset_sha256 VARCHAR2(64) NOT NULL,
  asset_caption VARCHAR2(500),
  embedding_model VARCHAR2(160) NOT NULL,
  embedding VECTOR(512, FLOAT32) NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  PRIMARY KEY(person_id,asset_ref),
  UNIQUE(asset_ref)
);

COMMENT ON TABLE person_narrative_embeddings IS
  'MiniLM narrative vectors for fictional POI semantic retrieval in Oracle Vector Search.';
COMMENT ON TABLE person_visual_embeddings IS
  'CLIP visual vectors and asset metadata for generated fictional portraits and controlled case images. Not for real-person identification.';
