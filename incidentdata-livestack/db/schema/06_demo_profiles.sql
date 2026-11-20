/* Legacy profile registry retained for migration compatibility. Recoverable city
   profiles are stored in the governed Z_BASE library. */
CREATE TABLE demo_data_profiles (
  profile_code VARCHAR2(40) PRIMARY KEY,
  profile_name VARCHAR2(100) NOT NULL,
  city_label VARCHAR2(100) NOT NULL,
  profile_status VARCHAR2(20) NOT NULL,
  last_backup_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

INSERT INTO demo_data_profiles(profile_code,profile_name,city_label,profile_status,last_backup_at)
VALUES ('ADELAIDE_DATA','Adelaide Data Set Profile','Adelaide','active',SYSTIMESTAMP);

COMMENT ON TABLE demo_data_profiles IS 'Legacy synthetic city profile registry. Recoverable Adelaide, Perth, and Brisbane profiles are governed by the Z_BASE library.';
