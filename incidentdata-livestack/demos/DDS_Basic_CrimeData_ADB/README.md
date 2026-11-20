# IncidentData Basic DDS on Autonomous Database

A repeatable Oracle Deep Data Security (DDS) baseline for the IncidentData
Livestack deployed to **Oracle Autonomous AI Database (ADB)**. All content is
synthetic and non-operational.

This is the ADB counterpart to `DDS_Basic_CommunityCare`: a small set of
persona roles receives only explicitly approved data products. It is intended
for a direct-logon demonstration, development, and test. Production users
should authenticate through OCI IAM and the application must propagate the
authenticated end-user identity.

## Personas and products

| Deep Sec identity | Data role | Approved product |
| --- | --- | --- |
| `aci_b_statewide_command` | `aci_b_statewide_command_role` | statewide incident product, full report product, aggregate activity |
| `aci_b_central_analyst` | `aci_b_regional_analyst_role` | Central safe incident and report-summary rows, aggregate activity |
| `aci_b_north_analyst` | `aci_b_regional_analyst_role` | North safe incident and report-summary rows, aggregate activity |
| `aci_b_south_analyst` | `aci_b_regional_analyst_role` | South safe incident and report-summary rows, aggregate activity |
| `aci_b_strategy_viewer` | `aci_b_strategy_viewer_role` | statewide aggregate activity only |

The regional role is deliberately scoped by the individual grant predicates.
It cannot see raw narrative text, vehicle descriptors, or JSON attributes.
The strategy role receives no incident-level product.

## Prerequisites

- An Oracle Autonomous AI Database release with Deep Data Security available.
- The IncidentData ADB schema, owned by `CRIME_DATA`, has been deployed (including
  `CRIME_INCIDENTS`, `INCIDENT_REPORTS`, and `PATROL_AREAS`).
- ADB `ADMIN` can create local end users and the login role.
- `CRIME_DATA` has `CREATE DATA ROLE`, `CREATE DATA GRANT`, and `SET USE DATA
  GRANTS ONLY`. The read-only preflight identifies missing privileges before
  any change.

Use the wallet service alias from `tnsnames.ora`, such as `fu40_medium`; do
not use `ALTER SESSION SET CONTAINER` on ADB.

## Deploy

1. Connect as `ADMIN` and run `create/01_preflight.sql`.
2. Connect as `CRIME_DATA` and run `create/02_create_products_roles_grants.sql`.
3. Connect as `ADMIN` and run `create/03_create_end_users.sql`. Passwords are
   prompted for and never stored in this repository.
4. Connect as an identity above and run its matching `walkthrough/` script.

The product views are explicitly placed in `USE DATA GRANTS ONLY` mode. Thus,
an application-side filter, changed URL, or altered generated SQL cannot add
rows or columns beyond the Data Grant.

## Remove

Run `drop/90_drop_dds_basic_crimedata_adb.sql` as `ADMIN` after demo sessions
disconnect. It removes only objects prefixed `ACI_B_`; IncidentData tables,
application views, vectors, graph objects, and synthetic data remain intact.
