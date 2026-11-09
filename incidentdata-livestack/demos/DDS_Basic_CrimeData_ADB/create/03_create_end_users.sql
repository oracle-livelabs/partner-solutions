/* Run as ADB ADMIN after 02. Passwords are prompted and never persisted. */
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET SERVEROUTPUT ON

ACCEPT ACI_B_COMMAND_PASSWORD CHAR PROMPT 'Statewide command password: ' HIDE
ACCEPT ACI_B_CENTRAL_PASSWORD CHAR PROMPT 'Central analyst password: ' HIDE
ACCEPT ACI_B_NORTH_PASSWORD CHAR PROMPT 'North analyst password: ' HIDE
ACCEPT ACI_B_SOUTH_PASSWORD CHAR PROMPT 'South analyst password: ' HIDE
ACCEPT ACI_B_STRATEGY_PASSWORD CHAR PROMPT 'Strategy viewer password: ' HIDE

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM dba_roles WHERE role = 'ACI_B_DIRECT_LOGIN_ROLE';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE ROLE aci_b_direct_login_role';
    EXECUTE IMMEDIATE 'GRANT CREATE SESSION TO aci_b_direct_login_role';
  END IF;
END;
/
GRANT aci_b_direct_login_role TO aci_b_statewide_command_role;
GRANT aci_b_direct_login_role TO aci_b_regional_analyst_role;
GRANT aci_b_direct_login_role TO aci_b_strategy_viewer_role;

CREATE END USER aci_b_statewide_command IDENTIFIED BY "&&ACI_B_COMMAND_PASSWORD";
CREATE END USER aci_b_central_analyst IDENTIFIED BY "&&ACI_B_CENTRAL_PASSWORD";
CREATE END USER aci_b_north_analyst IDENTIFIED BY "&&ACI_B_NORTH_PASSWORD";
CREATE END USER aci_b_south_analyst IDENTIFIED BY "&&ACI_B_SOUTH_PASSWORD";
CREATE END USER aci_b_strategy_viewer IDENTIFIED BY "&&ACI_B_STRATEGY_PASSWORD";

GRANT DATA ROLE aci_b_statewide_command_role TO aci_b_statewide_command;
GRANT DATA ROLE aci_b_regional_analyst_role TO aci_b_central_analyst,
  aci_b_north_analyst, aci_b_south_analyst;
GRANT DATA ROLE aci_b_strategy_viewer_role TO aci_b_strategy_viewer;

PROMPT Basic direct-logon identities are ready.
