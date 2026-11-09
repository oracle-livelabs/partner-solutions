/*
 * Read-only ADB preflight. Run as ADMIN, then repeat the CRIME_DATA section
 * while connected as CRIME_DATA if ADMIN cannot inspect its grants.
 */
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET PAGES 100 LINES 220

PROMPT === Connected database and schema ===
SELECT SYS_CONTEXT('USERENV', 'DB_UNIQUE_NAME') AS database_name,
       SYS_CONTEXT('USERENV', 'CURRENT_USER') AS current_user
FROM dual;

PROMPT === Required IncidentData objects ===
SELECT table_name FROM all_tables
WHERE owner = 'CRIME_DATA'
  AND table_name IN ('CRIME_INCIDENTS', 'INCIDENT_REPORTS', 'PATROL_AREAS')
ORDER BY table_name;

PROMPT === CRIME_DATA Deep Sec administration privileges (expect all three) ===
SELECT privilege FROM dba_sys_privs
WHERE grantee = 'CRIME_DATA'
  AND privilege IN ('CREATE DATA ROLE', 'CREATE DATA GRANT', 'SET USE DATA GRANTS ONLY')
ORDER BY privilege;

PROMPT === Deep Sec feature/version check ===
SELECT banner_full FROM v$version WHERE banner_full LIKE 'Oracle Database%';

PROMPT No objects are created by this preflight.
