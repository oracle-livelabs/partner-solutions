# Data Room — current workspace release

20 October: [Detective Room person links](detective-room-person-links.md) connects declared fictional handles, catalogue portraits and saved photo comparisons in the room and Crime Board.
Evidence-explorer update: 15 September 2026. Section D now presents [Money Flows](data-room-money-flows.md), [Messages](data-room-messages.md) and [People & Photos](data-room-people-photos.md) as [smart tiles with focused detail panels](data-room-capabilities.md), tested with SUGA and backed by separate native Oracle property graphs. Photo regions have saved vector candidates and explicit, audited review decisions; the former inline candidate panel is inside the new workspace. A separately versioned Money Flow agent pilot can explain a selected route search using three read-only registered tools. The original Connection Review team and Batch Assistant remain unchanged. The original workspace release notes below retain their historical sample IDs; use the linked guides for current SUGA walkthroughs.

## Resume the demonstration

For the current increment, open `Suga_Scene4.zip` (`DR-20260914-13f650e8-dfa8-450e`) and its **People & Photos** tile: three photos, ten saved regions, thirty pending candidate links. Compare a new region or inspect an existing one, review its crop/portraits and record a decision. All prepared candidates were deliberately left pending. The remaining instructions below describe the original baseline workspace.

Next testing focus: return to ZIP loading in section A. The [deferred scene-region search research](scene-region-search-research.md) records character/object retrieval ideas, possible future pipeline integration, and the ZIP-test checklist. Region matching is not part of the current loader.

Refresh the FU40 application on port **8706**, choose **Data Room** as `statewide_admin`, and open batch **DR-20260912-38be78f8-7a8c-448a** from section E. This is the original eight-file sample; all seven stages are now complete. The newer sample ending `80f1421b-cc57-491a` is a separate upload and has not been automatically submitted for analysis.

Section D contains the Batch Brief, connection graph and product downloads. Filter connections to **Declared synthetic cast** to show the three fictional people and their four links to the two staged photos. Selecting a source opens its exact saved description version in section C. Section F contains Select AI Chat and a conversation selector; the completed `Workspace live verification` conversation contains two replies and can be reopened after refresh or container recreation.

## What is implemented

| Section | Current capability |
| --- | --- |
| A | ZIP upload, progress, allocated Batch ID, original archive persisted in ADB |
| B | File-type counts, load time, uploader and stored sizes |
| C | OCI-generated descriptions, original previews/downloads, cited description versions |
| D | Seven stages; source-linked Batch Brief; connections graph and native ADB agent review; saved products |
| E | Scoped load history, including the generated brief title |
| F | Select AI Chat, saved questions/replies, source buttons and per-user conversation history |

Load, unzip, ingest, Identify/Describe and learning retain their existing Node workers and ADB persistence. Stage six uses Node to extract bounded original-text references and generate vectors, ADB `VECTOR_DISTANCE` to compare stored vectors, and a **native `DBMS_CLOUD_AI_AGENT.RUN_TEAM`** call to review the resulting graph through three registered tools. Stage seven deterministically saves an immutable review pack. This release does not claim that ZIP extraction or all seven stages execute as native ADB agent tasks.

The dedicated `CDR_CONNECTION_REVIEW_V2` team uses `CDR_INVENTORY_V1`, `CDR_BRIEF_V1` and `CDR_CONNECTIONS_V1`. Each tool requires the application's selected request ID, verifies the requesting user, and reads the saved context through scoped views. Tool calls are recorded in `CDR_AGENT_TOOL_EVENTS`; completion requires all three tools to have been invoked. No SQL-generation or external-action tools are assigned. The existing Ask IncidentData / Agent V2 configuration is preserved.

Chat calls `DBMS_CLOUD_AI.GENERATE(action=>'chat')` with the dedicated `CDR_WORKSPACE_AI_V1` profile. The application stores complete turn history in ADB and sends the previous five completed turns with current batch descriptions and the brief. Each turn has its own native Oracle conversation ID; application thread history is the durable conversational memory. Threads are private to their creator even when a statewide user can see the underlying batch. Context is limited to saved descriptions and the brief, not the full original archive or other batches. Source aliases such as `S1` are normalised to the manifest's `S01`; raw model output is retained separately. Unknown source references cause a visible failed turn.

## Graph and vector semantics

