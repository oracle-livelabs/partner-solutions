# IncidentData Advanced DDS on Autonomous Database

An entitlement-driven Oracle Deep Data Security demonstration for the IncidentData
Livestack on **Oracle Autonomous AI Database (ADB)**. It layers live,
identity-aware patrol-area, clearance, and effective-date checks over the
Basic demo's product-boundary model. All data is synthetic.

## Authorization model

```text
authenticated Deep Sec end user + data role
  + active entitlement (area + clearance + dates)
  = rows and columns returned by the approved product
```

`ACI_A_END_USER_SCOPE` is the controlled entitlement register. A data-grant
predicate queries it at statement execution using
`ORA_END_USER_CONTEXT.username`; a changed client filter cannot expand scope.

| Identity | Role | Demonstrated entitlement |
| --- | --- | --- |
| `aci_a_field_central` | Field analyst | Central, `FIELD` clearance |
| `aci_a_field_north` | Field analyst | North, `FIELD` clearance |
| `aci_a_case_south` | Case lead | South, `CASE` clearance |
| `aci_a_case_central` | Case lead | Central, `CASE` clearance |
| `aci_a_command` | Strategic command | all areas, `COMMAND` clearance |

Field analysts receive safe incident rows only. Case leads receive their
area's incident and report-detail product. Strategic command receives a
statewide aggregate product, never the incident product.

## Deploy

1. As `ADMIN`, run `create/01_preflight.sql`.
2. As `CRIME_DATA`, run `create/02_create_products_and_entitlements.sql`.
3. As `CRIME_DATA`, run `create/03_create_roles_and_grants.sql`.
4. As `ADMIN`, run `create/04_create_end_users.sql`; passwords are prompted
   for and never stored.
5. Connect as a listed identity and run its corresponding walkthrough.

These scripts are ADB-aware: use a wallet service alias and do not execute a
container switch. For production, replace local direct-logon demo identities
with OCI IAM-mapped data roles and ensure the app/agent propagates the
authenticated end-user identity.

## Entitlement operations

Grant, revoke, or time-limit access by changing the appropriate
`ACI_A_END_USER_SCOPE` record. The example data is idempotently seeded by
step 2. A production change process should make this table writable only
through an approved, audited access-management workflow.

## Remove

Run `drop/90_drop_dds_advanced_crimedata_adb.sql` as `ADMIN` after demo
sessions disconnect. It removes only `ACI_A_*` artifacts and does not modify
the Basic ADB DDS kit or IncidentData application data.
