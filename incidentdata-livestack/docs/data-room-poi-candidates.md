# Stage 6: POI candidate searches

15 September update: the current UI is inside the [People & Photos workspace](data-room-people-photos.md), not inline under Stage 6. Narrative/explicit-name searches remain session-only. Visual region comparisons now have their own saved candidates, graph and explicit review workflow. The sections below describe the earlier candidate-search increments and their historical test datasets.

Implemented 13 September 2026 on FU40 port 8706. Current image: `local/adelaide-crime-intelligence:cdr-poi-coverage-20260913` (previous images retained).

## Alice Springs coverage repair (v2)

The initial panel successfully searched the five FNET profiles, but the live Clara Thornhill, George Kaplan, Eve Kendall and Philip Vandamm records had **no embeddings in either modality**. They could not appear in similarity results. Earlier tests verified retrieval plumbing and the new five-profile set, but missed this catalogue-completeness gap.

`scripts/repair_nbnw_missing_vectors.js --apply-missing-vectors` now inserts only missing vectors for these four verified fictional records. It uses their existing stored narrative text and registered portrait assets; it does not overwrite profile text, regenerate portraits, change POI ownership, modify existing vectors, or touch batch records. All eight missing vectors were inserted. Source records and image hashes are rechecked before commit; the script is transaction-bound and a second run confirmed all eight were already present without overwriting them. Narrative sources are short existing profile summaries; they were not enriched to fit the test batch.

The Stage 6 panel now shows compatible narrative/visual vector coverage for **all authorised registered profiles**. Statewide coverage is 9/11 in each modality. Alder and Meridian are legacy placeholders with no narrative/portrait source assets and remain explicitly unavailable rather than receiving fabricated vectors. Catalogue readiness is queried on opening the panel and refreshed with search responses.

Narrative results now separate literal registered-name/alias mentions from similarity ranking. Mentions scan at most 24,000 original text characters, report exact UTF-16 offsets/quotes, match case-insensitively with Unicode word boundaries, and flag shared aliases as ambiguous. They are not inferred from filenames, image descriptions, initials, or unregistered chat handles. Missing vectors do not prevent literal mentions. A mention establishes wording in a source, not identity, involvement or a connection. Similarity rankings are not boosted by name matches or restricted to an expected cast.

The API still returns up to three distinct nearest profiles with signed scores. The UI now defaults to adjustable **display filters** of 0.30 for narratives and 0.60 for visual comparisons. These are screening defaults, **not calibrated identity/match thresholds**. Below-filter neighbours are retained in an expandable section and in the JSON export; an empty above-filter set is explicitly inconclusive. Raising/lowering the filter changes display only, never the ranking. Export v2 records the display filter and all neighbours. Candidate searches remain session-only and do not alter saved graphs or Stage 7 packs.

Live Alice Springs verification after repair:

| Query | Results |
| --- | --- |
| `narrative.txt`, semantic ranking | Eve 0.462; George Kaplan 0.448; Philip 0.363 |
| Same original text, literal names | George Kaplan at 11–24; Philip Vandamm at 211–225; Eve Kendall at 287–298 |
| Theatre scene left region `(x .26, y .08, width .23, height .48)` | George Kaplan first, 0.850 |
| Theatre scene right region `(x .60, y .17, width .25, height .46)` | Clara Thornhill first, 0.773 |

Region coordinates were chosen from the scene before querying. This is a small synthetic spot-check, not a general accuracy benchmark. Clara is not falsely listed as a literal mention in `narrative.txt`, which does not name her. All 13 uploaded file hashes match the original ZIP; the saved Alice Springs workspace/graph was identical before and after the new search.

All 11 local test files pass. `scripts/test_alice_poi_browser.cjs` verifies live 9/11 coverage, original-text name separation, both visual first-ranked results, an inconclusive display filter, and clearing results when switching back to Scene2, with no browser errors. The existing live regression also passes scope/read-only checks and source/graph immutability. Frontend build passes with its pre-existing bundle-size warning. Screenshot: `/tmp/alice-poi-clara-fixed.png`.

The Scene2 browser regression also passes all 11 narrative searches, pointer-drawn cropping, source retention, export, dismissal and 760/600px layouts. It explicitly selects the Scene2 source after the batch finishes loading and disables the display filter when asserting all three raw neighbours are available. Alice-specific tests retain the default filter and verify the inconclusive state separately.

## User workflow

Refresh Data Room and open a batch. In Stage 6, **Compare this batch with registered POIs** is independent of Run Connections; existing graph results do not need regeneration.

