# IncidentData LiveStack milestone — 20 October 2026

Git tag: **`milestone-2026-10-20`** in `fucci/CrimeDataLiveStack`.

This is the source baseline for the replication test. It captures the nine-city watch/evidence consistency changes, Detective Room layout fix and guarded recovery, four declared fictional person mappings, and persistent POI identifiers. The 143 person/city records now have 5–7 additional identifiers each (812 added; 875 total assertions). Shared fictional people have identical identifier sets across the cities where they already occur.

The POI identifier register and lookup helpers are installed in the original database. Existing screens and the Detective Room still use their earlier mapping paths; consuming the new register is a separate integration change.

## Clone and validate

```sh
git clone https://github.com/fucci/CrimeDataLiveStack.git
cd CrimeDataLiveStack
git checkout milestone-2026-10-20
npm ci
npm --prefix frontend ci
npm test
npm run build
```

Use the existing private-repository GitHub access. The application Containerfile builds from repository source with `podman build -t incidentdata-livestack:milestone-2026-10-20 .`. Host port and wallet/data mounts must be configured for the destination; `compose.fu40.yml` records the original host's paths and database environment requirements. A frontend build alone does not restore database data or start the media worker.

## What Git contains

- Application/backend/frontend source, SQL migrations, build/deployment tools and checked-in synthetic assets.
- Nine-city watch and evidence seed packs, identifier catalogue and deterministic additional-identifier pack.
- Alice Springs declared-person link fixture (`testdata/detective-room/alice-springs-person-links.json`). The live operator copy is outside Git.
- The complete small media-worker room/video scripts and templates, copied from the running worker; its runtime dependency versions and model checksums are under `detective-worker/`.
- Implementation documentation and verification receipts.

`runtime-manifest.json` records the original app/worker image identities, commands, mounts and resource settings, without environment values or credentials. The current app image is `localhost/incidentdata-livestack:person-links-20261020-r1`; the worker is `localhost/crimedata-detective-worker:person-links-20261020-r1`.

The original deployment uses locally layered images. The `scripts/Containerfile.detective-room-*` overlay recipes depend on prior local images and are **not standalone fresh-host worker builds**. The media source and dependency snapshots now make that dependency visible and preserve the code needed to develop a standalone build. Dependency snapshots are captured versions, not a validated portable worker lockfile. A fresh-host worker rebuild has not been tested by this milestone.

## State to transfer separately for an equivalent deployment

1. **Oracle database:** a consistent schema/data export or clone, including the nine `Z_BASE` datasets, active profile marker, entitlements, assets/vectors, Data Room source BLOBs and derived state, and `POI_IDENTIFIERS`. Git and the separate CSV data repository are not a current database backup. Native Select AI/agent configuration and cloud permissions also need destination-specific setup.
2. **Detective Room state:** `/home/opc/livestack/detective-room/data`, including associations, jobs and published packages. Stop/quiesce generation when taking the file snapshot, and keep it consistent with the database copy. Preserve file ownership and permissions.
3. **Speech models:** the two files in `/home/opc/livestack/detective-room/models` matching `detective-worker/models.manifest.json`. The model binaries (roughly 354 MB combined) are not in Git.
4. **Worker runtime image:** transfer the recorded worker image or build a new compatible runtime with Node, Python, Playwright/Chromium, FFmpeg/ffprobe, eSpeak NG, unzip and the captured Node/Python dependencies. OCI authoring access, model mounts, cache and portrait/public asset mounts must be configured. An app-only container is insufficient for video generation.
5. **Credentials:** destination wallet, app database credentials and OCI configuration/permissions, transferred through a protected channel. They are deliberately excluded from this repository.

For a same-architecture image transfer, these are example operator commands; they were not executed as part of this source checkpoint:

```sh
# Original host: export locally; transfer these archives outside Git.
podman save -o incidentdata-app-milestone.tar localhost/incidentdata-livestack:person-links-20261020-r1
podman save -o incidentdata-worker-milestone.tar localhost/crimedata-detective-worker:person-links-20261020-r1
# Destination host:
podman load -i incidentdata-app-milestone.tar
podman load -i incidentdata-worker-milestone.tar
```

**Destination safety:** several current verification/import/deployment scripts intentionally target the original FU40 container, wallet and database. In particular, `scripts/evidence-intelligence/connection.cjs` asserts FU40, and some deploy scripts contain the original container names and image lineage. Review and adapt destination connection/deployment configuration before running these scripts on another environment. Do not treat them as generic fresh-database bootstrap commands or remove the original target guards blindly.

No database export, runtime data copy or image archive is included in this Git milestone. The replication destination has not yet been exercised.

## Acceptance evidence

- All 54 application test files pass; production frontend build passes.
- Live identifier verification: all 96 generated identifiers visible in the active 17-person city profile resolve to the intended POI; scope, ambiguity, status and validity checks pass.
- Nine-city coverage and shared-person consistency pass. Repeating the identifier import adds zero rows.
- Published Detective Room browser, layout, video and source-link checks are recorded under `docs/verification/detective-room-person-links-20261020/`.

See [POI identifiers](../../poi-identifiers.md), [person links](../../detective-room-person-links.md), [room recovery](../../detective-room-record-label-recovery.md), [city watch patterns](../../city-watch-pattern-consistency.md) and [city evidence](../../city-evidence-consistency.md).
