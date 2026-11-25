# Second row of saved-profile tiles — 17 September 2026

Deployed and verified in the live Data Foundation page. The desktop grid has the requested two rows:

| Row | First tile | Second tile | Third tile |
| --- | --- | --- | --- |
| 1 | Adelaide → `ADELAIDE_DATA_V2` | Perth → `PERTH_DATA` | Brisbane → `BRISBANE_DATA` |
| 2 | Amsterdam → `AMSTERDAM_DATA_V1` | Brussels → `BRUSSELS_DATA_V1` | Dublin → `DUBLIN_CITY_DATA_V1` |

The new tiles display their exact profile identifiers and saved Z_BASE counts: Amsterdam 14,467; Brussels 25,691; Dublin 17,817. Standard restore is enabled for all six tiles. NRT remains available only for Adelaide, Perth and Brisbane. Selecting a tile only reads its saved metadata; the separate Restore button replaces the single active operational dataset.

**No restore was performed during this task. Adelaide V2 remains active with 21,532 incidents, 15 POIs and its populated watch scenarios.** All seven saved profiles, including Adelaide V1, remain available in the database.

## Implementation

The running backend previously recognised only the four Australian profile codes and silently fell back to Adelaide for other codes. The new `backend/setup-profile-selection.js` provides an explicit seven-profile allowlist, exact bound profile queries, and validation before setup handlers. Unknown/missing mutation targets now fail without a fallback. The new European profiles allow standard restore only; NRT, capture and delete were not enabled for them. Existing administrator-only mutation access is retained.

The existing restore procedure and its standard/NRT route SQL were not changed. The frontend adds the three tiles in the requested order, gives each its exact code, cancels stale selection requests, checks that the returned profile matches the selection, and disables restores until profile data is available. Tile selection is disabled while a restore request is in progress.

The isolated frontend baseline reproduced every currently served asset byte-for-byte before changes. Deployment derives from the prior running image and adds only the scoped frontend changes, setup helper and runtime setup wiring. Unrelated pending generic profile-library/backend changes in the main workspace were neither overwritten nor deployed.

Current image: `localhost/local/adelaide-crime-intelligence:europe-profile-tiles-20260917`.

Previous image retained: `localhost/local/adelaide-crime-intelligence:adelaide-v2-tile-20260917`.

Root `compose.fu40.yml` points to the new image. Only `app-fu40` was recreated; environment, mounts and ports were verified unchanged. Credentials remain outside the receipts.

## Verification and limits

- Full application unit suite: 154 passed, zero failed.
- Nine additional tests exercised the actual runtime restore-handler source with a mock database, confirming exact bound profile codes and rejection of invalid/unauthorised or unsupported NRT requests.
- Preview and live browser/API checks passed for all six profile/count mappings, desktop two-row ordering, restricted-user disabled buttons, and mismatched-profile failure handling.
- All nine browser restore requests (six standard plus three Australian NRT) were intercepted and fulfilled locally. None reached a real restore endpoint. Preview-server writes were independently blocked.
- Tile-grid stacking was checked at a 390-pixel viewport. This is not a whole-app mobile accessibility certification; the existing narrow-screen sidebar overflow is outside this tile change.
- Full before/after fingerprints for the recorded saved/live dataset, POI, watch, security, vector and configuration tables matched, including active profile ID 6 and activation timestamp.

Actual European restores were deliberately not executed. These checks establish the tile/endpoint mapping, saved-data availability and unchanged existing restore invocation, not end-to-end activation acceptance for every application feature. They do not add incident vectors, watch memberships, social posts or graph cases to the European datasets.

## Reproducibility and recovery

This directory contains the effective frontend source, before/after runtime server source, copied setup helper, build/container scripts, screenshots, database audits, test results and deployment receipt. `delivery_manifest.json` records their hashes. The newly added root helper and unit test are also retained in the main workspace.

The main workspace still contains a separate, undeployed generic profile-library implementation with its own activation guard. A future full-workspace build must reconcile these explicit tile/restore targets with that pending implementation; do not replace this scoped deployment with an unreviewed full build. Rebuild this delivered UI using this directory's isolated frontend source and the included Containerfile.

The prior image and `rollback_image.yml` remain available for an explicitly requested application rollback. No saved profile was captured, removed, renamed or restored. Earlier delivery evidence was not edited.

## User action

Refresh **Data Foundation** to see the new row. Select Amsterdam, Brussels or Dublin and check its displayed profile/count. Use the corresponding **Restore** button when ready to replace the active dataset.
