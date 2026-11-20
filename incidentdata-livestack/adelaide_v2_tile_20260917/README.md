# Adelaide tile → ADELAIDE_DATA_V2

The deployed Adelaide tile now selects `ADELAIDE_DATA_V2`. It explicitly labels V2 scenario enrichment, displays 21,532 saved incidents, and offers **Restore Adelaide Data Set V2 - Scenario Enrichment**. Both standard and NRT restore buttons send `profileCode: "ADELAIDE_DATA_V2"`. Perth and Brisbane retain their existing targets.

No dataset restore was performed. `ADELAIDE_DATA` remains active with 21,513 incidents until the user chooses to restore V2. The standard restore preserves recorded timestamps; the separately labelled NRT option shifts incident times using the existing backend behaviour.

## Scope and verification

- Reproduced all ten frontend assets from the running image byte-for-byte before making changes. This establishes that the isolated build starts from the deployed frontend, not unrelated pending workspace work.
- Changed only three source lines in `frontend/src/main.jsx`: the initial selected profile, Adelaide's tile mapping/description, and its eligibility for the existing NRT button.
- Built and browser-tested the frontend before deployment. All six standard/NRT request combinations for Adelaide, Perth and Brisbane were intercepted and checked in the browser; none reached the app's restore endpoint. A second layer also blocks writes at the preview server.
- Repeated those tests against the deployed app, checked the visible V2 label/count, and confirmed the limited viewer cannot use either restore button.
- Compared read-only before/after fingerprints across the recorded saved/live dataset, watch, POI, security, vector and configuration tables. No audited data or active-profile change occurred.
- Deployed on the previous app image, preserving the backend and the empty-community-summary fix. Environment settings, storage mounts, ports and backend hash were verified unchanged. Only `app-fu40` was recreated.

The first preview runs correctly blocked all writes but failed because of mistakes in the browser test's interception/selector code. Those test-only issues were corrected before deployment; the final preview and deployed tests passed.

## Deployment and source

Current image: `localhost/local/adelaide-crime-intelligence:adelaide-v2-tile-20260917`.

Previous image retained: `localhost/local/adelaide-crime-intelligence:empty-summary-20260917`.

The root `compose.fu40.yml` points to the new image. This directory contains the isolated build source, build scripts, Containerfile, before/after evidence, browser screenshots, deployment receipt and delivery manifest. The main workspace's pending generic profile-library implementation was not overwritten or deployed; it already exposes V1 and V2 as separate, explicitly identified catalogue entries. Future full-workspace deployment remains separate work.

`rollback_image.yml` retains the prior image selection for a separately requested app rollback. No saved profile was removed, recaptured or renamed. Credentials are not included in the receipts.

## User action

Refresh **Data Foundation**, select **Adelaide Metropolitan Area**, and use **Restore Adelaide Data Set V2 - Scenario Enrichment**. Selecting the tile alone does not restore the dataset. After the restore completes, open **Crime Pattern Signals** to inspect the populated watches.
