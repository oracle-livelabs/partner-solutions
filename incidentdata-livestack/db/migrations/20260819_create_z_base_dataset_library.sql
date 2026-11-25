/*
  Profile-aware snapshot library. Active application tables are unchanged and
  hold exactly one restored profile at a time. Z_BASE_* stores every profile.
*/
DECLARE
  PROCEDURE create_from_active(p_name VARCHAR2, p_source VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name = UPPER(p_name);
    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'CREATE TABLE ' || p_name ||
        ' AS SELECT CAST(NULL AS NUMBER) dataset_profile_id, s.* FROM ' || p_source || ' s WHERE 1=0';
      EXECUTE IMMEDIATE 'CREATE INDEX ix_zb_' || SUBSTR(LOWER(p_name), 1, 20) || '_p ON ' || p_name || '(dataset_profile_id)';
    END IF;
  END;
BEGIN
  create_from_active('z_base_security_users', 'security_users');
  create_from_active('z_base_patrol_areas', 'patrol_areas');
  create_from_active('z_base_security_entitlements', 'security_user_geo_entitlements');
  create_from_active('z_base_incident_categories', 'incident_categories');
  create_from_active('z_base_crime_incidents', 'crime_incidents');
  create_from_active('z_base_incident_reports', 'incident_reports');
  create_from_active('z_base_evidence_items', 'evidence_items');
  create_from_active('z_base_persons', 'persons_of_interest');
  create_from_active('z_base_person_incident_links', 'person_incident_links');
  create_from_active('z_base_case_files', 'case_files');
  create_from_active('z_base_case_incident_links', 'case_incident_links');
  create_from_active('z_base_semantic_matches', 'semantic_matches');
  create_from_active('z_base_incident_embeddings', 'incident_report_embeddings');
  create_from_active('z_base_person_embeddings', 'person_profile_embeddings');
  create_from_active('z_base_analyst_actions', 'analyst_actions');
END;
/

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name = 'Z_BASE_DATASET_PROFILES';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE z_base_dataset_profiles (
        dataset_profile_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        profile_code VARCHAR2(40) UNIQUE NOT NULL,
        profile_name VARCHAR2(100) NOT NULL,
        city_label VARCHAR2(100) NOT NULL,
        profile_status VARCHAR2(20) DEFAULT 'available' NOT NULL,
        profile_notes VARCHAR2(1000),
        captured_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
      )]';
    EXECUTE IMMEDIATE q'[
      CREATE TABLE z_base_active_dataset_profile (
        control_id NUMBER PRIMARY KEY CHECK (control_id = 1),
        dataset_profile_id NUMBER REFERENCES z_base_dataset_profiles(dataset_profile_id),
        activated_at TIMESTAMP,
        activated_by VARCHAR2(128)
      )]';
    EXECUTE IMMEDIATE 'INSERT INTO z_base_active_dataset_profile(control_id) VALUES (1)';
  END IF;
END;
/

CREATE OR REPLACE PACKAGE z_base_dataset_admin AS
  PROCEDURE capture_active_profile(
    p_profile_code IN VARCHAR2, p_profile_name IN VARCHAR2, p_city_label IN VARCHAR2,
    p_profile_notes IN VARCHAR2 DEFAULT NULL);
  PROCEDURE restore_profile(p_profile_code IN VARCHAR2);
END z_base_dataset_admin;
/

