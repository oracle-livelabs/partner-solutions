/* Run as ADB ADMIN after 03. Passwords are prompted and never persisted. */
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET SERVEROUTPUT ON

ACCEPT ACI_A_FIELD_CENTRAL_PASSWORD CHAR PROMPT 'Central field analyst password: ' HIDE
ACCEPT ACI_A_FIELD_NORTH_PASSWORD CHAR PROMPT 'North field analyst password: ' HIDE
ACCEPT ACI_A_CASE_SOUTH_PASSWORD CHAR PROMPT 'South case lead password: ' HIDE
ACCEPT ACI_A_CASE_CENTRAL_PASSWORD CHAR PROMPT 'Central case lead password: ' HIDE
ACCEPT ACI_A_COMMAND_PASSWORD CHAR PROMPT 'Strategic command password: ' HIDE

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM dba_roles WHERE role = 'ACI_A_DIRECT_LOGIN_ROLE';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE ROLE aci_a_direct_login_role';
    EXECUTE IMMEDIATE 'GRANT CREATE SESSION TO aci_a_direct_login_role';
  END IF;
END;
/
GRANT aci_a_direct_login_role TO aci_a_field_analyst_role;
GRANT aci_a_direct_login_role TO aci_a_case_lead_role;
GRANT aci_a_direct_login_role TO aci_a_command_role;

CREATE END USER IF NOT EXISTS aci_a_field_central IDENTIFIED BY "&&ACI_A_FIELD_CENTRAL_PASSWORD";
CREATE END USER IF NOT EXISTS aci_a_field_north IDENTIFIED BY "&&ACI_A_FIELD_NORTH_PASSWORD";
CREATE END USER IF NOT EXISTS aci_a_case_south IDENTIFIED BY "&&ACI_A_CASE_SOUTH_PASSWORD";
CREATE END USER IF NOT EXISTS aci_a_case_central IDENTIFIED BY "&&ACI_A_CASE_CENTRAL_PASSWORD";
CREATE END USER IF NOT EXISTS aci_a_command IDENTIFIED BY "&&ACI_A_COMMAND_PASSWORD";

GRANT DATA ROLE aci_a_field_analyst_role TO aci_a_field_central, aci_a_field_north;
GRANT DATA ROLE aci_a_case_lead_role TO aci_a_case_south, aci_a_case_central;
GRANT DATA ROLE aci_a_command_role TO aci_a_command;

PROMPT Advanced ADB direct-logon identities are ready.
