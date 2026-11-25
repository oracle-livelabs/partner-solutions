# Batch exploration: tiles, detail workspaces and agent tools

Approved direction: 15 September 2026. Simplify the page first, then prove one bounded read-only Money Flow agent extension with SUGA. The next increment adds [People & Photos](data-room-people-photos.md): a third tile, saved manual-region comparisons and a separate review graph. It does not extend the agent.

## Shared contract

`GET /api/data-room/batches/:id/capabilities` is a scoped, read-only metadata endpoint. Each capability exposes its ID, availability, status, analysis version, counts, coverage, warnings and supported navigation action. Money/Messages additionally expose their single saved snapshot/fingerprint; People & Photos has independently versioned region comparisons rather than a batch build. No LLM call, graph traversal, build or identity inference is needed to show a tile.

Discovery uses recognised CSV headers, the structured TXT conversation header, and Oracle JSON checks for a top-level `messages` member. It does not claim that all records validate. CSV/TXT discovery reads at most 32,767 bytes per file; JSON checks are bounded to the 2 MiB message-source limit. Ambiguous/malformed or oversized sources are flagged for inspection, not silently classified as absent. Exact whole-document validation and source checksums remain the responsibility of the existing explicit build actions.

Statuses: `waiting`, `ready`, `results`, `stale`, `needs_attention`, `unavailable`. The complete response always includes every implemented capability. The normal view shows relevant tiles; discovery details expose unavailable capabilities and coverage. Build failures are recorded against the source fingerprint and remain visible after refresh. A successful explicit rebuild clears the previous failure. Ordinary navigation never triggers an analysis.

## Detail workspaces

Money Flows and Messages move out of the long batch pipeline into one large native dialog. Views mount only on first opening; closing retains their controls for that selected batch and user. Switching batch/user discards the session state. The dialog traps keyboard focus, supports Escape, restores focus and the page position, and uses an internal source inspector rather than nested dialogs or a hidden page preview.

The existing connection-review agent, Batch Assistant, batch brief, graph algorithms and source records are unchanged by the presentation work. Important warnings remain visible; provenance and method details are expandable.

## Money Flow agent pilot

The implemented pilot uses the separately versioned native team `CDR_MONEY_REVIEW_V2`, agent `CDR_MONEY_REVIEWER_V2` and task `CDR_MONEY_TASK_V2`, with the existing provider profile `CDR_WORKSPACE_AI_V1` unchanged. Three custom PL/SQL tools read a frozen request context: `CDR_MONEY_SUMMARY_V1`, `CDR_MONEY_ROUTES_V1` and `CDR_MONEY_EVIDENCE_V1`. They expose the same money snapshot, summaries, Oracle route-query results and source locators as the graph. The application executes the existing bounded graph searches before the agent review; this first pilot explains the analyst's selected search rather than letting the model choose arbitrary endpoints or execute arbitrary SQL. Registration follows Oracle's [custom-tool and task framework](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/dbms-cloud-ai-agent-package.html).

User/batch/request/snapshot scope is checked independently of model arguments. Tools require the application's request ID in session context, a matching owner, and an active leased request. Evidence access is read-only; the application writes only review/audit metadata. Tool events and raw/validated answers are retained. Completion requires all three tool events and known bracketed transaction citations. Citation validation establishes references, not the truth of every generated interpretation. No evidence writes, calibrated risk scoring, automatic POI identity links, arbitrary SQL, external actions or changes to the existing agent team are permitted.

V2 additionally requires exact labelled gross-transfer-volume and selected-destination-inflow facts, including the currency, and compares them using integer decimal arithmetic against the saved summary. Conflicting numeric gross-volume claims are rejected. No per-route financial total is defined. The agent is instructed to describe routes as names/citations, not to invent per-route allocations or totals. These checks do not establish the truth of every qualitative interpretation; explanations remain reviewable drafts.

