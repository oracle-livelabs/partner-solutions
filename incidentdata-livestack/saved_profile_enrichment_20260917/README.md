# Shared synthetic cast and watched-pattern additions

Completed 2026-09-17T05:38:36.563Z. These are generated fictional demonstration people and monitoring definitions, not real people or findings of criminal conduct.

## Saved profile result

| Saved dataset | ID | POIs | Narrative vectors | Portrait vectors | Watch definitions | Marked for display |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BRUSSELS_DATA_V1 | 10 | 13 | 13 | 13 | 21 | 6 |
| AMSTERDAM_DATA_V1 | 30 | 13 | 13 | 13 | 21 | 6 |
| DUBLIN_CITY_DATA_V1 | 50 | 13 | 13 | 13 | 21 | 6 |

All additions were committed together to four existing tables only: Z_BASE_PERSONS, Z_BASE_PERSON_NARRATIVE_VEC, Z_BASE_PERSON_VISUAL_VEC and Z_BASE_WATCHED_CRIME_PATTERNS. No pre-existing rows were updated or deleted. Existing incident/report/evidence counts and contents are unchanged. The complete before/after protected fingerprints match, including the other saved profiles, profile configuration, active-profile control, live core tables, POI/vector/watch/social tables and audited security data.

ADELAIDE_DATA (profile 1) was active at preflight and remains active. This run did not activate or restore any profile, grant access, alter schema, deploy application code, restart a service, or modify the Adelaide snapshots. The live Adelaide POI count remains zero; these additions belong only to the three requested saved profiles.

## The 13-person cast

- George Kaplan — `POI-NBNW-GEORGE`
- Clara Thornhill — `POI-NBNW-CLARA`
- Eve Kendall — `POI-NBNW-EVE`
- Philip Vandamm — `POI-NBNW-PHILIP`
- Mara Vega — `POI-FNET-MARA`
- Elias Grant — `POI-FNET-ELIAS`
- Noah Kim — `POI-FNET-NOAH`
- Tessa Rowe — `POI-FNET-TESSA`
- Darnell Price — `POI-FNET-DARNELL`
- Vivienne Hartley — `POI-V2-VIVIENNE`
- Julian Cross — `POI-V2-JULIAN`
- Tony Kapoor — `POI-V2-TONY`
- George Horner — `POI-V2-GEORGE`

Profile Alder and Profile Meridian are excluded. The same retained generated portraits and original fictional roles/backstories are reused across the three snapshots; no new portraits were generated. Names, aliases, narrative text, provenance, source hashes and explicit synthetic notices are retained. Original geographic references (including the Australian art-market backstory and Julian's Amsterdam description) remain source backstory, not a claim that those activities happened in each destination city.

Each person has a 384-dimensional Xenova/all-MiniLM-L6-v2 narrative vector and a 512-dimensional Xenova/clip-vit-base-patch32 visual vector. Vectors were generated offline with the existing local cached models, without a cloud call or application telemetry write. Narrative vectors use the original scenario narrative, excluding the newly added common safety preamble. The exact embedded text and its hash are in package.json; PROFILE_ATTRIBUTES records this policy and the separate full stored-narrative hash. This is generic similarity over generated fictional material, not real-person identification.

Each profile's existing synthetic coverage bucket supplies its demo access scope; it is not a police/Garda jurisdiction or residence. The existing statewide administrator can access the profiles on a future restore; no locality analyst receives a new entitlement. Scoped join checks return 13 for statewide_admin and zero for the other retained demo users.

## Watched patterns

The 21-definition catalogue comes from ADELAIDE_DATA_V2. Codes, names, descriptions, indicators, search prompts, types, colours, display order, active flags and the six ACTIVATE_UI flags match that source. Two intentional changes: CASE_REF is null (no transplanted Adelaide case) and PATTERN_STATUS is monitoring (no claimed completed local comparison).

The six display choices are:

- After-Hours Rear Service Access Property Entry
- Payment-Document Anomaly Chain
- Entertainment Precinct Escalation
- Residential Daytime Occupancy Test Burglary
- Vehicle Catalytic Converter / Parts Harvesting Cluster
- Construction / Development Site Material Strip

No city incident memberships, social posts, reviewed post links, cases, person-to-incident links or graph relationships were created. These are reusable monitoring definitions, not pre-populated local investigations. Application deployment and global activation remain separate from this saved-data load.

Important search limitation: the current schema has no saved-profile table for watched-pattern semantic vectors. Its restore package clears the live WATCHED_PATTERN_EMBEDDINGS table. This task does not add such a table, call cloud pattern embedding, or generate city incident embeddings. Pattern-to-incident semantic demonstrations and linked city scenarios therefore remain a separate enrichment/activation step. POI narrative and portrait vectors are saved and verified now.

## Verification and recovery

- Six local package regression tests passed (package_tests.log).
- A complete dry-run insert was rolled back and target emptiness verified before the final load.
- All business fields and vector values in all four tables read back exactly, across all three profiles.
- 78 database self-retrieval checks (13 people x 2 vector types x 3 profiles) rank the corresponding profile first.
- Three fixed narrative probes passed in each city. Julian and Tony rank first for their targeted descriptions; Elias ranks third for the broader finance query. Rankings are not findings or identity verification.
- An initial dry run failed that finance probe and rolled back completely. The initial package is retained as package_initial_probe_failed.json. Excluding the shared safety preamble from vector input fixed the check without changing its top-three acceptance threshold or removing the stored safety notice.
- All 13 existing served portrait URLs returned HTTP 200 with exact source checksums. Production health passed; container started 2026-09-15T08:20:49.034966069Z, restart count 0 at the check. No restart was performed.
- The actual database restore-package mappings for POIs, both vector tables, patrol-area remapping and watched definitions were inspected read-only. No restore/activation test was run.
- A fresh verify-only loader rerun passed and inserted no duplicates. Protected before/after fingerprints are identical.

before_additions.json preserves the original empty target collections. after_additions.json is a full lossless logical export of the 180 added rows, including vectors, JSON provenance, timestamps and target IDs. package.json, source_patterns.json and preflight.json preserve the replay inputs and area mappings. delivery_manifest.json hashes all handoff files; retain this whole directory with the existing portrait assets, whose hashes are in the package. No passwords, wallet or model binaries are included.

The original city delivery folders remain untouched and describe their earlier capture state; this directory is the additive enrichment receipt. For a future recovery, verify checksums first and use the exact target IDs/codes. The loader accepts a complete matching existing registration as verify-only and rejects a partial/different one; it never deletes or replaces rows. Existing run receipts are deliberately write-once, so use a separately reviewed recovery run directory rather than erasing receipts. Any requested rollback requires a separate exact-row, backed-up plan; do not truncate shared tables or recapture a saved profile from an unrelated live dataset.
