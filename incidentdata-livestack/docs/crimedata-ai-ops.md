# AI Opps

A stack-wide, read-only observability page immediately after **Data Room**.
The Data Room's **View AI activity** button opens it for the selected batch.

## Dashboard

- Summary: direct LLM attempts, native invocations, reported tokens, vectors,
  failure/retry records, average AI duration and a separate workflow average.
  Local inference tokens are distinguished from cloud-provider usage.
- UTC daily usage, usage by application area and model, and five workflow tiles.
- Filters: 1/7/30/90 days, area, model, batch, activity type, status, token coverage,
  registered operation, user/job (administrator only), and related trace.
- A 25-record paginated, scrollable ledger. Details open in a keyboard-accessible
  modal with metadata, usage breakdown, bounded prompt/response excerpts, original
  request/conversation IDs and source-batch navigation.
- Opening or refreshing the dashboard never calls an LLM or reruns a workflow.
- Expand **Registered operations (31)** for the code-owned operation inventory,
  measurement scope, records/failures and last observed time. Counts obey all
  filters and ownership rules. Zero records is not proof of zero AI usage.
  Pre-retrofit records have no registration ID; they remain in historical totals.
- Administrators see separate web-app and Detective Room collector health.
  Worker heartbeat is stale after 45 seconds; a running old worker without
  telemetry is explicitly marked uninstrumented, not healthy coverage.

## Measurement contract

`ai_ops_events` is a separate Oracle JSON ledger with indexed scalar metadata.
`ai_ops_import_state` records the one-time historical import cutoff. There are no
foreign keys or cascades into operational/source tables and no agent/profile changes.

| Activity | Capture |
| --- | --- |
| Data Room Identify/Describe and Batch Brief | Each application attempt, provider usage/request ID, validation failure, duration, model, batch, source, run and bounded text excerpts. Image bytes are omitted. |
| Ask IncidentData V2 | Each Select AI SQL-generation invocation, including the explicit correction retry. Native tokens remain unavailable. |
| Native Agent V2, Data Room Connections/Chat/Money AI | Native invocation, original prompt/answer excerpt, conversation/team ID and duration where available. Not an invented count of internal model calls. |
| Ask Detective and first-cut hunch | Native invocation, profile, conversation, batch/run and citation validation. Profile names are not reported as model IDs; native tokens remain unavailable. |
| Detective Room publishing | Each source chunk, scene-image description and overview attempt, including corrective retries and rejected output usage. Model/region, source/run/request IDs and bounded text excerpts are recorded; image bytes omitted. |
| Detective Room local speech | Kokoro process duration, input characters/scenes and completed scene count. Not an LLM call or cloud-token usage; audio and speech text are not retained by AI Opps. |
| Evidence Intelligence | Native Select AI/agent reviews, profile/run/citation validation; query vectors recorded through shared embedding helpers. |
| Guided Ask, guided Agent Console, case-readiness and guided incident requests | Non-LLM workflow activity, separate from model calls and tokens. |
| Local CLIP/MiniLM vectors | Inputs, dimensions, generated-vector count and duration, including initial model loading. No cloud-token usage. |
| OCI embedding operations | Model, input count/characters, generated vectors, request ID and provider usage when returned. Includes document ingestion and transient semantic-search query vectors. |
| Incident OCI/Ollama helpers | Separate SQL/answer stages, explicit SQL-correction attempt numbers, empty/invalid SQL output failures. OCI usage when returned; Ollama token counts are local processing, not cloud billing. |
| HTTP and queued workflow outcomes | Separate end-to-end records for AI requests, description/brief runs, connections/chat/vector workspace runs, money reviews and room publication. Includes downstream source/tool/validation/persistence failures; no extra model calls or tokens assigned. |

Provider totals are authoritative. Missing totals are **unavailable**, not zero;
known zero remains measured. Local embeddings and no-model workflows are **not
applicable**. Dimensions are not tokens. Reasoning counts are shown but never
added again to a provider total. An embedding vector being generated does not
claim that its later database insert committed.

Provider success is distinct from application success. A rejected model response
can still consume reported tokens. Direct/native validation is captured within
the measured attempt where practical; downstream failures also appear as a
workflow outcome. A failed child and failed parent are two failure **records**,
not two distinct failed user requests. Workflow durations include child activity
and must not be added to model durations. Local speech is measured at process
level, not individual neural synthesis chunks. Client initialisation failures
are failed attempts with no reported provider usage, not proof a call was sent.

Historical imports use saved evidence only. Eight recorded description attempts
provided 22,075 tokens at initial setup. Older audit exchanges do not establish
individual call/retry counts, so they are classified **historical**, not counted
as direct calls or native invocations. Original prompts and usage are not
reconstructed. The initial import inspected 107 saved records from the preceding
90 days and is idempotent; later calls use live capture.

