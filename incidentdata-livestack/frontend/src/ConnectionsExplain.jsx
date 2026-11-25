import React from 'react';
import ExplanationDialog from './ExplanationDialog';
import './connections-explain.css';

export default function ConnectionsExplain({batchId,runId}){
 return <ExplanationDialog label="Explain connections" title="Connections explained">
  <p className="brief-explain-lead">Find source-supported connection candidates, then inspect what each link actually means.</p>
  <p>Stage 6 uses the selected batch’s original files, saved descriptions and current Batch Brief. Its graph and AI review are drafts for human review; a connection is not proof of a meeting, identity, wrongdoing or a relationship between people.</p>
  <h3>What happens when you run connections</h3>
  <ol className="brief-explain-flow">
   <li><strong>Read the saved batch.</strong> The application checks the current descriptions and brief, then extracts supported reference codes and dates from original text. Text scanning covers up to 24,000 characters per file. For supported audio it uses the saved machine transcript, which must be checked against the original recording.</li>
   <li><strong>Compare descriptions and images.</strong> The application creates numerical embeddings of saved headlines/descriptions and whole images. Oracle compares stored vectors using cosine similarity. The graph keeps a bounded set of qualifying comparison candidates; it does not include every possible pair.</li>
   <li><strong>Assemble the links.</strong> Application code builds file nodes, shared-reference nodes and links with their supporting source references. Declared fictional cast links are added only for supported packaged scenes whose file checksums match.</li>
   <li><strong>Run an Oracle AI agent review.</strong> A database agent reads the inventory, brief and assembled connections through three scoped tools. Its written review and tool-call records are saved alongside the graph. The agent reviews the candidates; its prose does not independently create the displayed links.</li>
   <li><strong>Save a versioned result.</strong> The completed graph, source manifest and review are saved in Oracle. An unchanged completed run can be reused. If descriptions change, the saved view is marked out of date and connections must be run again.</li>
  </ol>
  <h3>How to read the diagram</h3>
  <dl>
   <dt>Blue file nodes</dt><dd>Uploaded source files. Their labels are filenames.</dd>
   <dt>Purple reference nodes and solid blue links</dt><dd>The same literal reference, such as a DEMO case code or date, occurs in multiple sources. This establishes shared text, not an incident or person relationship.</dd>
   <dt>Dashed similarity links</dt><dd>Saved descriptions or whole scenes are similar. A cosine score is a comparison measure, not an identity confidence or probability that an event happened.</dd>
   <dt>Green declared-cast links</dt><dd>Explicit cast associations for a limited set of packaged fictional scenes, verified by checksum. These are not face recognition results; they may be absent from your batch.</dd>
  </dl>
  <p>Node positions, order and distance do not carry investigative meaning. Dates can also appear in the saved timeline. Use <strong>Link type</strong> and <strong>Focus</strong> to reduce clutter, then use the source buttons to inspect the exact saved description version and check the original artifact.</p>
  <h3>Choose a visualizer</h3>
  <dl>
   <dt>Saved connection diagram</dt><dd>The existing circular diagram reads the saved graph JSON. It shows up to 36 connected nodes at once; use Focus for larger results. The table and exports retain all links.</dd>
   <dt>Oracle Graph Visualizer</dt><dd>Oracle’s graph visualization library displays results queried from the native Oracle SQL property graph. Choose force-directed, hierarchical or radial layouts; drag, zoom and filter the graph. Double-click a node or select a link to inspect its support. An accessible node and connection list provides the same inspection choices.</dd>
  </dl>
  <h3>Where the data lives</h3>
  <p>Original files, descriptions, briefs and vectors are stored in separate Oracle tables. The completed Stage 6 graph and agent review are saved as JSON in <code>CDR_WORKSPACE_RUNS.RESULT_JSON</code>.</p>
  <p>The native model, <code>CDR_CONNECTIONS_GRAPH_V1</code>, reads that same saved JSON through two scoped <code>JSON_TABLE</code> views: one for vertices and one for edges. <code>GRAPH_TABLE</code> queries the native graph. This does not create a second copy of the nodes and links. Run-specific keys keep separate snapshots apart, and your existing batch access permissions apply.</p>
  <p>Expand <strong>Oracle graph model &amp; SQL</strong> beneath the Oracle visualizer to see the mapping and queries. Switching visualizers does not rerun AI or change the saved connections.</p>
  <h3>SQL: retrieve the saved graph</h3>
  <p>The JSON is stored in <code>CDR_WORKSPACE_RUNS.RESULT_JSON</code>. Read it through the scoped view below to return this completed run’s graph, including its nodes, edges and supporting metadata.</p>
  <pre className="connections-explain-sql" tabIndex={0} aria-label="SQL to retrieve the saved connection graph"><code>{`SELECT run_id,
       batch_id,
       JSON_QUERY(result_json, '$.graph'
                  RETURNING CLOB) AS graph_json
FROM secure_cdr_workspace_runs_v
WHERE batch_id = :batch_id
  AND run_id = :run_id
  AND kind = 'connections'
  AND status = 'complete';`}</code></pre>
  {batchId&&<p className="connections-explain-bindings">For this batch, bind <code>:batch_id</code> to <code>{batchId}</code>{runId?<> and <code>:run_id</code> to <code>{runId}</code></>:<>. Complete a connection run to obtain its <code>:run_id</code></>}.</p>}
  <p>Run these examples in an authorised application database session. The scoped view applies the current user’s batch access.</p>
  <details><summary>SQL: return native Oracle graph links as rows</summary>
   <p>This queries the same saved graph through the native Oracle property graph. Each row is one connection.</p>
   <pre className="connections-explain-sql" tabIndex={0} aria-label="SQL to query native Oracle graph connections"><code>{`SELECT *
FROM GRAPH_TABLE (
  cdr_connections_graph_v1
  MATCH (a IS connection_node)
        -[e IS connection_link]->
        (b IS connection_node)
  WHERE a.run_id = :run_id
    AND e.run_id = :run_id
    AND b.run_id = :run_id
  COLUMNS (
    a.node_label AS from_source,
    b.node_label AS to_source,
    e.edge_kind AS link_type,
    e.score AS cosine_similarity,
    e.basis AS supporting_basis
  )
);`}</code></pre>
  </details>
  <aside className="brief-explain-note"><strong>Check the support before drawing conclusions.</strong><p>Read the link type and basis, inspect the cited descriptions, and compare them with original files. Similarity and an AI-written review remain candidate explanations requiring human judgement.</p></aside>
  <footer>Opening this explanation makes no AI request and changes no batch data.</footer>
 </ExplanationDialog>;
}
