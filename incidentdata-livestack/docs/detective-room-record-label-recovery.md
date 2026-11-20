# Detective Room record-label layout and checked-analysis recovery

20 October 2026, FU40 media worker.

Long CSV source paths made the record-index buttons extend past a 320-pixel
viewport. The final room validator correctly stopped publication after the video
had already been generated. The affected Alice Springs batch contains 18 files,
67 CSV records, 96 messages and seven scene images.

The room stylesheet now constrains record-register buttons to their container
and wraps long labels at any necessary character. The original, unchanged room
checker passes all source inspectors, video playback and the ten room views at
1440, 1056, 850, 560, 390 and 320 pixels. The worker image contains this stylesheet;
future generation uses the corrected layout.

The canonical stylesheet is
`detective-worker/room/assets/industrial.css`.
`scripts/Containerfile.detective-room-layout` builds the initial CSS-only overlay.
`scripts/Containerfile.detective-room-recovery` adds the guarded recovery support
to that worker image. `scripts/deploy_detective_room_layout.cjs` verifies the
replacement's environment, command, mounts, network, security settings and
resource limits before switching the worker container. The dedicated startup
service continues to use the same container name.

## Operator recovery

An operator can create a new run using the checked analysis from a previous run
that reached the final room-layout validation. This avoids repeating model
extraction when valid analysis is already available for exactly the same source
snapshot. The prior failed job stays unchanged.

```bash
CDR_ROOM_ROOT=/home/opc/livestack/detective-room/data \
  node scripts/requeue_detective_room_layout.cjs <original-layout-failed-run-id>
```

The recovery pointer is created by the operator script. The browser generation
endpoint continues to accept its existing generation options.

Before using saved analysis, the worker verifies:

- The previous run failed specifically at the final room-control/layout check.
- Owner, batch, source fingerprint and engine match the new run.
- The original archive checksum matches the current source snapshot.
- The saved analysis file matches the checksum recorded when recovery was queued.
- Every stored quotation and character offset still matches the current source.
- Named people remain exact substrings of their cited original passages.
- Fact references and image bindings remain within the same source batch.
- The saved narration matches a fresh deterministic source-grounded script.

Generation then renders and synthesises a new briefing, runs the full video and
room checks, packages the ZIP, and rechecks source visibility and fingerprint
before publication. Generation provenance identifies the earlier analysis run
and its checksum. Existing model JSON validation and corrective-retry limits
remain in force for ordinary fresh generation.

Recovery regression tests cover changed ownership, batch, fingerprint, engine,
archive, failure stage, quotes, names, image bindings and fact references.
All 51 application test files pass. The actual saved Alice Springs analysis also
passed the quote and narration revalidation before the recovery run was queued.

Deployment and final validation receipts are retained in
[verification/detective-room-record-label-20261020](verification/detective-room-record-label-20261020/).

The recovery completed as `run-1792470547563-a8f48f3bf08c` for batch
`DR-20261020-68ed95d9-8383-401c`. The published video is 220.708333 seconds
(3 minutes 41 seconds) and the ZIP is 70,791,817 bytes. The API reports READY
and confirms that this package matches the current source snapshot. Scoped room
opening, ZIP download, MP4 byte ranges and unauthenticated-access rejection passed.
