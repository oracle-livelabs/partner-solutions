# Stage 6 Oracle property graph and alternate visualizer

Stage 6 retains its saved connection diagram and adds **Connection view → Oracle Graph Visualizer**. The alternate uses the installed, user-supplied Oracle Graph Visualization Library 26.4.0, not a replacement drawing labelled Oracle. It supports force-directed, hierarchical and radial layouts, link/focus filters, link support inspection and source-description navigation. The canvas has an accessible node/connection list. View changes do not call an LLM or write batch data.

## Database model

`CDR_CONNECTIONS_GRAPH_V1` is a native SQL property graph defined over two views:

- `SECURE_CDR_CONN_NODES_V`: `JSON_TABLE(CDR_WORKSPACE_RUNS.RESULT_JSON, '$.graph.nodes[*]')` projects the saved vertices.
- `SECURE_CDR_CONN_EDGES_V`: `JSON_TABLE(..., '$.graph.edges[*]')` projects the saved edges, retaining an ordinal to distinguish parallel links.

Both views read through `SECURE_CDR_WORKSPACE_RUNS_V`, include only completed `connections` runs, and therefore inherit authorised batch scope. Vertex keys combine run ID and source node ID. Edge keys combine run ID and JSON edge ordinal. `connection_node` properties include source reference, content type and source checksum. `connection_link` properties include kind, label, cosine score and basis.

The graph uses `OPTIONS(TRUSTED MODE)` over the derived views; the application checks that native counts, unique IDs, endpoints and properties reconcile exactly with the saved JSON before returning a result. Source references and exact quote metadata are retained from that same snapshot. Runs are not joined across one another. This adds **no duplicate vertex/edge tables** and does not change originals, saved snapshots, the existing vectors, agent execution or other native graphs. New completed Stage 6 runs are immediately represented by the views. Batch removal needs no added child-table cleanup.

`GET /api/data-room/batches/:id/connections/graph?runId=<completed-run-uuid>` first verifies the completed run in the supplied batch and user scope, then issues two `GRAPH_TABLE` queries. It does not create or rerun Stage 6. Read-only users may read batches already visible to them. API responses are not cached. The original snapshot and historical runs remain the source of truth; the existing Stage 6 stale-snapshot warning also applies to this alternate view.

## Setup and release

Apply `scripts/setup_data_room_connections_graph.js` with the existing FU40 application connection environment. It creates/replaces only the two new views and the versioned property graph; it does not modify source rows. Runtime module: `backend/data-room-connections-graph.js`. UI: `frontend/src/Stage6OracleGraph.jsx`.

Verification includes local reconciliation/converter tests, real `GRAPH_TABLE` reads (Dublin: 16 vertices, 30 links), rollback-only checks for user/batch isolation, cross-run IDs, parallel links and isolated nodes, and preview/live browser interaction checks. Fixture data is rolled back. Browser checks issue no writes or model requests.

The embedded library is distinct from launching the external Graph Studio application. Oracle documents [embedding its graph visualization library](https://docs.oracle.com/en/database/oracle/property-graph/26.3/spgdg/embedding-graph-visualization-library-web-application.html) and [Graph Explorer in Graph Studio](https://docs.oracle.com/en/cloud/paas/autonomous-database/csgru/work-explorer-graph-studio.html). Existing vendor provenance remains in `frontend/public/vendor/oracle-graph/26.4.0/provenance.json`.
