# Deep Data Security

This stack requires Oracle AI Database 26ai 23.26.2 or newer. The source
`03_deep_data_security.sql` contains an application baseline policy. The
legacy local-VM tutorial remains in
[`demos/DDS_CrimeData`](../demos/DDS_CrimeData/README.md). For the OCI
Autonomous Database deployment, use the separately deployable
[`DDS_Basic_CrimeData_ADB`](../demos/DDS_Basic_CrimeData_ADB/README.md) and
[`DDS_Advanced_CrimeData_ADB`](../demos/DDS_Advanced_CrimeData_ADB/README.md)
kits. The Advanced kit evaluates active user entitlements, clearance, patrol
area, and effective dates in database Data Grant predicates. Full production
end-user identity propagation still requires application identity and OCI IAM
integration; the local app also retains its existing trusted-server
client-identifier views. These tutorials are deliberately not production
security configurations.

| User | Scope |
|---|---|
| statewide_admin | all synthetic areas |
| central_analyst | central |
| northern_analyst | north/west |
| southern_analyst | south/east |
| read_only_viewer | central aggregate demo |

The canonical Central analyst identity is `central_analyst` for every city.
The 2026-10-13 migration updates the live identity, geographic entitlements,
all 15 Z_BASE profiles, and any existing Mobile DickTracy scope mapping in
one transaction. A city restore supplies that city's geographic entitlements.
The app accepts `adelaide_central_analyst` as a compatibility alias and resolves
it to `central_analyst` before accessing data or checking room permissions.
Direct SQL sessions should set `CLIENT_IDENTIFIER` to `central_analyst`.
Historical recovery tables and completed room artifacts retain their original
recorded identities.

Migration: [`20261013_neutral_central_analyst.sql`](../db/migrations/20261013_neutral_central_analyst.sql).
The deployment runner verifies unchanged scopes and incident/report/vector
inventories before committing; saved-profile security contracts are checked
for every profile.
