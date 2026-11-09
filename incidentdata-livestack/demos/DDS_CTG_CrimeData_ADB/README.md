# IncidentData Cross-Table Grant DDS on Autonomous Database

An Oracle Deep Data Security (DDS) cross-table grant (CTG) demonstration for
the synthetic IncidentData Livestack on **Oracle Autonomous AI Database (ADB)**.
It can be deployed alongside the Basic (`ACI_B_*`) and Advanced (`ACI_A_*`)
kits: this kit owns only `ACI_C_*` artifacts.

## What this demonstrates

Cross-table grants derive access to a child object from privileges already
held on a related parent object. This kit grants an investigator access to
their patrol-area incident rows directly. It then grants the matching report
rows through a CTG; the child grant has **no `TO` clause**.

```text
direct parent Data Grant on ACI_C_INCIDENT_PARENT_PRODUCT_V
  (for example, Central incidents)
          |
          v  WHEN SELECT (incident_id) GRANTED ON parent
cross-table Data Grant on ACI_C_REPORT_CHILD_PRODUCT_V
  (only reports whose incident_id matches an authorized parent row)
```

| Deep Sec identity | Direct parent authorization | Inherited child authorization |
| --- | --- | --- |
| `aci_c_investigator_central` | Central incident product | Reports for those Central incidents |
| `aci_c_investigator_north` | North incident product | Reports for those North incidents |
| `aci_c_statewide_reviewer` | Statewide incident product | Reports for all authorized incidents |
| `aci_c_report_only_probe` | Login-only data role; no parent Data Grant | None; proves the child has no direct grantee |

The parent and child product views are both in `USE DATA GRANTS ONLY` mode.
Changing a report filter cannot add a child row unless DDS first authorizes its
related incident parent row.

## Prerequisites

- Oracle Autonomous AI Database 26ai with Deep Data Security available.
- The `CRIME_DATA` schema and synthetic IncidentData source tables deployed.
- `CRIME_DATA` has `CREATE DATA ROLE`, `CREATE DATA GRANT`, and
  `SET USE DATA GRANTS ONLY`.
- An ADB `ADMIN` account that can create local end users and roles.

Use an ADB wallet service alias; do not use `ALTER SESSION SET CONTAINER`.

## Deploy

1. As `ADMIN`, run `create/01_preflight.sql`.
2. As `CRIME_DATA`, run `create/02_create_products_roles_and_grants.sql`.
3. As `ADMIN`, run `create/03_create_end_users.sql`. It prompts for passwords
   and does not persist them.
4. Connect as each identity and run its corresponding `walkthrough/` script.

The cross-table grant in step 2 uses the native DDS `WHEN SELECT (incident_id)
GRANTED ON ...` syntax. Unlike a regular Data Grant, a CTG cannot have a `TO`
clause: its effective grantees are derived at query time from the parent grant.

## Remove

After all CTG demo sessions disconnect, run
`drop/90_drop_dds_ctg_crimedata_adb.sql` as `ADMIN`. It removes only `ACI_C_*`
users, roles, data grants, views, and configuration. Basic, Advanced, and the
underlying IncidentData source tables remain intact.
