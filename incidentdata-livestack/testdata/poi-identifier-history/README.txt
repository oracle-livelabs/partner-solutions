Identifier capture history, authored 30 October 2026

At the user's explicit request, six POI_IDENTIFIERS columns now model a varied
synthetic capture history: RECORDED_BY, REVIEWED_BY, REVIEWED_AT, VALID_FROM,
VALID_TO and CREATED_AT. The window is 30 June 2025 inclusive to 30 June 2026
exclusive in Australia/Adelaide. The date range includes 29 June 2026, but no
populated timestamp falls on or after 30 June 2026 in that timezone.

These are authored demonstration events, not a reconstruction of real staff
actions or original database ingestion. agent01/03/05/07/09/12 and app21/23 are
display codes, as are reviewer02/04/06/08; they do not identify real personnel,
accounts or deployed applications. Original recorder values and load dates
are retained per identifier in the before-change backup and provenance CSV.
Source-reference version dates refer to retained register bundles, not dates
on which the newly authored capture events actually occurred.

CREATED_AT is used as the modelled capture date. VALID_FROM describes the
modelled beginning of an association and can precede capture. REVIEWED_AT
records administrative review after capture; it does not verify identity,
account ownership or subscriber control. REVIEW_STATUS remains unchanged.
Pending proposals retain NULL review fields; some declared associations also
await administrative review. All existing expired identifiers remain expired.
Their end dates align with the earliest replacement-alias validity start for
the same POI. Current associations remain open-ended rather than acquiring
invented future end dates outside the requested period.

All 1,283 rows across 12 saved profiles are covered, representing 150 distinct
logical assertions across 19 people. Dates and actors agree for shared
assertions in different city profiles. Never sum all saved city copies as
independent capture events. Use SECURE_POI_IDENTIFIERS_V for active-profile,
user-scoped charts, or explicitly de-duplicate logical assertions for a global
history. chart-queries.sql provides monthly capture, timeline, Gantt and
actor-to-person network datasets. Open Gantt intervals are clipped for display,
not stored with an artificial end date.

The generator uses stable assertion keys independent of DATASET_PROFILE_ID,
clusters initial collection by person, and adds later alias follow-ups and
review delays. It never changes values, IDs, sources, notes, review status,
person membership, security scope or the active dataset. SQL timestamps are
bound with explicit UTC offsets. Current matching eligibility is compared for
every identifier before commit. Tests check chronological ordering, pending
review semantics, expired intervals, reproducibility and city-copy consistency.

Specification: 20261030-spec.json.
Build: node scripts/build_poi_identifier_history.cjs
Load/check: node scripts/load_poi_identifier_history.cjs --dry-run|--apply|--check
Unit checks: node --test test/poi-identifier-history.test.js
Original baseline, backup, before/after CSV and verification receipts:
/home/opc/scratch/poi-identifier-history-20261030/

Historical loaders that assert former recorder/validity metadata will report
intentional conflicts after this revision. Do not replay them to overwrite the
new history. Existing note and source-reference verifiers read current rows and
continue to validate their own columns.
