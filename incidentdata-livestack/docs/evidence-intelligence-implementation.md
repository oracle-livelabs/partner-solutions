# Evidence Intelligence — Amsterdam pilot

Map hotfix, 24 September 2026: the Evidence Intelligence basemap now uses the same Esri World Light Gray service as the other application maps. The app's `no-referrer` security policy is unchanged. A failed tile request shows a warning without removing incident markers; reopening the Map tab retries. Verification now checks actual tile HTTP responses and decoded image dimensions, plus simulated 403 handling and recovery. The original map test checked only the map container and did not catch the OpenStreetMap denial. See [map-fix release receipts](../evidence_map_fix_20260924/deployment.json) and [live map check](../evidence_map_fix_20260924/live-map-check.json). This release changes no backend code, database schema or evidence records; normal application telemetry may still record test requests.

24 September 2026. Target: FU40, `CRIME_DATA`, application port **8706**. The user explicitly authorised database access, additive loading and page implementation. The initial local-only preparation is superseded by this implementation. Test and release receipts are in [evidence_intelligence_20260924](../evidence_intelligence_20260924/).

## Dataset and teaching story

The pilot extends **AMSTERDAM_DATA_V1**, which was already active. It does not switch cities, create incidents, change POIs or broaden entitlements.

| Thread | Existing case | Incidents | Fictional context contacts |
| --- | --- | ---: | --- |
| Payment-document anomalies | CASE-AMS-2026-02 | 6 | Philip Vandamm, Mara Vega, Elias Grant |
| Worksite storage and tools | CASE-AMS-2026-05 | 6 | George Horner, George Kaplan, Clara Thornhill |

There are **32 items**: 12 document/observation extracts, 12 contact notes, four generated object images and four controls. Each has a stable reference, exact source text, SHA-256 checksums, synthetic provenance and incident linkage. The images illustrate descriptions, not recovered exhibits. Twenty-eight text assets and four PNG assets accompany the pack.

The narrative-quality skill informed variation and detail checks. The spatial-data skill informed preserving approximate points and location roles. The image-generation skill produced the four fictional object photographs. [image-prompts.json](../testdata/evidence-intelligence/v1/image-prompts.json) records their prompts and origins.

The page includes three walkthrough shortcuts:

1. **Payment paperwork:** compare P01/P02, inspect namespace-qualified markers, follow incident context and open N01/N02 for literal name mentions. Existing incident–POI associations and source mentions remain different link types.
2. **Compare object images:** select V01 and choose **Compare images**. V02 should rank first; the orange organiser V03 remains a plausible distractor. Scores are cosine similarity, not identification confidence.
3. **Shared-code caution:** compare P03/W03/C01/C04. `K-204` occurs in dispatch-form, inventory-form and blank-form namespaces; it does not establish a cross-case link. C04 deliberately contains hostile quoted instructions.

Other controls include a balanced ledger, stock checklist and P05's unknown currency. The evaluation answer key stays outside the indexed corpus and deployed image.

## What actually runs in Oracle

| Capability | Implemented path |
| --- | --- |
| JSON | `EVIDENCE_ITEMS.EVIDENCE_METADATA`, scoped projection and `JSON_TABLE` exact-marker filtering |
| Text vectors | `EI_TEXT_VECTORS`, 32 × `VECTOR(384,FLOAT32)`, MiniLM query embedding and Oracle `VECTOR_DISTANCE` |
| Image vectors | `EI_IMAGE_VECTORS`, four × `VECTOR(512,FLOAT32)`, CLIP comparison using a visible image |
| Spatial | `SDO_GEOM.SDO_DISTANCE` over scoped approximate incident points, in kilometres |
| Property graph | Actual `GRAPH_TABLE(CRIME_CASE_NETWORK ...)` traversal; incident and POI vertices joined to secure views |
| Select AI | `DBMS_CLOUD_AI.GENERATE`, **chat** action with scoped source JSON; no generated SQL execution |
| Native agent | `DBMS_CLOUD_AI_AGENT.RUN_TEAM`, `EI_REVIEW_TEAM_V1`, two request-bound tools and a fresh conversation |

Installed release verified: Oracle AI Database 26ai, 23.26.3.3.0. Both AI paths use the existing enabled `CDR_WORKSPACE_AI_V1` profile without changing it. Tools `EI_SOURCES_V1` and `EI_CONTEXT_V1` log invocations in `EI_REVIEW_EVENTS`. No SQL-generation tool or case-changing action is assigned.

