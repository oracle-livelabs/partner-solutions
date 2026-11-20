# Saved-profile map and paging update — 20 September 2026

Status: **deployed and verified**. The app restarted at 02:24:57 UTC on 20 September 2026 with `local/adelaide-crime-intelligence:saved-profile-scale-20260920`. Live API/browser checks and the final preservation audit passed. Dublin remains active. This is an application-only phase, not a Chicago dataset load.

`preservation_verification.json` confirms identical before/after fingerprints for all 44 protected tables, unchanged schema/security metadata, all nine saved profiles, and live Dublin's 17,817 incidents, 13 POIs and five cases. The frozen Chicago manifest is unchanged. The 26 live API checks had a maximum response time of 4,356 ms; these are observed test timings, not a service guarantee.

## Use

As Statewide Admin, open **Data Foundation → select a saved city → Review saved profile (read only) → Use clustered map and pages**. Click populated clusters to drill down. Next, Previous and Last page navigate the full filtered incident list without resetting the map. Filters reset the list to its first page.

Existing profiles still open their classic saved review by default. A stored `saved_review.mode: "clustered"` or positive integer `performance.raw_map_marker_limit` opts a profile into bounded review automatically. Chicago's staged configuration already contains the latter; no staged configuration was edited and no Chicago database row was created.

## Boundaries and behavior

- Read-only, administrator-gated queries against the selected saved profile. No activation, DML, DDL, changed permissions, embeddings, AI calls or generated graph data.
- Exact counts, not point samples. At most 1,000 returned clusters. At zoom 15 or closer, original physical markers appear only when the entire viewport fits under the hard 5,000-marker cap. An oversized client request cannot raise that cap.
- Presentation cells start at roughly 64 horizontal pixels. Exact selected extents skip excessively fine cells; a bounded fallback coarsens them. This is separate from every dataset's spatial-validation grid.
- Cluster centroids describe groups, not incident sites: a centroid can be in an empty gap between incident locations. Click populated clusters to reach actual saved points. No coordinates were changed.
- Reference-only/online records count toward the incident list but receive no physical map marker. Stored profile timezones, source reports, provenance and synthetic notices remain visible. Legacy profiles without timezone configuration still explicitly show UTC.
- The spatial-address-data-less-congested skill informed exact count reconciliation, separation of reference-only records, unchanged coordinates and visibly synthetic-location labels. It did not regenerate any dataset.

## Verification artifacts

`build_checks.json` and `unit_tests.log`: all 183 tests and the production frontend build pass. `preview_api.json` and `preview_browser.json` record the final preview checks; `live_api.json` and `live_browser.json` are created during deployment. API checks exercise actual saved Brisbane data (42,317 incidents, larger than Chicago), stable paging, final partial pages, filters, empty results, malformed input, cross-profile isolation and restricted-user denials. An independent read-only stream of all 42,317 stored coordinates reconciles both tested cluster grids and narrow-viewport membership.

Browser checks cover actual cluster-to-marker drill-down, paging without map resets, empty and online-only views, mobile layout, timezone display in a differently zoned browser, and removal of saved review after switching away from administrator access. All browser write requests are blocked. They verify the six existing restore tiles without invoking restore.

Earlier failed checks are retained for traceability: `preview_api_initial_timing_failure.json` (fixed high-zoom scan cost), `preview_browser_initial_extent_failure.json` (fixed initial extent), and `preview_browser_centroid_test_assumption.json` (the test incorrectly assumed a group centroid must contain an incident). The spacing-adjustment image receipt is retained separately; that image was never deployed.

## Controlled release and recovery

`preflight.json` records the original image/container, runtime hashes and a reproducible baseline frontend. `before/` holds scoped source backups and the original compose file (restricted permissions).

`build_image.cjs` packages only the two scoped backend files and built frontend index/assets into a fresh minimal context, based on the verified existing image. It does not include dataset artifacts, wallets, compose settings or public photographs.

`deploy.cjs` requires passing checks and sealed build hashes, verifies that compose changes only the app image, preserves environment values in memory, and recreates only `app-fu40`. It checks runtime settings, ports, mounts, unrelated backend/public files, all six restore capabilities, nine saved profiles and active Dublin; it then runs live API/browser checks. A failure after recreation triggers the retained prior image through `rollback_image.yml`. Credentials and compose environment values are not logged. The old image remains `local/adelaide-crime-intelligence:six-city-restore-20260919`.

After successful deployment, the existing Chicago read-only fingerprint workflow is rerun with a new app-phase audit label, comparing all original saved/live/security/configuration fingerprints. These checks do not validate Chicago's own stored UI behavior: Chicago remains unreviewed/incomplete and unloaded, with its original manual/content/load gates intact.
