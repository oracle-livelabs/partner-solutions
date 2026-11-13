# Presenter preparation and reset guide

Prepare a dependable route through the application before introducing optional AI or security exercises.

## Session preparation

1. Check the application URL and SSH forwarding, current branding and database health. The renamed fu40 app is deployed on remote port 8706.
2. Confirm the selected Adelaide profile, persona and record-date range. Record a representative incident and a case with source-supported connections.
3. Read the Part 1 route end to end. Keep a guided question with inspected SQL ready; prepare native AI separately if included.
4. Verify compatible narrative-vector coverage before enabling the vector extension. Resolve the difference between historical full-coverage documentation and the later missing-coverage observation.
5. For Part 2, choose one visible saved batch and record its ID, inventory, pipeline state and completed products. Prepare a separate fresh-upload fixture if needed.
6. Validate the selected APEX application's live authentication and screen sequence before publishing its detailed learner exercise.
7. For DDS, review the matching ADB scripts, version support, required privileges and exact object names. Collect allowed and denied query results using the intended identities before delivery.

![Fictional analysts explore incidents through reports, maps and relationships.](assets/incidentdata-overview.png)

*Fictional analysts explore incidents through reports, maps and relationships.*

## Recommended presenter route

Welcome and data context → activity and persona scope → one report → map and case/source context → guided question and visible SQL → optional prepared vector extension → interpretation checkpoint.

Explain each result with its source and execution mechanism. Use Redwood illustrations to introduce the scenario, then use diagrams beside the relevant exercise. The shared platform, graph and DDS diagrams are conceptual explanations, not deployment or trust-boundary maps.

## Reset matrix

| Activity | Learner reset | Instructor preparation or cleanup |
| --- | --- | --- |
| Activity and report browsing | Restore starting persona; clear filters | None for the screen exercise |
| Guided questions | Clear screen conversation | Saved audit/history may remain; no deletion needed for core walkthrough |
| Narrative search | Clear query; restore default threshold | Prepare compatible stored vectors before the session |
| Data Room review | Return to batch history; preserve fixture | Fresh upload, AI preparation and deliberate batch cleanup |
| APEX comparison | Sign out | Export/import and shared data preparation |
| DDS queries | Disconnect the demo identity | Installation and separately reviewed kit cleanup |
| Data Foundation restore | No learner reset action | Shared-state operation requiring a documented backup and recovery plan |

## Known release preparation items

- Narrative-vector coverage needs reconciliation for the selected release profile.
- Relative-time charts need explicit dataset/reference-clock interpretation.
- The map requires a layout check at supported viewport sizes.
- Some existing category/status filter wording still needs cleanup.
- APEX fixture steps and DDS execution evidence are pending.
- Two pre-existing profile tests fail against stale profile expectations; resolve them independently of branding.

These items bound the current workshop draft. Use the verified screen route and explain unmet prerequisites rather than presenting every extension as ready.

## Record workshop evidence

For each validated exercise, record build, profile, persona, dataset dates, chosen record or batch, steps, actual result, interpretation and reset outcome. Screenshot captures should show the relevant context and use synthetic material.

Instructor source mappings are maintained in docs/workshop/source-map.json in the authoring workspace. That file preserves actual technical paths and schema names for maintenance and is excluded from the public workshop ZIP.
