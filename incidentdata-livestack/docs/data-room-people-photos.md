# People & Photos — first increment

15 September 2026 · FU40 only · `cdr-people-photos-v1`.

Deployment: `local/adelaide-crime-intelligence:cdr-people-photos-v1-20260915`, image SHA `d57d619a8e7490fc8d668fef85801b69d6a914dde1bf082db91116729c305df2`. Only port-8706 `app-fu40` was recreated, after idle checks. The prior `cdr-explorer-v1-20260915` image is retained for rollback.

## Workflow

Data Room → select a batch → Choose what to explore → **People & Photos**.

The tile appears for PNG/JPEG inventory or saved comparisons. Text-only batches retain access to the narrative tool through the same tile, labelled “Narrative context available · no photos”. Inventory is not people detection. Opening reads saved data; it never starts inference. The workspace contains a photo strip, manual region selection (pointer or keyboard percentages), saved region selector, exact stored crop, three nearest authorised POI portraits, explicit review controls and a per-photo network. Closing preserves workspace state. Saved comparisons survive reloads.

**Compare & save region** calls the existing server-side CLIP search and stores its result. Nothing accepts a candidate automatically. Decisions are pending, accepted for demo, rejected or uncertain. Every decision requires a reason, records the demo-role identifier and database timestamp, and appends to history. Acceptance is a fictional scenario review decision, not verified identity. Demo-role switching is not production authentication.

Only one candidate can be accepted per saved region. Conflicting acceptance and outdated revision submissions return 409. Changing a decision requires another explicit review; old decisions remain. Reviews are shared with users who can see both the batch and POI, unlike private Money Flow Agent drafts.

The previous narrative/explicit-name search is retained in an expandable additional tool inside this workspace. It remains session-only and creates no photo links. Its inline Stage 6 placement was removed. Declared-cast links, Connection Review agent, Money Flow pilot, Batch Assistant and Stage 7 exports are unchanged.

## Evidence and models

`Xenova/clip-vit-base-patch32`, 512 dimensions, existing preprocessing and Oracle `VECTOR_DISTANCE(..., COSINE)` retrieval. Reference portraits only, up to three distinct authorised profiles. Every neighbour is shown, including poor/close alternatives, with raw cosine score rather than match probability. This is not a face-recognition model or calibrated identity test.

The server retrieves and SHA-256 checks the authorised original, applies EXIF orientation, validates/extracts the region and produces the PNG submitted to the embedding model. Saved provenance includes source SHA, oriented source dimensions/pixel box, exact processed crop BLOB/SHA, model/dimensions, reference asset IDs/SHAs, ranking, scores, search version, actor and time. Clients cannot supply persisted scores, candidate identities or decisions through the comparison endpoint.

Limits: PNG/JPEG ≤5 MiB; decoded image ≤25 million pixels; region ≥24 × 24 source pixels; processed crop fits within 768 × 768; 200 saved regions per batch; two concurrent saved comparisons per process. No automatic detector or full-photo coverage guarantee. No-match and unsearched regions do not establish absence.

Exact repeated source/crop/catalogue comparisons reopen the existing snapshot. Source, model, workflow-version or compatible portrait catalogue changes make old comparisons stale and block new decisions until recompared. Catalogue fingerprints include scoped person/asset IDs, portrait SHA, model and vector creation time. Historical reviews remain visible with a stale warning; stale edges have `current:false`, and accepted-only display excludes them. Reference images come from the current POI register, so a stale comparison must not be mistaken for an unchanged reference.

## Database and graph

Additive tables: `CDR_PHOTO_SEARCHES`, `CDR_PHOTO_CANDIDATES`, `CDR_PHOTO_REVIEWS`. `CDR_PHOTO_GRAPH_V1` is a native SQL property graph over scoped views, queried with fixed `GRAPH_TABLE` SQL. It follows Oracle's [view-backed property graph approach](https://docs.oracle.com/en/database/oracle/property-graph/26.3/spgdg/creating-sql-property-graph.html) and [query syntax](https://docs.oracle.com/en/database/oracle/property-graph/26.3/spgdg/examples-sql-property-graph-queries.html). The visual is custom React/SVG, not Oracle's visualization SDK.

