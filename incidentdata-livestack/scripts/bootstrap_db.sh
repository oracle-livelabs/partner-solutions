#!/usr/bin/env bash
set -euo pipefail
marker=/opt/oracle/oradata/.police_adelaide_ready
schema="${ORACLE_USER:-CRIME_DATA}"
password="${APP_SCHEMA_PASSWORD:-crime-demo-only}"
until echo 'select 1 from dual;' | sqlplus -L -s "system/${ORACLE_PWD:-oracle}@localhost:1521/FREEPDB1" >/dev/null 2>&1; do sleep 5; done
if [[ -f "$marker" ]]; then echo 'IncidentData LiveStack schema already bootstrapped.'; exit 0; fi
sqlplus -L -s "system/${ORACLE_PWD:-oracle}@localhost:1521/FREEPDB1" <<SQL
WHENEVER SQLERROR EXIT SQL.SQLCODE
CREATE USER $schema IDENTIFIED BY "$password" DEFAULT TABLESPACE USERS TEMPORARY TABLESPACE TEMP QUOTA UNLIMITED ON USERS;
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TYPE, CREATE PROPERTY GRAPH, CREATE DATA ROLE, CREATE DATA GRANT, ADMINISTER ANY DATA GRANT, UNLIMITED TABLESPACE TO $schema;
EXIT
SQL
sqlplus -L -s "${schema}/${password}@localhost:1521/FREEPDB1" <<SQL
WHENEVER SQLERROR EXIT SQL.SQLCODE
@/workspace/app/db/schema/01_core.sql
EXIT
SQL
sqlplus -L -s "${schema}/${password}@localhost:1521/FREEPDB1" <<SQL
WHENEVER SQLERROR EXIT SQL.SQLCODE
@/workspace/app/db/schema/02_seed.sql
EXIT
SQL
sqlplus -L -s "${schema}/${password}@localhost:1521/FREEPDB1" <<SQL
WHENEVER SQLERROR EXIT SQL.SQLCODE
@/workspace/app/db/schema/04_vector.sql
EXIT
SQL
sqlplus -L -s "${schema}/${password}@localhost:1521/FREEPDB1" <<SQL
WHENEVER SQLERROR EXIT SQL.SQLCODE
@/workspace/app/db/schema/05_case_relationship_graph.sql
EXIT
SQL
sqlplus -L -s "${schema}/${password}@localhost:1521/FREEPDB1" <<SQL
WHENEVER SQLERROR EXIT SQL.SQLCODE
@/workspace/app/db/schema/06_demo_profiles.sql
EXIT
SQL
sqlplus -L -s "${schema}/${password}@localhost:1521/FREEPDB1" <<SQL
WHENEVER SQLERROR EXIT SQL.SQLCODE
@/workspace/app/db/migrations/20260817_add_perth_profile_support.sql
EXIT
SQL
# Deep Sec is available in the selected 23.26.2 image. Policy statements are version-gated to keep local bootstrap diagnostic.
sqlplus -L -s "${schema}/${password}@localhost:1521/FREEPDB1" @/workspace/app/db/schema/03_deep_data_security.sql || echo 'Deep Sec policy baseline requires additional administrator identity provisioning; secure view remains active for the local demo.'
touch "$marker"