CREATE OR REPLACE PACKAGE BODY z_base_dataset_admin AS
  TYPE table_map_t IS RECORD (active_name VARCHAR2(30), base_name VARCHAR2(30));
  TYPE table_map_list_t IS TABLE OF table_map_t;

  FUNCTION maps RETURN table_map_list_t IS
  BEGIN
    RETURN table_map_list_t(
      table_map_t('SECURITY_USERS','Z_BASE_SECURITY_USERS'),
      table_map_t('PATROL_AREAS','Z_BASE_PATROL_AREAS'),
      table_map_t('SECURITY_USER_GEO_ENTITLEMENTS','Z_BASE_SECURITY_ENTITLEMENTS'),
      table_map_t('INCIDENT_CATEGORIES','Z_BASE_INCIDENT_CATEGORIES'),
      table_map_t('CRIME_INCIDENTS','Z_BASE_CRIME_INCIDENTS'),
      table_map_t('INCIDENT_REPORTS','Z_BASE_INCIDENT_REPORTS'),
      table_map_t('EVIDENCE_ITEMS','Z_BASE_EVIDENCE_ITEMS'),
      table_map_t('PERSONS_OF_INTEREST','Z_BASE_PERSONS'),
      table_map_t('PERSON_INCIDENT_LINKS','Z_BASE_PERSON_INCIDENT_LINKS'),
      table_map_t('CASE_FILES','Z_BASE_CASE_FILES'),
      table_map_t('CASE_INCIDENT_LINKS','Z_BASE_CASE_INCIDENT_LINKS'),
      table_map_t('SEMANTIC_MATCHES','Z_BASE_SEMANTIC_MATCHES'),
      table_map_t('INCIDENT_REPORT_EMBEDDINGS','Z_BASE_INCIDENT_EMBEDDINGS'),
      table_map_t('PERSON_PROFILE_EMBEDDINGS','Z_BASE_PERSON_EMBEDDINGS'),
      table_map_t('ANALYST_ACTIONS','Z_BASE_ANALYST_ACTIONS'));
  END;

  FUNCTION columns_for(p_table_name VARCHAR2) RETURN VARCHAR2 IS
    v_columns VARCHAR2(32767);
  BEGIN
    SELECT LISTAGG(column_name, ',') WITHIN GROUP (ORDER BY column_id)
    INTO v_columns FROM user_tab_columns
    WHERE table_name = UPPER(p_table_name);
    RETURN v_columns;
  END;

  PROCEDURE copy_active_to_base(p_active VARCHAR2, p_base VARCHAR2, p_profile_id NUMBER) IS
    v_columns VARCHAR2(32767) := columns_for(p_active);
  BEGIN
    EXECUTE IMMEDIATE 'DELETE FROM ' || p_base || ' WHERE dataset_profile_id = :1' USING p_profile_id;
    EXECUTE IMMEDIATE 'INSERT INTO ' || p_base || '(dataset_profile_id,' || v_columns || ') '
      || 'SELECT :1,' || v_columns || ' FROM ' || p_active USING p_profile_id;
  END;

  PROCEDURE copy_base_to_active(p_active VARCHAR2, p_base VARCHAR2, p_profile_id NUMBER) IS
    v_columns VARCHAR2(32767) := columns_for(p_active);
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO ' || p_active || '(' || v_columns || ') OVERRIDING SYSTEM VALUE '
      || 'SELECT ' || v_columns || ' FROM ' || p_base || ' WHERE dataset_profile_id = :1' USING p_profile_id;
  END;

  PROCEDURE capture_active_profile(
    p_profile_code IN VARCHAR2, p_profile_name IN VARCHAR2, p_city_label IN VARCHAR2,
    p_profile_notes IN VARCHAR2 DEFAULT NULL) IS
    v_profile_id NUMBER;
    v_maps table_map_list_t := maps;
  BEGIN
    MERGE INTO z_base_dataset_profiles p
    USING (SELECT UPPER(p_profile_code) profile_code, p_profile_name profile_name,
                  p_city_label city_label, p_profile_notes profile_notes FROM dual) s
    ON (p.profile_code = s.profile_code)
    WHEN MATCHED THEN UPDATE SET p.profile_name=s.profile_name, p.city_label=s.city_label,
      p.profile_notes=s.profile_notes, p.captured_at=SYSTIMESTAMP
    WHEN NOT MATCHED THEN INSERT(profile_code,profile_name,city_label,profile_notes)
      VALUES(s.profile_code,s.profile_name,s.city_label,s.profile_notes);
    SELECT dataset_profile_id INTO v_profile_id FROM z_base_dataset_profiles WHERE profile_code=UPPER(p_profile_code);
    FOR i IN 1 .. v_maps.COUNT LOOP
      copy_active_to_base(v_maps(i).active_name, v_maps(i).base_name, v_profile_id);
    END LOOP;
    COMMIT;
  END;

  PROCEDURE restore_profile(p_profile_code IN VARCHAR2) IS
    v_profile_id NUMBER;
    v_incidents NUMBER;
    v_maps table_map_list_t := maps;
  BEGIN
    SELECT dataset_profile_id INTO v_profile_id FROM z_base_dataset_profiles WHERE profile_code=UPPER(p_profile_code);
    SELECT COUNT(*) INTO v_incidents FROM z_base_crime_incidents WHERE dataset_profile_id=v_profile_id;
    IF v_incidents = 0 THEN RAISE_APPLICATION_ERROR(-20001, 'Profile has no Z_BASE_CRIME_INCIDENTS rows: ' || p_profile_code); END IF;

    /* Delete children before parents; DELETE keeps the restore rollback-safe. */
    DELETE FROM semantic_matches;
    DELETE FROM evidence_items;
    DELETE FROM case_incident_links;
    DELETE FROM person_incident_links;
    DELETE FROM incident_report_embeddings;
    DELETE FROM person_profile_embeddings;
    DELETE FROM incident_reports;
    DELETE FROM case_files;
    DELETE FROM persons_of_interest;
    DELETE FROM crime_incidents;
    DELETE FROM analyst_actions;
    DELETE FROM security_user_geo_entitlements;
    DELETE FROM security_users;
    DELETE FROM patrol_areas;
    DELETE FROM incident_categories;

    /* Restore parents before children. */
    copy_base_to_active(v_maps(1).active_name, v_maps(1).base_name, v_profile_id);
    copy_base_to_active(v_maps(2).active_name, v_maps(2).base_name, v_profile_id);
    copy_base_to_active(v_maps(3).active_name, v_maps(3).base_name, v_profile_id);
    copy_base_to_active(v_maps(4).active_name, v_maps(4).base_name, v_profile_id);
    copy_base_to_active(v_maps(5).active_name, v_maps(5).base_name, v_profile_id);
    copy_base_to_active(v_maps(6).active_name, v_maps(6).base_name, v_profile_id);
    copy_base_to_active(v_maps(7).active_name, v_maps(7).base_name, v_profile_id);
    copy_base_to_active(v_maps(8).active_name, v_maps(8).base_name, v_profile_id);
    copy_base_to_active(v_maps(9).active_name, v_maps(9).base_name, v_profile_id);
    copy_base_to_active(v_maps(10).active_name, v_maps(10).base_name, v_profile_id);
    copy_base_to_active(v_maps(11).active_name, v_maps(11).base_name, v_profile_id);
    copy_base_to_active(v_maps(12).active_name, v_maps(12).base_name, v_profile_id);
    copy_base_to_active(v_maps(13).active_name, v_maps(13).base_name, v_profile_id);
    copy_base_to_active(v_maps(14).active_name, v_maps(14).base_name, v_profile_id);
    copy_base_to_active(v_maps(15).active_name, v_maps(15).base_name, v_profile_id);

    UPDATE z_base_dataset_profiles SET profile_status=CASE WHEN dataset_profile_id=v_profile_id THEN 'active' ELSE 'available' END;
    UPDATE z_base_active_dataset_profile
    SET dataset_profile_id=v_profile_id, activated_at=SYSTIMESTAMP, activated_by=SYS_CONTEXT('USERENV','SESSION_USER')
    WHERE control_id=1;
    COMMIT;
  END;
