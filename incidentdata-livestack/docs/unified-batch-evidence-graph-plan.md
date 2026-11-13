# Unified batch evidence graph: implementation design

Status: design and live prerequisites verified, 13 September 2026. Not implemented or deployed. The user endorsed a native Oracle graph combining transaction flows, text findings/vector comparisons, and fictional photo-to-POI review links.

## Verified foundation and pending UI dependency

FU40 (port 8706, CRIME_DATA schema) reports Oracle AI Database 26ai Enterprise Edition, version 23.26.3.3.0. CREATE PROPERTY GRAPH is granted and `CRIME_CASE_NETWORK` exists. Preserve that graph and its case/incident workflow. Current Data Room Stage 6 is a custom-rendered saved JSON graph, not the proposed native unified graph.

No Oracle Graph Visualization Library distribution was found in the project, scratch or searched download locations. Oracle documents a separately distributed JavaScript library downloaded from Oracle Software Delivery Cloud. Obtain an authorised package before embedding it; do not assume Graph Studio's hosted UI can simply be placed in the React app or accept Oracle download terms on the user's behalf. Graph Studio availability, permissions, and actual visualization must still be tested on this instance.

References:

- [Embedding Oracle Graph Visualization Library](https://docs.oracle.com/en/database/oracle/property-graph/26.2/spgdg/embedding-graph-visualization-library-web-application.html)
- [Current visualization developer guide](https://docs.oracle.com/en/database/oracle/property-graph/26.3/pgvtr/index.html)
- [Graph Studio SQL interpreter](https://docs.oracle.com/en/cloud/paas/autonomous-database/csgru/sql-interpreter.html)

## Proposed model

Use a new, versioned batch evidence property graph, not an overwrite of the existing case graph. Its relational records are the durable source for SQL graph queries and UI results.

| Vertex type | Identity and provenance |
| --- | --- |
| Source document/photo | Batch ID, item ID, original hash, description version when relevant |
| Photo region | Source photo ID/hash, oriented bounding box, crop hash and model version |
| Registered fictional POI | Stable POI reference, with current authorised catalogue visibility |
| Account | Batch/source account identifier; preserve exact source text and conflicting party labels |
| Named party | Source-provided label; do not silently merge with POIs or claim verified ownership |
| Finding/review assertion | Author/method, source references, status, creation time and revision |

| Edge type | Evidential status |
| --- | --- |
| Account → account transfer | Recorded-in-source transaction, amount/date/currency state and exact source row |
| Party → account association | Asserted by supplied source; not independently verified account ownership |
| Document → POI name/alias mention | Literal quote/offset, alias ambiguity preserved; not identity verification |
| Document → document/POI narrative comparison | Vector candidate, model/dimensions/source versions and raw cosine score |
| Photo → region | Derived source geometry, not an identity finding |
| Region → POI visual comparison | CLIP candidate, crop/reference hashes and score; not confirmed appearance |
| Photo → POI declared cast | Only explicit synthetic cast provenance, independently labelled |
| Region/photo → POI reviewed appearance | Separate human assertion with reviewer, reason and timestamp; retain original candidate |
| Finding → source/transaction | Traceable supporting reference; does not automatically validate the finding |

Review must create an auditable assertion rather than rewriting a candidate edge into a fact. Rejection, uncertainty and superseded versions must remain representable. A graph path through mixed edge types is not an established chain of evidence.

## Financial first slice

Parse recognised transaction CSV schemas deterministically, preserving original files and source row references. The existing Alice Springs CSV has nine transactions and columns TDATE, SENDER, SENDER_ACCOUNT, RECEIVER, RECEIVER_ACCOUNT, AMOUNT, DESCRIPTION, FLAG. It does not declare currency. Do not infer AUD, regulatory thresholds, account opening balances, or that downstream transfers are the same funds.

Use decimal-safe amounts and validated dates, not floating-point accounting. Reject/flag malformed rows explicitly rather than silently dropping them. Keep repeated transactions distinct; aggregated UI edges must expand to their constituent rows. Account identifiers must not be coerced to numbers or merged across batches by default. Source descriptions and FLAG values are source assertions, not classifier outputs.

Start with one-batch directional transfers and time-ordered routes. Convergence, branching, recurrence and circular routes can be labelled as observable review patterns with explicit query rules. They are not money-laundering findings. Avoid global exposure/risk scores in this increment.

## Permissions and integration gates

- Every graph request must enforce batch visibility and POI visibility, including intermediate vertices/edges in multi-hop queries. Filtering only the final display is insufficient.
- Validate the graph's scoped-view/query behaviour on 26ai before granting access. Graph Studio connects as a database user and does not automatically inherit the app's demo-role selector; do not claim equivalent isolation without testing.
- Keep existing Stage 6 results/Stage 7 packs immutable. New evidence graph snapshots should be independently versioned and included only in new review-pack versions.
- Current POI candidates are session-only. Introduce explicit durable candidate saving and reviewer actions; do not silently ingest browser sessions or manufacture prior review decisions.
- Preserve original hashes, precise source references, model/version, generated/reviewed timestamps and author/method on persisted graph support records.
- UI filters must distinguish recorded source relationships, literal mentions, vector candidates, declared cast, and reviewer assertions. Edge inspection must expose the basis, not just a coloured line.

## Acceptance checks before release

1. Alice Springs: all nine CSV transfers and original row references reconcile; no inferred currency or fabricated funds continuity.
2. Clara/Kaplan visual crops and explicit narrative names appear under different, correctly labelled edge types.
3. Weak/no-result candidates remain inconclusive and cannot auto-promote to reviewed connections.
4. Graph and multi-hop queries cannot cross batch/POI scope; test hidden intermediate nodes and direct API requests.
5. Candidate save/review is idempotent and versioned; rejected and older assertions remain inspectable.
6. Native SQL graph query results agree with source-table counts and independent expected paths.
7. Oracle visualization integration shows directed edges, source inspection and status filters; test error/no-data states and accessibility.
8. Existing batches, graphs, AI model settings, and old Stage 7 packs remain unchanged.

Next prerequisite: obtain the Oracle visualization-library distribution or explicitly choose a Graph Studio-only first UI. No new schema objects, candidate persistence, reviewer assertions, transaction records or graph deployments were created during this prerequisite check.
