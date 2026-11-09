import {AGENT_FRAMEWORK_INTERNALS} from './agent-framework-internals.mjs';

// Page explanations follow the deployed query paths. SQL samples are bounded,
// read-only demonstrations, not an arbitrary-query endpoint or exact API replicas.
const sql = (title, code, note = 'Run in an authorised IncidentData database session. Results follow that session’s demo-user scope.') => ({ title, code, note });
const scopedCount = `SELECT COUNT(*) AS authorised_incidents
FROM secure_crime_incidents_v;`;
const recentIncidents = `SELECT incident_ref, suburb, incident_status, occurred_at
FROM secure_crime_incidents_v
ORDER BY occurred_at DESC, incident_ref
FETCH FIRST 10 ROWS ONLY;`;

export const ORACLE_INTERNALS = {
  workshop: {
    title: 'Workshop & Guides', engine: 'Illustrated guides · Page explanations',
    badges: ['Oracle AI Database 26ai', 'React', 'APEX', 'Learning Guides'],
    what: 'Open illustrated learner chapters, the capability map and presenter preparation guide alongside the application.',
    why: 'Shared visuals connect the interface to the workshop explanations and make the learning route easier to follow.',
    how: 'The application serves static workshop pages and PNG visuals. Links open a guide or full-size visual in a new tab.',
    flow: [['Choose a chapter', 'Read its preparation status'], ['Open the guide', 'Follow the exercise steps'], ['Return to the app', 'Inspect records and mechanisms']],
    examples: [],
    point: 'Opening guides makes no AI calls. APEX, DDS and prepared-vector exercises retain their stated validation and configuration prerequisites.'
  },
  welcome: {
    title: 'IncidentData LiveStack',
    engine: 'Oracle AI Database 26ai',
    badges: ['Relational SQL', 'Native JSON', 'VECTOR', 'Oracle Spatial', 'Property Graph', 'Scoped Views'],
    what: 'Explore synthetic incident records, reports, evidence, relationships and AI activity in one Oracle database. Each page explains the database operations behind its visible results.',
    why: 'The same records can support SQL summaries, vector comparisons, relationship exploration and spatial context without a separate reporting copy for each view.',
    how: 'The app sets the selected demo-user context on its database connection. Secure views constrain the records before page queries aggregate, join or rank them.',
    flow: [['Demo user', 'Selected scope'], ['Oracle secure views', 'Authorised records'], ['Page results', 'Counts, context and links']],
    examples: [sql('Count the visible incident records', scopedCount)],
    point: 'This is a synthetic teaching environment. The demo identity selector illustrates data scoping; it is not production authentication.'
  },
  foundation: {
    title: 'Data Foundation', engine: 'Relational core · Saved city profiles',
    badges: ['Relational SQL', 'JSON', 'Z_BASE Library', 'Scoped Views', 'Stable References'],
    what: 'City tiles expose saved demonstration profiles and their readiness. Restoring a supported profile replaces the active operational dataset used by the investigation pages.',
    why: 'A repeatable starting point lets the same application demonstrate different cities while retaining stable incident, person and case reference codes.',
    how: 'The Z_BASE catalogue describes saved profiles. The restore package remaps regenerated identity keys through stable references so linked records stay connected. A restore is a separate administrator action.',
    flow: [['Saved city profile', 'Z_BASE catalogue'], ['Explicit restore', 'Remap identity keys'], ['Active dataset', 'Shared page foundation']],
    examples: [sql('Inspect the saved profile catalogue', `SELECT profile_code, profile_name, profile_status, captured_at
FROM z_base_dataset_profiles
ORDER BY profile_code
FETCH FIRST 30 ROWS ONLY;`, 'Read-only catalogue query; it does not restore or change a profile.')],
    point: 'Reading this explanation never runs a restore. Data Room batches and the AI Opps ledger have separate lifecycles from city-profile data.'
  },
  dashboard: {
    title: 'Incident Activity Center', engine: 'Scoped SQL aggregation',
    badges: ['Relational SQL', 'COUNT / SUM', 'CASE Expressions', 'Scoped Views'],
    what: 'Activity cards and charts summarise recorded incidents, categories, status and patrol-area context for the selected demo user.',
    why: 'Security scope is applied before counting, so a summary and its underlying incident records describe the same authorised population.',
    how: 'Oracle aggregates secure_crime_incidents_v using COUNT, distinct counts and conditional SUM expressions. Related queries group those records by category, area and time.',
    flow: [['Secure incident view', 'Apply user scope'], ['SQL aggregation', 'Count and group'], ['Activity cards', 'Recorded workload']],
    examples: [sql('Count incidents and unresolved records', `SELECT COUNT(*) AS incident_count,
       COUNT(DISTINCT category_id) AS category_count,
       SUM(CASE WHEN incident_status NOT IN
         ('resolved', 'closed_no_further_action')
         THEN 1 ELSE 0 END) AS open_count
FROM secure_crime_incidents_v;`)],
    point: 'These are descriptive counts from the demonstration dataset, not predictions of future incidents.'
  },
  signals: {
    title: 'Incident Pattern Signals', engine: 'Vector search · Recorded pattern links',
    badges: ['VECTOR_DISTANCE', 'COSINE', 'OCI Embeddings', '1536 Dimensions', 'Scoped Joins'],
    what: 'Explore watched patterns, linked incident reports and unverified public signals. Semantic report search ranks narratives by similarity to the search description.',
    why: 'Vector search can surface related wording that a literal keyword search misses, while explicit recorded links retain their own meaning.',
    how: 'OCI Cohere Embed 4 generates the query vector. Oracle compares it with stored narrative vectors of the same model and active profile, joins secure incident/report views and applies the selected similarity threshold.',
    flow: [['Search description', 'OCI query embedding'], ['Oracle VECTOR_DISTANCE', 'Scoped cosine ranking'], ['Related reports', 'Analyst reviews matches']],
    examples: [sql('Inspect available narrative-vector coverage', `SELECT e.profile_code, e.embedding_model,
       COUNT(*) AS visible_report_vectors
FROM incident_narrative_embeddings_v4 e
JOIN secure_crime_incidents_v i
  ON i.incident_ref = e.incident_ref
JOIN secure_incident_reports_v r
  ON r.incident_id = i.incident_id
GROUP BY e.profile_code, e.embedding_model
ORDER BY e.profile_code, e.embedding_model
FETCH FIRST 20 ROWS ONLY;`, 'Counts stored vectors by profile and model; no embedding request is sent. SQL Workshop uses its own session identifier, so these secure joins can return no rows. Use the SQL Workshop block below for an authorised Statewide Admin demo check.'),
      {kind:'plsql',title:'APEX SQL Workshop: check Adelaide V2 vector coverage',
        note:'Select the CRIME_DATA schema on FU40 with Adelaide V2 active. Run this entire block together in SQL Workshop → SQL Commands. Expected DBMS Output: Visible report vectors: 21532. Keep only one identity line active: comment out statewide_admin and uncomment an alternative to test its geographic scope. Other identities have smaller scoped counts. For authorised demo diagnostics: temporarily sets the chosen identity, restores the previous client identifier on success or error, reads data only and makes no embedding requests.',
        code:`DECLARE
  previous_id VARCHAR2(64) :=
    SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');
  vector_count NUMBER;

  PROCEDURE restore_context IS
  BEGIN
    IF previous_id IS NULL THEN
      DBMS_SESSION.CLEAR_IDENTIFIER;
    ELSE
      DBMS_SESSION.SET_IDENTIFIER(previous_id);
    END IF;
  END;
BEGIN
  -- Keep only ONE identity line active.
  DBMS_SESSION.SET_IDENTIFIER('statewide_admin');
  -- DBMS_SESSION.SET_IDENTIFIER('central_analyst');
  -- DBMS_SESSION.SET_IDENTIFIER('northern_analyst');
  -- DBMS_SESSION.SET_IDENTIFIER('southern_analyst');
  -- DBMS_SESSION.SET_IDENTIFIER('read_only_viewer');

  SELECT COUNT(*)
  INTO vector_count
  FROM incident_narrative_embeddings_v4 e
  JOIN secure_crime_incidents_v i
    ON i.incident_ref = e.incident_ref
  JOIN secure_incident_reports_v r
    ON r.incident_id = i.incident_id
  WHERE e.profile_code = 'ADELAIDE_DATA_V2'
    AND e.embedding_model = 'cohere.embed-v4.0';

  DBMS_OUTPUT.PUT_LINE(
    'Identity: ' ||
    SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER')
  );
  DBMS_OUTPUT.PUT_LINE(
    'Visible report vectors: ' || vector_count
  );

  restore_context;
EXCEPTION
  WHEN OTHERS THEN
    restore_context;
    RAISE;
END;`}
    ],
    point: 'Cosine similarity is not a probability or proof of a connection. Public signals remain separate from verified incident information.'
  },
  persons: {
    title: 'Person Intelligence', engine: 'Separate text and image vectors',
    badges: ['VECTOR_DISTANCE', 'MiniLM 384d', 'CLIP 512d', 'COSINE', 'Scoped Joins'],
    what: 'Compare fictional profile narratives and generated test images. Text and visual searches use separate embedding models and separate vector stores.',
    why: 'Each comparison preserves its basis: narrative resemblance and visual resemblance are different signals for human review.',
    how: 'Local MiniLM creates text embeddings; CLIP creates image embeddings. Oracle ranks the corresponding stored vectors by cosine distance, joined to the secure person view.',
    flow: [['Text or test image', 'MiniLM or CLIP'], ['Oracle vector ranking', 'Authorised fictional profiles'], ['Comparison results', 'Separate similarity scores']],
    examples: [sql('Compare stored narratives without a model call', `WITH selected_profile AS (
  SELECT p.person_ref, e.embedding
  FROM person_narrative_embeddings e
  JOIN secure_persons_of_interest_v p
    ON p.person_id = e.person_id
  ORDER BY p.person_ref FETCH FIRST 1 ROW ONLY
)
SELECT s.person_ref AS compared_with, p.person_ref,
       ROUND(1 - VECTOR_DISTANCE(e.embedding,
         s.embedding, COSINE), 4) AS similarity_score
FROM person_narrative_embeddings e
JOIN secure_persons_of_interest_v p
  ON p.person_id = e.person_id
CROSS JOIN selected_profile s
WHERE p.person_ref <> s.person_ref
ORDER BY similarity_score DESC, p.person_ref
FETCH FIRST 6 ROWS ONLY;`, 'Uses the first visible stored narrative as the comparison seed. No new embeddings are generated.')],
    point: 'These are fictional profiles and generic image comparisons, not biometric identification or findings about a real person.'
  },
  evidence: {
    title: 'Evidence Intelligence', engine: 'JSON · Vectors · Spatial · SQL/PGQ',
    badges: ['Native JSON', 'JSON_TABLE', 'VECTOR_DISTANCE', 'SDO_DISTANCE', 'GRAPH_TABLE', 'Select AI'],
    what: 'Inspect synthetic evidence with source text, provenance, exact markers, similarity, approximate spatial context and existing incident relationships. Available packs depend on the active profile.',
    why: 'A source-supported review keeps literal evidence, inherited incident context and suggested similarities distinguishable.',
    how: 'Secure evidence views constrain access. Oracle reads JSON markers, ranks same-model text/image vectors, computes spatial distance and traverses the crime_case_network property graph. Select AI and native-agent reviews produce cited drafts when explicitly requested.',
    flow: [['Source and provenance', 'JSON evidence document'], ['Scoped Oracle queries', 'Markers, vectors, distance, paths'], ['Review workspace', 'Sources and cited drafts']],
    examples: [sql('Read exact markers from evidence JSON', `SELECT e.evidence_ref, m.namespace, m.marker_value
FROM secure_ei_items_v e,
     JSON_TABLE(e.document, '$.markers[*]'
       COLUMNS (
         namespace VARCHAR2(100) PATH '$.namespace',
         marker_value VARCHAR2(200) PATH '$.value'
       )) m
ORDER BY e.evidence_ref, m.namespace, m.marker_value
FETCH FIRST 20 ROWS ONLY;`, 'Returns saved markers from the visible evidence pack. An empty result can mean no pack or markers are visible in this profile.')],
    point: 'An exact marker match, a vector match and an incident-context relationship are different kinds of evidence. AI drafts remain unreviewed.'
  },
  graph: {
    title: 'Case Relationships', engine: 'Scoped relationships · Oracle graph visualisation',
    badges: ['Relational Joins', 'Property Graph', 'SQL/PGQ', 'Oracle Graph SDK', 'Scoped Views'],
    what: 'Explore recorded case, incident, person and evidence links. The Oracle graph view adds interactive layouts, filtering and comparison groups to the same authorised network.',
    why: 'A visible link can be traced to a stored relationship instead of treating proximity in a graph drawing as evidence.',
    how: 'The case network endpoint builds nodes and edges from scoped SQL joins. The browser renders them using the selected graph view. The same data also has a crime_case_network property-graph projection; Evidence Intelligence uses GRAPH_TABLE to traverse it.',
    flow: [['Stored relationships', 'Scoped SQL joins'], ['Nodes and typed edges', 'One authorised network'], ['Graph view', 'Layout and exploration']],
    examples: [sql('Traverse the native property graph', `SELECT g.person_ref, g.incident_ref, g.connection_type
FROM GRAPH_TABLE(crime_case_network
  MATCH (p IS person_of_interest)
    -[l IS person_linked_to_incident]->(i IS incident)
  COLUMNS (
    p.person_id AS person_id, p.person_ref AS person_ref,
    i.incident_id AS incident_id, i.incident_ref AS incident_ref,
    l.connection_type AS connection_type
  )) g
JOIN secure_crime_incidents_v si
  ON si.incident_id = g.incident_id
JOIN secure_persons_of_interest_v sp
  ON sp.person_id = g.person_id
ORDER BY g.incident_ref, g.person_ref
FETCH FIRST 20 ROWS ONLY;`, 'A read-only SQL/PGQ demonstration over the real graph projection. The case network screen itself currently loads scoped relational joins.')],
    point: 'Layout positions and computed comparison groups are browser exploration aids. They do not create new stored relationships or invoke an AI model.'
  },
  geography: {
    title: 'Incident Map', engine: 'Scoped coordinates · Spatial context',
    badges: ['Scoped Views', 'Coordinates', 'Oracle Spatial', 'SDO_GEOMETRY', 'WGS-84'],
    what: 'Display approximate incident locations and contextual address information for the active city and demo-user scope.',
    why: 'A map helps explore where recorded activity sits while preserving the same record-access boundary used by the list views.',
    how: 'The map reads latitude and longitude from secure incident queries and renders them with Leaflet. Those coordinates can also be passed to Oracle Spatial for database-side distance calculations, as demonstrated below.',
    flow: [['Authorised incidents', 'Coordinates and address precision'], ['Map markers', 'Leaflet rendering'], ['Spatial context', 'Approximate locations']],
    examples: [sql('Calculate Oracle Spatial distance between two visible points', `WITH points AS (
  SELECT incident_ref, latitude, longitude,
         ROW_NUMBER() OVER (ORDER BY incident_ref) AS rn
  FROM secure_crime_incidents_v
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL
)
SELECT a.incident_ref AS from_incident,
       b.incident_ref AS to_incident,
       ROUND(SDO_GEOM.SDO_DISTANCE(
         SDO_GEOMETRY(2001, 4326,
           SDO_POINT_TYPE(a.longitude, a.latitude, NULL), NULL, NULL),
         SDO_GEOMETRY(2001, 4326,
           SDO_POINT_TYPE(b.longitude, b.latitude, NULL), NULL, NULL),
         0.05, 'unit=KM'), 3) AS distance_km
FROM points a CROSS JOIN points b
WHERE a.rn = 1 AND b.rn = 2;`, 'Measures between the first two visible mapped records. This demonstrates Spatial on the map data; the marker layer itself does not run distance calculations.')],
    point: 'Locations are synthetic and approximate. Distance indicates spatial context, not a causal or evidential connection.'
  },
  incidents: {
    title: 'Incident Explorer', engine: 'Structured records · Reports · JSON attributes',
    badges: ['Relational SQL', 'Report Text', 'Native JSON', 'Scoped Views'],
    what: 'Search and filter incident records, then inspect their report narrative, metadata and authorised linked context.',
    why: 'Structured fields, free text and JSON attributes remain attached to the same incident rather than being separate search copies.',
    how: 'Bound search/filter parameters constrain SQL over secure incident and report views. Drill-down queries retrieve related records by incident reference; optional assistance runs only when requested.',
    flow: [['Search and filters', 'Bound query values'], ['Secure incident/report join', 'Structured and text fields'], ['Incident detail', 'Source record and context']],
    examples: [sql('Inspect reports alongside incident records', `SELECT i.incident_ref, i.suburb, i.incident_status,
       r.report_summary,
       JSON_SERIALIZE(i.incident_attributes
         RETURNING VARCHAR2(4000) TRUNCATE) AS attributes_json
FROM secure_crime_incidents_v i
JOIN secure_incident_reports_v r
  ON r.incident_id = i.incident_id
ORDER BY i.occurred_at DESC, i.incident_ref
FETCH FIRST 10 ROWS ONLY;`)],
    point: 'The incident record and report remain the reviewable source. Optional generated explanations do not replace them.'
  },
  analytics: {
    title: 'Incident and Capacity Analytics', engine: 'Historical SQL analytics',
    badges: ['Date Bucketing', 'Conditional SUM', 'GROUP BY', 'Stored Similarities', 'Scoped Views'],
    what: 'Compare recorded demand, patrol-area workload, case-context coverage and saved narrative-pattern similarities.',
    why: 'Historical trends and explicit record counts make the demonstration’s workload and data coverage inspectable.',
    how: 'Oracle groups authorised incidents into time buckets and calculates category, status and area aggregates. Pattern-group queries summarise stored semantic matches; these screens do not train a forecasting model.',
    flow: [['Scoped incident history', 'Observed records'], ['SQL time buckets', 'Counts and conditional totals'], ['Analytics tabs', 'Trends and coverage']],
    examples: [sql('Group historical activity by day', `SELECT TRUNC(occurred_at) AS day_bucket,
       COUNT(*) AS incident_count,
       SUM(CASE WHEN incident_status NOT IN
         ('resolved', 'closed_no_further_action')
         THEN 1 ELSE 0 END) AS active_count
FROM secure_crime_incidents_v
GROUP BY TRUNC(occurred_at)
ORDER BY day_bucket DESC
FETCH FIRST 30 ROWS ONLY;`)],
    point: 'These are descriptive historical aggregates, not crime forecasts or staffing recommendations.'
  },
  ask: {
    title: 'Ask IncidentData', engine: 'Guided SQL · Native Select AI V2',
    badges: ['Select AI', 'DBMS_CLOUD_AI', 'Validated SQL', 'Scoped Views', 'Conversation History'],
    what: 'Ask questions about the demonstration data and inspect returned records and SQL. Guided queries and native Select AI V2 are separate execution paths.',
    why: 'Visible SQL and retained exchanges make it possible to inspect how an answer was produced and which records support it.',
    how: 'The guided path selects predefined SQL. V2 asks Oracle Select AI to generate SQL, validates the query against approved secure views and executes it with bounded results. An explicit correction attempt can follow a SQL failure.',
    flow: [['Question', 'Guided or native V2'], ['Approved scoped SQL', 'Validate and execute'], ['Answer and history', 'Records, SQL and audit']],
    examples: [sql('Inspect the records an answer can use', recentIncidents, 'This SELECT inspects the data without generating a new answer. Use Ask IncidentData V2 on the page to exercise the native model path.')],
    point: 'Reading saved history does not rerun a model. Native invocation counts and missing provider-token measurements are distinguished in AI Opps.'
  },
  agents: AGENT_FRAMEWORK_INTERNALS,
  'data-room': {
    title: 'Data Room', engine: 'Source inventory · AI workspace · Provenance',
    badges: ['BLOB Sources', 'JSON Results', 'OCI GenAI', 'VECTOR', 'Select AI', 'Native Agent', 'Source SHA-256'],
    what: 'Retain uploaded source batches, inspect descriptions and briefs, explore connections, messages and money context, and use batch chat, Ask Detective or Detective Room publishing.',
    why: 'Original material remains distinguishable from generated descriptions, inferred connections, analyst notes and published presentations.',
    how: 'Oracle stores source inventory and BLOB content behind batch-owner views. Explicit jobs add OCI descriptions, native AI reviews, local text/image vectors and saved results linked to source checksums. The publishing worker assembles source-cited scenes and local speech into a presentation.',
    flow: [['Original batch', 'BLOBs, inventory and checksums'], ['Explicit workspace jobs', 'Descriptions, vectors and native AI'], ['Review and publish', 'Sources stay traceable']],
    examples: [sql('Inspect visible batch inventory', `SELECT batch_id, filename, loaded_by, uploaded_at,
       status, file_count
FROM secure_cdr_batches_v
ORDER BY created_at DESC
FETCH FIRST 10 ROWS ONLY;`), sql('Inspect saved workspace-run provenance', `SELECT batch_id, kind, status, requested_by,
       native_conversation_id, created_at
FROM secure_cdr_workspace_runs_v
ORDER BY created_at DESC
FETCH FIRST 20 ROWS ONLY;`, 'Lists stored connections/chat runs according to the view’s batch and owner rules. It does not queue jobs or replay AI.')],
    point: 'Generated outputs remain drafts. Saved source fingerprints help detect stale results; private conversations and analyst work retain their ownership rules.'
  },
  'ai-ops': {
    title: 'AI Opps', engine: 'Oracle JSON ledger · Usage and traceability',
    badges: ['Native JSON', 'JSON_VALUE', 'Usage Aggregation', '31 Operations', 'Scoped Activity', 'Collector Health'],
    what: 'Inspect model attempts, native invocations, embeddings and workflow outcomes across the stack, including the app and Detective Room worker collectors.',
    why: 'Reported tokens, unavailable usage, local processing and workflow duration need distinct measures to make the activity ledger interpretable.',
    how: 'Instrumented boundaries write metadata and bounded details into a separate Oracle ledger. SQL aggregates activity by area, model, status and operation registration. The app enforces owner scope and hides other users’ conversation excerpts even from the administrator view.',
    flow: [['Instrumented operation', 'Usage, duration and trace'], ['Oracle activity ledger', 'Metadata and JSON details'], ['Read-only dashboard', 'Totals and collector health']],
    examples: [sql('Summarise reported activity and token coverage', `SELECT area, kind, token_status, COUNT(*) AS records,
       SUM(total_tokens) AS reported_tokens,
       SUM(vectors) AS vectors_generated
FROM ai_ops_events
WHERE (actor = SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER')
   OR SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER') = 'statewide_admin')
  AND started_at >= SYSTIMESTAMP - INTERVAL '90' DAY
GROUP BY area, kind, token_status
ORDER BY area, kind, token_status
FETCH FIRST 100 ROWS ONLY;`, 'Mirrors the dashboard’s actor/admin metadata predicate. The ledger uses application query scoping; this is not a separate secure-view or production-authentication claim.')],
    point: 'Unavailable tokens do not mean zero usage. Native internal calls and hidden SDK retries remain coverage gaps. Opening this panel does not call a model or replay a workflow.'
  }
};