END z_base_dataset_admin;
/

/* Early Adelaide snapshots predate required address defaults. */
UPDATE basic_bak_crime_incidents
SET address_country_code = COALESCE(address_country_code, 'AU'),
    address_precision = COALESCE(address_precision, 'approximate_suburb');

UPDATE perth_bak_crime_incidents
SET address_country_code = COALESCE(address_country_code, 'AU'),
    address_precision = COALESCE(address_precision, 'approximate_suburb');

BEGIN
  /* Import legacy Adelaide and Perth snapshots once. */
  z_base_dataset_admin.capture_active_profile('ADELAIDE_DATA', 'Adelaide Data Set Profile', 'Adelaide', 'Imported from BASIC_BAK_*');
END;
/

/* Replace the just-captured Adelaide rows with the original legacy backup content. */
DECLARE
  v_adelaide_id NUMBER;
  PROCEDURE import_snapshot(p_base VARCHAR2, p_legacy VARCHAR2) IS
    v_columns VARCHAR2(32767);
  BEGIN
    SELECT LISTAGG(column_name, ',') WITHIN GROUP (ORDER BY column_id) INTO v_columns
    FROM user_tab_columns WHERE table_name=UPPER(p_legacy);
    EXECUTE IMMEDIATE 'DELETE FROM '||p_base||' WHERE dataset_profile_id=:1' USING v_adelaide_id;
    EXECUTE IMMEDIATE 'INSERT INTO '||p_base||'(dataset_profile_id,'||v_columns||') SELECT :1,'||v_columns||' FROM '||p_legacy USING v_adelaide_id;
  END;
