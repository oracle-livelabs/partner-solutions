/*
  Fictional POI multimodal search support.

  Narrative and portrait vectors are intentionally stored separately because
  they answer different questions and use different embedding models. Portrait
  assets must be generated fictional people; no operational or real-person
  biometric data is permitted in this demonstration table.
*/
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tab_columns
  WHERE table_name='PERSONS_OF_INTEREST' AND column_name='NARRATIVE_TEXT';
  IF v_count=0 THEN EXECUTE IMMEDIATE 'ALTER TABLE persons_of_interest ADD narrative_text CLOB'; END IF;

  SELECT COUNT(*) INTO v_count FROM user_tab_columns
  WHERE table_name='PERSONS_OF_INTEREST' AND column_name='PROFILE_ATTRIBUTES';
  IF v_count=0 THEN EXECUTE IMMEDIATE 'ALTER TABLE persons_of_interest ADD profile_attributes JSON'; END IF;

  SELECT COUNT(*) INTO v_count FROM user_tab_columns
  WHERE table_name='PERSONS_OF_INTEREST' AND column_name='OWNING_PATROL_AREA_ID';
  IF v_count=0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE persons_of_interest ADD owning_patrol_area_id NUMBER REFERENCES patrol_areas(patrol_area_id)';
  END IF;
END;
/

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name='PERSON_NARRATIVE_EMBEDDINGS';
  IF v_count=0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE person_narrative_embeddings (
        person_id NUMBER PRIMARY KEY REFERENCES persons_of_interest(person_id),
        embedding_model VARCHAR2(160) NOT NULL,
        source_sha256 VARCHAR2(64) NOT NULL,
        embedding VECTOR(384, FLOAT32) NOT NULL,
        created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
      )]';
  END IF;

  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name='PERSON_VISUAL_EMBEDDINGS';
  IF v_count=0 THEN
    EXECUTE IMMEDIATE q'[
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
      )]';
  END IF;
END;
/

COMMENT ON COLUMN persons_of_interest.narrative_text IS
  'Full fictional profile narrative used as the source document for narrative embedding and investigator reference.';
COMMENT ON COLUMN persons_of_interest.profile_attributes IS
  'Structured fictional profile provenance, role, and demonstration-only controls.';
COMMENT ON COLUMN persons_of_interest.owning_patrol_area_id IS
  'Case-management ownership area used for database security when an authorised incident link does not yet exist.';
COMMENT ON TABLE person_narrative_embeddings IS
  'MiniLM narrative vectors for fictional POI semantic retrieval in Oracle Vector Search.';
COMMENT ON TABLE person_visual_embeddings IS
  'CLIP visual vectors and asset metadata for generated fictional portraits and controlled case images. Not for real-person identification.';

CREATE OR REPLACE VIEW secure_persons_of_interest_v AS
SELECT p.*
FROM persons_of_interest p
WHERE SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')='statewide_admin'
   OR EXISTS (
        SELECT 1 FROM security_user_geo_entitlements e
        WHERE e.user_name=SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')
          AND e.patrol_area_id=p.owning_patrol_area_id)
   OR EXISTS (
        SELECT 1 FROM person_incident_links l
        JOIN secure_crime_incidents_v i ON i.incident_id=l.incident_id
        WHERE l.person_id=p.person_id);

DECLARE
  PROCEDURE add_base_column(p_column VARCHAR2, p_definition VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_tab_columns
    WHERE table_name='Z_BASE_PERSONS' AND column_name=UPPER(p_column);
    IF v_count=0 THEN EXECUTE IMMEDIATE 'ALTER TABLE z_base_persons ADD '||p_column||' '||p_definition; END IF;
  END;
  PROCEDURE create_from_active(p_name VARCHAR2, p_source VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name=UPPER(p_name);
    IF v_count=0 THEN
      EXECUTE IMMEDIATE 'CREATE TABLE '||p_name||' AS SELECT CAST(NULL AS NUMBER) dataset_profile_id,s.* FROM '||p_source||' s WHERE 1=0';
      EXECUTE IMMEDIATE 'CREATE INDEX ix_'||LOWER(SUBSTR(p_name,8,18))||'_p ON '||p_name||'(dataset_profile_id)';
    END IF;
  END;
BEGIN
  add_base_column('narrative_text','CLOB');
  add_base_column('profile_attributes','JSON');
  add_base_column('owning_patrol_area_id','NUMBER');
  create_from_active('z_base_person_narrative_vec','person_narrative_embeddings');
  create_from_active('z_base_person_visual_vec','person_visual_embeddings');
END;
/

@@20260820_fix_z_base_profile_restore.sql
