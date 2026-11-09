# Six-city Data Foundation repair — 19 September 2026

The six-city restore interface is restored on the FU40 application (port 8706), without rolling back the newer CrimeDataRoom features.

| Row | First tile | Second tile | Third tile |
| --- | --- | --- | --- |
| 1 | Adelaide (`ADELAIDE_DATA_V2`) | Perth (`PERTH_DATA`) | Brisbane (`BRISBANE_DATA`) |
| 2 | Amsterdam (`AMSTERDAM_DATA_V1`) | Brussels (`BRUSSELS_DATA_V1`) | Dublin (`DUBLIN_CITY_DATA_V1`) |

Adelaide V1 remains under **Other saved profiles**, along with any additional catalogue entries. Profile metadata and counts still come from Z_BASE; tile selection and saved-profile review remain read-only.

## Restore behaviour

- All six tiles support standard restore. Adelaide V1 also retains its existing restore capability.
- Only the four Australian profile versions support NRT time-shifted restore.
- European capture, delete and NRT operations remain blocked.
- A restore still requires Statewide Admin, exact `ACTIVATE <PROFILE_CODE>` confirmation and a matching current-active-profile preflight.
- Unknown identifiers and invalid or mismatched profile responses fail closed. No fallback to Adelaide is permitted.
- **No real dataset restore was run during this repair.** Dublin remains active, with 17,817 incidents, 13 POIs and five cases.

## What prevented the regression from recurring

The 17 September delivery was built from an isolated frontend. Subsequent full-workspace builds used different profile-library code and lost the explicit six-city restore setup.

This repair reconciles the implementation in the **main workspace source**, not just an isolated build:

- `backend/setup-profile-selection.js` is the shared explicit profile allowlist.
- `backend/server.js`, `profile-library.js` and `setup-mutation-guard.js` now distinguish standard restore from NRT capability while retaining the existing confirmations.
- `frontend/src/foundation-profiles.mjs` defines the six-tile order, used by `ProfileLibraryPanel.jsx`; extra profiles remain separately accessible.
- `test/foundation-restore.test.js` exercises the actual server wiring/restore handlers with a mocked database, capability discovery, invalid requests and six-tile ordering.

Normal future frontend/full-workspace builds now include the repair. The local `frontend/dist` has also been rebuilt.

## Deployment and verification

- Current image: `localhost/local/adelaide-crime-intelligence:six-city-restore-20260919`.
- Base/rollback image retained: `localhost/local/adelaide-crime-intelligence:cdr-messages-dated-v2-20260918`.
- Only the FU40 app container was recreated; application settings, mounts and ports were verified unchanged.
- The pre-change frontend build reproduced the running release byte-for-byte.
- All 174 unit tests passed. Standard frontend build passed, with the existing large-chunk advisory.
- Read-only preview checks verified all six counts/capabilities, desktop rows, mobile stacking, Adelaide V1 access, response mismatch rejection and non-admin restrictions.
- Nine browser restore requests per check (six standard plus three Australian NRT) were intercepted and never sent to the backend.
- All unrelated deployed backend files, including CrimeDataRoom and AI Ops, were checked unchanged by SHA-256.
- `deployment.json` records the deployed image and capability checks. `live_browser.json` records live UI verification. `database_before.json` and `database_after.json` record before/after read-only data fingerprints.

Actual database replacement was deliberately not exercised. Browser interception and mocked routing tests verify targets and controls; they do not constitute end-to-end acceptance of every feature after restoring each city.

## Rebuild this scoped image

From the project root:

```sh
npm test
npm --prefix frontend run build -- --outDir ../europe_profile_restore_20260919/dist
podman build --network none --pull=never \
  --ignorefile europe_profile_restore_20260919/image.ignore \
  -f europe_profile_restore_20260919/Containerfile \
  -t local/adelaide-crime-intelligence:six-city-restore-20260919 .
```

The custom ignore file restricts the image build context to the four changed backend files and compiled frontend. The prior image and `rollback_image.yml` are available for an explicitly requested application rollback. Source backups are retained under `before/`.