- **Narrative → POI profiles:** choose a file and Search selected narrative, or Search all batch narratives. Each file returns its own top three distinct authorised profiles. Expand the source excerpt to see exactly what was submitted to the embedding function.
- **Image region → POI portraits:** choose a generated scene, drag a box around one fictional character (or enter percentage coordinates), then Compare selected region. The original and selection remain visible. Results show the exact processed crop beside the ranked profile cards.
- Inspect cosine scores, profile narratives and provenance. Dismiss candidates that are not useful. Download candidate report to retain results as JSON.

Searches are session-only: changing source/mode or leaving the page clears results. Download before doing so. They are not saved graph links, POI updates or Stage 7 pack contents. There is no automatic identification, accepted-link action, or automatic region detector in this increment.

## Models and source handling

Narrative: existing `Xenova/all-MiniLM-L6-v2`, 384 dimensions. Text sources use the first 1,500 original UTF-8 characters; images use the latest completed, hash-matched saved headline and description, likewise bounded. The tokenizer may truncate further; character coverage is not a claim of full model-token coverage. A description run ID is included when used. Narrative similarity is topical relevance, not an exact name lookup or proof of a POI mention.

Visual: existing `Xenova/clip-vit-base-patch32`, 512 dimensions. Server loads the authorised original, checks its SHA-256, applies EXIF orientation, validates the normalized box, and extracts the crop. Regions must be at least 24×24 source pixels. Crops are resized inside 768×768 without upscaling and encoded as PNG. Query and reference preprocessing share the existing embedding function. Original files are unchanged. Record includes original SHA-256, oriented image dimensions, source-pixel bounding box, processed crop SHA-256 and exact submitted crop.

Image limits: 5 MiB original file, 25 million decoded pixels. No client-supplied image bytes or remote image URLs are accepted by the candidate endpoint.

Oracle cosine-distance searches use the same model ID and dimension count as each query. Visual candidates use reference portraits only, not registered scene images. A per-person row rank ensures up to three distinct profiles. Results retain raw signed cosine scores—not percentages or identity probabilities. No universal match threshold has been calibrated; top-k neighbours can all be poor candidates. The v2 UI applies the adjustable display filters described above and makes no match assertion.

## Security and state boundaries

`POST /api/data-room/batches/:id/items/:itemId/poi-candidates` accepts `{mode:'narrative'}` or `{mode:'visual',region:{x,y,width,height}}`. Coordinates are fractions of the EXIF-oriented image, all within [0,1].

Every source is obtained from `secure_cdr_items_v` for the exact batch/item pair and checksum-checked before inference. Source visibility is checked again after inference. POI candidates join `secure_persons_of_interest_v`; embedding tables do not bypass POI scope. The read-only demo user cannot run searches. The existing demo-role mechanism remains demonstrative, not production authentication.

At most two candidate requests run concurrently per app process; the UI's all-narratives action runs sequentially and reports per-file errors. Stopping or leaving the page cancels client waiting/further requests; an already executing server inference may still finish. Queries use bound values and SELECT only. No schema migration, graph mutation, POI creation, data-product update, or model-default change is involved. These candidates are not supplied to the Stage 6 agent as established facts.

## Verification

- Unit coverage: invalid/out-of-frame/tiny region rejection; source visibility/read-only/checksum checks before inference; source scope recheck; source excerpt bounds and description-version provenance; compatible-model/dimension SQL; server-side cropping and crop SHA-256. All ten project test files pass.
- Frontend production build passes, retaining the existing bundle-size warning.
- `scripts/test_data_room_poi_live.js`: real narrative and visual queries on Scene2.zip, distinct candidates, invalid region rejection, read-only denial, cross-batch denial. Batch details and workspace records compare identical before/after.
- A manually selected region on scene 9 ranked the fictional Darnell profile first (cosine 0.654), followed by Noah (0.537) and Tessa (0.423). This is one synthetic test, not an accuracy benchmark. The messages.json excerpt had much weaker narrative scores (top 0.082); those should not be treated as convincing connections.
- `scripts/test_data_room_poi_browser.cjs`: narrative cards/excerpt, all 11 batch narratives (33 cards, no per-file errors), pointer-drawn region, visual cards, original-image retention, JSON download, dismissal, 760/600px layouts, and no browser errors. Use the existing Playwright installation via `NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules`.
- Screenshots: `/tmp/cdr-poi-candidates-desktop.png`, `/tmp/cdr-poi-candidates-mobile.png`.

Automatic region detection, reverse portrait-to-scene indexing, review acceptance/persistence and inclusion in Stage 7 remain later extensions. Existing source graph semantics and saved products are unchanged.
