/* Additive identifier register. PERSON_ID is deliberately not a foreign key:
   city restoration deletes/recreates live persons. Profile + PERSON_REF is stable. */
CREATE TABLE poi_identifiers (
  identifier_id VARCHAR2(64 BYTE) PRIMARY KEY,
  dataset_profile_id NUMBER NOT NULL REFERENCES z_base_dataset_profiles(dataset_profile_id),
  person_ref VARCHAR2(24 BYTE) NOT NULL,
  identifier_type VARCHAR2(16 BYTE) NOT NULL CHECK(identifier_type IN ('alias','username','email','phone')),
  namespace VARCHAR2(80 BYTE) DEFAULT 'general' NOT NULL,
  identifier_value VARCHAR2(320 CHAR) NOT NULL,
  normalized_value VARCHAR2(400 CHAR) NOT NULL,
  review_status VARCHAR2(16 BYTE) NOT NULL CHECK(review_status IN ('proposed','declared','confirmed','rejected')),
  source_ref VARCHAR2(300 CHAR) NOT NULL,
  source_note VARCHAR2(1000 CHAR) NOT NULL,
  recorded_by VARCHAR2(120 CHAR) NOT NULL,
  reviewed_by VARCHAR2(120 CHAR),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_to TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT poi_identifier_dates CHECK(valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT poi_identifier_review CHECK(review_status <> 'confirmed' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX poi_identifiers_person_ix ON poi_identifiers(dataset_profile_id,person_ref);
CREATE INDEX poi_identifiers_match_ix ON poi_identifiers(dataset_profile_id,identifier_type,namespace,normalized_value);
CREATE OR REPLACE VIEW secure_poi_identifiers_v AS
SELECT x.*,p.person_id,p.display_name
FROM poi_identifiers x
JOIN z_base_active_dataset_profile a ON a.dataset_profile_id=x.dataset_profile_id AND a.control_id=1
JOIN secure_persons_of_interest_v p ON p.person_ref=x.person_ref;
COMMENT ON TABLE poi_identifiers IS 'Profile-scoped identifier assertions for fictional POIs. Multiple people may share an identifier; a match is not identity verification.';
COMMENT ON COLUMN poi_identifiers.namespace IS 'Account platform for usernames, email for addresses, e164 for phone numbers, general for aliases. Unknown username platforms use unspecified.';
COMMENT ON COLUMN poi_identifiers.review_status IS 'proposed: candidate only; declared: explicit scenario annotation; confirmed: reviewed with attribution; rejected: retained but excluded from matching.';
