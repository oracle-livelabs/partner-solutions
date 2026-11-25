/*
 * DDS_CrimeData -- local Deep Sec direct-login identities.
 * Run as SYS or an equivalent PDB administrator in FREEPDB1 after 02.
 * Passwords are prompted for and never stored in this repository.
 */
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET SERVEROUTPUT ON
ALTER SESSION SET CONTAINER = FREEPDB1;

ACCEPT ACI_DS_STATEWIDE_PASSWORD CHAR PROMPT 'Statewide demo password: ' HIDE
ACCEPT ACI_DS_CENTRAL_PASSWORD CHAR PROMPT 'Central demo password: ' HIDE
ACCEPT ACI_DS_NORTH_PASSWORD CHAR PROMPT 'North demo password: ' HIDE
ACCEPT ACI_DS_SOUTH_PASSWORD CHAR PROMPT 'South demo password: ' HIDE

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM dba_roles WHERE role = 'ACI_DS_DIRECT_LOGIN_ROLE';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE ROLE aci_ds_direct_login_role';
    EXECUTE IMMEDIATE 'GRANT CREATE SESSION TO aci_ds_direct_login_role';
  END IF;
END;
/

GRANT aci_ds_direct_login_role TO aci_ds_statewide_role;
GRANT aci_ds_direct_login_role TO aci_ds_central_role;
GRANT aci_ds_direct_login_role TO aci_ds_north_role;
GRANT aci_ds_direct_login_role TO aci_ds_south_role;

CREATE END USER IF NOT EXISTS aci_ds_statewide IDENTIFIED BY "&&ACI_DS_STATEWIDE_PASSWORD" SCHEMA CRIME_DATA;
CREATE END USER IF NOT EXISTS aci_ds_central IDENTIFIED BY "&&ACI_DS_CENTRAL_PASSWORD" SCHEMA CRIME_DATA;
CREATE END USER IF NOT EXISTS aci_ds_north IDENTIFIED BY "&&ACI_DS_NORTH_PASSWORD" SCHEMA CRIME_DATA;
CREATE END USER IF NOT EXISTS aci_ds_south IDENTIFIED BY "&&ACI_DS_SOUTH_PASSWORD" SCHEMA CRIME_DATA;

GRANT DATA ROLE aci_ds_statewide_role TO aci_ds_statewide;
GRANT DATA ROLE aci_ds_central_role TO aci_ds_central;
GRANT DATA ROLE aci_ds_north_role TO aci_ds_north;
GRANT DATA ROLE aci_ds_south_role TO aci_ds_south;

PROMPT DDS_CrimeData local end users and role mappings are ready.