The application schema returned ORA-00942 for `V$CLOUD_AI_SQL` during inspection.
Its native agent history exposes execution metadata, not a per-call token meter.
The collector does not change grants, agent configuration or model profiles to address this.
Native internal LLM calls and SDK-internal retries remain explicit coverage gaps.
Arbitrary external scripts/direct database calls bypassing the instrumented
helpers are not observed. Prior vector-compute history is not reconstructed.
Offline fixture generators (`scripts/care-trust*/embed.cjs` and
`scripts/evidence-intelligence/embed.cjs`) run their own local pipelines and are
not app-runtime capture. Demo SQL scripts can also invoke native AI outside this
collector. Deterministic graph rendering/layouts, message parsing, maps, data
restores, saved-vector comparisons and video rendering are not new model calls.
Where these are part of a recorded AI workflow, only the workflow's elapsed time
includes that processing. SDK retries hidden inside an invocation, abrupt process
termination and activity before deployment remain explicit gaps.

## Reliability, scope and retention

- Async-local context attributes requests and background workers without sharing
  one user's context with another. Embedding-based standalone loaders using the
  shared helpers initialise a separate writer from their application environment;
  these appear as `background_job`, with the script name and a process trace.
- Queue jobs begin with a fresh context (owner, batch and run), never the context
  of a request that woke the worker. The publishing worker uses its own independent
  telemetry connections; evidence-read transactions remain read-only.
- Writes are best-effort, independently committed, bounded to 100 pending events,
  and never retried by rerunning an AI operation. Logging failure does not change
  the original response/error. Administrator coverage shows dropped records for
  the current process. In-flight events can be lost on abrupt process exit; this
  is not a billing-grade or exactly-once collector.
- The collector's short database-write timeout is restored before its pooled
  connection is released. It must never shorten subsequent AI/database calls.
- Non-admin users see only their own records. Statewide administrators see
  stack-wide operational metadata, but another user's prompt/response/error
  excerpts remain hidden. Existing conversation-history ownership is unchanged.
- Uses the existing `X-Demo-User` demonstration identity mechanism, not new
  production authentication. Common secrets are redacted; excerpts are bounded
  to 12,000 characters (errors 2,000). No embedding input bodies, raw image bytes
  or embedding arrays are retained. Redaction is not a comprehensive DLP system.
- No automatic purge is introduced. The ledger survives dataset restores and
  Data Room source deletion; source links can then become unavailable. Define
  production retention/access controls before using non-demonstration data.
- No cost estimates, alerts, autonomous remediation or model-routing changes.

## Setup and verification

Run `node scripts/setup_ai_ops.js` inside the existing FU40 app environment before
enabling capture. It creates only the new ledger/state tables and indexes, imports
saved records without AI calls, and leaves original history/results unchanged.

Checks:

```sh
node --test --test-reporter=dot test/*.test.js
npm run build
node scripts/check_ai_ops_live.js
NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules node scripts/test_ai_ops_browser.cjs --local
NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules node scripts/test_ai_ops_live_browser.cjs
```

The Oracle integration script uses 33 rollback-only fixtures to check UTC time,
JSON, totals, duplicate safety, paging, operation filters, scoped registration
counts, separate local/cloud tokens and AI/workflow averages, and owner/admin separation. The
mocked browser test covers keyboard focus/return, mobile widths, escaped content,
empty filters, retrying reads, related traces and user changes, with GETs only.
The optional `--exercise` live-browser flag makes bounded normal queries and
embedding searches; their genuine usage/audit records persist, not source changes.
An initial verification caught a pooled-timeout regression; its real failed
invocation is retained in the ledger. The isolation fix has its own regression test.

## Current retrofit — 30 September 2026

The runtime sweep found untracked Ask Detective/first-cut calls, publishing-worker
model attempts and local speech processing. It also found incomplete retry/stage
labels, profile-as-model labels and downstream failures invisible to call-level
metrics. These are now registered in `backend/ai-ops-registry.js` and instrumented.
All existing backend direct OCI, Oracle-native and local model boundaries were
reviewed; a boundary-inventory regression test flags newly added call sites.

This is additive observability: no schema migration, historical reconstruction,
source replay, model/profile changes or changes to DDS access controls. Existing
848 records and 1,491,232 reported tokens were unchanged during read-only candidate
verification. Newly recorded operations carry stable registration IDs.

