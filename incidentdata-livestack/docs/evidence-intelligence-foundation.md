# Evidence Intelligence: data foundation and implementation contract

Historical preparation/design record, 24 September 2026. The local-only status and remaining gates below describe the initial preparation, not the subsequent authorised implementation. See [Evidence Intelligence implementation and release](evidence-intelligence-implementation.md) for current database loading, implemented APIs, tests and deployment receipts.

## The first dataset

The active FU40 application on port 8706 was **AMSTERDAM_DATA_V1** during inspection. The older Adelaide art-market scenario is useful prior work, but its incident references and scene locations do not belong to this active profile. This pilot therefore extends two existing Amsterdam cases and their existing POI associations. It neither changes the city nor reassigns incidents.

| Thread | Existing case | Incidents | Existing fictional context contacts |
| --- | --- | ---: | --- |
| Payment-document anomalies | CASE-AMS-2026-02 | 6 | Philip Vandamm, Mara Vega, Elias Grant |
| Worksite storage and tools | CASE-AMS-2026-05 | 6 | George Horner, George Kaplan, Clara Thornhill |

The package contains 12 substantive document/observation extracts, 12 contact cover notes, four generated object images and four controls. All 32 items have unique titles and descriptions, exact source content, stable evidence references, SHA-256 hashes, explicit provenance and links resolving to the captured incident/case/POI records. Twenty-eight text files and four PNG files are supplied. These are **newly authored supplementary fiction**, not claims that original evidence files were recovered from the existing incidents.

Start with [the local review catalogue](../testdata/evidence-intelligence/v1/review.html). Machine-readable files are [pack.json](../testdata/evidence-intelligence/v1/pack.json), [anchors.json](../testdata/evidence-intelligence/v1/anchors.json), [manifest.json](../testdata/evidence-intelligence/v1/manifest.json), [embeddings.json](../testdata/evidence-intelligence/v1/embeddings.json), [expected.json](../testdata/evidence-intelligence/v1/expected.json), and [validation.json](../testdata/evidence-intelligence/v1/validation.json).

The image-generation skill produced four new images using the built-in tool. The exact prompts and original generated-file paths are in [image-prompts.json](../testdata/evidence-intelligence/v1/image-prompts.json); the project copies are under `testdata/evidence-intelligence/v1/assets/images/`. The narrative-quality skill informed the fact cards and variation checks. The spatial-data skill informed preserving existing coordinates, their precision and their context meaning, and validating one unique point per anchor incident.

## Investigation walkthroughs and deliberate uncertainty

1. **Payment comparison.** Search “purchase paperwork repeats the same payment reference with equal amounts for different goods”. P01 and P02 should appear in the first six candidates. Inspect their source entries, compare the `payment_comparison:AMS-2-1` marker, follow each incident to CASE-AMS-2026-02, and inspect N01/N02 for the literal reference to Philip Vandamm. The inherited incident relationship and the new document mention remain different edge types.
2. **Object comparison.** Query V01's blue tray image. V02 should rank first among the other images. Open W01/W02 to compare their descriptions and follow their existing incident association to George Horner. The generated images have no person link, capture timestamp or capture location. The orange organiser V03 is a deliberately similar object with a different layout.
3. **Weak cross-thread signal.** P03, W03 and C01 contain `K-204`, but in dispatch-form, inventory-form and blank-form namespaces. A broad text search can surface all three; an exact marker join must retain their distinct namespaces. There is no authored assertion that the two cases are connected.
4. **Spatial and time context.** Use the approximate incident point for SYN-AMS-2026-06208 with a 2 km radius: the Buiksloterham-Noord payment incident is included and the Weesp incident is excluded. This illustrates proximity in synthetic geography, not travel, co-presence or an evidence capture site. The UTC occurrence of SYN-AMS-2026-03505 is 26 June 23:45:43; the Amsterdam calendar date is 27 June. Apply dates in Europe/Amsterdam.
5. **Negative and hostile inputs.** C02 is a balanced ledger that can still rank highly for payment vocabulary; C03 is an ordinary stock checklist. C04 contains a quoted instruction to reveal hidden records and resolve a case. A future assistant must treat it as document content. Its presence in this fixture does not prove that any agent currently resists it.

The evaluation answer key is separate from indexed content. Rank expectations concern relevant groups and comparator ordering, not manufactured confidence values. Text and image vectors have separate models and dimensions. Measured results include V01→V02 cosine **0.8366**, V01→orange organiser **0.7950**, and the balanced ledger ranking third in the repeated-payment query. These close distractors make source inspection meaningful; do not present a generic “match percentage” as confidence.

## Storage and identity contract

