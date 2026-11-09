/*
  Oracle identity columns cannot use PostgreSQL's OVERRIDING SYSTEM VALUE clause.
  Rebuild the restore body so parent identities are regenerated and children are
  remapped through stable incident_ref, person_ref, and case_ref keys.
*/
CREATE OR REPLACE PACKAGE BODY z_base_dataset_admin AS
  TYPE table_map_t IS RECORD (active_name VARCHAR2(128), base_name VARCHAR2(128));
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
      table_map_t('PERSON_NARRATIVE_EMBEDDINGS','Z_BASE_PERSON_NARRATIVE_VEC'),
      table_map_t('PERSON_VISUAL_EMBEDDINGS','Z_BASE_PERSON_VISUAL_VEC'),
      table_map_t('ANALYST_ACTIONS','Z_BASE_ANALYST_ACTIONS'),
      table_map_t('SOCIAL_MEDIA_SOURCES','Z_BASE_SOCIAL_MEDIA_SOURCES'),
      table_map_t('SOCIAL_MEDIA_POSTS','Z_BASE_SOCIAL_MEDIA_POSTS'),
      table_map_t('WATCHED_CRIME_PATTERNS','Z_BASE_WATCHED_CRIME_PATTERNS'),
      table_map_t('SOCIAL_POST_INCIDENT_LINKS','Z_BASE_SOCIAL_POST_INCIDENT_LINKS'),
      table_map_t('WATCHED_PATTERN_INCIDENTS','Z_BASE_WATCHED_PATTERN_INCIDENTS'),
      table_map_t('WATCHED_PATTERN_POSTS','Z_BASE_WATCHED_PATTERN_POSTS'));
  END;

  FUNCTION identity_column(p_table_name VARCHAR2) RETURN VARCHAR2 IS
    v_column VARCHAR2(128);
  BEGIN
    SELECT column_name INTO v_column
    FROM user_tab_identity_cols
    WHERE table_name = UPPER(p_table_name);
    RETURN v_column;
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN NULL;
  END;

  FUNCTION columns_for(p_table_name VARCHAR2, p_exclude_column VARCHAR2 DEFAULT NULL) RETURN VARCHAR2 IS
    v_columns VARCHAR2(32767);
  BEGIN
    SELECT LISTAGG(column_name, ',') WITHIN GROUP (ORDER BY column_id)
    INTO v_columns
    FROM user_tab_columns
    WHERE table_name = UPPER(p_table_name)
      AND (p_exclude_column IS NULL OR column_name <> UPPER(p_exclude_column));
    RETURN v_columns;
  END;

  FUNCTION select_list(
    p_table_name VARCHAR2, p_exclude_column VARCHAR2 DEFAULT NULL,
    p_incident_expr VARCHAR2 DEFAULT NULL, p_person_expr VARCHAR2 DEFAULT NULL,
    p_case_expr VARCHAR2 DEFAULT NULL, p_source_incident_expr VARCHAR2 DEFAULT NULL,
    p_matched_incident_expr VARCHAR2 DEFAULT NULL, p_category_expr VARCHAR2 DEFAULT NULL,
    p_patrol_area_expr VARCHAR2 DEFAULT NULL) RETURN VARCHAR2 IS
    v_columns VARCHAR2(32767);
  BEGIN
    SELECT LISTAGG(
      CASE
        WHEN column_name = 'INCIDENT_ID' AND p_incident_expr IS NOT NULL THEN p_incident_expr
        WHEN column_name = 'PERSON_ID' AND p_person_expr IS NOT NULL THEN p_person_expr
        WHEN column_name = 'CASE_ID' AND p_case_expr IS NOT NULL THEN p_case_expr
        WHEN column_name = 'SOURCE_INCIDENT_ID' AND p_source_incident_expr IS NOT NULL THEN p_source_incident_expr
        WHEN column_name = 'MATCHED_INCIDENT_ID' AND p_matched_incident_expr IS NOT NULL THEN p_matched_incident_expr
        WHEN column_name = 'CATEGORY_ID' AND p_category_expr IS NOT NULL THEN p_category_expr
        WHEN column_name IN ('PATROL_AREA_ID','OWNING_PATROL_AREA_ID') AND p_patrol_area_expr IS NOT NULL THEN p_patrol_area_expr
        ELSE 'b.' || column_name
      END, ',') WITHIN GROUP (ORDER BY column_id)
    INTO v_columns
    FROM user_tab_columns
    WHERE table_name = UPPER(p_table_name)
      AND (p_exclude_column IS NULL OR column_name <> UPPER(p_exclude_column));
    RETURN v_columns;
  END;

  PROCEDURE copy_active_to_base(p_active VARCHAR2, p_base VARCHAR2, p_profile_id NUMBER) IS
    v_columns VARCHAR2(32767) := columns_for(p_active);
  BEGIN
    EXECUTE IMMEDIATE 'DELETE FROM ' || p_base || ' WHERE dataset_profile_id = :1' USING p_profile_id;
    EXECUTE IMMEDIATE 'INSERT INTO ' || p_base || '(dataset_profile_id,' || v_columns || ') SELECT :1,' || v_columns || ' FROM ' || p_active USING p_profile_id;
  END;

  PROCEDURE copy_base_to_active(p_active VARCHAR2, p_base VARCHAR2, p_profile_id NUMBER) IS
    v_identity VARCHAR2(128) := identity_column(p_active);
    v_columns VARCHAR2(32767) := columns_for(p_active, v_identity);
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO ' || p_active || '(' || v_columns || ') SELECT ' || v_columns || ' FROM ' || p_base || ' WHERE dataset_profile_id = :1' USING p_profile_id;
  END;

  PROCEDURE copy_with_incident(p_active VARCHAR2, p_base VARCHAR2, p_profile_id NUMBER) IS
    v_identity VARCHAR2(128) := identity_column(p_active);
    v_columns VARCHAR2(32767) := columns_for(p_active, v_identity);
    v_select VARCHAR2(32767) := select_list(p_active, v_identity, 'i.incident_id');
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO ' || p_active || '(' || v_columns || ') SELECT ' || v_select ||
      ' FROM ' || p_base || ' b JOIN z_base_crime_incidents source_i ON source_i.dataset_profile_id=:1 AND source_i.incident_id=b.incident_id' ||
      ' JOIN crime_incidents i ON i.incident_ref=source_i.incident_ref WHERE b.dataset_profile_id=:2'
      USING p_profile_id, p_profile_id;
  END;

  PROCEDURE copy_security_entitlements(p_profile_id NUMBER) IS
    v_columns VARCHAR2(32767) := columns_for('SECURITY_USER_GEO_ENTITLEMENTS');
    v_select VARCHAR2(32767) := select_list('SECURITY_USER_GEO_ENTITLEMENTS', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'a.patrol_area_id');
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO security_user_geo_entitlements(' || v_columns || ') SELECT ' || v_select ||
      ' FROM z_base_security_entitlements b' ||
      ' JOIN z_base_patrol_areas source_a ON source_a.dataset_profile_id=:1 AND source_a.patrol_area_id=b.patrol_area_id' ||
      ' JOIN patrol_areas a ON a.area_code=source_a.area_code WHERE b.dataset_profile_id=:2'
      USING p_profile_id, p_profile_id;
  END;

  PROCEDURE copy_crime_incidents(p_profile_id NUMBER) IS
    v_identity VARCHAR2(128) := identity_column('CRIME_INCIDENTS');
    v_columns VARCHAR2(32767) := columns_for('CRIME_INCIDENTS', v_identity);
    v_select VARCHAR2(32767) := select_list('CRIME_INCIDENTS', v_identity, NULL, NULL, NULL, NULL, NULL, 'c.category_id', 'a.patrol_area_id');
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO crime_incidents(' || v_columns || ') SELECT ' || v_select ||
      ' FROM z_base_crime_incidents b' ||
      ' JOIN z_base_incident_categories source_c ON source_c.dataset_profile_id=:1 AND source_c.category_id=b.category_id' ||
      ' JOIN incident_categories c ON c.category_code=source_c.category_code' ||
      ' JOIN z_base_patrol_areas source_a ON source_a.dataset_profile_id=:2 AND source_a.patrol_area_id=b.patrol_area_id' ||
      ' JOIN patrol_areas a ON a.area_code=source_a.area_code WHERE b.dataset_profile_id=:3'
      USING p_profile_id, p_profile_id, p_profile_id;
  END;

  PROCEDURE copy_with_person(p_active VARCHAR2, p_base VARCHAR2, p_profile_id NUMBER) IS
    v_identity VARCHAR2(128) := identity_column(p_active);
    v_columns VARCHAR2(32767) := columns_for(p_active, v_identity);
    v_select VARCHAR2(32767) := select_list(p_active, v_identity, NULL, 'p.person_id');
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO ' || p_active || '(' || v_columns || ') SELECT ' || v_select ||
      ' FROM ' || p_base || ' b JOIN z_base_persons source_p ON source_p.dataset_profile_id=:1 AND source_p.person_id=b.person_id' ||
      ' JOIN persons_of_interest p ON p.person_ref=source_p.person_ref WHERE b.dataset_profile_id=:2'
      USING p_profile_id, p_profile_id;
  END;

  PROCEDURE copy_persons(p_profile_id NUMBER) IS
    v_identity VARCHAR2(128) := identity_column('PERSONS_OF_INTEREST');
    v_columns VARCHAR2(32767) := columns_for('PERSONS_OF_INTEREST', v_identity);
    v_select VARCHAR2(32767) := select_list('PERSONS_OF_INTEREST', v_identity,
      NULL, NULL, NULL, NULL, NULL, NULL, 'a.patrol_area_id');
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO persons_of_interest(' || v_columns || ') SELECT ' || v_select ||
      ' FROM z_base_persons b' ||
      ' LEFT JOIN z_base_patrol_areas source_a ON source_a.dataset_profile_id=:1 AND source_a.patrol_area_id=b.owning_patrol_area_id' ||
      ' LEFT JOIN patrol_areas a ON a.area_code=source_a.area_code WHERE b.dataset_profile_id=:2'
      USING p_profile_id, p_profile_id;
  END;

  PROCEDURE copy_person_incident_links(p_profile_id NUMBER) IS
    v_columns VARCHAR2(32767) := columns_for('PERSON_INCIDENT_LINKS');
    v_select VARCHAR2(32767) := select_list('PERSON_INCIDENT_LINKS', NULL, 'i.incident_id', 'p.person_id');
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO person_incident_links(' || v_columns || ') SELECT ' || v_select ||
      ' FROM z_base_person_incident_links b' ||
      ' JOIN z_base_persons source_p ON source_p.dataset_profile_id=:1 AND source_p.person_id=b.person_id' ||
      ' JOIN persons_of_interest p ON p.person_ref=source_p.person_ref' ||
      ' JOIN z_base_crime_incidents source_i ON source_i.dataset_profile_id=:2 AND source_i.incident_id=b.incident_id' ||
      ' JOIN crime_incidents i ON i.incident_ref=source_i.incident_ref WHERE b.dataset_profile_id=:3'
      USING p_profile_id, p_profile_id, p_profile_id;
  END;

  PROCEDURE copy_case_incident_links(p_profile_id NUMBER) IS
    v_columns VARCHAR2(32767) := columns_for('CASE_INCIDENT_LINKS');
    v_select VARCHAR2(32767) := select_list('CASE_INCIDENT_LINKS', NULL, 'i.incident_id', NULL, 'c.case_id');
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO case_incident_links(' || v_columns || ') SELECT ' || v_select ||
      ' FROM z_base_case_incident_links b' ||
      ' JOIN z_base_case_files source_c ON source_c.dataset_profile_id=:1 AND source_c.case_id=b.case_id' ||
      ' JOIN case_files c ON c.case_ref=source_c.case_ref' ||
      ' JOIN z_base_crime_incidents source_i ON source_i.dataset_profile_id=:2 AND source_i.incident_id=b.incident_id' ||
      ' JOIN crime_incidents i ON i.incident_ref=source_i.incident_ref WHERE b.dataset_profile_id=:3'
      USING p_profile_id, p_profile_id, p_profile_id;
  END;

  PROCEDURE copy_case_files(p_profile_id NUMBER) IS
    v_identity VARCHAR2(128) := identity_column('CASE_FILES');
    v_columns VARCHAR2(32767) := columns_for('CASE_FILES', v_identity);
    v_select VARCHAR2(32767) := select_list('CASE_FILES', v_identity, NULL, NULL, NULL, NULL, NULL, NULL, 'a.patrol_area_id');
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO case_files(' || v_columns || ') SELECT ' || v_select ||
      ' FROM z_base_case_files b' ||
      ' JOIN z_base_patrol_areas source_a ON source_a.dataset_profile_id=:1 AND source_a.patrol_area_id=b.patrol_area_id' ||
      ' JOIN patrol_areas a ON a.area_code=source_a.area_code WHERE b.dataset_profile_id=:2'
      USING p_profile_id, p_profile_id;
  END;

  PROCEDURE copy_semantic_matches(p_profile_id NUMBER) IS
    v_identity VARCHAR2(128) := identity_column('SEMANTIC_MATCHES');
    v_columns VARCHAR2(32767) := columns_for('SEMANTIC_MATCHES', v_identity);
    v_select VARCHAR2(32767) := select_list('SEMANTIC_MATCHES', v_identity, NULL, NULL, NULL, 'source_i.incident_id', 'matched_i.incident_id');
  BEGIN
    EXECUTE IMMEDIATE 'INSERT INTO semantic_matches(' || v_columns || ') SELECT ' || v_select ||
      ' FROM z_base_semantic_matches b' ||
      ' JOIN z_base_crime_incidents source_base ON source_base.dataset_profile_id=:1 AND source_base.incident_id=b.source_incident_id' ||
      ' JOIN crime_incidents source_i ON source_i.incident_ref=source_base.incident_ref' ||
      ' JOIN z_base_crime_incidents matched_base ON matched_base.dataset_profile_id=:2 AND matched_base.incident_id=b.matched_incident_id' ||
      ' JOIN crime_incidents matched_i ON matched_i.incident_ref=matched_base.incident_ref WHERE b.dataset_profile_id=:3'
      USING p_profile_id, p_profile_id, p_profile_id;
  END;

  /*
    Narrative embeddings are maintained in a profile-keyed table rather than in
    the Z_BASE row copies.  Some deployed environments created a foreign key
    from that table to CRIME_INCIDENTS(INCIDENT_REF).  Clear only the profile
    that is about to be replaced before deleting its incident rows.  The table
    is optional so an earlier schema can run the same restore package.
  */
  PROCEDURE clear_active_narrative_embeddings IS
    v_active_profile_code z_base_dataset_profiles.profile_code%TYPE;
    v_table_count NUMBER;
  BEGIN
    SELECT p.profile_code INTO v_active_profile_code
    FROM z_base_active_dataset_profile a
    JOIN z_base_dataset_profiles p ON p.dataset_profile_id = a.dataset_profile_id
    WHERE a.control_id = 1;

    SELECT COUNT(*) INTO v_table_count
    FROM user_tables
    WHERE table_name = 'INCIDENT_NARRATIVE_EMBEDDINGS_V4';

    IF v_table_count > 0 THEN
      EXECUTE IMMEDIATE
        'DELETE FROM incident_narrative_embeddings_v4 WHERE profile_code = :1'
        USING v_active_profile_code;
    END IF;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      NULL;
  END;

  PROCEDURE delete_if_present(p_table_name IN VARCHAR2) IS
    v_table_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_table_count FROM user_tables WHERE table_name = UPPER(p_table_name);
    IF v_table_count > 0 THEN
      EXECUTE IMMEDIATE 'DELETE FROM ' || DBMS_ASSERT.SQL_OBJECT_NAME(UPPER(p_table_name));
    END IF;
  END;

  PROCEDURE capture_active_profile(p_profile_code IN VARCHAR2, p_profile_name IN VARCHAR2, p_city_label IN VARCHAR2, p_profile_notes IN VARCHAR2 DEFAULT NULL) IS
    v_profile_id NUMBER;
    v_maps table_map_list_t := maps;
  BEGIN
    MERGE INTO z_base_dataset_profiles p
    USING (SELECT UPPER(p_profile_code) profile_code, p_profile_name profile_name, p_city_label city_label, p_profile_notes profile_notes FROM dual) s
    ON (p.profile_code = s.profile_code)
    WHEN MATCHED THEN UPDATE SET p.profile_name=s.profile_name, p.city_label=s.city_label, p.profile_notes=s.profile_notes, p.captured_at=SYSTIMESTAMP
    WHEN NOT MATCHED THEN INSERT(profile_code,profile_name,city_label,profile_notes) VALUES(s.profile_code,s.profile_name,s.city_label,s.profile_notes);
    SELECT dataset_profile_id INTO v_profile_id FROM z_base_dataset_profiles WHERE profile_code=UPPER(p_profile_code);
    FOR i IN 1 .. v_maps.COUNT LOOP copy_active_to_base(v_maps(i).active_name, v_maps(i).base_name, v_profile_id); END LOOP;
    COMMIT;
  END;

  PROCEDURE restore_profile(p_profile_code IN VARCHAR2) IS
    v_profile_id NUMBER;
    v_incidents NUMBER;
    v_maps table_map_list_t := maps;
  BEGIN
    /* A restore clears and repopulates the same tables in one transaction. */
    EXECUTE IMMEDIATE 'ALTER SESSION DISABLE PARALLEL DML';
    SELECT dataset_profile_id INTO v_profile_id FROM z_base_dataset_profiles WHERE profile_code=UPPER(p_profile_code);
    SELECT COUNT(*) INTO v_incidents FROM z_base_crime_incidents WHERE dataset_profile_id=v_profile_id;
    IF v_incidents = 0 THEN RAISE_APPLICATION_ERROR(-20001, 'Profile has no Z_BASE_CRIME_INCIDENTS rows: ' || p_profile_code); END IF;
    DELETE FROM watched_pattern_posts; DELETE FROM watched_pattern_incidents;
    delete_if_present('WATCHED_PATTERN_EMBEDDINGS');
    DELETE FROM social_post_incident_links;
    DELETE FROM social_media_posts; DELETE FROM social_media_sources; DELETE FROM watched_crime_patterns;
    DELETE FROM semantic_matches; DELETE FROM evidence_items; DELETE FROM case_incident_links; DELETE FROM person_incident_links;
    DELETE FROM person_visual_embeddings; DELETE FROM person_narrative_embeddings;
    DELETE FROM incident_report_embeddings; DELETE FROM person_profile_embeddings;
    clear_active_narrative_embeddings;
    DELETE FROM incident_reports; DELETE FROM case_files;
    DELETE FROM persons_of_interest; DELETE FROM crime_incidents; DELETE FROM analyst_actions; DELETE FROM security_user_geo_entitlements;
    DELETE FROM security_users; DELETE FROM patrol_areas; DELETE FROM incident_categories;
    copy_base_to_active(v_maps(1).active_name, v_maps(1).base_name, v_profile_id);
    copy_base_to_active(v_maps(2).active_name, v_maps(2).base_name, v_profile_id);
    copy_security_entitlements(v_profile_id);
    copy_base_to_active(v_maps(4).active_name, v_maps(4).base_name, v_profile_id);
    copy_crime_incidents(v_profile_id);
    copy_with_incident(v_maps(6).active_name, v_maps(6).base_name, v_profile_id);
    copy_with_incident(v_maps(7).active_name, v_maps(7).base_name, v_profile_id);
    copy_persons(v_profile_id);
    copy_person_incident_links(v_profile_id);
    copy_case_files(v_profile_id);
    copy_case_incident_links(v_profile_id);
    copy_semantic_matches(v_profile_id);
    copy_with_incident(v_maps(13).active_name, v_maps(13).base_name, v_profile_id);
    copy_with_person(v_maps(14).active_name, v_maps(14).base_name, v_profile_id);
    copy_with_person(v_maps(15).active_name, v_maps(15).base_name, v_profile_id);
    copy_with_person(v_maps(16).active_name, v_maps(16).base_name, v_profile_id);
    copy_base_to_active(v_maps(17).active_name, v_maps(17).base_name, v_profile_id);
    copy_base_to_active(v_maps(18).active_name, v_maps(18).base_name, v_profile_id);
    copy_base_to_active(v_maps(19).active_name, v_maps(19).base_name, v_profile_id);
    copy_base_to_active(v_maps(20).active_name, v_maps(20).base_name, v_profile_id);
    copy_base_to_active(v_maps(21).active_name, v_maps(21).base_name, v_profile_id);
    copy_base_to_active(v_maps(22).active_name, v_maps(22).base_name, v_profile_id);
    copy_base_to_active(v_maps(23).active_name, v_maps(23).base_name, v_profile_id);
    UPDATE z_base_dataset_profiles SET profile_status=CASE WHEN dataset_profile_id=v_profile_id THEN 'active' ELSE 'available' END;
    UPDATE z_base_active_dataset_profile SET dataset_profile_id=v_profile_id, activated_at=SYSTIMESTAMP, activated_by=SYS_CONTEXT('USERENV','SESSION_USER') WHERE control_id=1;
    COMMIT;
  END;
END z_base_dataset_admin;
/

SHOW ERRORS PACKAGE BODY z_base_dataset_admin
EXIT SUCCESS;
