# USA Data Foundation tiles — 20 September 2026

Adds Boston, Chicago and Las Vegas to the third desktop row of the saved-profile
library. The first two rows retain their existing order and behaviour. The
existing two-column tablet and one-column phone breakpoints are unchanged.

| Third-row tile | Saved profile | Incidents |
| --- | --- | ---: |
| Boston | `BOSTON_CITY_DATA_V1` | 14,513 |
| Chicago | `CHICAGO_CITY_DATA_V2` | 39,649 |
| Las Vegas | `LAS_VEGAS_URBAN_DATA_V1` | 19,527 |

The three profiles are no longer duplicated under Other saved profiles. Missing
profile metadata still produces a disabled tile; there is no fallback to another
profile. Counts and selected-profile capabilities come from the existing API.

## Important restoration boundary

All three USA profiles currently advertise `savedReview: true`, `restore: false`
and `nrtRestore: false`. Their saved reviews are accessible from the new tiles,
but this release does **not** enable restoration, change readiness declarations,
certify AI features, or activate a dataset. Dublin remains the active profile.
Further readiness work is required before testing these as operational datasets.

## Scope and verification

- Application source: only `frontend/src/foundation-profiles.mjs` and
  `frontend/src/ProfileLibraryPanel.jsx`; regression tests in
  `test/foundation-restore.test.js`.
- The unchanged frontend was rebuilt and matched the running app before edits.
- All 184 unit tests passed, including USA mutation-denial tests.
- Browser checks cover exact three-row ordering, all three real saved reviews,
  counts/timezones, no duplicate entries, existing restore confirmation controls,
  mobile tile sizing, restricted-user access and absence of API writes.
- Preview API checks record all ten saved profiles. Live checks compare the full
  catalogue details, counts, capabilities and active profile against that record.
- Deployment verifies settings, mounts, ports, all backend files and public assets
  remain unchanged. Only the frontend entry point and compiled assets are overlaid.
- The authoritative deployment outcome is `deployment.json`; preview and live
  results are in `preview_*.json` and `live_*.json`. Screenshots are in `screenshots/`.

An initial browser assertion detected page-level horizontal overflow at 390px.
The before/after comparison in `mobile_baseline_comparison.json` confirms both
builds have the same existing 455px page width caused by header/sidebar content;
every profile tile fits its own bounds. This unrelated layout issue is unchanged.
The initial failed check is retained as `preview_browser_initial_mobile_check.json`.

## Deployment and recovery

New image: `local/adelaide-crime-intelligence:usa-foundation-tiles-20260920`.
Retained previous image: `local/adelaide-crime-intelligence:saved-profile-scale-20260920`.

The compose change is restricted to the `app-fu40` image. `deploy.cjs` refuses
stale baselines, requires successful validation receipts and a sealed image
manifest, and restores the previous image if post-recreation validation fails.
`rollback_image.yml` targets only that service. Original source and private
compose backups are retained under `before/`; no dataset files are modified.

Do not rerun this one-shot deployment script to perform dataset restoration.
