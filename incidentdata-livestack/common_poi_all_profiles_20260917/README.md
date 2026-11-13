# Common 13 fictional POIs across the saved dataset library

Completed 2026-09-17T06:11:36.149Z. The same 13 generated-portrait demonstration people are now saved with both narrative and visual vectors in every one of the seven dataset profiles. Active Adelaide also contains the 13 now; the actual running Person Intelligence screen was checked and renders all 13 names and portraits. Refresh the browser or reopen Person Intelligence. No service restart or dataset switch is needed.

| Saved profile | Shared cast | Total POIs including retained city-specific profiles |
| --- | ---: | ---: |
| ADELAIDE_DATA | 13 | 13 |
| BRISBANE_DATA | 13 | 16 |
| PERTH_DATA | 13 | 25 |
| ADELAIDE_DATA_V2 | 13 | 15 |
| BRUSSELS_DATA_V1 | 13 | 13 |
| AMSTERDAM_DATA_V1 | 13 | 13 |
| DUBLIN_CITY_DATA_V1 | 13 | 13 |

## Changes and preservation

This task added 13 people to Adelaide V1, 13 to Brisbane and 13 to Perth. Adelaide V2 already held George Kaplan, Clara Thornhill, Eve Kendall and Philip Vandamm; their person IDs, names, aliases, statuses, portrait URIs, ownership areas, creation timestamps and existing incident relationships were retained. Their full fictional narratives, portrait descriptions and provenance were completed from the common source. Nine other shared people were added to V2. Every Australian snapshot now has 13 narrative vectors (384-dimensional MiniLM) and 13 portrait vectors (512-dimensional CLIP). The vectors and portraits are reused from the checksum-verified common cast package, not regenerated or sent to a cloud provider.

Brisbane's three original city-specific POIs, Perth's twelve original POIs, and V2's Alder and Meridian profiles remain byte-for-byte equivalent under canonical comparison. No existing relationship rows were removed or rewritten. No new incident/case/person-to-person links were inferred. Full protected-table fingerprints match before and after: incidents, reports, evidence, cases, relationships, watched patterns, configuration and security data are unchanged. The Amsterdam, Brussels and Dublin snapshots are unchanged by this task and retain their common cast from the earlier load.

Only the three POI/paired-vector saved tables and their three live counterparts were written. No snapshot was recaptured from the live dataset. No DDL, deletion, grant, deployment, restart, activation or full-profile restore was performed. Active-profile control remains ADELAIDE_DATA with the same activation timestamp. Database identity sequences may advance during rolled-back insert tests; no dry-run POI rows persisted.

## Visibility and meaning

New Australian shared-cast records use each profile's existing central demo ownership scope. Existing Adelaide V2 owners are retained. This is an application security scope, not a claim of residence or actual activity. Current Adelaide users statewide_admin, adelaide_central_analyst and read_only_viewer see 13 under the existing rules. Northern and Southern analysts still see none; no user entitlements changed.

These are generated fictional people, not real-person identity findings. Original scenario backstories and their original place references are retained as fiction; copying a cast member into a dataset does not create a local allegation or new incident relationship. The newly added common safety notice remains in stored narratives. Narrative vectors index the original scenario text without that common preamble, with separate source and full-narrative hashes. Generic image and semantic similarities require review and do not establish identity or conduct.

## Verification

- Five package/merge tests passed (plan_tests.log).
- A complete transaction containing saved and live additions was tested and rolled back; the original collections were read back after rollback.
- Every resulting POI and vector business field matches the plan, including all retained city-specific profiles and the four explicitly enriched Adelaide V2 rows.
- 130 exact self-retrieval checks (13 people x two vector types x four saved profiles plus active Adelaide) rank the expected person first; three fixed narrative probes pass for each target.
- A fresh verify-only loader pass inserted no duplicates; full protected before/after audits match.
- All seven saved profiles have 13 unique cast references joined successfully to ownership rows and both 384/512-dimensional vector records. The installed restore package's reference-based person/area remapping and vector-table mappings were inspected. No destructive live restore was executed to test this.
- The running API returns all 13 names with both vector-ready flags; every detail and served portrait checksum passes. Existing five-user security scopes were checked through both database views and HTTP.
- The running browser renders 13 POI cards, loads all 13 portraits and selects Mara Vega correctly, without page errors or write requests. See adelaide_common_pois_live.png.
- Production health passed. Container start time 2026-09-15T08:20:49.034966069Z; restart count 0 at verification.

## Recovery and provenance

before_people_and_vectors.json is the complete before-image of the four affected saved profiles' POI/vector collections and the original empty live collections. after_people_and_vectors.json is the complete corresponding post-load export. preflight.json records exact profile IDs, access mappings, retained link counts and hashes. The source cast package remains in ../saved_profile_enrichment_20260917/package.json, SHA-256 ccc37234489843067ba4bcce3e242023f62ce34011b10aaaac8841c1d42033f2, together with its package checksum. The existing served portrait assets are unchanged; their checksums are in that package. Keep both handoff directories and those assets for recovery.

The loader rejects differing/partial registrations and preserves existing reference-to-ID mappings. It never deletes rows. Receipts are write-once. Future recovery or rollback must use a fresh reviewed run directory and the before/after exports, targeting these exact POI rows and vector records; do not truncate shared tables, restore an unrelated profile, or overwrite immutable receipts. This report is the dated additive amendment to earlier profile captures, not a claim that the original snapshot files were rewritten.

The browser check reuses the existing temporary Playwright installation through NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules; no test dependency was installed into the production app. Database credentials are read into memory from the existing app container and are not saved in this handoff.