Use `(profile_code, evidence_ref, version)` as the logical evidence identity. Live numeric `evidence_id`, `incident_id` and `person_id` can change during profile restoration. Join current incidents and people by their stable references within the active profile. New evidence references are `EV-AMS-P01..P06`, `W01..W06`, `N01..N12`, `V01..V04`, and `C01..C04`.

For the first data-only import, retain the existing `EVIDENCE_ITEMS` parent incident FK and store the detailed versioned contract under `evidence_metadata.evidence_intelligence`. Root `evidence_ref`, `pack_code`, `profile_code`, `record_sha256`, `synthetic_record`, `observed_detail` and `shared_marker` support existing readers. The existing evidence snapshot path copies JSON with the evidence row; no new required FK should break the profile restore. This has been inspected in source, not exercised against Oracle for this package.

`personLinks` distinguish:

- `existing_incident_context`: the captured person-to-incident association, with its source reference and explanation; no direct evidence attribution.
- `literal_name_mention`: exact quote and character offsets in an authored source text; no identity verification.

Similarity candidates and human review assertions are later, separate records. A score must never silently become a reviewed relationship. A graph of these fixtures may expose inherited Evidence → Incident ← POI paths and explicitly quoted Evidence → POI mentions with different labels.

The JSON metadata is a staging representation for variable source attributes and typed links. B can project it with `JSON_TABLE` and, if needed, materialize stable-key link tables. This is ordinary native JSON usage, **not a claim that JSON Relational Duality has been implemented**. See Oracle's [JSON data type](https://docs.oracle.com/en/database/oracle/oracle-database/26/adjsn/json-data-type.html) and [JSON_TABLE](https://docs.oracle.com/en/database/oracle/oracle-database/26/adjsn/sql-json-function-json_table.html) documentation.

Embeddings currently reside in the local sidecar: 32 MiniLM 384-dimensional narrative vectors and four CLIP 512-dimensional image vectors. Every entry has its model, modality, source hash, dimensions and quantized model setting; the artifact records the runtime version. B should persist them in native `VECTOR` columns keyed by profile, stable evidence reference, modality, model and source hash. Treat the vector cache as rebuildable when a source hash changes or a profile is replaced. Do not index the evaluator answer key or common provenance boilerplate.

## Dates, geography and provenance

Incident occurrence, the authored fixture date, a simulated record-receipt time, and a real ingestion timestamp are different fields. Simulated receipt is one hour after the source's synthetic reported time. `capturedAt` and `captureLocation` are null. Generated object photographs illustrate descriptions and carry no claim of contemporaneous collection or physical recovery.

`incidentContext` preserves the captured approximate neighbourhood point, location role, suburb, district, timezone and point semantics. A page should join the current incident context, not treat the stored snapshot as a new location observation. If NRT restoration shifts dates, display those as shifted incident context while preserving the original fixture provenance. The loader intentionally rejects a time-shifted anchor until the pack is explicitly rebased. Map pins should group by incident; 32 evidence items do not imply 32 distinct observation locations. Records marked `locality_reference` must never be promoted into physical capture points.

Hashes demonstrate artifact integrity from this pack's creation. They do not establish historical chain of custody, authenticity of a source assertion or an investigative conclusion.

## Workstream B: page and API scope

The page should have a searchable evidence list, a selected source viewer with provenance, and context panels for related material, incident map and graph. A compact “Database work” disclosure can show the actual executed SQL, model and timing for teaching. Keep implementation terms secondary to the user's review task.

| Read path / action | Required response and behaviour |
| --- | --- |
| `GET /api/evidence-intelligence` | Paginated authorised items; profile, kind, case, incident, date, exact marker and text filters; total computed within scope |
| `GET /api/evidence-intelligence/:ref` | Source, asset metadata, provenance, current incident context, typed authorised POI links; 404 for invisible or missing |
| `GET /api/evidence-intelligence/:ref/asset` | Authorisation checked on every request; path allowlist and MIME checks; no public static asset bypass |
| `POST /api/evidence-intelligence/search/narrative` | Scoped candidates ranked with Oracle VECTOR_DISTANCE; source excerpts, raw cosine, model, source hashes and request timing |
| `POST /api/evidence-intelligence/search/visual` | Generated image comparison in the evidence corpus; independent image-model space; explicit query thumbnail |
| `GET /api/evidence-intelligence/:ref/context` | Radius/date filtering over authorised incident context using native spatial operations; typed paths through authorised vertices |
| `POST /api/evidence-intelligence/ask` | Read-only, source-cited answer; inspectable generated SQL or RAG references; capability unavailable until verified |
| `POST /api/evidence-intelligence/review-brief` | Bounded agent retrieval and comparison; source-linked draft and tool trace; no case mutation |