BEGIN
  SELECT dataset_profile_id INTO v_adelaide_id FROM z_base_dataset_profiles WHERE profile_code='ADELAIDE_DATA';
  import_snapshot('z_base_security_users','basic_bak_security_users'); import_snapshot('z_base_patrol_areas','basic_bak_patrol_areas'); import_snapshot('z_base_security_entitlements','basic_bak_security_entitlements'); import_snapshot('z_base_incident_categories','basic_bak_incident_categories'); import_snapshot('z_base_crime_incidents','basic_bak_crime_incidents'); import_snapshot('z_base_incident_reports','basic_bak_incident_reports'); import_snapshot('z_base_evidence_items','basic_bak_evidence_items'); import_snapshot('z_base_persons','basic_bak_persons'); import_snapshot('z_base_person_incident_links','basic_bak_person_incident_links'); import_snapshot('z_base_case_files','basic_bak_case_files'); import_snapshot('z_base_case_incident_links','basic_bak_case_incident_links'); import_snapshot('z_base_semantic_matches','basic_bak_semantic_matches'); import_snapshot('z_base_incident_embeddings','basic_bak_incident_embeddings'); import_snapshot('z_base_person_embeddings','basic_bak_person_embeddings'); import_snapshot('z_base_analyst_actions','basic_bak_analyst_actions');
END;
/

DECLARE
  v_perth_id NUMBER;
  PROCEDURE import_snapshot(p_base VARCHAR2, p_legacy VARCHAR2) IS
    v_columns VARCHAR2(32767);
  BEGIN
    SELECT LISTAGG(column_name, ',') WITHIN GROUP (ORDER BY column_id) INTO v_columns
    FROM user_tab_columns WHERE table_name=UPPER(p_legacy);
    EXECUTE IMMEDIATE 'DELETE FROM '||p_base||' WHERE dataset_profile_id=:1' USING v_perth_id;
    EXECUTE IMMEDIATE 'INSERT INTO '||p_base||'(dataset_profile_id,'||v_columns||') SELECT :1,'||v_columns||' FROM '||p_legacy USING v_perth_id;
  END;
BEGIN
  MERGE INTO z_base_dataset_profiles p
  USING (SELECT 'PERTH_DATA' profile_code, 'Perth Data Set Profile' profile_name, 'Perth Metropolitan Area' city_label FROM dual) s
  ON (p.profile_code=s.profile_code)
  WHEN MATCHED THEN UPDATE SET p.profile_name=s.profile_name,p.city_label=s.city_label,p.profile_notes='Imported from PERTH_BAK_*',p.captured_at=SYSTIMESTAMP
  WHEN NOT MATCHED THEN INSERT(profile_code,profile_name,city_label,profile_notes) VALUES(s.profile_code,s.profile_name,s.city_label,'Imported from PERTH_BAK_*');
  SELECT dataset_profile_id INTO v_perth_id FROM z_base_dataset_profiles WHERE profile_code='PERTH_DATA';
  import_snapshot('z_base_security_users','perth_bak_security_users'); import_snapshot('z_base_patrol_areas','perth_bak_patrol_areas'); import_snapshot('z_base_security_entitlements','perth_bak_security_entitlements'); import_snapshot('z_base_incident_categories','perth_bak_incident_categories'); import_snapshot('z_base_crime_incidents','perth_bak_crime_incidents'); import_snapshot('z_base_incident_reports','perth_bak_incident_reports'); import_snapshot('z_base_evidence_items','perth_bak_evidence_items'); import_snapshot('z_base_persons','perth_bak_persons'); import_snapshot('z_base_person_incident_links','perth_bak_person_incident_links'); import_snapshot('z_base_case_files','perth_bak_case_files'); import_snapshot('z_base_case_incident_links','perth_bak_case_incident_links'); import_snapshot('z_base_semantic_matches','perth_bak_semantic_matches'); import_snapshot('z_base_incident_embeddings','perth_bak_incident_embeddings'); import_snapshot('z_base_person_embeddings','perth_bak_person_embeddings'); import_snapshot('z_base_analyst_actions','perth_bak_analyst_actions');
END;
/

DECLARE
  v_perth_id NUMBER;
BEGIN
  SELECT dataset_profile_id INTO v_perth_id FROM z_base_dataset_profiles WHERE profile_code='PERTH_DATA';
  UPDATE z_base_dataset_profiles
  SET profile_status=CASE WHEN dataset_profile_id=v_perth_id THEN 'active' ELSE 'available' END;
  UPDATE z_base_active_dataset_profile
  SET dataset_profile_id=v_perth_id, activated_at=SYSTIMESTAMP, activated_by=SYS_CONTEXT('USERENV','SESSION_USER')
  WHERE control_id=1;
  COMMIT;
END;
/

COMMENT ON TABLE z_base_dataset_profiles IS 'Library of synthetic city dataset profiles. Active application tables hold one restored profile at a time.';
EXIT SUCCESS;
