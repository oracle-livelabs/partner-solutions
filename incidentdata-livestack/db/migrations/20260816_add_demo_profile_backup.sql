/* One-time migration for recoverable Basic Data profile support. */
CREATE TABLE demo_data_profiles (
  profile_code VARCHAR2(40) PRIMARY KEY,
  profile_name VARCHAR2(100) NOT NULL,
  city_label VARCHAR2(100) NOT NULL,
  profile_status VARCHAR2(20) NOT NULL,
  last_backup_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

INSERT INTO demo_data_profiles(profile_code,profile_name,city_label,profile_status,last_backup_at)
VALUES ('BASIC_DATA','Basic Data','Adelaide','active',SYSTIMESTAMP);

CREATE TABLE basic_bak_crime_incidents AS SELECT * FROM crime_incidents;
CREATE TABLE basic_bak_incident_reports AS SELECT * FROM incident_reports;
CREATE TABLE basic_bak_evidence_items AS SELECT * FROM evidence_items;
CREATE TABLE basic_bak_persons AS SELECT * FROM persons_of_interest;
CREATE TABLE basic_bak_person_incident_links AS SELECT * FROM person_incident_links;
CREATE TABLE basic_bak_case_files AS SELECT * FROM case_files;
CREATE TABLE basic_bak_case_incident_links AS SELECT * FROM case_incident_links;
CREATE TABLE basic_bak_semantic_matches AS SELECT * FROM semantic_matches;
CREATE TABLE basic_bak_incident_embeddings AS SELECT * FROM incident_report_embeddings;
CREATE TABLE basic_bak_person_embeddings AS SELECT * FROM person_profile_embeddings;
CREATE TABLE basic_bak_analyst_actions AS SELECT * FROM analyst_actions;

COMMENT ON TABLE demo_data_profiles IS 'Synthetic city data-profile registry for the Police Adelaide teaching app. Perth and Brisbane profiles are planned future variants.';
COMMIT;
