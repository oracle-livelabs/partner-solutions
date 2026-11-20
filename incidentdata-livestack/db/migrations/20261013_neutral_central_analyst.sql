-- Run as the IncidentData application schema. Data changes are one transaction.
-- Recovery R0920_* tables remain historical, unchanged backups.
DECLARE
  old_user CONSTANT VARCHAR2(80) := 'adelaide_central_analyst';
  new_user CONSTANT VARCHAR2(80) := 'central_analyst';
  old_count NUMBER;
  new_count NUMBER;
BEGIN
  -- Run serially: parent and child changes must share one transaction.
  EXECUTE IMMEDIATE 'ALTER SESSION DISABLE PARALLEL DML';
  EXECUTE IMMEDIATE 'ALTER SESSION DISABLE PARALLEL QUERY';
  SELECT COUNT(*) INTO old_count FROM security_users WHERE user_name=old_user;
  SELECT COUNT(*) INTO new_count FROM security_users WHERE user_name=new_user;
  IF old_count=1 AND new_count<>0 THEN
    RAISE_APPLICATION_ERROR(-20061,'Both analyst identities exist; migration requires review.');
  END IF;
  IF old_count=1 THEN
    -- Insert the parent first so immediate foreign keys remain enabled throughout.
    INSERT INTO security_users(user_name,role_name,display_name,is_active)
      SELECT new_user,role_name,'Central Analyst',is_active
      FROM security_users WHERE user_name=old_user;
    UPDATE security_user_geo_entitlements SET user_name=new_user WHERE user_name=old_user;
    -- Includes Mobile DickTracy scope mapping and owner references, if present.
    FOR col IN (
      SELECT c.table_name,c.column_name FROM user_tab_columns c
      JOIN user_tables t ON t.table_name=c.table_name
      WHERE c.data_type IN ('VARCHAR2','NVARCHAR2','CHAR')
        AND (c.column_name LIKE '%USER%' OR c.column_name LIKE '%OWNER%'
          OR c.column_name IN ('ACTOR','LOADED_BY','CREATED_BY','UPDATED_BY'))
        AND c.table_name NOT IN ('SECURITY_USERS','SECURITY_USER_GEO_ENTITLEMENTS')
        AND c.table_name NOT LIKE 'R0920\_%' ESCAPE '\'
    ) LOOP
      EXECUTE IMMEDIATE 'UPDATE '||DBMS_ASSERT.SIMPLE_SQL_NAME(col.table_name)||
        ' SET '||DBMS_ASSERT.SIMPLE_SQL_NAME(col.column_name)||'=:new_user WHERE '||
        DBMS_ASSERT.SIMPLE_SQL_NAME(col.column_name)||'=:old_user'
        USING new_user,old_user;
    END LOOP;
    DELETE FROM security_users WHERE user_name=old_user;
  ELSIF new_count<>1 THEN
    RAISE_APPLICATION_ERROR(-20062,'Central analyst identity not found.');
  END IF;
  UPDATE z_base_security_users SET display_name='Central Analyst' WHERE user_name=new_user;
  -- The restore guard compares shared live identities with every saved profile.
  FOR p IN (SELECT dataset_profile_id FROM z_base_dataset_profiles) LOOP
    SELECT COUNT(*) INTO old_count FROM (
      SELECT user_name,role_name,is_active FROM security_users
      MINUS SELECT user_name,role_name,is_active FROM z_base_security_users
        WHERE dataset_profile_id=p.dataset_profile_id);
    SELECT COUNT(*) INTO new_count FROM (
      SELECT user_name,role_name,is_active FROM z_base_security_users
        WHERE dataset_profile_id=p.dataset_profile_id
      MINUS SELECT user_name,role_name,is_active FROM security_users);
    IF old_count<>0 OR new_count<>0 THEN
      RAISE_APPLICATION_ERROR(-20063,'Saved profile security contract mismatch: '||p.dataset_profile_id);
    END IF;
  END LOOP;
  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;
    RAISE;
END;
/