`POST /batches/:id/money-agent` requires a saved current money `runId`, start/end account IDs, currency, optional dates, maximum 1–4 hops and an optional question of at most 1,000 characters. It saves a queued review and returns 202. Context is limited to 160,000 UTF-8 bytes. The existing graph limits still apply. Only one active Money Flow review is permitted per batch. `GET /batches/:id/money-agent[?runId=…]` returns the current user's latest or selected review, context, tool events and source-staleness flag. Reviews are private to their requester, including when another user can see the batch.

The native call has a 180-second per-round-trip timeout and a ten-minute lease. The durable worker handles explicit queued requests only; expired running requests fail visibly and are not automatically replayed. Closing a panel does not cancel the requested review. Failure does not disable direct graph use. A changed route selection hides graph links for an older answer; saved outputs remain available for reference. Source inspection and route highlighting use validated IDs from the stored deterministic context, never model-generated navigation URLs.

SUGA acceptance: four supported three-hop routes, all ten original transfer citations, AUD 4.5 million gross transfer volume versus AUD 1.5 million received by Hartley, and explicit warnings about shared transfers, unknown same-day ordering and unproven continuity of funds. Direct graph exploration continues to work if the agent fails.

## Deployment and verification

FU40 port 8706 only; image `local/adelaide-crime-intelligence:cdr-explorer-v1-20260915`. Previous `cdr-messages-v1-20260914` remains available as an application rollback image. Migrations are additive: run `scripts/setup_data_room_capabilities.js` and `scripts/setup_data_room_money_agent.js` in the existing FU40 environment before publishing the app. They do not enqueue inference. Do not rerun the original workspace migration just to deploy this change.

New tables: `CDR_CAP_FAILURES`, `CDR_MONEY_AI_RUNS`, `CDR_MONEY_AI_EVENTS`, with scoped views. Batch removal checks for active pilot reviews and deletes their audit/review children before the original money snapshot. Nonparallel DML hints follow the existing lifecycle safeguards. Originals and existing money/message snapshots are preserved.

- `test/data-room-capabilities.test.js`: signatures, ambiguity, fingerprints, status/coverage and initial scope checks.
- `test/data-room-money-agent.test.js`: bounded selection, exact context, citations and initial scope checks.
- `scripts/verify_explorer_edges_live.js`: uncommitted, rollback-only Oracle fixtures for discovery, saved failures, private review scope, injected native failures, required tools, unknown citations, stale/busy requests and deletion order. No model calls.
- `scripts/verify_suga_money_agent_live.js`: real native SUGA review, three tool events, all ten source citations, four routes and unchanged sources, snapshots, stages and original workspace. Reuses a completed review unless `--new` is supplied.
- `scripts/test_suga_explorer_browser.cjs`: no automatic analysis/graph loads, lazy opening, retained state, focus trap, Escape, return position and 760/600/390-pixel layouts.
- Existing SUGA Money/Messages browser regressions now enter through the tiles.
- `scripts/test_suga_money_agent_browser.cjs`: saved answer, original-record citations, graph links, changed-selection warning, private scope and reload persistence. `--new` explicitly requests one additional native review and verifies background completion.

One initial SUGA pilot (`77d8c8f7-ad55-4733-88f1-5668f48e45e7`) completed its native tool calls but failed to save the answer because `:raw` is a reserved Oracle bind name. It is retained as a failed audit record; the code uses `:rawAnswer`. The corrected bind-error pilot completed successfully. No source evidence was deleted or altered.

The browser-requested V1 review (`1b9385ea-8c33-4ab2-8483-a6813ea1cc06`) passed citation/navigation checks but a subsequent content review found invented per-route gross totals. Its displayed result was withdrawn and the run marked failed; its complete raw answer, tool audit and input context remain retained. This finding drove the V2 amount checks. The earlier V1 team remains registered only as historical configuration; new requests use V2.

Final V2 SUGA review: `51946d41-2656-4bbe-8d3c-debe77d00e81`, completed with all three native tool events, all ten original transaction citations, four three-hop routes and validated gross/destination-inflow facts. Final running image SHA: `22d15b7e724b77ba9f5fdbe7a94f17fb29a5ef74797e2fcb34d73b1d35907b0a`. Fifteen local test files pass; rollback-only Oracle edge cases and deployed browser tests cover the new boundaries.
