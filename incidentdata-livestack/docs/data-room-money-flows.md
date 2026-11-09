# Data Room — money flows

First release: 14 September 2026, FU40 on port **8706**. Synthetic demonstration only.

## Try SUGA

1. Refresh the application and select **Data Room** as `statewide_admin`.
2. Open **Suga_Scene4.zip**, batch `DR-20260914-13f650e8-dfa8-450e`.
3. In section D, find **Choose what to explore** and open the **Money Flows** tile. Its full workspace opens in a large panel. The SUGA snapshot has already been built.
4. Select an arrow or account to narrow the source transaction table. Choose **Record …** to inspect all original CSV fields, then download the original or open its file details.
5. Under **Trace a route**, leave VantaSys / `SYN-AUD-001` as the start and Hartley / `SYN-AUD-008` as the end. Select **Find routes**: four three-hop routes appear. Select a route to highlight its arrows and individual records.
6. Set maximum hops to 2 and search again: no complete routes. Set the date filter to 14 September: only the two final receipts remain. **Clear filters** restores the full graph.
7. Use **Highlight pattern** for split payments, convergence, onward transfers or repeated pairs. Search for `Hartley` to highlight that account and narrow the table to its two receipts.

The view is independent of AI descriptions, batch learning and the connection-review agent. Other ready batches can use **Build money flows**. Nothing is added to operational incident or POI tables. Close the workspace or press Escape to return to the tiles; the selected batch's controls are retained until the batch/user changes or the page reloads.

15 September: expand **Ask the Money Flow Agent** below the route controls to read the saved SUGA explanation or explicitly request a new one. Its citations open original transaction records; **Show route …** highlights the corresponding graph path. This is a separately versioned native agent, not a change to the existing Connection Review team or Batch Assistant. See [capability and agent boundaries](data-room-capabilities.md).

## Verified SUGA result

| Measure | Result |
| --- | --- |
| Accounts / source transaction records | 8 / 10 |
| Distinct directed account pairs | 10 |
| Outflow from accounts with no observed incoming transfers | AUD 1,500,000.00 |
| Inflow to accounts with no observed outgoing transfers | AUD 1,500,000.00 |
| Gross transfer volume, including onward movements | AUD 4,500,000.00 |
| VantaSys → Hartley routes | 4, each 3 hops |
| Split / convergence accounts | 1 / 3 |
| Equal observed inflow/outflow intermediaries | 6 |
| Circular topology | None |

The four routes are transaction suffixes `001 → 005 → 009`, `002 → 006 → 009`, `003 → 007 → 010`, and `004 → 008 → 010`. Routes share final transfers; adding route amounts would double-count movement. The originating and final figures coincide in this sample, not necessarily in other batches or filtered windows.

Patterns are deterministic descriptions of the selected records, **not a calibrated likelihood of money laundering**. Calendar dates do not establish same-day ordering or forwarding within minutes. Amount equality and connected topology do not prove that the same fungible funds moved along a route. Party names are source assertions, not verified account ownership or POI links.

## Sources and calculation

Supported CSV adapters, case-insensitive headers:

- SUGA: `TRANSACTION_ID,TDATE,SENDER,SENDER_ACCOUNT,RECEIVER,RECEIVER_ACCOUNT,AMOUNT,CURRENCY,DESCRIPTION,STAGE,SYNTHETIC`.
- Alice Springs: `TDATE,SENDER,SENDER_ACCOUNT,RECEIVER,RECEIVER_ACCOUNT,AMOUNT,DESCRIPTION,FLAG`. Missing currency is explicitly **Not recorded**, never assumed AUD.
- Downloadable sample: `transaction_id,date,from_account,to_account,amount_aud,reference`.
- Payment exports: `payment_reference,posting_date,debit_account,credit_account,transaction_amount,currency_code`; JSON arrays can be under `payments`, `paymentTransactions`, `payment_transactions`, `transactions`, `transactionRecords`, or `records`.

Dates accept validated `YYYY-MM-DD` and `DD-MON-YYYY`. Account identifiers remain strings, preserving leading zeros. Amounts must be positive unsigned decimals, without grouping separators or exponents, with up to 24 whole digits and 6 decimal places. They are stored as `NUMBER(30,6)` and summed using fixed-scale JavaScript `BigInt` arithmetic; no binary-floating-point accounting. Different currencies are never summed together. “Unknown” groups records without recorded currency; currency continuity cannot be verified for that group.

Every transfer retains its original fields, source item ID, SHA-256, source transaction ID if provided, and data-record ordinal. Ordinals exclude the header and blank records; a quoted multiline field remains one record. Repeated source rows are retained separately, while graph arrows aggregate a sender/receiver/currency pair. `STAGE`, `FLAG` and other source annotations remain visible but are not computed detections.

First-release bounds: **2 MiB per CSV, 500 transfers and 100 accounts per batch**. Imports exceeding the bounds or containing malformed recognized records fail without saving partial results. Unsupported CSV schemas are listed in coverage; no transactions are inferred from photographs, narratives or conversations. Original sources and existing AI results remain unchanged.

