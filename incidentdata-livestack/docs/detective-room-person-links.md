# Detective Room handles, portraits and saved photo comparisons

20 October 2026. The Alice Springs scenario owner explicitly supplied and
confirmed these fictional character links:

| Original handle | Catalogue character |
| --- | --- |
| `kappa66` | George Kaplan |
| `evek81` | Eve Kendall |
| `pipp68` | Philip Vandamm |
| `thorny58` | Clara Thornhill |

The Crime Board and video person overview now include four portrait cards with
the original handles in their labels. Conversation cords follow the declared
handle plus the original recorded membership. Message senders and text remain
unchanged. Exact catalogue aliases, such as the registered label `Vandamm`,
consolidate into the same character card. Ambiguous or undeclared labels remain
separate. The person register retains the source references and link bases.

## Photo comparisons

Two current saved photo-region comparisons have leading fictional candidates
Clara Thornhill (cosine 0.8543) and Philip Vandamm (cosine 0.7731). Both decisions
remain pending. The board prioritises the compared photograph and includes the
two pending candidate cords. **Person links** lists the region coordinates,
visible alternatives, raw scores, decisions and review reasons.

Visual candidates are separate from the owner-declared handle links. The portrait
cards use the scoped catalogue's reference illustrations. This carries the
existing saved comparisons; it does not automatically detect or search every
face in every photo. No review decision was automatically accepted.

To review a candidate, open **Brief & Connections → People & Photos**, choose its
saved region, inspect the source and reference portraits, then save a demo review
decision and reason. A later room generation records that decision. Pending and
accepted-for-demo links retain distinct board labels and colours.

## Scope and persistence

Annotations are batch-specific private documents under
`CDR_ROOM_ROOT/associations/<batch-id>.json`. The checked input is versioned in
`testdata/detective-room/alice-springs-person-links.json`, with the owner's
instruction and reasons. Applying an update keeps a private backup of the prior
document. The original archive and global POI catalogue are unchanged.

```bash
CDR_ROOM_ROOT=/home/opc/livestack/detective-room/data \
  node scripts/set_detective_room_person_links.cjs \
  testdata/detective-room/alice-springs-person-links.json --apply
```

Without `--apply`, the operator command validates the plan. It checks batch
access, visible catalogue references and literal conversation handles. The
browser generation endpoint does not accept arbitrary bindings.

The app and worker share the same association snapshot. Hidden profiles are
omitted. Photo candidates come from scoped views; source checksums, catalogue
fingerprints, workflow version and model must still match. Stale comparisons and
rejected candidates are excluded from the board.

Generation fingerprints include declarations and current comparison/review
state. Changes require a new snapshot; publication rechecks that state. The
original analysis fingerprint remains separate, allowing checked analysis to be
reused when only annotations change. Original quotations and deterministic
narration are revalidated. Provenance records the fingerprints and association
bases.

## Verification

All 52 test files pass. Regression coverage includes hidden profiles, conflicting
handles, catalogue consolidation, original message preservation, fingerprint
changes and analysis recovery guards. The actual preview has all four named
portraits and two pending photo-region cords, preserving 18 source files, seven
photographs, 96 messages and 67 CSV records. The unchanged full room checker
passes inspectors, playback and 1440/1056/850/560/390/320-pixel layouts. The board
was visually inspected.

App and worker runtime settings are preserved. The app frontend and unrelated
backend files are unchanged. Receipts are in
[verification/detective-room-person-links-20261020](verification/detective-room-person-links-20261020/).

The regenerated room completed as `run-1792471817737-af4421d2201e`. A live
browser verified all four named portrait cards and conversation cords, both
pending photo links, the Person links panel, provenance and ZIP download. The
app reports READY and current against the unchanged source batch and present
annotation/review snapshot.
