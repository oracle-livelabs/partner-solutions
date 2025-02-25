/*
|| Script:  create-user.sql
|| Purpose: Creates HOL23 schema user, grants appropriate privileges and roles,
||          and enables HOL23 schema for ORDS REST access so it can open SQL
||          Web Developer
|| Author:  Jim Czuprynski, Zero Defect Computing, Inc.
*/

CREATE USER hol23 
  IDENTIFIED BY "Future1sNow#"
  DEFAULT TABLESPACE USERS 
  QUOTA UNLIMITED ON USERS
  TEMPORARY TABLESPACE TEMP;

GRANT CONNECT TO hol23;
GRANT RESOURCE TO hol23;
GRANT DWROLE TO hol23;
GRANT UNLIMITED TABLESPACE TO hol23;

GRANT CREATE SESSION TO hol23;
GRANT ALTER SESSION TO hol23;
GRANT CREATE TABLE TO hol23;
GRANT CREATE SEQUENCE TO hol23;
GRANT CREATE PROCEDURE TO hol23;
GRANT CREATE VIEW TO hol23;
GRANT CREATE MINING MODEL TO hol23;
GRANT ANALYZE ANY DICTIONARY TO hol23;
GRANT ANALYZE ANY TO hol23;
GRANT READ, WRITE ON DIRECTORY data_pump_dir TO hol23;

BEGIN
    ORDS_ADMIN.ENABLE_SCHEMA(
        p_enabled => TRUE
       ,p_schema => 'hol23'
       ,p_url_mapping_type => 'BASE_PATH'
       ,p_url_mapping_pattern => 'hol23'
       ,p_auto_rest_auth=> TRUE
    );

    DBMS_SHARE.ENABLE_SCHEMA(
        SCHEMA_NAME => 'hol23',
        ENABLED => TRUE
        );
   
   COMMIT;

END;
/
    