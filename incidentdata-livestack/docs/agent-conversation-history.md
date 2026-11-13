# Saved conversations from the JSON audit panel

15 September 2026 · FU40, port 8706.

Audit entries in IncidentData AI Agent Console now open a read-only **Saved conversation** dialog. The main page keeps its compact eight-entry feed. Full exchanges are fetched only when opened, with ten exchanges per page; the initial page contains the clicked entry. The viewer supports keyboard navigation, Escape, focus return, mobile layouts, loading/error recovery, and expandable saved SQL, result tables, audit details and response JSON.

## New and historical records

New guided console runs, Ask IncidentData V2 questions, native Agent V2 runs and case-readiness briefs retain their server-produced responses in `ANALYST_ACTIONS.PAYLOAD`. The original request is stored alongside the response snapshot, workflow metadata, a server-generated `historyThreadId`, `historyVersion: 1`, and completion/failure status. A CLOB bind avoids a short-text limit when inserting the JSON. Response snapshots use the existing presentation formatting so the archived response matches what the app displayed. Existing raw metadata, such as generated SQL, is also retained.

Successive questions in the same open guided or Ask IncidentData V2 interface share the saved thread. Guided **Clear**, closing/reopening Ask IncidentData V2, changing the demo user, or native **Start new case memory** starts a new thread. Case-readiness requests share a thread while the same scenario remains selected. Saved history does not introduce conversational model memory to guided queries or Ask IncidentData V2.

Older rows are not modified or backfilled. If no response snapshot exists, the viewer explicitly shows **Limited historical record** and the original question/details only. Historical native rows can be grouped by their recorded native conversation identifier, but the reader does not query expired model memory or fabricate missing answers. Other legacy application action types remain readable as limited records unless their producer stores a response snapshot.

Failed guided, Ask IncidentData V2 and native requests are saved as failed exchanges when history preparation has succeeded. A history-storage error does not discard a successful answer: the interface displays a warning that the exchange was not saved. A failed case-readiness preparation does not currently create a saved exchange.

## Access and read-only behaviour

- `GET /api/agents/actions` returns compact metadata for the selected demo user's latest eight actions, without response snapshots.
- `GET /api/agents/actions/:id/thread?page=N` checks the entry's owner before reading its thread; every related query is constrained by the same user and workflow.
- A supplied continuation thread must already belong to that user and workflow. Native conversation identifiers must also match the owned record before invoking the native team.
- Opening, paging, closing or retrying the viewer executes only history SELECTs. It cannot rerun saved SQL, invoke AI, edit a record, or resume a conversation.
- Switching demo users remounts the console/Ask page and cancels outstanding history reads, avoiding a stale display from the previous persona.

This uses the existing demo-user header mechanism, not new production authentication. It remains an application history table, not an immutable audit service. Existing city-profile backup/restore and reset behaviour for `ANALYST_ACTIONS` is unchanged; restoring a dataset can replace its active audit history. The archive is separate from the native agent's short-lived model memory.

## Implementation and verification

- `backend/agent-history.js`: storage, ownership validation, compact feed and paginated history.
- `backend/agent-console-routes.js`: existing guided, Ask IncidentData V2 and native execution paths with server-side snapshots. SQL validation, CLOB result handling, model/profile/team settings and the Ask IncidentData V2 100-row limit are retained.
- `frontend/src/AgentHistory.jsx` and `agent-history.css`: compact clickable audit cards, conversation viewer and save-warning handling.
- `test/agent-history.test.js`: legacy limitations, full responses, failures, long-text binds, owner/workflow isolation, pagination, read-only access, and native conversation reuse.
- `test/ask-crime-v2-results.test.js`: retained long-text/retry regressions, updated for the shared route registration and explicit failure history.
- Full test suite: 123 checks pass across 18 files. Frontend build passes with the pre-existing main-bundle size warning.
- `scripts/check_agent_history_live.js`: Oracle integration passed with 52,000-character text, 12-turn pagination and user/workflow isolation. All 13 fixture rows were rolled back; no AI calls.
- `scripts/test_agent_history_browser.cjs`: read-only fixtures pass against local and deployed assets, including legacy records, paging, SQL/results, failure recovery, HTML escaping, keyboard/focus behaviour and legible 600/390-pixel layouts.
- `scripts/test_agent_history_live_browser.cjs`: passes end-to-end. Guided audit entries 208/209 reopen as one two-exchange thread; Clear starts a separate thread at 210. Cross-user access returns 404. Ask IncidentData V2 entry 211 reopens the exact Norwood question with all five saved rows and generated SQL matching the live response. No browser errors. These tests retain normal application audit entries; they do not edit incident data.
- Live case-readiness check: audit entry 207 reopened with matching saved coverage and records; the panel refreshed automatically and no browser errors occurred.

No database migration, profile reset, agent reconfiguration, source-data edit or historical audit rewrite was required. Data Room's Money Flows, Messages and People & Photos implementations remain unchanged; the read-only SUGA explorer regression passes.

## Deployment

Image: `local/adelaide-crime-intelligence:agent-history-v1-20260915`.

SHA: `1ad187199dadac1f369b33f15185f77555d20465945f41679cee85b8f1f691f7`.

Only `app-fu40` was recreated after all five Data Room active-work counts were zero. Health passed after restart. The prior `ask-v2-clob-fix-20260915` image remains available for rollback; it would hide the new viewer but does not require deleting the saved JSON snapshots.

To try it: refresh the browser, open **IncidentData AI Agent Console**, and click an audit entry. Run two guided questions without clearing the console, then open either new entry to see both exchanges. Older entries remain visibly limited when their answers were never recorded.

On 15 October 2026, the Agent Console's Evidence & Case-Readiness V1 and
AI-Agent-V2 Challenge launchers, dialogs and guided backend handlers were
retired. Run native Agent V2 remains available. The retired API paths return
HTTP 410; saved audit exchanges and historical AI Ops records remain readable.
The native team's five tools and underlying scenario data are retained.