Date and currency filters recompute graph topology and metrics. **Graph view** offers Directed flow, Force-directed network and Oracle Graph Explorer. The Oracle view uses the locally hosted Oracle Graph Visualization 26.4 library to display the same batch-scoped accounts and directed payment pairs. Its account and line selections narrow the existing source transaction table; its accessible lists provide the same selections without the canvas. Oracle layout choices are hierarchical, force-directed and radial. Text search narrows the source table in every view and highlights accounts/edges in the two application SVG views; it does not recompute global totals. Pattern selection highlights graph elements in the application SVG views; it does not remove transfers from totals. Tables paginate after 20 records. Narrow screens scroll within the graph/table rather than widening the page.

## Native Oracle graph and isolation

Additive objects:

- `CDR_MONEY_RUNS`: immutable source snapshot JSON, version, fingerprint and creator.
- `CDR_MONEY_ACCOUNTS`: run-scoped string account identifiers.
- `CDR_MONEY_TRANSFERS`: one directed edge per source record, exact amount, currency and date.
- `SECURE_CDR_MONEY_RUNS_V`, `SECURE_CDR_MONEY_ACCOUNTS_V`, `SECURE_CDR_MONEY_TRANSFERS_V`: backing views joined through the existing scoped batch view.
- `CDR_MONEY_GRAPH_V1`: native SQL property graph over those views.

The account network is read with `GRAPH_TABLE`. Route queries generate fixed patterns for 1–4 hops; account values, currency, dates and run ID are binds. Each intermediate vertex and edge is constrained to the same visible run. Composite foreign keys prohibit cross-run edges, and run-scoped vertex keys prevent accounts with matching identifiers in different batches from merging. Route queries require non-decreasing dates and distinct vertices. Circular topology is detected separately from directed adjacency; circular fund-tracing is not claimed.

Routes are capped at **100 results** with an explicit truncation message and a 10-second per-query timeout. A route search issues at most four fixed-hop queries. Failures are surfaced; the app does not silently substitute an AI-generated route. The Directed flow and Force-directed network displays are application-owned SVG; Oracle Graph Explorer uses the locally hosted Oracle Graph Visualization library over the same scoped API result. See Oracle's [property-graph creation documentation](https://docs.oracle.com/en/database/oracle/property-graph/26.3/spgdg/creating-sql-property-graph.html) and [SQL graph query examples](https://docs.oracle.com/en/database/oracle/property-graph/26.3/spgdg/examples-sql-property-graph-queries.html).

Builds take the existing per-batch lifecycle lock and commit atomically. Identical source/version fingerprints reuse the snapshot. Concurrent removal therefore cannot leave half-built money records. Batch removal explicitly deletes money edges, accounts and runs before source items. Read-only users cannot build; all reads and traversals retain existing demo-user batch scope.

Endpoints under `/api/data-room/batches/:id`:

- `POST /money-flows`: build or reuse a snapshot.
- `GET /money-flows?currency=AUD&dateFrom=2026-09-11&dateTo=2026-09-14`: scoped graph, exact summaries and source records.
- `GET /money-flows/routes?runId=…&from=SYN-AUD-001&to=SYN-AUD-008&currency=AUD&maxHops=4`: source-linked native routes; optional date filters apply to every edge.

## Deployment and verification

Apply `node scripts/setup_data_room_money.js` in the target application's existing environment **before** publishing the backend. This additive migration uses views as graph element sources and was verified on FU40 Oracle 26ai `23.26.3.3.0`. It changes no existing agent registration. The FU40 image is pinned in `compose.fu40.yml`; the previous release image is retained for rollback. Only port 8706 is in scope.

- `node test/data-room-money.test.js`: normalization, exact arithmetic, provenance, duplicate rows, dates, currencies, cycle topology, scope rejection, bounded SQL and rollback tests.
- `npm test`: full existing test suite plus money-flow tests.
- `npm run build`: production frontend build.
- `scripts/verify_suga_money_live.js`: creates/reuses only SUGA's snapshot; validates Oracle sums and native routes, source checksums, repeated builds and denied users. Run inside the FU40 app container.
- `scripts/verify_money_graph_edges_live.js`: uses isolated uncommitted fixtures to verify duplicates, chronology, mixed currencies, cycles, hidden intermediates, cross-run foreign keys and deletion order, then rolls everything back.
- `scripts/test_suga_money_browser.cjs`: Playwright acceptance test of the live view, source inspection/download, routes, filters, pattern highlights, rebuild reuse, persistence and widths 760/600. Uses an externally supplied Playwright installation (`NODE_PATH`), not a production dependency.

Photo/POI graphs, extracted-message conversation readers, combined evidence graphs and calibrated risk scoring remain separate future work. Money-flow snapshots are not yet included in the existing Stage 7 review-pack export or Batch Assistant context.