Oracle documents the [chat action's supplied-data approach](https://docs.oracle.com/en/database/oracle/oracle-database/26/selai/use-chat-action.html) and [native agent package](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/dbms-cloud-ai-agent-package.html). Local native executions, not package presence alone, underpin the claims above.

## Page and API

Open **Evidence Intelligence** below Person Intelligence. Use Statewide Administrator for this Amsterdam pack. The other four existing personas have no entitlement to these incidents; they see an empty state, not substitute data.

The page has a scoped register, text/type/case/exact-marker filters, semantic search, selected-image comparison, source downloads, provenance/timestamps, typed links, a map, native JSON and source-cited AI drafts. Incident/case buttons open existing pages. Dates use the active profile's time zone.

| Route under `/api/evidence-intelligence` | Purpose |
| --- | --- |
| `GET /` | Authorised pilot register; text, type, case and namespace/value filters |
| `GET /:ref` | Scoped source detail; POI bindings independently filtered |
| `GET /:ref/asset` | Reauthorised asset with safe path, MIME and checksum checks |
| `GET /:ref/relationships` | Native graph paths, case context and literal mentions |
| `POST /search` | Text query or selected-item text/image vector comparison |
| `POST /nearby` | Native spatial radius search around a visible item's incident |
| `POST /review` | Select AI or native-agent review of 1–6 visible items |

This bounded pilot lists at most 100 items; its pack has 32. General evidence ingestion, larger-corpus pagination, arbitrary image upload, date-range filtering and operational custody workflows remain later extensions.

## Scope, trust and provenance

Database security views filter candidates before top-K and distance results. Native graph queries re-check every returned incident and POI vertex; graph privileges alone are not treated as row security. Assets are outside the public frontend tree. The UI fetches them with the current demo-user header before creating browser-local blob URLs.

A visible document may contain a name without granting access to a registered POI binding. This demonstration uses the existing `X-Demo-User` selector, **not production authentication**. Entitlements are unchanged. Offline contract tests cover positive partial scope; native tests cover the administrator and four existing zero-access personas. No test entitlement was added to FU40.

AI receives only selected scoped sources and typed context. Native tools require an owner-bound, active-profile, unexpired request and matching session `CLIENT_INFO`. Each review gets a fresh conversation; pooled sessions clear conversation state afterwards. A profile/source visibility change during generation prevents release. Audit records are additional records, not evidence/case edits.

Drafts are rejected if citations are absent or unknown, including invented context references such as `[S1]`. Agent drafts also require both actual tool calls. These checks validate references and execution, **not every factual interpretation**. Drafts remain unreviewed and need human checking. C04 also produces a deterministic source warning. AI Opps records invocations; internal provider token counts are unavailable, not fabricated.

Occurrence, fixture authorship, simulated receipt and actual ingestion are distinct timestamps. Capture time/location are unknown. Map points are approximate incident context; orange locality references are not physical-event locations. Checksums establish artifact integrity, not historical custody.

## Loading and restore persistence

`setup.cjs` creates additive vector, scoped-view and native-review objects. `load.cjs` validates source anchors, takes NOWAIT locks, refuses differing duplicates and inserts only missing rows. Default mode stages then rolls back; `--apply` commits. Connection credentials are not logged or saved.

The rollback test was followed by the authorised commit:

- Live evidence: **6,009 → 6,041**.
- Saved Amsterdam evidence: **6,009 → 6,041**.
- Text/image vectors: **32 + 4**.
- Other saved profile evidence counts: unchanged.
- Idempotence rerun: zero added rows/vectors, rolled back.

Saved links use saved incident IDs resolved through stable references. The existing restore package remaps regenerated live incident IDs when copying evidence. Vector caches use profile code, stable reference and source hash, with no live identity-key foreign keys. A disruptive full profile restore was **not** invoked for testing; saved/live parity and the deployed remapping contract were checked.

Receipts: [preflight](../evidence_intelligence_20260924/preflight.json), [rollback test](../evidence_intelligence_20260924/load-check.json), [commit](../evidence_intelligence_20260924/load-committed.json), [idempotence](../evidence_intelligence_20260924/idempotence.json), [native verification](../evidence_intelligence_20260924/native-verification.json). The older generated `load.sql` is an active-only handoff artifact; use the Node loader for live-plus-saved loading.

## Reproduce and release

```bash
node scripts/evidence-intelligence/evaluate.cjs
npm test
npm run build
# Explicitly authorised FU40 operations; DDL is separate from the data transaction:
node scripts/evidence-intelligence/setup.cjs
node scripts/evidence-intelligence/load.cjs
node scripts/evidence-intelligence/load.cjs --apply
node scripts/evidence-intelligence/verify-native.cjs --ai
```

The fixture evaluation passed 59 checks. Native verification covers JSON, vector ranking versus offline cosine, spatial inclusion/exclusion, graph paths, all five personas and real AI calls. Browser verification covers assets, semantic/visual ranking, map/graph/JSON views, user switching, direct forbidden asset access and responsive layouts. Run the browser script with Playwright available; `--live` targets 8706, otherwise 18706.

Deployment overlays only the three changed/new backend files, built frontend and scoped assets onto the existing FU40 image. The isolated build context has no credentials, weights or answer key. `build-image.cjs` and `deploy.cjs` preserve runtime settings, ports and mounts; unrelated backend files are hash-checked. Failed verification recreates the previous image. The previous image and [rollback overlay](../evidence_intelligence_20260924/rollback-image.yml) remain available. App rollback does not delete the additive database pack.

See [deployment.json](../evidence_intelligence_20260924/deployment.json) and [live-browser.json](../evidence_intelligence_20260924/live-browser.json) for the final release outcome. No git commit or push is performed automatically.
