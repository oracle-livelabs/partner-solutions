/* Add a recoverable Perth Metro profile without disturbing the Adelaide snapshot.
   Run once as the application schema user. */
DECLARE
  PROCEDURE create_snapshot(p_name VARCHAR2, p_source VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name=UPPER(p_name);
    IF v_count=0 THEN EXECUTE IMMEDIATE 'CREATE TABLE '||p_name||' AS SELECT * FROM '||p_source||' WHERE 1=0'; END IF;
  END;
BEGIN
  /* Adelaide city-reference tables were not part of the original backup. */
  create_snapshot('basic_bak_incident_categories','incident_categories');
  create_snapshot('basic_bak_patrol_areas','patrol_areas');
  create_snapshot('basic_bak_security_users','security_users');
  create_snapshot('basic_bak_security_entitlements','security_user_geo_entitlements');
  EXECUTE IMMEDIATE 'INSERT INTO basic_bak_incident_categories SELECT * FROM incident_categories WHERE NOT EXISTS (SELECT 1 FROM basic_bak_incident_categories)';
  EXECUTE IMMEDIATE 'INSERT INTO basic_bak_patrol_areas SELECT * FROM patrol_areas WHERE NOT EXISTS (SELECT 1 FROM basic_bak_patrol_areas)';
  EXECUTE IMMEDIATE 'INSERT INTO basic_bak_security_users SELECT * FROM security_users WHERE NOT EXISTS (SELECT 1 FROM basic_bak_security_users)';
  EXECUTE IMMEDIATE 'INSERT INTO basic_bak_security_entitlements SELECT * FROM security_user_geo_entitlements WHERE NOT EXISTS (SELECT 1 FROM basic_bak_security_entitlements)';

  create_snapshot('perth_bak_crime_incidents','crime_incidents');
  create_snapshot('perth_bak_incident_reports','incident_reports');
  create_snapshot('perth_bak_evidence_items','evidence_items');
  create_snapshot('perth_bak_persons','persons_of_interest');
  create_snapshot('perth_bak_person_incident_links','person_incident_links');
  create_snapshot('perth_bak_case_files','case_files');
  create_snapshot('perth_bak_case_incident_links','case_incident_links');
  create_snapshot('perth_bak_semantic_matches','semantic_matches');
  create_snapshot('perth_bak_incident_embeddings','incident_report_embeddings');
  create_snapshot('perth_bak_person_embeddings','person_profile_embeddings');
  create_snapshot('perth_bak_analyst_actions','analyst_actions');
  create_snapshot('perth_bak_incident_categories','incident_categories');
  create_snapshot('perth_bak_patrol_areas','patrol_areas');
  create_snapshot('perth_bak_security_users','security_users');
  create_snapshot('perth_bak_security_entitlements','security_user_geo_entitlements');
END;
/

MERGE INTO demo_data_profiles t
USING (SELECT 'PERTH_DATA' profile_code,'Perth Data Set Profile' profile_name,'Perth Metropolitan Area' city_label,'available' profile_status FROM dual) s
ON (t.profile_code=s.profile_code)
WHEN MATCHED THEN UPDATE SET t.profile_name=s.profile_name,t.city_label=s.city_label
WHEN NOT MATCHED THEN INSERT (profile_code,profile_name,city_label,profile_status) VALUES (s.profile_code,s.profile_name,s.city_label,s.profile_status);

COMMENT ON TABLE demo_data_profiles IS 'Recoverable synthetic city data profiles. Adelaide/SAPOL and Perth/WAPOL are mutually exclusive operational demonstration datasets.';
COMMIT;