Topology: **Photo → Region → Candidate POI**, never person-to-person association. Source-region and similarity edges are distinct. Pending is dashed blue; accepted-for-demo solid green; uncertain amber; rejected/stale grey. Default display hides rejected neighbours; all remain in saved cards/export. At most the latest 12 regions for the selected photo are drawn, with an explicit notice and every region available through the selector/export.

The API reconciles native topology with scoped relational rows. Views join authorised batch/item and POI views on every read; history cannot bypass POI scope. POI graph keys include batch ID. No foreign key points into the replaceable live POI register, preserving city-profile restores; history becomes hidden/stale as appropriate. Source/search/review foreign keys remain. Batch removal deletes photo reviews → candidates → searches before original items, limited to that Data Room batch.

## API

- `GET /batches/:id/capabilities`: metadata-only photo/saved-region counts and stale warnings; no inference/graph query.
- `GET /batches/:id/people-photos`: scoped photos, searches, candidates, current review state, native edges and vector coverage.
- `POST /batches/:id/items/:itemId/photo-comparisons`: `{region:{x,y,width,height}}`, normalised coordinates; explicit vector inference and atomic persistence.
- `GET /batches/:id/people-photos/:searchId/crop`: exact stored PNG, scoped, no-store.
- `GET /batches/:id/photo-candidates/:candidateId/reviews`: scoped append-only history.
- `POST /batches/:id/photo-candidates/:candidateId/reviews`: `{decision,reason,expectedRevision}`; current source/catalogue required, read-only role denied.

New API database round trips are bounded at 15 seconds and use serial queries. Inference occurs outside the transaction. Persistence/review locks the batch row and rechecks scope/source/catalogue before commit. Closing does not undo an executing save; refresh to retrieve it. Atomic rollback prevents half-saved regions.

## SUGA checks

Ten regions were selected by location before querying: cafe left/centre/right; workshop left/centre/right; networking foreground left/right and background left/right. Each produced three pending candidates and four graph edges: 10 regions, 30 candidate links, 40 total edges. No SUGA review decision was written by these checks. Background figures outside these regions remain unsearched.

First-ranked names/scores: Julian 0.872/0.881/0.881; Tony 0.813/0.866/0.766; George Horner 0.854/0.772/0.773; Vivienne 0.843. Workshop right has close alternatives: Horner 0.772, Kaplan 0.760. Julian outranks Kaplan in all three tested Julian regions using the replacement portrait. These are synthetic spot checks, not a general accuracy benchmark; filenames did not influence ranking.

Coverage remains 13/15. Alder and Meridian lack compatible vectors. All seven original file checksums, stages, other analysis/run IDs and portrait-vector metadata were unchanged.

Validation:

- `test/data-room-people-photos.test.js`: review validation, scope/read-only, staleness, server-only provenance, deduplication, rollback, metadata-only discovery.
- `scripts/verify_people_photos_edges_live.js`: uncommitted native-graph fixtures, scoped POI/crop/history access, optimistic revisions, conflicting acceptance, append-only history, stale rejection and deletion order; all rolled back, no model calls.
- `scripts/verify_suga_people_photos_live.js`: idempotent real-vector SUGA comparisons and immutability checks; leaves all new links pending.
- `scripts/test_suga_people_photos_browser.cjs`: live tile/lazy loading, exact-crop display, real deduplicated vector request, pointer/keyboard controls, source inspector, export/reload, retained state, narrative tool and 760/600/390-pixel layouts. Review form gating/payload/display uses isolated browser responses; native review writes are tested separately with rollback fixtures, so SUGA remains pending.

All 16 local test files and the frontend build pass. The existing Vite main-bundle-size advisory remains. Money, Messages and Explorer browser regressions pass with the third workspace present. The saved Money Flow Agent review still opens with four route links and exact transaction citations; no new agent run was requested.

No photo agent tools, automatic detection, face identification, reverse full-batch portrait search, cross-batch linking or Stage 7 integration is included.
