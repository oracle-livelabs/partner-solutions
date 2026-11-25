# Amsterdam application gap checks — 17 September 2026

The application changes are implemented and passed database/API and real-browser checks in an isolated read-only application instance connected to FU40 / CRIME_DATA. **They have not been deployed to the production application. Amsterdam has not been activated.** Brussels remains the active operational profile, with 25,691 live incidents. The immutable Amsterdam V1 dataset and its original delivery record were not edited.

## Gaps addressed in the tested build

| Gap | Change and verification |
| --- | --- |
| Amsterdam selector silently selected Adelaide | Catalogue now reads all six saved profiles from Z_BASE. Amsterdam resolves to profile 30. Unknown codes fail explicitly. Selection and review do not activate a profile. |
| Saved Amsterdam could not be inspected in the application | Added administrator-only read-only saved review with incident list, independent full map coverage, detailed reports, evidence references and stored source hierarchy. |
| Filters and report search needed acceptance | All 11 executive groups, 39 detailed categories and nine source areas match the frozen dataset. Full-report phrase search, accented Rhônepark search and combined category/group filters pass. |
| Browser/session timezone could alter occurrence display or date filters | Configured Europe/Amsterdam governs saved display and local calendar filters. Europe/Brussels governs the active explorer/map. A browser set to America/Los_Angeles displays the correct Amsterdam times and offset. Missing legacy timezone configuration is explicitly UTC, not guessed. |
| NULL coordinates could become false zero/zero markers | NULL, blank, non-finite, out-of-range and online/reference-only coordinates are excluded. All 13,297 physical marker coordinates exactly match the frozen validated data. The 1,170 online/reference records display zero markers. |
| City-specific map defaults | Extent uses profile bounds or valid filtered marker bounds. Whole Amsterdam, all nine areas, Weesp and Westpoort render correctly. Filter transitions pass without JavaScript errors. |
| Source text/provenance could be rewritten by presentation middleware | Stored reports, summaries, source metadata, identifiers and synthetic provenance are preserved verbatim. All 379 stratified sample details match saved source content, offset timestamps, attributes and linked evidence. |
| Synthetic notice not persistently exact | Persistent application notice and saved-review notice say: “Synthetic demonstration data. These are not actual police incidents.” |
| Saved review could cross locality permissions | Existing Statewide Admin only, checked against the active database role. Four existing restricted users plus an unknown user are denied saved access. Existing scoped live views are retained. Changing to a restricted user clears saved details from the UI. |
| Unsafe setup fallback/global replacement | Unknown/new profiles cannot reach legacy restore handlers; legacy restore requires typed confirmation and a current-active-profile precondition. This is a preflight check, not a transaction-level concurrency lock. Amsterdam activation remains disabled. No restore/delete/capture operation was executed. |
| Slow saved-table joins | Query hints avoid repeated profile scans without DDL or new indexes. Full Amsterdam marker review completed below one second in the tested instance; this is an observed result, not a performance guarantee. |

The spatial and incident-description quality skills guided the coordinate exclusions, approximate-location labelling and verbatim searchable report checks. No coordinates, narratives, taxonomy or synthetic records were regenerated.

## Evidence and scope