App image: `localhost/adelaide-crime-intelligence:ai-ops-sweep-20260930`.
Worker image: `localhost/crimedata-detective-worker:ai-ops-sweep-20260930`.
Build overlays: `scripts/Containerfile.ai-ops-sweep` and
`scripts/Containerfile.ai-ops-worker`. Only the FU40 port-8706 app and its named
publishing worker are replaced. The worker overlay preserves its accepted source
adapters, pinned voice models and renderer rather than replacing all backend files.

Rollback app image: `localhost/adelaide-crime-intelligence:oracle-layouts-20260930`.
Set only the compose image back and run `node scripts/redeploy_data_room_workspace.js`
in the existing protected host environment after verifying queues are idle.
The previous worker is retained, stopped, as
`detective-room-worker-before-aiops-20260930`: stop/rename the new worker, rename
that retained container back to `detective-room-worker`, then start it. Do not
restart while jobs are queued/in progress. No ledger or source deletion is needed.
Worker image rollback ID:
`3a6999f526e865657319d1861e6a0b26134bfd84f2574d41d41e8f1b05f1d9aa`.

Release checks and non-secret before/after manifests are under
`/tmp/crimedata-aiops-sweep.9v1pCD` on the deployment host. Retain them elsewhere
if long-term operational evidence is required; `/tmp` is not archival storage.

Acceptance results:

- All 38 Node test-runner checks passed, including injected-provider tests for
  native citation failures, Detective retries, incident stages, malformed vectors,
  fresh queue context and local-speech classification. Backend syntax checks and
  the frontend build passed; the existing large-bundle warning remains.
- FU40 aggregation/access tests passed with 33 rollback-only fixtures. A separate
  process inside the deployed worker verified its independent telemetry writer,
  operation ID and owner attribution with an insert/query/rollback probe.
- Mocked dashboard browser tests passed (registration filter, collector notice,
  pagination, owner switch, keyboard focus, escaped content and mobile details).
  Live GET-only AI Opps tests passed; dashboard reads added zero activity records.
- Live native Oracle Graph layouts and messaging-space regressions passed, with
  no writes or browser errors. Deployment manifests verified unchanged settings,
  mounts, existing published-package checksums, the checked source batch, SDK
  assets and unrelated running containers. All six queue counts were zero at
  preflight. The disposable read-only canary was removed; rollback images and the
  old worker container remain available.
- Final health was healthy with 31 registered operations, 848 existing records
  and 1,491,232 reported tokens. Both live collectors reported zero drops. No
  real provider or speech calls were made solely for this verification: future
  model-backed runs are instrumented but were not exhaustively replayed live.

Verified app image ID:
`13ad97cd802374fe7a4f3271741cb133834fea1dcf054b77694db2dc4ea538e2`.
Verified worker image ID:
`aad94829dcc72787c2a4656b205a732aa4c89498f797cc0e671f869e8b301a6c`.

## Original V1 deployment / rollback (historical)

Image: `local/adelaide-crime-intelligence:ai-ops-v1-20260915`, built with
`scripts/Containerfile.ai-ops` on the previous known-good app image. Only FU40
`app-fu40` on port 8706 is recreated; all five Data Room active-worker counts were
zero before the first deployment. Dependencies and protected environment values
are reused, not replaced.

Final image ID: `3908d914be3ef6060b09bf82706975585ec0b8c1edebd4dff885c14865122182`.

Rollback image retained: `local/adelaide-crime-intelligence:agent-history-v1-20260915`.
Repoint only `compose.fu40.yml`'s image and use the existing protected redeploy
helper. No table/data deletion is necessary for rollback; the additive ledger
remains available and the older image simply does not display or capture it.

The frontend build retains its pre-existing >500 kB bundle warning.

## Acceptance results — 15 September 2026

- 135 unit/regression checks passed, including timeout restoration and the prior
  Ask IncidentData V2 long-CLOB regression.
- Oracle integration passed against the deployed schema; all 29 fixtures rolled back.
- Mocked AI Opps browser checks and the existing conversation-history regression
  passed, including 600/390-pixel dialog layouts and no browser exceptions.
- Live guided Ask, guided Console, local text/image searches and OCI semantic
  search succeeded and were attributed to their application areas. The OCI
  embedding response reported six tokens; local embeddings remained not applicable.
- Live Ask IncidentData V2 saved five Norwood results (audit 218). Both native SQL
  generation calls, including its explicit correction retry, were recorded.
  Their 4.9/2.4-second durations verify they were not limited by the collector's
  two-second write timeout. Seven new records were saved after the corrected
  deployment, with zero collector drops at the check.
- The deployed dashboard, scoped details and Data Room context link passed
  read-only checks; opening them added no activity records. Native agent teams
  and Data Room descriptions were not rerun solely for this dashboard test;
  their adapters are covered by unit tests and retained historical usage.
