/* Retire the pre-Z_BASE Adelaide snapshot tables. City profiles are restored from
   z_base_dataset_profiles and the associated Z_BASE_* tables. Safe to rerun. */
DECLARE
  PROCEDURE drop_if_exists(p_table_name IN VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE ' || p_table_name;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE <> -942 THEN RAISE; END IF;
  END;
BEGIN
  FOR t IN (
    SELECT table_name
    FROM user_tables
    WHERE table_name LIKE 'BASIC_BAK%'
  ) LOOP
    drop_if_exists(t.table_name);
  END LOOP;

  UPDATE z_base_dataset_profiles
  SET profile_notes = 'Preserved in the governed Z_BASE profile library.'
  WHERE profile_code = 'ADELAIDE_DATA'
    AND profile_notes LIKE 'Imported from BASIC_BAK%';
END;
/

EXIT SUCCESS;