- [API acceptance](api_acceptance.json): passed; 105 logged requests plus 379 sampled incident-detail requests. Every physical marker matches the frozen staging records. May 7,447; June 7,020; 61 local dates. Local 1 May contains 247 incidents, including records stored on 30 April UTC.
- [Browser acceptance](browser_acceptance.json): passed; nine check groups, 14 screenshots, no page errors and no write requests. Tests use the actual React/Leaflet UI and FU40-backed APIs, not the offline dataset review.
- [Screenshots](screenshots): whole city, all nine source areas, online-only empty marker layer, exact report/time/evidence, accented search and local midnight. All nine area maps were also visually inspected. These are synthetic distributions, not measured hotspots or police jurisdictions.
- [Database before](database_before.json) and [database after](database_after.json): identical semantic fingerprints across all six saved profiles and the audited live/security/configuration tables, including saved vectors. Profile IDs remain 1, 4, 5, 6, 10 and 30. No grants, DDL, live incident replacement or profile activation occurred.
- [Unit suite](unit-tests.log): all 143 tests across 20 test files pass. [New profile tests](profile-unit-tests.log): eight tests pass. [Existing report regressions](report-regressions.log): seven tests pass. [Backend syntax](backend-syntax.log) and [frontend build](frontend-build.log) pass. The frontend build retains a non-blocking bundle-size warning. Final receipts were captured outside the sandbox after detecting that sandboxed child-process launches could return an EPERM error alongside a misleading zero status; the capture script now checks both errors and status.
- [Delivery manifest](delivery_manifest.json), [source patch](source_changes.patch), `source_before/` and `source_after/` record the 14 source/test files touched. Four existing files were backed up; ten are new. No credentials or wallet contents are included.
- [Final production health](final_health.json): healthy at 01:51 UTC; Brussels still has 25,691 incidents. The production container is running with zero recorded restarts and its existing 15 September start time. The temporary loopback review server was stopped after testing; its build and receipts remain available here.

The preservation audit is read-only and full-scope for the table set recorded in its JSON files; it is not a fingerprint of every unrelated schema object. Browser tests exercised the new saved review and the active Brussels explorer; this is not an exhaustive regression of every unrelated application feature. The export metadata/filename now derives from the active profile, but a full export download was not exercised; export retains its existing core-relational scope and is not a replacement for the dataset backup.

## What remains before a live Amsterdam trial

1. Approve a controlled application deployment/restart, initially keeping Brussels active, then smoke-test the deployed catalogue, review, maps, permissions and Brussels health. Source and an isolated frontend build are ready; the running production container was not rebuilt or restarted.
2. Separately approve replacing Brussels through the single global active-profile switch. Recheck backups and current active state, use a narrowly controlled Amsterdam activation procedure, and verify live counts, joins, timezone, map/search behavior and rollback after activation. The current application deliberately does not enable an Amsterdam restore button.
3. Decide whether the trial needs semantic/vector search or graph scenarios. Amsterdam has zero saved narrative embeddings and zero saved graph cases. Neither was generated or exercised, and no AI service was called. These are not required for the tested relational/map/report review, but are required before claiming an Amsterdam semantic/graph trial.
4. If regional users need Amsterdam access, agree their geographical scope explicitly. No new local entitlements were inferred or granted; existing restricted users do not gain Amsterdam access from this work. A Statewide Admin review is already covered by the tests.

The dataset's stored `activation_ready:false` is intentionally unchanged: isolated application acceptance is not production activation acceptance.

## Recovery and rerunning checks

`source_before/` contains the pre-task `backend/server.js`, `frontend/src/main.jsx`, `frontend/src/app-use-notice.css` and `test/ask-crime-v2-results.test.js`. Compare current hashes with `delivery_manifest.json` before any rollback so later user changes are preserved. The patch records new modules separately. No source rollback or deletion has been executed. Since production was not deployed, its running image did not need recovery.

The test server uses a separate loopback port (18706), `CRIMEDATA_READ_ONLY_REVIEW=1`, `CRIMEDATA_BIND_HOST=127.0.0.1`, and `CRIMEDATA_FRONTEND_DIST` pointing to this directory's `frontend-dist`. The review mode disables background workers/config persistence and rejects non-GET/HEAD API calls. Production remains on port 8706. Credentials come only from the existing protected application environment/wallet and are never copied into this directory.

`check_api.cjs` expects that isolated server and the frozen sibling Amsterdam staging directory. `check_browser.cjs` additionally uses the existing temporary Playwright installation via `NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules`; that dependency is not vendored here. `audit_database.cjs` writes each before/after snapshot exclusively and will not overwrite an existing audit. Preserve receipts before a separately labelled future run. `record_delivery.cjs` initially captures exclusively; its `--verify-existing` mode requires the source to match the captured copy before refreshing only this task's generated patch, verification logs and delivery manifest. It never overwrites pre-task source backups.

The original frozen Amsterdam delivery remains at `../synthetic_amsterdam_may_jun_2026_v1/` and its existing archive remains unchanged. This directory records subsequent application work without rewriting that historical delivery.
