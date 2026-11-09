/* Run as ADB ADMIN after 02. Passwords are prompted and never persisted. */
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET SERVEROUTPUT ON
/* Prevent SQLcl from echoing substituted password values as "old/new" lines. */
SET VERIFY OFF

ACCEPT ACI_C_CENTRAL_PASSWORD CHAR PROMPT 'Central investigator password: ' HIDE
ACCEPT ACI_C_NORTH_PASSWORD CHAR PROMPT 'North investigator password: ' HIDE
ACCEPT ACI_C_STATEWIDE_PASSWORD CHAR PROMPT 'Statewide reviewer password: ' HIDE
ACCEPT ACI_C_PROBE_PASSWORD CHAR PROMPT 'Report-only probe password: ' HIDE

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM dba_roles
  WHERE role = 'ACI_C_DIRECT_LOGIN_ROLE';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE ROLE aci_c_direct_login_role';
    EXECUTE IMMEDIATE 'GRANT CREATE SESSION TO aci_c_direct_login_role';
  END IF;
END;
/

GRANT aci_c_direct_login_role TO aci_c_central_investigator_role;
GRANT aci_c_direct_login_role TO aci_c_north_investigator_role;
GRANT aci_c_direct_login_role TO aci_c_statewide_reviewer_role;

/* The probe needs a session-capable data role but deliberately receives no
 * Data Grant. A standard database role cannot be granted directly to an END
 * USER; it must be inherited through a DATA ROLE. */
CREATE DATA ROLE IF NOT EXISTS aci_c_probe_login_role;
GRANT aci_c_direct_login_role TO aci_c_probe_login_role;

CREATE END USER IF NOT EXISTS aci_c_investigator_central IDENTIFIED BY "&&ACI_C_CENTRAL_PASSWORD";
CREATE END USER IF NOT EXISTS aci_c_investigator_north IDENTIFIED BY "&&ACI_C_NORTH_PASSWORD";
CREATE END USER IF NOT EXISTS aci_c_statewide_reviewer IDENTIFIED BY "&&ACI_C_STATEWIDE_PASSWORD";
CREATE END USER IF NOT EXISTS aci_c_report_only_probe IDENTIFIED BY "&&ACI_C_PROBE_PASSWORD";

/* Reset prompted demo passwords on rerun. This is required now because an
 * earlier SQLcl invocation with VERIFY enabled echoed the substituted values. */
ALTER END USER aci_c_investigator_central IDENTIFIED BY "&&ACI_C_CENTRAL_PASSWORD";
ALTER END USER aci_c_investigator_north IDENTIFIED BY "&&ACI_C_NORTH_PASSWORD";
ALTER END USER aci_c_statewide_reviewer IDENTIFIED BY "&&ACI_C_STATEWIDE_PASSWORD";
ALTER END USER aci_c_report_only_probe IDENTIFIED BY "&&ACI_C_PROBE_PASSWORD";

/* The probe can authenticate but holds only a login role with no Data Grants. */
GRANT DATA ROLE aci_c_probe_login_role TO aci_c_report_only_probe;
GRANT DATA ROLE aci_c_central_investigator_role TO aci_c_investigator_central;
GRANT DATA ROLE aci_c_north_investigator_role TO aci_c_investigator_north;
GRANT DATA ROLE aci_c_statewide_reviewer_role TO aci_c_statewide_reviewer;

PROMPT CTG ADB direct-logon identities are ready.
