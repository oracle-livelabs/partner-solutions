/*
 * DDS_CrimeData -- read-only preflight.
 * Run as SYS or an equivalent PDB administrator in FREEPDB1.
 * This kit deliberately does not grant persistent administration privileges
 * to the application schema. The current CRIME_DATA bootstrap already has the
 * two required own-schema privileges shown below.
 */
WHENEVER SQLERROR EXIT SQL.SQLCODE
ALTER SESSION SET CONTAINER = FREEPDB1;
SET PAGES 100 LINES 220

SELECT privilege
FROM dba_sys_privs
WHERE grantee = 'CRIME_DATA'
  AND privilege IN ('CREATE DATA ROLE', 'CREATE DATA GRANT')
ORDER BY privilege;

PROMPT Expected: CREATE DATA GRANT and CREATE DATA ROLE.
PROMPT Create END USER and GRANT DATA ROLE are performed by SYS in step 3.