- Text vectors: existing `Xenova/all-MiniLM-L6-v2`, 384 dimensions, using saved headlines and descriptions. Image items also receive description vectors.
- Photo vectors: existing `Xenova/clip-vit-base-patch32`, 512 dimensions, using the complete image. These support **scene-to-scene** comparison, not facial identification.
- Vectors are stored as ADB `VECTOR` values in `CDR_BATCH_VECTORS`, with run, item, model, modality and source checksum. Cosine comparison retains up to 12 pairs per modality at score 0.35 or above; this is a demo display cutoff, not a calibrated confidence measure.
- Literal links record shared `DEMO-...` references and ISO dates from the first 24,000 characters of original text, with exact UTF-16 offsets. This is a limited demo reference extractor, not general-purpose entity resolution. The timeline lists date mentions, not independently verified events.
- Declared cast graph links require an exact checksum match to one of two packaged, explicitly fictional scene assets. User-supplied filenames never create person links. The optional [POI candidate panel](data-room-poi-candidates.md) now compares narratives and manually selected scene regions with authorised POI profiles; its session-only candidates do not alter graph links. No manual person-link editing is enabled.
- Connection-review nodes/edges and their provenance are stored in versioned ADB JSON and rendered as an interactive graph and table. The separate money-flow view now uses the native `CDR_MONEY_GRAPH_V1` SQL property graph; the existing connection-review graph is unchanged.
- The diagram shows up to 36 nodes; filtering/focusing and the full link table/export retain access to larger graphs. Limits: 1,500 nodes, 3,000 edges; oversized runs fail visibly.

The verified sample produced **15 nodes, 21 links**, including **4 declared cast links**, and all three native tool events. Source membership/offset checks establish provenance, not the truth of AI interpretations.

## Saved data products

Each successful connection run can create one reusable product version:

- `review.json`: graph, timeline, Batch Brief, agent review, source manifest and execution provenance.
- `manifest.csv`: file IDs, types, original checksums and cited description runs.
- `connections.csv`: typed links, scores where applicable, source references and basis.
- `timeline.csv`: dates, source files and exact original-text offsets.

CSV cells are quoted and spreadsheet formulas are neutralised. Product versions remain available after subsequent runs. Nothing is written into existing incident or POI tables.

## Persistence and recovery

Additive tables: `CDR_WORKSPACE_RUNS`, `CDR_BATCH_VECTORS`, `CDR_AGENT_TOOL_EVENTS`, `CDR_CHAT_THREADS`, `CDR_DATA_PRODUCTS`, plus three scoped views and the dedicated agent/profile objects. Queued runs persist in ADB. One active connection run and one active chat turn are allowed per batch; connections are reused when source fingerprint and implementation version match. Concurrent chat submissions receive a conflict response. Threads are limited to 100 turns.

The worker uses a ten-minute lease. If an in-flight execution is interrupted, its result may be uncertain at the remote provider; after lease expiry it is marked failed and requires a new explicit request. Saved prior work remains available. Source-description fingerprints are rechecked before committing results. Oracle calls have a 180-second per-round-trip timeout. These are demo-user access scopes, consistent with the existing app.

## Deployment

The workspace backend was released in **`local/adelaide-crime-intelligence:cdr-workspace-20260912`**. The current FU40 image is **`local/adelaide-crime-intelligence:cdr-explorer-v1-20260915`**, pinned in `compose.fu40.yml`, retaining Money Flows, Messages, the [Person Intelligence search UI update](poi-visual-search-ui.md) and existing workspace changes. See the [explorer migration notes](data-room-capabilities.md) for the additive capability-status and Money Flow agent objects. `.containerignore` restricts full-build inputs and excludes credentials, datasets and dependency directories. The other IncidentData app on port 8705 is unaffected.

Apply migrations in order when setting up another database, using its existing application environment:

```sh
node scripts/setup_data_room.js
node scripts/setup_data_room_descriptions.js
node scripts/setup_data_room_learning.js
node scripts/setup_data_room_workspace.js
node scripts/setup_data_room_money.js
node scripts/setup_data_room_messages.js
```

The workspace script uses the existing IncidentData credential/provider settings to create a separate versioned profile/team. Re-running it leaves existing versioned profile/team settings intact. The money-flow and message scripts add their separate scoped native graphs and tables. None of these setup scripts enqueues inference.

For a later FU40 redeployment from this checkout:

```sh
podman build -f Containerfile -t local/adelaide-crime-intelligence:cdr-explorer-v1-20260915 .
node scripts/redeploy_data_room_workspace.js
```

The redeploy helper reads the current FU40 app's connection settings into memory, validates the expected schema and port, and recreates only that service. It does not write credentials to a file. Initial pre-extension module/UI backups remain at `/tmp/crimedata-workspace-backup.3gNgNT`; original archive and item data remain in ADB.

## Verification

```sh
npm test
npm run build
node scripts/test_data_room_workspace_live.js --run-synthetic-tests --batch=DR-20260912-38be78f8-7a8c-448a
```

The explicitly opted-in live script runs connections if needed, reuses completed work, saves/reuses products, creates a test conversation with two OCI-backed Select AI replies, checks reopening, verifies user isolation and compares original checksums. It leaves named verification conversations in history, including failed attempts for traceability.

The optional `scripts/test_data_room_workspace_browser.cjs` uses Playwright to check seven stages, cast filtering, source navigation, persisted chat and 760/600px layouts. Playwright is available in the existing temporary browser-check installation; it is not a runtime dependency.

Oracle references: [Select AI Agent package](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/dbms-cloud-ai-agent-package.html) and [Select AI chat/conversation APIs](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/dbms-cloud-ai-package.html).
