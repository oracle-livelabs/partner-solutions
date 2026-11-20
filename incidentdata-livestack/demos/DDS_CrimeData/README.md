# IncidentData DDS

Repeatable Oracle Deep Data Security demonstration for the IncidentData LiveStack. The data is fully synthetic and non-operational.

This replaces the former single, manual `db/tutorial/01_deep_sec_setup.sql`
workflow with separately runnable provisioning, policy, identity, teardown,
and walkthrough scripts.

## Scope model

| Deep Sec end user | Data role | Approved scope |
| --- | --- | --- |
| `aci_ds_statewide` | `aci_ds_statewide_role` | all synthetic incident rows and full reports |
| `aci_ds_central` | `aci_ds_central_role` | `CENTRAL` patrol-area incidents; sensitive incident/report fields masked |
| `aci_ds_north` | `aci_ds_north_role` | `NORTH` patrol-area incidents; sensitive incident/report fields masked |
| `aci_ds_south` | `aci_ds_south_role` | `SOUTH` patrol-area incidents; sensitive incident/report fields masked |

Regional users receive their patrol-area rows through DDS row predicates. The
statewide role receives the broader synthetic product. Reference categories and
patrol areas are shared. Regional grants name explicit approved scalar columns;
raw JSON, vehicle descriptor, raw report text, and report enrichments are not
granted and are returned as `NULL`.

## Prerequisites

- Oracle AI Database 26ai with Deep Data Security available.
- IncidentData Livestack schema and synthetic Adelaide data loaded in `FREEPDB1`.
- `CRIME_DATA` is the running application schema owner.

The current running IncidentData instance was checked before this kit was added:
the tutorial end users, data roles, and data grants were not present. Creating
this kit does not provision them. Deployment is an explicit next action.

## Deploy

1. Connect as `SYS` (or a PDB administrator) in `FREEPDB1` and run the
   read-only `create/01_preflight.sql`.
2. Connect as `CRIME_DATA` and run
   `create/02_create_roles_and_grants.sql`.
3. Connect as `SYS` in `FREEPDB1` and run
   `create/03_create_end_users.sql`. It prompts for passwords and stores none.
4. Connect as each Deep Sec end user and run a matching script in
   `walkthrough/`.

For the local VM database, the service is `localhost:1533/FREEPDB1`.

## What to demonstrate

Open two SQL worksheets side by side: one as `aci_ds_statewide`, one as
`aci_ds_central`. Run the same incident count query. The first returns all
patrol areas; the second only Central. Then show the regional identity's
authorised incident cells alongside the DDS-masked columns. Finally, the report
walkthrough shows that reports follow the same patrol-area predicate as their
parent incidents. The local Free 26ai build rejected the documented cross-table
grant syntax during deployment, so the runnable kit uses explicit, matching
report grants instead.

This is database enforcement. Editing a client-side filter or a browser URL
does not change the Data Grant predicate.

## Remove

Run `drop/90_drop_dds_crimedata.sql` as `SYS` in `FREEPDB1` after all tutorial
sessions disconnect. It removes only `ACI_DS_*` roles, end users, grants, and
the local direct-login role. It does not remove incidents, reports, secure
views, the application, or other DDS objects.
