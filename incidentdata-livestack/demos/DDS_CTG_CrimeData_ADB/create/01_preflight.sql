/* Read-only CTG ADB preflight. Run as ADMIN. */
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET PAGES 100 LINES 220

SELECT SYS_CONTEXT('USERENV', 'DB_UNIQUE_NAME') AS database_name,
       SYS_CONTEXT('USERENV', 'CURRENT_USER') AS current_user
FROM dual;

SELECT table_name
FROM all_tables
WHERE owner = 'CRIME_DATA'
  AND table_name IN ('CRIME_INCIDENTS', 'INCIDENT_REPORTS',
                     'INCIDENT_CATEGORIES', 'PATROL_AREAS')
ORDER BY table_name;

SELECT privilege
FROM dba_sys_privs
WHERE grantee = 'CRIME_DATA'
  AND privilege IN ('CREATE DATA ROLE', 'CREATE DATA GRANT',
                    'SET USE DATA GRANTS ONLY')
ORDER BY privilege;

PROMPT Confirm all four source tables and all three Deep Sec privileges are present.