Every path must enforce active profile, incident scope, linked POI scope and intermediate graph-node scope. Apply scope **before** top-K, aggregation, counts and distance calculations. A visible source document may contain a literal name without granting access to a hidden registered POI or its graph binding. The five-user live snapshot showed 12 selected incidents and 13 catalogue people for Statewide Admin, and no selected incidents or people for the four other existing personas. Preserve those entitlements; create a narrower positive-access test persona only in an isolated test schema when testing partial graph access.

Native graph use must execute SQL/PGQ rather than merely display an application graph with an Oracle label. The current general case-network route constructs nodes and edges with relational queries, although an existing graph definition is present in source. B must verify real `GRAPH_TABLE` output against the expected fixture paths. Oracle's [graph reference privileges](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/graph-reference.html) deserve explicit review: permission on a graph does not require permission on its underlying tables. Do not assume a graph grant automatically reproduces application scope.

Select AI and agent capabilities remain capability-gated. Package availability, privileges, profiles, model/network configuration and exact installed database release have not been validated in this task. Start with a bounded source-cited brief using the verified retrieval paths, then exercise the C04 hostile-source test with the real configured agent before enabling it in the page. Do not label custom application orchestration as native Select AI Agent.

## Reproduce and validate

From the project root:

```bash
node scripts/evidence-intelligence/build.cjs
node scripts/evidence-intelligence/embed.cjs
node scripts/evidence-intelligence/evaluate.cjs
node --test test/evidence-intelligence-fixtures.test.js
node scripts/evidence-intelligence/prepare-loader.cjs
node scripts/evidence-intelligence/review.cjs
```

Model loading is offline and uses the already cached local models. Set `TRANSFORMERS_CACHE` if their cache is elsewhere. The initial `snapshot.cjs` uses only GET requests to the local application and refuses to overwrite the original anchor file. A future refresh should use a new package version and source snapshot.

The narrative checker passed: 32 complete descriptions, no short records, 100% unique titles and descriptions. The spatial checker passed on the **12 unique incident anchors**: 12 neighbourhoods and 12 unique coordinates, one per validation cell. The semantic/visual/identity/scope/time/marker fixture evaluator passed 59/59 checks. The additional fixture test suite passed and challenges orphans, changed quotes, altered asset bytes, wrong profile, hidden nearest neighbours, stale vectors, mixed model dimensions and false capture assertions.

The local catalogue browser check passed: 32 cards, four loaded images, source disclosures and all asset links, no browser errors, and no horizontal overflow at 760 or 390 pixels. See [review-verification.json](../testdata/evidence-intelligence/v1/review-verification.json). The final HTTP check confirmed the active Amsterdam profile, selected incident details, existing evidence summaries, existing person links and the POI catalogue were unchanged; the app remained healthy. See [live-anchor-verification.json](../testdata/evidence-intelligence/v1/live-anchor-verification.json). This is a scoped HTTP comparison, not a full native database fingerprint.

## Database handoff and remaining gates

`testdata/evidence-intelligence/v1/load.sql` is a generated data-only SQL*Plus/SQLcl loader for an already authenticated session. `CHECK` inserts in a transaction, validates counts, and rolls back; only `APPLY` commits. It checks active Amsterdam, case/person/incident references, occurrence times and localities. It preserves existing evidence, refuses differing duplicate references and uses short NOWAIT table locks to prevent concurrent profile mutation. No DDL, grants, incident edits, POI edits, deletion or snapshot recapture are included. Identity sequences can advance in a rolled-back check.

**The loader has not been executed against Oracle.** Test CHECK, repeatability, conflict rejection and rollback in an isolated application schema first. Compare protected-table fingerprints, verify live asset delivery and scoped endpoints, then plan the live addition and the separate saved-profile update. Until a saved-profile update is explicitly performed, a subsequent restore can remove active-only additions. Do not run a full snapshot capture merely to preserve this small pack: targeted saved-profile changes need their own reviewed before/after export.

Automatic approval review rejected the first native connection attempt because it would read database and wallet credentials from container metadata. That helper was removed. Source inspection continued through read-only app endpoints; no credentials were read by that rejected call, no database connection was established by it, and no schema or live data was changed. Native validation can continue through an explicitly authorised authenticated connection without harvesting container credentials.

Remaining release gates: native Oracle JSON/vector/spatial/graph checks, loader transaction and restore tests, scoped backend and asset endpoint, the production page and browser checks, then configured Select AI/agent tests. The local catalogue is a data-review artifact, not the deployed Evidence Intelligence page.
