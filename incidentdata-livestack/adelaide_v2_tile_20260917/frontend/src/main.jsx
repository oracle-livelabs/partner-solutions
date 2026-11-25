import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import * as d3 from "d3";
import ResultRelationships from "./ResultRelationships";
import CrimeDataRoom from "./CrimeDataRoom";
import AiOps from "./AiOps";
import AgentAuditTrail, {useConversationHistory, HistorySaveNotice} from "./AgentHistory";
import PoiVisualSearch, { PoiVectorResults } from "./PoiVisualSearch";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import "./command.css";
import "./velocity.css";
import "./patterns.css";
import "./pattern-visibility.css";
import "./nav-tech.css";
import "./graph.css";
import "./graph-experience.css";
import "./graph-workbench.css";
import "./graph-tidy.css";
import "./graph-panel-layout.css";
import "./graph-canvas-balance.css";
import "./graph-pathway.css";
import "./graph-force-directed.css";
import "./incident-map.css";
import "./persons.css";
import "./poi-multimodal.css";
import "./incident-explorer.css";
import "./incident-ask-me.css";
import "./incident-capacity-analytics.css";
import "./ask-crime-data.css";
import "./ask-crime-v2.css";
import "./ask-crime-v2-empty.css";
import "./crime-challenge.css";
import "./crime-challenge-chooser.css";
import "./crime-agent-console.css";
import "./case-readiness.css";
import "./crimedata-setup.css";
import "./nrt-restore.css";
import "./brisbane-profile-tile.css";
import "./crimedata-profile-grid.css";
import "./app-use-notice.css";
import "./oracle-brand.css";
import "./welcome-carousel.css";
import "./oracle-internals-foundation.css";
const NAV = [
  ["welcome", "Welcome", "◈"],
  ["foundation", "Data Foundation", "▦"],
  ["dashboard", "Incident Activity Center", "▤"],
  ["signals", "Crime Pattern Signals", "⌁"],
  ["persons", "Person Intelligence", "◉"],
  ["graph", "Case Relationships", "⌘"],
  ["geography", "Incident Map", "◎"],
  ["incidents", "Incident Explorer", "▤"],
  ["analytics", "Incident and Capacity Analytics", "◌"],
  ["ask", "Ask Crime Data", "✦"],
  ["agents", "CrimeData AI Agent Console", "◉"],
  ["data-room", "Crime Data Room", "▣"],
  ["ai-ops", "CrimeData AI Ops", "◴"],
];
const ORACLE_INTERNALS = {
  "ai-ops": {title:"CrimeData AI Ops",engine:"Oracle JSON · Usage & Traceability",badges:["Usage", "JSON", "Scoped Activity", "No AI Replay"],summary:"A separate activity ledger records model attempts, native invocations, embedding processing and guided workflows. Measured token totals, unavailable usage and non-applicable tokens remain distinct. Conversation excerpts remain owner-only.",sql:`SELECT area, kind, token_status, COUNT(*) records,
       SUM(total_tokens) reported_tokens, SUM(vectors) vectors_generated
FROM ai_ops_events
WHERE actor = SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')
   OR SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER') = 'statewide_admin'
GROUP BY area, kind, token_status;`},
  "data-room": { title: "Crime Data Room", engine: "ADB Inventory + OCI Descriptions", badges: ["BLOB", "OCI GenAI", "Scoped Views", "Source Provenance"], summary: "Original ZIPs and extracted content remain in ADB. Identify/Describe generates separate, unreviewed text and image descriptions with model provenance and source checksums. Native agent orchestration, embeddings, graph links and saved Select AI batch chat remain future stages.", sql: `SELECT batch_id, filename, loaded_by, uploaded_at, status, file_count
FROM secure_cdr_batches_v
ORDER BY created_at DESC;

SELECT item_id, original_path, content_type, headline, sha256
FROM secure_cdr_items_v
WHERE batch_id = :batch_id;`, detail: "Views scope each batch to its uploader or statewide_admin using the existing demo client identifier. This demonstrates access controls, not production authentication. Uploaded source content is retained unchanged and is never executed." },
  welcome: { title: "CrimeData Livestack", engine: "Oracle AI Database 26ai", badges: ["Relational SQL", "JSON", "Vector", "Spatial", "Graph", "Deep Data Security"], summary: "CrimeData Livestack keeps the demonstration's incident, report, vector, relationship, spatial, and access-control data in one converged Oracle database. Each screen uses the same governed operational tables rather than a copied reporting store.", sql: `-- One governed operational dataset
SELECT COUNT(*) AS authorised_incidents
FROM secure_crime_incidents_v;`, detail: "The secure view applies the active demo-user context before any result is returned." },
  foundation: { title: "CrimeData Foundation", engine: "Oracle AI Database 26ai · Z_BASE", badges: ["Relational Core", "JSON-Ready Reports", "Property Graph", "Oracle Spatial", "Vector Search", "Deep Data Security", "Agent Audit Trail"], summary: "The active operational tables hold one restored city profile. The Z_BASE library stores independent Adelaide, Perth, and Brisbane copies, so the demonstration can switch data without rebuilding the application.", readiness: "Start here to select and restore a captured metro-area profile before exploring the CrimeData use cases. The restore prepares the governed Oracle foundation used by incident activity, pattern signals, person intelligence, case relationships, spatial context, analytics, and the CrimeData AI Agent Console.", whyItMatters: "The same foundation supports incident search, descriptive activity and capacity signals, relationship pathways, approximate spatial coverage, semantic narrative exploration, and governed agent workflows without splitting the demonstration across separate data stores.", sql: `-- Profile catalogue used by the city tiles
SELECT profile_code, profile_name, profile_status, captured_at
FROM z_base_dataset_profiles
ORDER BY profile_code;

-- Restore runs as one database package call
BEGIN z_base_dataset_admin.restore_profile(:profile_code); END;`, detail: "The restore package preserves relationships by remapping regenerated Oracle identity keys through stable incident, person, case, category, and patrol-area reference codes." },
  dashboard: { title: "Incident Activity", engine: "Scoped Relational Aggregation", badges: ["SQL", "Deep Data Security", "Conditional Aggregation"], summary: "The command view aggregates only the incidents authorised for the current demo user. Changing the user changes the dataset before the counts, categories, and patrol-area totals are calculated.", sql: `SELECT COUNT(*) AS incident_count,
       COUNT(DISTINCT category_id) AS category_count,
       SUM(CASE WHEN incident_status NOT IN
         ('resolved','closed_no_further_action') THEN 1 ELSE 0 END) AS open_count
FROM secure_crime_incidents_v;`, detail: "secure_crime_incidents_v is the Deep Data Security boundary; the application does not filter the rows after retrieval." },
  signals: { title: "Crime Pattern Signals", engine: "Oracle Vector Search · OCI GenAI", badges: ["Cohere Embed 4", "1536D", "COSINE", "DDS Secure Views"], summary: "OCI GenAI embeds your incident-search description with Cohere Embed 4. Oracle compares it with stored report-narrative vectors for the active profile, within secure incident and report views, and excludes results below your minimum similarity.", sql: `SELECT i.incident_ref,
       ROUND(1 - VECTOR_DISTANCE(e.embedding,
         TO_VECTOR(:vector), COSINE), 4) AS similarity_score
FROM incident_narrative_embeddings_v4 e
JOIN secure_crime_incidents_v i ON i.incident_ref=e.incident_ref
JOIN secure_incident_reports_v rpt ON rpt.incident_id=i.incident_id
WHERE e.profile_code=:active_profile
  AND e.embedding_model=:query_model
  AND 1-VECTOR_DISTANCE(e.embedding,TO_VECTOR(:vector),COSINE)>=:min_similarity
ORDER BY VECTOR_DISTANCE(e.embedding, TO_VECTOR(:vector), COSINE),i.incident_ref
FETCH FIRST :topK ROWS ONLY;`, detail: "Semantic similarity is 1 minus cosine distance, displayed as a percentage with one decimal place. It is not a probability, confidence level, or evidence of a relationship. The default 40% minimum is an adjustable demo filter." },
  persons: { title: "Person Intelligence", engine: "Multimodal Vector Similarity · DDS", badges: ["CLIP 512d", "MiniLM 384d", "VECTOR", "COSINE", "Scoped Joins"], summary: "This screen keeps generated-portrait and profile-narrative embeddings separate, then uses Oracle cosine distance to rank only fictional profiles permitted by the active security context.", sql: `SELECT p.person_ref,
       ROUND(1 - VECTOR_DISTANCE(e.embedding, s.embedding, COSINE), 4)
         AS similarity_score
FROM person_narrative_embeddings e
JOIN secure_persons_of_interest_v p ON p.person_id=e.person_id
CROSS JOIN selected_profile s
ORDER BY VECTOR_DISTANCE(e.embedding, s.embedding, COSINE)
FETCH FIRST :topK ROWS ONLY;

-- The visual path uses the same Oracle ranking pattern over
-- person_visual_embeddings (VECTOR(512, FLOAT32)).`, detail: "MiniLM embeds profile text into 384 dimensions; CLIP embeds generated test imagery into 512 dimensions. Both results require manual review and are restricted to fictional data." },
  graph: { title: "Case Relationships", engine: "Relationship Graph Model", badges: ["Property Graph", "Relational Joins", "DDS"], summary: "Case, incident, person, and evidence relationships are resolved from one connected relational model. The screen renders the authorised relationship pathway as an interactive graph.", sql: `SELECT c.case_ref, i.incident_ref, p.person_ref, e.evidence_type
FROM case_incident_links l
JOIN case_files c ON c.case_id=l.case_id
JOIN secure_crime_incidents_v i ON i.incident_id=l.incident_id
LEFT JOIN person_incident_links pil ON pil.incident_id=i.incident_id
LEFT JOIN secure_persons_of_interest_v p ON p.person_id=pil.person_id
LEFT JOIN evidence_items e ON e.incident_id=i.incident_id;`, detail: "The same relationship model can be projected to Oracle Property Graph / SQL-PGQ for graph analysis; this screen keeps the joined pathway explainable for teaching." },
  geography: { title: "Incident Map", engine: "Spatial Context · DDS", badges: ["Oracle Spatial", "Coordinates", "DDS"], summary: "The map reads authorised incident coordinates and approximate address context from the active city dataset. Map markers are constrained by the same security scope used by the other screens.", sql: `SELECT incident_ref, latitude, longitude, suburb,
       address_line_1, address_postcode
FROM secure_crime_incidents_v
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
FETCH FIRST :limit ROWS ONLY;`, detail: "Coordinates are demonstration spatial context. The profile data uses controlled, non-operational locations and address precision metadata." },
  incidents: { title: "Incident Explorer", engine: "Relational Search · JSON", badges: ["SQL", "JSON", "DDS"], summary: "Incident Explorer combines structured incident fields with report text and JSON attributes, while the secure incident and report views enforce the active entitlement scope in the database.", sql: `SELECT i.incident_ref, i.suburb, i.incident_status,
       i.incident_attributes, rpt.report_summary
FROM secure_crime_incidents_v i
JOIN secure_incident_reports_v rpt ON rpt.incident_id=i.incident_id
WHERE UPPER(i.incident_ref) LIKE UPPER(:search)
   OR UPPER(rpt.report_summary) LIKE UPPER(:search);`, detail: "JSON provenance and attributes remain stored with each incident, alongside the relational columns used for governed search and joins." },
  analytics: { title: "Incident and Capacity Analytics", engine: "SQL Analytics · Vector Groups", badges: ["SQL", "Date Bucketing", "VECTOR", "DDS"], summary: "The analytics tabs calculate observed historical workload, patrol-area context, and existing vector-pattern groups directly from authorised operational records.", sql: `SELECT TRUNC(occurred_at) AS day_bucket,
       COUNT(*) AS incident_count,
       SUM(CASE WHEN incident_status NOT IN
         ('resolved','closed_no_further_action') THEN 1 ELSE 0 END) AS active_count
FROM secure_crime_incidents_v
GROUP BY TRUNC(occurred_at)
ORDER BY day_bucket;`, detail: "These are descriptive historical aggregates, not crime prediction or resource-deployment recommendations." },
  ask: { title: "Ask Crime Data", engine: "Select AI · Governed SQL", badges: ["Select AI", "SQL", "DDS", "Audit"], summary: "Natural-language requests are translated into bounded, reviewable database queries. The generated query remains subject to the same secure views and the action is retained in the demonstration audit trail.", sql: `-- Generated requests are constrained to approved views
SELECT incident_ref, suburb, incident_status
FROM secure_crime_incidents_v
WHERE occurred_at >= :from_date
FETCH FIRST :limit ROWS ONLY;`, detail: "The teaching workflow emphasises visible SQL, scoped data access, and auditability rather than unrestricted autonomous actions." },
  agents: { title: "CrimeData AI Agent Console", engine: "PL/SQL Tools · JSON Audit", badges: ["PL/SQL", "JSON", "Audit", "DDS"], summary: "The agent demonstration works through controlled database-backed tools. Inputs, action types, and JSON payloads are written to the analyst-action audit table for review.", sql: `INSERT INTO analyst_actions(user_name, action_type, payload)
VALUES (:user_name, :action_type, JSON(:payload));

SELECT action_type, payload, created_at
FROM analyst_actions
WHERE user_name=:user_name
ORDER BY created_at DESC;`, detail: "The agent is a teaching interface over governed data operations; it does not make operational policing decisions." },
};
const USERS = [
  "statewide_admin",
  "adelaide_central_analyst",
  "northern_analyst",
  "southern_analyst",
  "read_only_viewer",
];
const USER_LABELS = {
  statewide_admin: "Statewide administrator",
  adelaide_central_analyst: "Central analyst",
  northern_analyst: "Northern analyst",
  southern_analyst: "Southern analyst",
  read_only_viewer: "Limited viewer",
};
const CAP = [
  [
    "Data Foundation",
    "One governed demonstration data layer",
    [
      "Incident records and case files",
      "JSON documents and audit trails",
      "Security scopes",
    ],
    "#437c94",
  ],
  [
    "Incident Activity",
    "Descriptive operational visibility",
    [
      "Category and status summaries",
      "Patrol-area context",
      "Authorised data only",
    ],
    "#c74634",
  ],
  [
    "Pattern Signals",
    "Semantic narrative exploration",
    ["Vector-ready reports", "Related scenarios", "Demonstration control data"],
    "#4f7d7b",
  ],
  [
    "Incident and Capacity Analytics",
    "Descriptive demand, workload, and pattern analysis",
    ["Scoped incident trends", "Vector pattern groups", "Case-context workload"],
    "#796087",
  ],
  [
    "Person Intelligence",
    "Person-of-interest context",
    ["Generated profile portraits", "Similar POI Vector Search", "No biometric matching"],
    "#aa643b",
  ],
  [
    "Case Relationships",
    "Connected case context",
    [
      "Case and evidence links",
      "Graph-ready relationships",
      "No person-level inference",
    ],
    "#796087",
  ],
  [
    "Incident Map",
    "Spatially aware description",
    [
      "Approximate locations",
      "Area entitlement scope",
      "Descriptive mapping only",
    ],
    "#5f7d4f",
  ],
  [
    "Ask Crime Data",
    "Governed AI analysis",
    ["Visible SQL", "Read-only access", "Audited activity"],
    "#aa643b",
  ],
];
const PAGE_TECH = {
  "ai-ops": [
    ["Usage & Traceability", "LLM, native agent and vector processing activity"],
    ["Oracle JSON", "Measured usage with explicit coverage gaps"],
  ],
  "data-room": [
    ["ADB Content Store", "Original ZIPs, files and batch inventory"],
    ["Scoped Batches", "Uploader access and administrator oversight"],
  ],
  welcome: [
    ["Oracle AI Database", "One governed demonstration data platform"],
    ["DDS", "Scoped demonstration access"],
  ],
  foundation: [
    ["Relational & JSON", "Core incidents, reports, evidence, and audit data"],
    ["DDS", "Authorised area scopes"],
  ],
  dashboard: [
    ["In-Memory Analytics", "Fast descriptive incident aggregation"],
    ["DDS", "Live authorised data scope"],
  ],
  signals: [
    ["Vector Search", "Cosine similarity across pattern vectors"],
    ["DDS", "Deep Data Security filters every result"],
  ],
  persons: [
    ["Vector Search", "POI profile similarity"],
    ["DDS", "Authorised person-of-interest context"],
  ],
  graph: [
    ["Property Graph", "Case, incident, person, and evidence relationships"],
    ["DDS", "Authorised relationship context"],
  ],
  geography: [
    ["Oracle Spatial", "Approximate geographic context"],
    ["DDS", "Authorised patrol-area visibility"],
  ],
  incidents: [
    ["Relational Search", "Governed incident-record lookup"],
    ["DDS", "Scoped incident and report access"],
  ],
  analytics: [
    ["SQL Analytics", "Scoped incident, workload, and trend analysis"],
    ["Vector Search", "Pattern-group context"],
  ],
  ask: [
    ["Select AI", "Governed natural-language-to-SQL"],
    ["DDS", "Read-only, scoped answers"],
  ],
  agents: [
    ["AI Agents", "Guided, auditable crime-data workflows"],
    ["Audit Trail", "Governed interaction history"],
  ],
};
function PageTechTiles({ page }) {
  return (
    <div className="page-tech-tiles">
      {PAGE_TECH[page].map(([title, detail]) => (
        <article key={title}>
          <span>{title}</span>
          <small>{detail}</small>
        </article>
      ))}
    </div>
  );
}
function OracleInternalsPanel({ page }) {
  const [collapsed, setCollapsed] = useState(true);
  const info = ORACLE_INTERNALS[page] || ORACLE_INTERNALS.welcome;
  return (
    <aside className={`oracle-internals ${page === "foundation" ? "foundation" : ""} ${collapsed ? "collapsed" : ""}`} aria-label="Oracle Internals">
      <button className="oracle-internals__toggle" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed} title={collapsed ? "Show Oracle Internals" : "Collapse Oracle Internals"}>
        <span className="oracle-internals__icon">▣</span>
        {!collapsed && <><span>Oracle Internals</span><b>›</b></>}
      </button>
      {!collapsed && <div className="oracle-internals__content">
        <small>{info.engine}</small>
        <h2>{info.title}</h2>
        <p>{info.summary}</p>
        {info.readiness && <section className="oracle-internals__intro"><h3>Demo Readiness</h3><p>{info.readiness}</p></section>}
        {info.whyItMatters && <section className="oracle-internals__intro"><h3>Why It Matters</h3><p>{info.whyItMatters}</p></section>}
        <div className="oracle-internals__badges">{info.badges.map((badge) => <span key={badge}>{badge}</span>)}</div>
        {!info.readiness && <h3>Database operation</h3>}
        <pre><code>{info.sql}</code></pre>
        <h3>Teaching point</h3>
        <p className="oracle-internals__detail">{info.detail}</p>
        <footer>Oracle AI Database 26ai · one governed engine</footer>
      </div>}
    </aside>
  );
}
function App() {
  const [page, setPage] = useState("welcome"),
    [user, setUser] = useState("statewide_admin"),
    [dash, setDash] = useState(),
    [navigationContext, setNavigationContext] = useState({});
  const navigate = (nextPage, context = {}) => {
    setNavigationContext(context);
    setPage(nextPage);
  };
  const api = (x) =>
    fetch("/api/" + x, { headers: { "X-Demo-User": user } }).then((r) =>
      r.json(),
    );
  useEffect(() => {
    api("dashboard").then(setDash);
  }, [user]);
  let scope = {
    statewide_admin: "All demonstration areas",
    adelaide_central_analyst: "Central area scope",
    northern_analyst: "Northern & Western scope",
    southern_analyst: "Southern & Eastern scope",
    read_only_viewer: "Limited central scope",
  }[user];
  return (
    <div className="shell" data-release="2026-08-16-language-refresh">
      <aside>
        <button className="brand" onClick={() => setPage("welcome")} aria-label="Open Crime Data Livestack home">
          <img className="brand__oracle-logo" src="/oracle-logo.svg" alt="Oracle" />
          <span className="brand__title">Crime Data Livestack</span>
        </button>
        <nav>
          {NAV.map((n) => (
            <button
              className={`nav-item ${page === n[0] ? "active" : ""}`}
              onClick={() => navigate(n[0])}
              key={n[0]}
            >
              <span className="nav-item__label">
                <i>{n[2]}</i>
                <span>{n[1]}</span>
              </span>
              <span className="nav-item__tags">
                {PAGE_TECH[n[0]].map(([title]) => (
                  <small key={title}>{title}</small>
                ))}
              </span>
            </button>
          ))}
        </nav>
        <div className="scope">
          <small>DATA SECURITY CONTEXT</small>
          <b>{USER_LABELS[user]}</b>
          <p>{scope}</p>
        </div>
      </aside>
      <section className="main">
        <header>
          <div>
            <h1>{NAV.find((n) => n[0] === page)[1]}</h1>
          </div>
          <label>
            Demo user
            <select value={user} onChange={(e) => setUser(e.target.value)}>
              {USERS.map((u) => (
                <option key={u} value={u}>{USER_LABELS[u]}</option>
              ))}
            </select>
          </label>
        </header>
        <div className="app-workspace">
          <main>
            <PageTechTiles page={page} />
            {page === "welcome" ? (
              <Welcome go={setPage} />
            ) : page === "foundation" ? (
              <Foundation dash={dash} user={user} />
            ) : page === "data-room" ? (
              <CrimeDataRoom key={user} user={user} initialBatch={navigationContext.batchId || ''} onAiOps={batchId=>navigate('ai-ops',{batchId})} />
            ) : page === "ai-ops" ? (
              <AiOps key={user} user={user} initialBatch={navigationContext.batchId || ''} onNavigate={navigate} />
            ) : page === "dashboard" ? (
              <CommandDashboard dash={dash} user={user} />
            ) : page === "signals" ? (
              <CrimePatternSignals key={user} user={user} onNavigate={navigate} />
            ) : page === "persons" ? (
              <PersonIntelligence user={user} />
            ) : page === "graph" ? (
              <CaseRelationships user={user} initialCaseRef={navigationContext.caseRef} />
            ) : page === "geography" ? (
              <IncidentMap user={user} initialQuery={navigationContext.query} initialPatternCode={navigationContext.patternCode} />
            ) : page === "incidents" ? (
              <IncidentExplorer user={user} initialQuery={navigationContext.query} />
            ) : page === "analytics" ? (
              <IncidentCapacityAnalytics user={user} initialTab={navigationContext.analyticsTab} />
            ) : page === "ask" ? (
              <AskCrimeData key={user} user={user} />
            ) : page === "agents" ? (
              <CrimeDataAgentConsole key={user} user={user} />
            ) : (
              <Feature page={page} dash={dash} />
            )}
          </main>
          <OracleInternalsPanel page={page} />
        </div>
        <footer className="app-use-notice"><details><summary>Data use notice</summary><p>Demonstration data only — not for operational policing decisions. No record represents a real person, address, incident, or investigation.</p></details></footer>
      </section>
    </div>
  );
}
function Hero({ title, text, go, label }) {
  return (
    <section className="hero">
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
        {go && (
          <button className="primary" onClick={go}>
            {label} →
          </button>
        )}
      </div>
      <b>◌</b>
    </section>
  );
}
function Welcome({ go }) {
  const [useCasePage, setUseCasePage] = useState(0);
  const useCasesPerPage = 3;
  const pageCount = Math.ceil(CAP.length / useCasesPerPage);
  const carouselStart = useCasePage * useCasesPerPage;
  const visibleUseCases = CAP.slice(carouselStart, carouselStart + useCasesPerPage);
  const carouselEnd = carouselStart + visibleUseCases.length;

  return (
    <>
      <Hero
        title="Crime intelligence on one governed Oracle data platform."
        text="Explore a demonstration environment that connects incident activity, narrative pattern signals, spatial context, case relationships, and governed AI workflows. It demonstrates data capabilities—not operational policing decisions."
        go={() => go("foundation")}
        label="Explore the data foundation"
      />
      <div className="section-head">
        <div>
          <h2>Key Crime Data Use Cases Featured</h2>
          <p>
            Each experience is grounded in deliberately structured,
            non-identifying demonstration data.
          </p>
        </div>
        <div className="use-case-carousel__controls" aria-label="Use case carousel controls">
          <button
            type="button"
            aria-label="Show previous use cases"
            onClick={() => setUseCasePage((current) => Math.max(0, current - 1))}
            disabled={useCasePage === 0}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Show next use cases"
            onClick={() => setUseCasePage((current) => Math.min(pageCount - 1, current + 1))}
            disabled={useCasePage === pageCount - 1}
          >
            →
          </button>
        </div>
      </div>
      <div className="use-case-carousel__status">
        <span>Showing {carouselStart + 1}–{carouselEnd} of {CAP.length}</span>
        <div aria-label="Use case groups">
          {Array.from({ length: pageCount }).map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Show use case group ${index + 1}`}
              aria-current={useCasePage === index ? "true" : undefined}
              className={useCasePage === index ? "active" : ""}
              onClick={() => setUseCasePage(index)}
            />
          ))}
        </div>
      </div>
      <div className="cap-grid" aria-live="polite" aria-label={`Use cases ${carouselStart + 1} through ${carouselEnd}`}>
        {visibleUseCases.map((c) => (
          <article style={{ borderTopColor: c[3] }} key={c[0]}>
            <h3>{c[0]}</h3>
            <p>{c[1]}</p>
            <ul>
              {c[2].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <section className="story">
        <div>
          <small className="kicker">SAFE BY DESIGN</small>
          <h2>Descriptive analytics, constrained access</h2>
          <p>
            The seeded data separates linked patterns from control records so
            vector, graph, JSON, and security demonstrations are meaningful
            without profiling or prediction.
          </p>
        </div>
        <button onClick={() => go("signals")}>View pattern signals →</button>
      </section>
    </>
  );
}
function Foundation({ dash, user }) {
  const [profile, setProfile] = useState(null), [selectedProfileCode, setSelectedProfileCode] = useState("ADELAIDE_DATA_V2"), [working, setWorking] = useState(""), [notice, setNotice] = useState(""), [error, setError] = useState(""), [confirmation, setConfirmation] = useState("");
  const profileDefaults = { ADELAIDE_DATA_V2: { city: "Adelaide Metropolitan Area", name: "Adelaide Data Set V2 - Scenario Enrichment", description: "Adelaide V2 scenario enrichment (ADELAIDE_DATA_V2)." }, PERTH_DATA: { city: "Perth Metropolitan Area", name: "Perth Data Set Profile", description: "Perth Metropolitan WAPOL-calibrated demonstration data." }, BRISBANE_DATA: { city: "Brisbane Metropolitan Area", name: "Brisbane Data Set Profile", description: "Brisbane Metropolitan QPS-calibrated demonstration data." } };
  const loadProfile = (profileCode = selectedProfileCode) => fetch("/api/setup/profiles?profileCode=" + encodeURIComponent(profileCode), { headers: { "X-Demo-User": user } }).then(async (response) => { const body = await response.json(); if (!response.ok) throw Error(body.error || "Profile status unavailable"); return body; }).then(setProfile).catch((e) => setError(e.message));
  useEffect(() => { setNotice(""); setError(""); setConfirmation(""); loadProfile(); }, [user, selectedProfileCode]);
  const perform = (action, payload = {}) => { setWorking(action); setNotice(""); setError(""); fetch("/api/setup/" + action, { method: "POST", headers: { "Content-Type": "application/json", "X-Demo-User": user }, body: JSON.stringify({ ...payload, profileCode: selectedProfileCode }) }).then(async (response) => { const body = await response.json(); if (!response.ok) throw Error(body.error || "Setup action unavailable"); return body; }).then((body) => { setNotice(body.message); setProfile(body); setConfirmation(""); }).catch((e) => setError(e.message)).finally(() => setWorking("")); };
  const exportProfile = () => { setWorking("export"); setNotice(""); setError(""); fetch("/api/setup/export", { headers: { "X-Demo-User": user } }).then(async (response) => { if (!response.ok) { const body = await response.json(); throw Error(body.error || "Export unavailable"); } return response.blob(); }).then((blob) => { const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = "adelaide-data-set-profile.json"; link.click(); URL.revokeObjectURL(url); setNotice("Adelaide Data Set Profile export downloaded."); }).catch((e) => setError(e.message)).finally(() => setWorking("")); };
  const admin = user === "statewide_admin", selectedProfile = profile?.profile, selectedDefaults = profileDefaults[selectedProfileCode], profileName = selectedProfile?.PROFILE_NAME || selectedDefaults.name, confirmationText = `DELETE ${String(selectedProfile?.CITY_LABEL || selectedDefaults.city).split(" ")[0].toUpperCase()} DATA SET`, profiles = Object.keys(profileDefaults).map((code) => ({ ...profileDefaults[code], ...(profile?.profiles?.find((item) => item.PROFILE_CODE === code) || {}), PROFILE_CODE: code }));
  return (
    <>
      <Hero
        title="A governed foundation for demonstration incident intelligence."
        text="Relational records, flexible JSON, vector-ready narratives, graph relationships, spatial context, and database security work together in one platform."
      />
      <Metrics
        values={[
          [
            "Demonstration incident records",
            dash?.summary?.INCIDENT_COUNT,
            "#437c94",
          ],
          ["Crime categories", dash?.summary?.CATEGORY_COUNT, "#4f7d7b"],
          ["Security personas", "5", "#796087"],
          ["Watched crime patterns", dash?.watchedPatterns?.length, "#aa643b"],
        ]}
      />
      <div className="feature-stack">
        {[
          [
            "Relational & JSON",
            "Incident, report, case, evidence, entitlement, and audit structures support descriptive use cases.",
            "JSON duality views",
          ],
          [
            "Vector-ready narratives",
            "Repeated linked patterns vary wording so semantic similarity can be demonstrated.",
            "Oracle Vector Search",
          ],
          [
            "Graph & spatial context",
            "Case links, pattern labels, patrol areas, and approximate coordinates are graph and map ready.",
            "Property Graph · Spatial",
          ],
          [
            "Deep Data Security",
            "Statewide and regional data contexts create differentiated scopes; the local demo applies its scoped view.",
            "Deep Sec · ABAC",
          ],
        ].map((x) => (
          <article key={x[0]}>
            <i>◈</i>
            <div>
              <h3>{x[0]}</h3>
              <p>{x[1]}</p>
            </div>
            <span>{x[2]}</span>
          </article>
        ))}
      </div>
      <section className="crimedata-setup">
        <header><div><small className="kicker">CRIMEDATA SETUP · Z_BASE DATASET PROFILE LIBRARY</small><h2>CrimeData Setup</h2><p>Choose an Adelaide/SAPOL, Perth/WAPOL, or Brisbane/QPS profile. Restoring a profile replaces the one active operational dataset from its independent Z_BASE library copy.</p></div></header>
        <div className="crimedata-setup__profiles">{profiles.map((item) => <button type="button" className={item.PROFILE_CODE === selectedProfileCode ? "active" : "planned"} key={item.PROFILE_CODE} onClick={() => setSelectedProfileCode(item.PROFILE_CODE)}><small>{item.PROFILE_CODE === profile?.activeProfileCode ? "ACTIVE DATASET" : item.LAST_BACKUP_AT ? "AVAILABLE TO RESTORE" : "PROFILE PENDING"}</small><b>{item.CITY_LABEL || item.city}</b><p>{item.description}</p>{item.LAST_BACKUP_AT && <span className="crimedata-setup__coverage"><strong>{Number(item.INCIDENT_COUNT || 0).toLocaleString("en-AU")}</strong> Crime Incidents Across <strong>{Number(item.SUBURB_COUNT || 0).toLocaleString("en-AU")}</strong> Suburbs</span>}<em>{item.LAST_BACKUP_AT ? `Z_BASE captured: ${String(item.LAST_BACKUP_AT).slice(0,19).replace("T"," ")}` : "Awaiting Z_BASE profile registration"}</em></button>)}</div>
        <div className="crimedata-setup__counts"><span><b>{Number(profile?.live?.INCIDENTS || 0).toLocaleString("en-AU")}</b> active incidents</span><span><b>{Number(profile?.live?.REPORTS || 0).toLocaleString("en-AU")}</b> active reports</span><span><b>{Number(profile?.live?.PERSONS || 0).toLocaleString("en-AU")}</b> active person profiles</span><span><b>{Number(profile?.backup?.INCIDENTS || 0).toLocaleString("en-AU")}</b> selected Z_BASE incidents</span></div>
        <div className="crimedata-setup__actions"><button className="restore" onClick={() => perform("load")} disabled={!admin || !!working || !Number(profile?.backup?.INCIDENTS)}>{working === "load" ? "Restoring…" : `Restore ${profileName}`}</button>{["ADELAIDE_DATA_V2","PERTH_DATA","BRISBANE_DATA"].includes(selectedProfileCode) && <button className="restore nrt" onClick={() => perform("load-nrt")} disabled={!admin || !!working || !Number(profile?.backup?.INCIDENTS)}>{working === "load-nrt" ? "Restoring NRT…" : `Restore ${profileName} NRT`}</button>}</div>
        {!admin && <p className="crimedata-setup__access">Restoring a profile is available to the Statewide Admin demo user.</p>}{notice && <p className="crimedata-setup__notice">{notice}</p>}{error && <p className="pattern-error">CrimeData Setup error: {error}</p>}<footer>The standard restore preserves recorded timestamps. Adelaide, Perth, and Brisbane NRT restores shift all incident occurrence times together so the latest incident is now; they never change the Z_BASE snapshot.</footer>
      </section>
    </>
  );
}
function Metrics({ values }) {
  return (
    <div className="metric-grid">
      {values.map((v) => (
        <article style={{ borderTopColor: v[2] }} key={v[0]}>
          <span>{v[0]}</span>
          <b>
            {Number.isFinite(Number(v[1]))
              ? Number(v[1]).toLocaleString("en-AU")
              : v[1] || "—"}
          </b>
        </article>
      ))}
    </div>
  );
}
function CommandDashboard({ dash, user }) {
  let s = dash?.summary || {},
    cats = dash?.categories || [],
    areas = dash?.areas || [],
    signals = dash?.signals || {},
    watchedPatterns = dash?.watchedPatterns || [];
  return (
    <>
      <section className="command-title">
        <div>
          <h2>Incident activity overview</h2>
          <p>Live descriptive view of authorised incident data.</p>
        </div>
        <button onClick={() => location.reload()}>↻ Refresh</button>
      </section>
      <div className="command-kpis">
        <Kpi
          icon="▤"
          label="Authorised incidents"
          value={s.INCIDENT_COUNT}
          meta="Current data-security scope"
          tone="#437c94"
        />
        <Kpi
          icon="◌"
          label="Open records"
          value={s.OPEN_COUNT}
          meta="Reported, assigned or under review"
          tone="#c74634"
        />
        <Kpi
          icon="⌁"
          label="Watched crime patterns"
          value={watchedPatterns.length}
          meta="Graph and community-signal watches"
          tone="#4f7d7b"
        />
        <Kpi
          icon="◉"
          label="Community signals"
          value={signals.POST_COUNT_72H}
          meta={`${Number(signals.LINKED_INCIDENT_COUNT || 0)} reviewed incident links`}
          tone="#aa643b"
        />
        <Kpi
          icon="⌘"
          label="Access context"
          value={user === "statewide_admin" ? "All areas" : "Regional"}
          meta="Database-scoped data access"
          tone="#796087"
        />
      </div>
      <div className="command-grid">
        <Panel
          title="Authorised activity profile"
          sub="Category composition in the live data scope"
        >
          <Bars rows={cats} n="CATEGORY_NAME" />
          <p className="source-note">
            Source: governed incident records · descriptive counts only
          </p>
        </Panel>
        <Panel
          title="Area coverage"
          sub="Geography returned after security filtering"
        >
          <Bars rows={areas} n="AREA_NAME" />
          <div className="oracle-note">
            <b>Deep Data Security context</b>
            <p>
              Switching the demo user changes the database-scoped result set.
              Categories remain visible only for authorised areas.
            </p>
          </div>
        </Panel>
      </div>
      <div className="signal-chart-grid">
        <VelocityChart user={user} />
        <CrimeCategoryTotals rows={cats} />
      </div>
      <section className="command-grid lower">
        <Panel
          title="Watched pattern scenarios"
          sub="Guided exploration entry points"
        >
          <div className="watch-list">
            {watchedPatterns.map((pattern) => (
              <div key={pattern.PATTERN_CODE}>
                <i style={{ color: pattern.DISPLAY_COLOR }}>●</i>
                <span>
                  <b>{pattern.PATTERN_NAME}</b>
                  <small>{pattern.INCIDENT_COUNT} incidents · {pattern.POST_COUNT} public posts</small>
                </span>
                <em>{String(pattern.PATTERN_KIND).replaceAll("_", " ")}</em>
                <strong>›</strong>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Oracle AI Database capabilities"
          sub="What this command centre demonstrates"
        >
          <div className="capability-mini">
            <div>
              <b>In-Memory & relational</b>
              <p>Fast governed aggregation over incident records.</p>
            </div>
            <div>
              <b>JSON & duality</b>
              <p>Flexible evidence and report enrichments.</p>
            </div>
            <div>
              <b>Vector & graph</b>
              <p>Semantic pattern and case-context exploration.</p>
            </div>
            <div>
              <b>Deep Sec</b>
              <p>Geographic scope follows the active user context.</p>
            </div>
          </div>
        </Panel>
      </section>
      <section className="story compact">
        <div>
          <small className="kicker">INTERPRETATION GUIDE</small>
          <h2>Descriptive activity, not prediction</h2>
          <p>
            This page surfaces live governed data, but it never estimates risk,
            assigns people, allocates resources, or makes operational recommendations.
          </p>
        </div>
      </section>
    </>
  );
}
function VelocityChart({ user }) {
  const [d, setD] = useState({ groups: [], points: [] }),
    [w, setW] = useState("30d"),
    [hiddenGroups, setHiddenGroups] = useState(() => new Set());
  useEffect(() => {
    fetch("/api/dashboard/crime-category-signal-velocity?window=" + w, {
      headers: { "X-Demo-User": user },
    })
      .then((r) => r.json())
      .then(setD);
  }, [user, w]);
  useEffect(() => setHiddenGroups(new Set()), [user]);
  const groups = d.groups || [], rows = d.points || [],
    visibleGroups = groups.filter((group) => !hiddenGroups.has(group.CATEGORY_CODE));
  let max = Math.max(1, ...rows.flatMap((row) => visibleGroups.map((group) => +(row.COUNTS?.[group.CATEGORY_CODE] || 0)))),
    points = (code) =>
      rows
        .map(
          (x, i) =>
            `${rows.length < 2 ? 50 : (i / (rows.length - 1)) * 100},${94 - ((x.COUNTS?.[code] || 0) / max) * 84}`,
        )
        .join(" ");
  const toggleGroup = (code) => setHiddenGroups((current) => {
    const next = new Set(current);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  return (
    <section className="velocity">
      <div className="velocity-head">
        <div>
          <h2>Crime Category Signal Velocity</h2>
          <p>
            The same authorised categories shown in the activity profile,
            grouped across the selected time window.
          </p>
        </div>
        <div className="windows">
          {["1h", "2h", "24h", "48h", "7d", "30d", "60d", "1y", "2y"].map((x) => (
            <button
              className={w === x ? "on" : ""}
              onClick={() => setW(x)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
      <div className="legend">
        <div className="legend__head">
          <span>{groups.length} authorised categories</span>
          <small>Select a category to show or hide its line.</small>
          {hiddenGroups.size > 0 && <button type="button" onClick={() => setHiddenGroups(new Set())}>Show all</button>}
        </div>
        <div className="legend__items">
          {groups.map((group) => {
            const visible = !hiddenGroups.has(group.CATEGORY_CODE);
            return <button type="button" key={group.CATEGORY_CODE} className={visible ? "on" : "off"} aria-pressed={visible} onClick={() => toggleGroup(group.CATEGORY_CODE)}><i style={{ background: group.DISPLAY_COLOR }} />{group.CATEGORY_NAME}</button>;
          })}
        </div>
      </div>
      <svg
        className="velocity-line"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <line x1="0" y1="94" x2="100" y2="94" />
        {visibleGroups.map((group) => <polyline key={group.CATEGORY_CODE} points={points(group.CATEGORY_CODE)} style={{ stroke: group.DISPLAY_COLOR }} />)}
      </svg>
      <div className="axis">
        <span>{rows[0]?.DAY_LABEL || "—"}</span>
        <span>{rows[rows.length - 1]?.DAY_LABEL || "—"}</span>
      </div>
      <small>
        Source: scoped relational incident activity. This is a descriptive
        demonstration-data chart, not a predictive signal.
      </small>
    </section>
  );
}
function CrimeCategoryTotals({ rows }) {
  const total = rows.reduce((sum, row) => sum + (+row.COUNT || 0), 0);
  let progress = 0,
    stops = rows
      .map((row, i) => {
        let start = progress,
          end = progress + ((+row.COUNT || 0) / Math.max(total, 1)) * 100;
        progress = end;
        return `${row.DISPLAY_COLOR || "#437c94"} ${start}% ${end}%`;
      })
      .join(", ");
  return (
    <section className="crime-category-totals">
      <div>
        <h2>Total Incidents by Crime Category</h2>
        <p>All authorised incidents in the current security scope.</p>
      </div>
      {total ? (
        <>
          <div
            className="category-donut"
            style={{ background: `conic-gradient(${stops})` }}
          >
            <div>
              <b>{total.toLocaleString("en-AU")}</b>
              <span>Total incidents</span>
            </div>
          </div>
          <div className="category-legend">
            {rows.map((row, i) => {
              let value = +row.COUNT || 0;
              return (
                <div key={row.CATEGORY_NAME}>
                  <i style={{ background: row.DISPLAY_COLOR || "#437c94" }} />
                  <span>{row.CATEGORY_NAME}</span>
                  <b>
                    {((value / total) * 100).toFixed(0)}% ·{" "}
                    {value.toLocaleString("en-AU")}
                  </b>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="category-empty">No authorised incident data available.</p>
      )}
      <small>
        Source: scoped relational incident activity · descriptive counts only
      </small>
    </section>
  );
}
function Kpi({ icon, label, value, meta, tone }) {
  return (
    <article className="command-kpi">
      <i style={{ color: tone, background: tone + "18" }}>{icon}</i>
      <b>
        {Number.isFinite(Number(value))
          ? Number(value).toLocaleString("en-AU")
          : value}
      </b>
      <span>{label}</span>
      <small>{meta}</small>
    </article>
  );
}
function PoiPortrait({ person, compact = false }) {
  if (person?.PORTRAIT_ASSET_URI) return <img className={`poi-portrait${compact ? " compact" : ""}`} src={person.PORTRAIT_ASSET_URI} alt={person.PORTRAIT_ALT_TEXT || "Generated profile portrait"} />;
  const tones = ["#c96b4f", "#637e9d", "#8b6e9d", "#4f8978", "#b18247", "#6c7783"], number = Number(String(person?.PORTRAIT_VARIANT || "").match(/(\d+)$/)?.[1] || 1);
  return <div className={`poi-portrait poi-portrait--generated${compact ? " compact" : ""}`} style={{ "--portrait-tone": tones[(number - 1) % tones.length] }} aria-label={person?.PORTRAIT_ALT_TEXT || "Generated profile portrait"} role="img"><span className="poi-portrait__hair" /><span className="poi-portrait__head"><i /><i /><b /></span></div>;
}
function displayAttribute(value) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  return String(value).replaceAll("_", " ");
}
function ObjectDetailModal({ object, onClose, user }) {
  const [incidentDetail, setIncidentDetail] = useState(null);
  const [personDetail, setPersonDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const incidentRef = object?.type === "incident" ? object.INCIDENT_REF || object.label : "";
  const personRef = object?.type === "person" ? object.PERSON_REF || object.label : "";
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  useEffect(() => {
    if (!incidentRef) { setIncidentDetail(null); setDetailError(""); return; }
    setIncidentDetail(null); setDetailError("");
    fetch("/api/incidents/" + encodeURIComponent(incidentRef), { headers: { "X-Demo-User": user } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw Error(data.error || "Incident detail unavailable"); return data; })
      .then(setIncidentDetail)
      .catch((error) => setDetailError(error.message));
  }, [incidentRef, user]);
  useEffect(() => {
    if (!personRef) { setPersonDetail(null); return; }
    setPersonDetail(null); setDetailError("");
    fetch("/api/persons/" + encodeURIComponent(personRef), { headers: { "X-Demo-User": user } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw Error(data.error || "Person detail unavailable"); return data; })
      .then(setPersonDetail)
      .catch((error) => setDetailError(error.message));
  }, [personRef, user]);
  if (!object) return null;
  const record = incidentDetail?.incident || personDetail?.person || object;
  const type = object.type || "incident";
  const details = type === "person" ? [
    ["Person reference", record.PERSON_REF || record.label],
    ["Profile name", record.DISPLAY_NAME],
    ["Alias", record.ALIAS_NAME || record.alias || record.detail?.split(" · ")[0]],
    ["Profile status", record.PERSON_STATUS || record.status || record.detail?.split(" · ")[1]],
    ["Linked incidents", record.SCOPED_INCIDENT_COUNT || object.linkedIncidents],
    ["Profile created", record.CREATED_AT],
  ] : type === "evidence" ? [
    ["Evidence reference", object.EVIDENCE_REF || object.label],
    ["Evidence type", object.EVIDENCE_TYPE || object.label],
    ["Linked incident", object.linkedIncidentRef],
    ["Observed detail", object.OBSERVED_DETAIL || object.detail],
    ["Shared marker", object.SHARED_MARKER],
    ["Visual asset", object.ASSET_URI],
    ["Recorded", object.CREATED_AT],
  ] : [
    ["Incident reference", record.INCIDENT_REF || record.label],
    ["Crime category", record.CATEGORY_NAME || record.category || record.detail?.split(" · ")[0]],
    ["Status", record.INCIDENT_STATUS || record.status],
    ["Occurred", record.OCCURRED_AT],
    ["Suburb", record.SUBURB || record.suburb || record.detail?.split(" · ")[1]],
    ["Patrol area", record.AREA_NAME],
    ["Location type", record.LOCATION_TYPE],
    ["Address details (synthetic / masked)", [record.ADDRESS_LINE_1, record.ADDRESS_LOCALITY, record.ADDRESS_REGION, record.ADDRESS_POSTCODE, record.ADDRESS_COUNTRY_CODE].filter(Boolean).join(", ")],
    ["Address precision", record.ADDRESS_PRECISION],
    ["Modus operandi", record.MODUS_OPERANDI],
  ];
  const title = type === "person" ? "Person of Interest" : type === "evidence" ? "Evidence" : "Crime Incident";
  const identifier = type === "person" ? object.PERSON_REF || object.label : type === "evidence" ? object.EVIDENCE_REF || object.label : record.INCIDENT_REF || record.label;
  return <div className="object-detail-modal__backdrop" role="presentation" onMouseDown={onClose}>
    <section className="object-detail-modal" role="dialog" aria-modal="true" aria-labelledby="object-detail-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><small>{title.toUpperCase()} · AUTHORISED RECORD</small><h2 id="object-detail-title">{identifier}</h2></div><button type="button" onClick={onClose} aria-label="Close detail dialog">×</button></header>
      <div className="object-detail-modal__attributes">{details.map(([label, value]) => <div key={label}><small>{label}</small><b>{displayAttribute(value)}</b></div>)}</div>
      {type === "incident" && incidentRef && !incidentDetail && !detailError && <p className="object-detail-modal__loading">Loading incident report attributes…</p>}
      {type === "person" && personRef && !personDetail && !detailError && <p className="object-detail-modal__loading">Loading person profile attributes…</p>}
      {type === "incident" && detailError && <p className="object-detail-modal__notice">Incident report attributes could not be loaded: {detailError}</p>}
      {type === "person" && detailError && <p className="object-detail-modal__notice">Person profile attributes could not be loaded: {detailError}</p>}
      {record.REPORT_SUMMARY && <div className="object-detail-modal__summary"><small>Report Summary</small><p>{record.REPORT_SUMMARY}</p></div>}
      {record.REPORT_TEXT && <div className="object-detail-modal__summary"><small>Report Text</small><p>{record.REPORT_TEXT}</p></div>}
      {type === "evidence" && object.ASSET_URI && <figure className="object-detail-modal__evidence-image"><img src={object.ASSET_URI} alt={object.ASSET_CAPTION || "Generated fictional evidence scene"} /><figcaption>{object.ASSET_CAPTION || object.OBSERVED_DETAIL}</figcaption></figure>}
      {type === "person" && record.NARRATIVE_SUMMARY && <div className="object-detail-modal__summary"><small>Profile Summary</small><p>{record.NARRATIVE_SUMMARY}</p></div>}
      {type === "person" && record.NARRATIVE_TEXT && <div className="object-detail-modal__summary"><small>Profile Narrative</small><p>{record.NARRATIVE_TEXT}</p></div>}
      {type === "person" && personDetail?.assets?.length > 0 && <div className="object-detail-modal__summary"><small>Generated Visual Assets</small><p>{personDetail.assets.map((asset) => `${asset.ASSET_REF} · ${displayAttribute(asset.ASSET_KIND)} · ${asset.EMBEDDING_MODEL}`).join("\n")}</p></div>}
      {type === "person" && personDetail?.incidentLinks?.length > 0 && <div className="object-detail-modal__summary"><small>Incident Relationship Context</small><p>{personDetail.incidentLinks.map((link) => `${link.INCIDENT_REF} · ${displayAttribute(link.CONNECTION_TYPE)}${link.LINK_SUMMARY ? ` — ${link.LINK_SUMMARY}` : ""}`).join("\n\n")}</p></div>}
      {type === "person" && <p className="object-detail-modal__notice">Profile attributes are demonstration-only and do not represent identity verification or biometric information.</p>}
      <footer><span>Read-only detail · Deep Data Security scoped</span><button type="button" onClick={onClose}>Close</button></footer>
    </section>
  </div>;
}
function PersonIntelligence({ user }) {
  const [people, setPeople] = useState([]), [selectedRef, setSelectedRef] = useState(""), [similar, setSimilar] = useState(null), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const [narrativeQuery, setNarrativeQuery] = useState("art gallery transactions charitable foundation and connected entities"), [narrativeSearch, setNarrativeSearch] = useState(null), [narrativeLoading, setNarrativeLoading] = useState(false);
  const [visualQuery, setVisualQuery] = useState(null), [activeSearch, setActiveSearch] = useState(null), [narrativeError, setNarrativeError] = useState("");
  const narrativeRequest = useRef(0);
  useEffect(() => { setVisualQuery(null); setActiveSearch(null); setNarrativeSearch(null); setNarrativeError(""); setNarrativeLoading(false); return () => { narrativeRequest.current++; }; }, [user]);
  useEffect(() => { setError(""); fetch("/api/persons", { headers: { "X-Demo-User": user } }).then(async (r) => { const data = await r.json(); if (!r.ok) throw Error(data.error || "Person data unavailable"); return data; }).then((data) => { setPeople(data); setSelectedRef(data.find((person) => person.NARRATIVE_VECTOR_READY === 1)?.PERSON_REF || data[0]?.PERSON_REF || ""); }).catch((e) => setError(e.message)); }, [user]);
  useEffect(() => { const selectedPerson = people.find((person) => person.PERSON_REF === selectedRef); if (!selectedRef || !selectedPerson?.NARRATIVE_VECTOR_READY) { setSimilar(null); return; } setLoading(true); setError(""); fetch("/api/persons/similar?personRef=" + encodeURIComponent(selectedRef), { headers: { "X-Demo-User": user } }).then(async (r) => { const data = await r.json(); if (!r.ok) throw Error(data.error || "Similarity search unavailable"); return data; }).then(setSimilar).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [selectedRef, user, people]);
  const selected = people.find((person) => person.PERSON_REF === selectedRef);
  const profileName = (person) => person.DISPLAY_NAME || person.ALIAS_NAME || person.PERSON_REF;
  const aliasLabel = (person) => person.ALIAS_NAME && person.ALIAS_NAME !== person.DISPLAY_NAME ? `Alias: ${person.ALIAS_NAME}` : "";
  const postSearch = (path, body) => fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "X-Demo-User": user }, body: JSON.stringify(body) }).then(async (response) => { const data = await response.json(); if (!response.ok) throw Error(data.error || "Vector search unavailable"); return data; });
  const runNarrativeSearch = (event) => { event?.preventDefault(); const id = ++narrativeRequest.current; setActiveSearch("narrative"); setNarrativeSearch(null); setNarrativeLoading(true); setNarrativeError(""); postSearch("/api/persons/search/narrative", { query: narrativeQuery, topK: 6 }).then(data => { if (id === narrativeRequest.current) setNarrativeSearch(data); }).catch(e => { if (id === narrativeRequest.current) setNarrativeError(e.message); }).finally(() => { if (id === narrativeRequest.current) setNarrativeLoading(false); }); };
  const resultButtons = (results, scoreLabel) => <div className="similar-poi__results">{results?.map((person) => <button key={`${scoreLabel}-${person.PERSON_REF}`} onClick={() => setSelectedRef(person.PERSON_REF)}><PoiPortrait person={person} compact /><div><b>{person.PERSON_REF} · {profileName(person)}</b><span>{[aliasLabel(person), person.PERSON_STATUS.replaceAll("_", " ")].filter(Boolean).join(" · ")}</span><p>{person.NARRATIVE_SUMMARY}</p></div><strong>{(person.SIMILARITY_SCORE * 100).toFixed(0)}%<small>{scoreLabel}</small></strong></button>)}</div>;
  return <section className="person-intelligence">
    <div className="person-intelligence__head"><div><small className="kicker">VISUAL + NARRATIVE VECTORS · ORACLE VECTOR SEARCH</small><h2>Person Intelligence</h2><p>Compare generated portrait imagery and profile narratives through two independent, data-driven vector searches.</p></div><span>fictional identities only</span></div>
    <div className="person-intelligence__notice"><b>Controlled visual comparison</b><span>Only generated fictional people and test images belong in this workflow. Visual similarity produces candidates for manual review; it is not a biometric finding or real-person identification.</span></div>
    {error && <p className="pattern-error">Person search error: {error}</p>}
    <div className="person-intelligence__layout">
      <aside className="person-list"><small>AUTHORISED POI PROFILES ({people.length})</small>{people.map((person) => <button key={person.PERSON_REF} className={person.PERSON_REF === selectedRef ? "active" : ""} onClick={() => setSelectedRef(person.PERSON_REF)}><PoiPortrait person={person} compact /><span><b>{person.PERSON_REF}</b><em>{profileName(person)}</em><small>{[aliasLabel(person), person.NARRATIVE_VECTOR_READY && person.VISUAL_VECTOR_READY ? "visual + narrative ready" : `${person.SCOPED_INCIDENT_COUNT} scoped incidents`].filter(Boolean).join(" · ")}</small></span></button>)}</aside>
      <div className="person-intelligence__workbench">
        {selected && <section className="person-profile"><PoiPortrait person={selected} /><div><small>SELECTED PROFILE</small><h3>{selected.PERSON_REF} · {profileName(selected)}</h3>{aliasLabel(selected) && <small className="person-profile__alias">{aliasLabel(selected)}</small>}<p>{selected.NARRATIVE_SUMMARY}</p><div className="person-profile__tags"><span>{selected.PERSON_STATUS.replaceAll("_", " ")}</span><span>{selected.NARRATIVE_VECTOR_READY ? "384d narrative vector" : "narrative vector pending"}</span><span>{selected.VISUAL_VECTOR_READY ? "512d visual vector" : "visual vector pending"}</span></div></div></section>}
        <div className="poi-dual-search">
          <PoiVisualSearch key={user} user={user} query={visualQuery} setQuery={setVisualQuery} onSearchStart={() => setActiveSearch("visual")} />
          <form className="poi-search-card poi-narrative-search" onSubmit={runNarrativeSearch} aria-labelledby="poi-narrative-title"><div className="poi-visual-search__heading"><small>NARRATIVE VECTOR SEARCH</small><h3 id="poi-narrative-title">Search using a description</h3><p>Describe a role, activity or context to find related profiles.</p></div><textarea value={narrativeQuery} onChange={(event) => setNarrativeQuery(event.target.value)} rows="6" aria-label="Narrative vector query" placeholder="For example: cash flow and financial records" /><button type="submit" disabled={narrativeLoading || narrativeQuery.trim().length < 3}>{narrativeLoading ? "Searching narratives…" : "Search narratives"}</button>{narrativeError && <p className="pattern-error" role="alert">{narrativeError}</p>}</form>
        </div>
        <section className="poi-search-results" aria-labelledby="poi-results-title" data-mode={activeSearch || "none"}>
          <h3 id="poi-results-title">{activeSearch === "visual" ? "Visual search results" : activeSearch === "narrative" ? "Narrative search results" : "Vector search results"}</h3>
          {!activeSearch && <p>Use either search above. Results from your latest search appear here.</p>}
          {activeSearch === "visual" && <>{visualQuery?.data && <><p className="poi-results-source">Image: {visualQuery.filename}</p><PoiVectorResults data={visualQuery.data} mode="visual" onViewProfile={setSelectedRef} /></>}{visualQuery?.loading && <p role="status">Searching your uploaded image…</p>}{visualQuery?.error && <p>No results for this image. Check the message above and try again.</p>}{!visualQuery && <p>Choose a test image above to see visual matches.</p>}</>}
          {activeSearch === "narrative" && <>{narrativeSearch && <><p className="poi-results-source">Description: {narrativeSearch.query}</p><PoiVectorResults data={narrativeSearch} mode="narrative" onViewProfile={setSelectedRef} /></>}{narrativeLoading && <p role="status">Searching your description…</p>}{narrativeError && <p>No results for this description. Check the message above and try again.</p>}</>}
        </section>
        <details className="similar-poi"><summary>Related narratives for the browsed profile</summary><div className="similar-poi__head"><h3>{loading ? "Calculating narrative similarity…" : "Nearest profile narratives"}</h3></div>{similar && <p className="similar-poi__note">{similar.notice}</p>}{resultButtons(similar?.results, "narrative")}</details>
      </div>
    </div>
    <small className="person-intelligence__footnote">Both searches generate model vectors outside the application UI, then Oracle ranks authorised rows with <code>VECTOR_DISTANCE(..., COSINE)</code> through <code>secure_persons_of_interest_v</code>.</small>
  </section>;
}
const FORCE_GRAPH_COLORS = {
  case: "#c74634",
  incident: "#437c94",
  person: "#aa643b",
  evidence: "#796087",
};

function ForceDirectedCaseGraph({ network, selectedNodeId, onNodeSelect }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const onNodeSelectRef = useRef(onNodeSelect);
  const [width, setWidth] = useState(800);
  const height = 520;

  useEffect(() => { onNodeSelectRef.current = onNodeSelect; }, [onNodeSelect]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const updateWidth = () => {
      const nextWidth = Math.round(container.getBoundingClientRect().width);
      if (nextWidth > 0) setWidth(nextWidth);
    };
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    updateWidth();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!network?.nodes?.length || !width) return undefined;
    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);
    svg.selectAll("*").remove();
    tooltip.style("opacity", 0);

    const nodeIds = new Set(network.nodes.map((node) => node.id));
    const nodes = network.nodes.map((node) => ({ ...node, radius: node.type === "case" ? 27 : 15 }));
    const links = network.edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({ ...edge, source: edge.source, target: edge.target }));
    const root = svg.append("g");
    const defs = svg.append("defs");
    defs.append("marker").attr("id", "case-force-arrow").attr("viewBox", "0 -4 8 8")
      .attr("refX", 9).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
      .append("path").attr("d", "M0,-3.5L8,0L0,3.5").attr("fill", "#70828a");

    const zoom = d3.zoom().scaleExtent([0.25, 4]).on("zoom", (event) => root.attr("transform", event.transform));
    svg.call(zoom);
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((node) => node.id).distance((link) => link.type === "semantic similarity" ? 135 : 95).strength(0.65))
      .force("charge", d3.forceManyBody().strength(-340))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((node) => node.radius + 26));

    const link = root.append("g").attr("class", "case-force__links").selectAll("line").data(links).join("line")
      .attr("class", (edge) => `case-force__link${edge.type === "semantic similarity" ? " case-force__link--similarity" : ""}`)
      .attr("marker-end", "url(#case-force-arrow)");
    const node = root.append("g").attr("class", "case-force__nodes").selectAll("g").data(nodes).join("g")
      .attr("class", (item) => `case-force__node case-force__node--${item.type}${item.id === selectedNodeId ? " is-selected" : ""}`)
      .call(d3.drag()
        .on("start", (event, item) => { if (!event.active) simulation.alphaTarget(0.25).restart(); item.fx = item.x; item.fy = item.y; })
        .on("drag", (event, item) => { item.fx = event.x; item.fy = event.y; })
        .on("end", (event, item) => { if (!event.active) simulation.alphaTarget(0); item.fx = null; item.fy = null; }));
    node.append("circle").attr("class", "case-force__halo").attr("r", (item) => item.radius + 6);
    node.append("circle").attr("class", "case-force__circle").attr("r", (item) => item.radius)
      .attr("fill", (item) => FORCE_GRAPH_COLORS[item.type] || "#70828a");
    node.append("text").attr("class", "case-force__initial").attr("text-anchor", "middle").attr("dy", ".35em")
      .text((item) => item.type === "case" ? "C" : item.type === "incident" ? "I" : item.type === "person" ? "P" : "E");
    node.append("text").attr("class", "case-force__label").attr("text-anchor", "middle").attr("y", (item) => item.radius + 15)
      .text((item) => String(item.label || item.id).slice(0, 22));
    node.on("mouseenter", (event, item) => tooltip.html(`<strong>${item.label}</strong><span>${item.type}</span><p>${item.detail || "Authorised case relationship node"}</p>`)
      .style("opacity", 1).style("left", `${event.pageX + 14}px`).style("top", `${event.pageY - 10}px`))
      .on("mousemove", (event) => tooltip.style("left", `${event.pageX + 14}px`).style("top", `${event.pageY - 10}px`))
      .on("mouseleave", () => tooltip.style("opacity", 0))
      .on("click", (event, item) => { event.stopPropagation(); tooltip.style("opacity", 0); onNodeSelectRef.current?.(item); });
    simulation.on("tick", () => {
      link.attr("x1", (item) => item.source.x).attr("y1", (item) => item.source.y)
        .attr("x2", (item) => item.target.x).attr("y2", (item) => item.target.y);
      node.attr("transform", (item) => `translate(${item.x},${item.y})`);
    });
    return () => { simulation.stop(); tooltip.style("opacity", 0); };
  }, [network, selectedNodeId, width]);

  return <div className="case-force" ref={containerRef}><svg ref={svgRef} width={width} height={height} role="img" aria-label="Interactive force-directed case relationship network" /><div className="case-force__tooltip" ref={tooltipRef} /></div>;
}

function CaseRelationships({ user, initialCaseRef = "" }) {
  const [cases, setCases] = useState([]),
    [caseRef, setCaseRef] = useState(""),
    [network, setNetwork] = useState(null),
    [selectedNodeId, setSelectedNodeId] = useState(""),
    [detailObject, setDetailObject] = useState(null),
    [search, setSearch] = useState(""),
    [depth, setDepth] = useState(2),
    [graphView, setGraphView] = useState("investigation"),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/graph/cases", { headers: { "X-Demo-User": user } })
      .then((r) => r.json())
      .then((data) => {
        setCases(data);
        setCaseRef(data.find((item) => item.CASE_REF === initialCaseRef)?.CASE_REF || data[0]?.CASE_REF || "");
      })
      .catch((e) => setError(e.message));
  }, [user, initialCaseRef]);
  useEffect(() => {
    if (!caseRef) return;
    setNetwork(null);
    fetch("/api/graph/network?caseRef=" + encodeURIComponent(caseRef) + "&depth=" + depth, {
      headers: { "X-Demo-User": user },
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        setNetwork(data);
        setSelectedNodeId(data.nodes?.[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, [caseRef, depth, user]);
  const visible = network?.nodes || [];
  const position = (node) => {
    if (node.type === "case") return { x: 600, y: 56 };
    const sameType = visible.filter((item) => item.type === node.type);
    const index = sameType.indexOf(node);
    // Five columns leave a clear gutter around each card at desktop widths.
    // Keeping node types on distinct layers also stops relationship paths from
    // competing with labels in an adjacent row.
    const gridPosition = (columns, startY, rowGap) => ({
      x: 130 + (index % columns) * ((1200 - 260) / Math.max(columns - 1, 1)),
      y: startY + Math.floor(index / columns) * rowGap,
    });
    if (node.type === "incident") return gridPosition(5, 150, 92);
    if (node.type === "evidence") return gridPosition(5, 566, 84);
    return { x: ((index + 1) * 1200) / (sameType.length + 1), y: 450 };
  };
  const positions = visible.reduce((all, node) => ({ ...all, [node.id]: position(node) }), {});
  const linkCounts = network?.edges.reduce((counts, edge) => {
    counts[edge.source] = (counts[edge.source] || 0) + 1;
    counts[edge.target] = (counts[edge.target] || 0) + 1;
    return counts;
  }, {}) || {};
  const pathwayNodes = visible.map((node) => {
    if (node.type === "case") return { ...node, x: 600, y: 390, radius: 42 };
    const peers = visible.filter((item) => item.type !== "case");
    const peerIndex = peers.indexOf(node);
    const angle = (Math.PI * 2 * peerIndex) / Math.max(peers.length, 1) - Math.PI / 2;
    const ring = node.type === "person" ? 170 : node.type === "incident" ? 265 : 320;
    return { ...node, x: 600 + Math.cos(angle) * ring, y: 390 + Math.sin(angle) * (ring * 0.68), radius: Math.min(29, 14 + (linkCounts[node.id] || 0) * 2) };
  });
  const pathwayPositions = pathwayNodes.reduce((all, node) => ({ ...all, [node.id]: node }), {});
  const selected = visible.find((node) => node.id === selectedNodeId) || visible[0];
  const showNodeDetails = (node) => {
    setSelectedNodeId(node.id);
    if (!["incident", "person", "evidence"].includes(node.type)) return;
    const linkedEdge = network.edges.find((edge) => edge.target === node.id);
    const linkedIncident = visible.find((item) => item.id === linkedEdge?.source);
    const linkedIncidents = network.edges.filter((edge) => edge.source === node.id || edge.target === node.id).filter((edge) => visible.find((item) => item.id === (edge.source === node.id ? edge.target : edge.source))?.type === "incident").length;
    setDetailObject({ ...node, linkedIncidentRef: linkedIncident?.label, linkedIncidents });
  };
  const incidentCount = visible.filter((node) => node.type === "incident").length;
  const evidenceCount = visible.filter((node) => node.type === "evidence").length;
  const personCount = visible.filter((node) => node.type === "person").length;
  const similarityCount = network?.edges.filter((edge) => edge.type === "semantic similarity").length || 0;
  const filteredCases = cases.filter((item) => `${item.CASE_REF} ${item.PATTERN_LABEL}`.toLowerCase().includes(search.toLowerCase()));
  const findings = [
    { title: "Scoped case relationships", text: `${incidentCount} incidents are connected to ${network?.center?.CASE_REF || "the selected case"} in the active DDS scope.` },
    { title: depth < 2 ? "Person and evidence relationships outside selected depth" : "Person and evidence coverage", text: depth < 2 ? "Increase graph depth to 2 hops to include available person-of-interest and evidence links." : `${personCount} persons of interest and ${evidenceCount} evidence items are connected at the selected depth.` },
    { title: depth < 3 ? "Incident similarity paths outside selected depth" : "Incident similarity paths", text: depth < 3 ? "Increase graph depth to 3 hops to reveal available incident-to-incident comparison edges." : `${similarityCount} moderate incident-similarity relationships connect otherwise separate clue groups for expert review.` },
    { title: "Graph model", text: "The network is sourced from the Oracle Property Graph SQL/PGQ model crime_case_network." },
  ];
  return (
    <section className="case-graph">
      <div className="case-graph__head">
        <div>
          <small className="kicker">PROPERTY GRAPH · SQL/PGQ</small>
          <h2>Case Relationship Graph</h2>
          <p>
            Explore case, incident, and evidence connections within
            the active Deep Data Security scope.
          </p>
        </div>
        <label className="case-graph__view-select"><span>Graph view</span><select value={graphView} onChange={(event) => setGraphView(event.target.value)}><option value="investigation">Investigation network</option><option value="pathway">Pathway Style</option><option value="force">Force-directed network</option></select></label>
      </div>
      {error && <p className="pattern-error">Graph error: {error}</p>}
      <div className="case-graph__layout">
        <aside className="case-graph__rail">
          <label className="case-graph__search">Search incident graph nodes<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search case or pattern…" /></label>
          <div className="case-graph__suggestions"><span>Suggested:</span>{["vehicle recovery", "unlawful entry", "fraud wording", "property damage"].map((item) => <button key={item} onClick={() => setSearch(item)}>{item}</button>)}</div>
          <div className="case-graph__depth"><b>Graph Depth (Hops)</b><div>{[1, 2, 3].map((hop) => <button key={hop} className={depth === hop ? "active" : ""} onClick={() => setDepth(hop)}>{hop} Hop{hop > 1 ? "s" : ""}</button>)}</div></div>
          <div className="case-graph__node-list"><b>Incident Graph Nodes ({filteredCases.length})</b>{filteredCases.map((item) => <button key={item.CASE_REF} className={item.CASE_REF === caseRef ? "active" : ""} onClick={() => setCaseRef(item.CASE_REF)}><strong>{item.CASE_REF}</strong><span>{item.PATTERN_LABEL}</span><small>{item.INCIDENT_COUNT} scoped incidents</small></button>)}</div>
        </aside>
        <div className="case-graph__workbench">
          {network && <section className="case-graph__briefing"><div><small>CASE GRAPH BRIEFING</small><h3>{network.center.CASE_REF} · {network.center.PATTERN_LABEL}</h3><p>Authorised relationship context across the selected {depth}-hop graph depth. Every incident and evidence record remains filtered by the active DDS scope.</p></div><span>SQL/PGQ · DDS</span></section>}
      {network ? (
        <>
          <div className="case-graph__metrics">
            <span><b>{incidentCount}</b> linked incidents</span>
            <span><b>{personCount}</b> persons of interest</span>
            <span><b>{evidenceCount}</b> evidence items</span>
            <span><b>{network.edges.length}</b> graph relationships</span>
          </div>
          <section className="case-graph__findings"><div><small>KEY PATHWAY FINDINGS</small><h3>Relationship findings in the current graph</h3></div><div className="case-graph__finding-grid">{findings.map((finding) => <article key={finding.title}><b>{finding.title}</b><p>{finding.text}</p></article>)}</div></section>
          <div className="case-graph__experience">
            <div className="case-graph__canvas">
            {graphView === "investigation" ?
            <svg viewBox="0 0 1200 780" role="img" aria-label="Case relationship network">
              {network.edges.map((edge, i) => {
                const a = positions[edge.source],
                  b = positions[edge.target];
                return a && b ? (
                  <line key={i} className={`case-graph__edge case-graph__edge--${edge.type.replaceAll(" ", "-")}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                ) : null;
              })}
              {visible.map((node) => { const p = positions[node.id], active = node.id === selectedNodeId; return node.type === "person" ? <g key={node.id} className={`case-graph__svg-node person${active ? " active" : ""}`} transform={`translate(${p.x},${p.y})`} onClick={() => showNodeDetails(node)}><circle className="case-graph__person-face" r="27"/><circle className="case-graph__person-eye" cx="-9" cy="-4" r="2"/><circle className="case-graph__person-eye" cx="9" cy="-4" r="2"/><path className="case-graph__person-smile" d="M-10,8 Q0,16 10,8"/><text x="0" y="43" textAnchor="middle">{node.label}</text><text className="case-graph__svg-detail" x="0" y="56" textAnchor="middle">{node.detail.slice(0, 22)}</text></g> : <g key={node.id} className={`case-graph__svg-node ${node.type}${active ? " active" : ""}`} transform={`translate(${p.x},${p.y})`} onClick={() => showNodeDetails(node)}><rect x="-82" y="-26" width="164" height="52" rx="6"/><text x="0" y="-4" textAnchor="middle">{node.label.slice(0, 22)}</text><text className="case-graph__svg-detail" x="0" y="13" textAnchor="middle">{node.detail.slice(0, 25)}</text></g>; })}
            </svg>
            : graphView === "pathway" ? <svg className="case-graph__pathway-svg" viewBox="0 0 1200 780" role="img" aria-label="Case relationship pathway network">
              <defs><marker id="case-pathway-arrow" viewBox="0 -4 8 8" refX="8" refY="0" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-3.5L8,0L0,3.5" /></marker></defs>
              {network.edges.map((edge, index) => {
                const source = pathwayPositions[edge.source], target = pathwayPositions[edge.target];
                return source && target ? <line key={index} className={`case-graph__pathway-edge case-graph__pathway-edge--${edge.type.replaceAll(" ", "-")}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} markerEnd="url(#case-pathway-arrow)" /> : null;
              })}
              {pathwayNodes.map((node) => {
                const active = node.id === selectedNodeId;
                return <g key={node.id} className={`case-graph__pathway-node ${node.type}${active ? " active" : ""}`} transform={`translate(${node.x},${node.y})`} onClick={() => showNodeDetails(node)}><circle className="case-graph__pathway-orbit" r={node.radius + 8} /><circle className="case-graph__pathway-circle" r={node.radius} /><text className="case-graph__pathway-initial" textAnchor="middle" dy=".35em">{node.type === "case" ? "C" : node.type === "incident" ? "I" : node.type === "person" ? "P" : "E"}</text><text className="case-graph__pathway-label" textAnchor="middle" y={node.radius + 16}>{node.label.slice(0, 20)}</text><text className="case-graph__pathway-detail" textAnchor="middle" y={node.radius + 29}>{node.detail.slice(0, 22)}</text></g>;
              })}
            </svg> : <ForceDirectedCaseGraph network={network} selectedNodeId={selectedNodeId} onNodeSelect={showNodeDetails} />}
            </div>
          </div>
          <div className="case-graph__legend">
            <span>Case file</span>
            <span>Incident</span>
            <span>Person of interest</span>
            <span>Evidence</span>
          </div>
        </>
      ) : (
        <p>Loading authorised case relationships…</p>
      )}
        </div>
      </div>
      <ObjectDetailModal object={detailObject} onClose={() => setDetailObject(null)} user={user} />
    </section>
  );
}
function CrimePatternSignals({ user, onNavigate }) {
  const [minSimilarityPercent, setMinSimilarityPercent] = useState('40');
  const [incidentSearching, setIncidentSearching] = useState(false);
  const incidentRequest = useRef(null);
  useEffect(() => () => incidentRequest.current?.abort(), []);
  const validSimilarity = minSimilarityPercent !== '' && Number.isFinite(Number(minSimilarityPercent)) && Number(minSimilarityPercent) >= 10 && Number(minSimilarityPercent) <= 100;
  const [showResultGraph, setShowResultGraph] = useState(false);
  const graphButtonRef = useRef(null);
  const [query, setQuery] = useState(""),
    [results, setResults] = useState(null),
    [catalogQuery, setCatalogQuery] = useState(""),
    [catalogResults, setCatalogResults] = useState(null),
    [relatedReports, setRelatedReports] = useState(null),
    [reportLoading, setReportLoading] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [watchedPatterns, setWatchedPatterns] = useState([]),
    [signalSummary, setSignalSummary] = useState(null),
    [signalPosts, setSignalPosts] = useState([]),
    [signalNotice, setSignalNotice] = useState(""),
    [momentumFilter, setMomentumFilter] = useState(""),
    [patternFilter, setPatternFilter] = useState(""),
    [linkedOnly, setLinkedOnly] = useState(false),
    [detailObject, setDetailObject] = useState(null);
  const examples = [
    "after-hours rear service access property entry",
    "art gallery payment invoice and provenance",
    "weekend assault and public order near venues",
    "retail transport theft and missing property",
  ];
  const search = (q) => {
    q = (q || query).trim();
    if (q.length < 3 || !validSimilarity) return;
    incidentRequest.current?.abort();
    const controller = new AbortController();
    incidentRequest.current = controller;
    setIncidentSearching(true);
    setResults(null);
    setError("");
    fetch("/api/patterns/semantic-search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Demo-User": user },
      body: JSON.stringify({ query: q, minSimilarity: Number(minSimilarityPercent) / 100 }),
      signal: controller.signal,
    })
      .then(async (r) => {
        let data = await r.json();
        if (!r.ok) throw Error(data.error || "Search unavailable");
        if (!controller.signal.aborted) setResults(data);
      })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setIncidentSearching(false); });
  };
  const searchCatalog = (q) => {
    q = (q || catalogQuery).trim();
    if (!q) return;
    setLoading(true);
    setError("");
    fetch("/api/watched-patterns/semantic-search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Demo-User": user },
      body: JSON.stringify({ query: q }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Pattern catalog search unavailable");
      setCatalogResults(data);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  const loadRelatedReports = (pattern) => {
    setReportLoading(true); setError("");
    fetch(`/api/watched-patterns/${encodeURIComponent(pattern.PATTERN_CODE)}/related-reports?limit=12`, { headers: { "X-Demo-User": user } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw Error(data.error || "Related report search unavailable"); setRelatedReports({ ...data, pattern }); })
      .catch((e) => setError(e.message)).finally(() => setReportLoading(false));
  };
  const hideFromUi = (pattern) => fetch(`/api/watched-patterns/${encodeURIComponent(pattern.PATTERN_CODE)}/hide-from-ui`, { method: "POST", headers: { "X-Demo-User": user } })
    .then(async (response) => { const data = await response.json(); if (!response.ok) throw Error(data.error || "Unable to hide pattern"); setWatchedPatterns((current) => current.filter((item) => item.PATTERN_CODE !== pattern.PATTERN_CODE)); if (patternFilter === pattern.PATTERN_CODE) { setPatternFilter(""); setRelatedReports(null); } })
    .catch((e) => setError(e.message));
  useEffect(() => {
    Promise.all([
      fetch("/api/watched-patterns", { headers: { "X-Demo-User": user } }).then((r) => r.json()),
      fetch("/api/community-signals/summary", { headers: { "X-Demo-User": user } }).then((r) => r.json()),
    ]).then(([patterns, summary]) => {
      if (patterns.error || summary.error) throw Error(patterns.error || summary.error);
      setWatchedPatterns(patterns);
      setSignalSummary(summary);
    }).catch((e) => setError(e.message));
  }, [user]);
  useEffect(() => {
    const params = new URLSearchParams({ limit: "12" });
    const controller = new AbortController();
    setSignalPosts([]);
    if (momentumFilter) params.set("momentum", momentumFilter);
    if (patternFilter) params.set("patternCode", patternFilter);
    if (linkedOnly) params.set("linkedOnly", "1");
    fetch("/api/community-signals/posts?" + params, { headers: { "X-Demo-User": user }, signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw Error(data.error || "Community signal feed unavailable"); return data; })
      .then((data) => { if (!controller.signal.aborted) { setSignalPosts(data.posts || []); setSignalNotice(data.notice || ""); } })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [user, momentumFilter, patternFilter, linkedOnly]);
  const watchPattern = (pattern) => {
    setPatternFilter(pattern.PATTERN_CODE);
    const searchQuery = pattern.SEARCH_QUERY || pattern.PATTERN_SUMMARY || pattern.PATTERN_NAME;
    setQuery(searchQuery);
    search(searchQuery);
  };
  const activePattern = watchedPatterns.find((pattern) => pattern.PATTERN_CODE === patternFilter);
  const openWorkspace = (page, context = {}) => onNavigate(page, {
    query: activePattern?.SEARCH_QUERY || query,
    caseRef: activePattern?.CASE_REF || "",
    patternName: activePattern?.PATTERN_NAME || "Selected crime pattern",
    ...context,
  });
  const linkedShare = signalSummary?.AUTHORISED_INCIDENT_COUNT
    ? (Number(signalSummary.LINKED_INCIDENT_COUNT || 0) / Number(signalSummary.AUTHORISED_INCIDENT_COUNT)) * 100
    : 0;
  const graphSeeds = {
    patternCodes: [...new Set([...(catalogResults?.results || []).map(p => p.PATTERN_CODE), ...(activePattern ? [activePattern.PATTERN_CODE] : [])])].slice(0, 12),
    incidentRefs: [...new Set([...(results?.results || []), ...(relatedReports?.results || [])].map(r => r.INCIDENT_REF))].slice(0, 30),
    postRefs: signalPosts.map(p => p.POST_REF).slice(0, 30),
  };
  return (
    <section className="pattern-signals">
      <div className="pattern-title">
        <small className="kicker">VECTOR SEARCH · DEEP DATA SECURITY</small>
        <h2>Crime Pattern Signal Intelligence</h2>
        <p>
          Search incident narratives for related patterns.
          Results are filtered by the active database security scope.
        </p>
      </div>
      <section className="watched-patterns">
        <header>
          <div><small>DATA-DRIVEN LOCALITY CONFIGURATION</small><h3>Watched Crime Patterns</h3><p>Two graph-backed investigations and two community-signal watches provide clear, explainable starting points.</p></div>
          <span>{watchedPatterns.length} active watches</span>
        </header>
        <div className="watched-patterns__grid">
          {watchedPatterns.map((pattern) => <article key={pattern.PATTERN_CODE} className="watched-pattern-card" style={{ "--watch-color": pattern.DISPLAY_COLOR }}><button type="button" className={patternFilter === pattern.PATTERN_CODE ? "active" : ""} onClick={() => watchPattern(pattern)}><small>{String(pattern.PATTERN_KIND).replaceAll("_", " ")} · {String(pattern.PATTERN_STATUS).replaceAll("_", " ")}</small><b>{pattern.PATTERN_NAME}</b><p>{pattern.PATTERN_SUMMARY}</p><span>{pattern.INCIDENT_COUNT} incidents · {pattern.POST_COUNT} public posts{pattern.CASE_REF ? ` · ${pattern.CASE_REF}` : ""}</span></button>{user === "statewide_admin" && <button type="button" className="watched-patterns__hide" title="Hide from the UI (it remains watched)" aria-label={`Hide ${pattern.PATTERN_NAME} from the UI`} onClick={() => hideFromUi(pattern)}>⌄</button>}</article>)}
        </div>
      </section>
      <section className="pattern-catalog-search">
        <div className="pattern-search-heading">
          <h3 id="watched-pattern-search-title">Find watched patterns</h3>
          <p id="watched-pattern-search-help">Search the catalogue by meaning to find named monitoring patterns to explore. Results are pattern definitions for analyst review.</p>
        </div>
        <div className="pattern-search"><input aria-labelledby="watched-pattern-search-title" aria-describedby="watched-pattern-search-help" value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchCatalog()} placeholder="Describe a watched pattern, e.g. vehicles checking whether homes are occupied…" /><button className="primary" disabled={loading || !catalogQuery.trim()} onClick={() => searchCatalog()}>{loading ? "Searching…" : "Find watched patterns"}</button></div>
        {catalogResults && <div className="pattern-catalog-results"><p><b>{catalogResults.results.length} related patterns</b> · {catalogResults.model} · {catalogResults.dimensions}d · cosine</p>{catalogResults.results.map((pattern) => <button type="button" key={pattern.PATTERN_CODE} onClick={() => watchPattern(pattern)}><b>{pattern.PATTERN_NAME}</b><span>{(Number(pattern.SIMILARITY_SCORE) * 100).toFixed(0)}% semantic relevance</span><p>{pattern.PATTERN_SUMMARY}</p></button>)}<small>{catalogResults.notice}</small></div>}
      </section>
      {activePattern && <section className="pattern-scenario-summary">
        <header>
          <div>
            <small>SCENARIO READY · AUTHORISED RECORDS + CONTEXTUAL SIGNALS</small>
            <h3>{activePattern.PATTERN_NAME}</h3>
            <p>{activePattern.WHY_WATCH}</p>
          </div>
          <span>{String(activePattern.PATTERN_STATUS).replaceAll("_", " ")}</span>
        </header>
        <div className="pattern-scenario-summary__metrics">
          <article><b>{activePattern.INCIDENT_COUNT}</b><span>linked incidents</span></article>
          <article><b>{activePattern.POST_COUNT}</b><span>contextual posts</span></article>
          <article><b>{activePattern.CASE_REF ? "Graph ready" : "Monitor"}</b><span>{activePattern.CASE_REF || "community-signal watch"}</span></article>
          <article><b>{activePattern.PATTERN_KIND === "case_series" ? "Connect records" : "Compare time + place"}</b><span>recommended next step</span></article>
        </div>
        <div className="pattern-scenario-summary__actions">
          <button type="button" onClick={() => openWorkspace("incidents")}>View linked incidents</button>
          <button type="button" onClick={() => loadRelatedReports(activePattern)}>{reportLoading ? "Finding reports…" : "View semantically related reports"}</button>
          <button type="button" onClick={() => openWorkspace("geography", { patternCode: activePattern.PATTERN_CODE })}>Check spatial pattern</button>
          {activePattern.CASE_REF && <button type="button" onClick={() => openWorkspace("graph")}>Open case relationship graph</button>}
          <button type="button" onClick={() => openWorkspace("analytics", { analyticsTab: "vectors" })}>Compare similar narratives</button>
        </div>
        <footer>Public posts are unverified contextual signals. They can support a review, but are not incident evidence.</footer>
      </section>}
      {relatedReports && <section className="pattern-related-reports"><header><div><small>OCI GENAI · COHERE EMBED 4 · SEMANTIC CONTEXT</small><h3>Related authorised reports: {relatedReports.pattern.PATTERN_NAME}</h3><p>{relatedReports.notice}</p></div><button type="button" onClick={() => setRelatedReports(null)}>Close</button></header><div className="pattern-results">{relatedReports.results.map((report, index) => <article key={report.INCIDENT_REF}><div className="match-score">#{index + 1}<b>{(Number(report.SIMILARITY_SCORE) * 100).toFixed(0)}%</b><small>relevance</small></div><div><div className="pattern-meta"><span>{report.CATEGORY_NAME}</span><span>{report.SUBURB}</span><span>{String(report.OCCURRED_AT).slice(0, 10)}</span></div><h3>{report.MODUS_OPERANDI.replaceAll("-", " ")}</h3><p>{report.REPORT_SUMMARY}</p><small>{report.INCIDENT_REF} · {report.INCIDENT_STATUS.replaceAll("_", " ")}</small><div className="pattern-result-actions"><button type="button" onClick={() => openWorkspace("incidents", { query: report.INCIDENT_REF })}>Open incident</button><button type="button" onClick={() => openWorkspace("geography", { query: report.INCIDENT_REF })}>Map context</button></div></div></article>)}</div></section>}
      <div className="pattern-search-heading pattern-search-heading--incidents">
        <h3 id="incident-report-search-title">Search incident reports</h3>
        <p id="incident-report-search-help">Search authorised report narratives by meaning using Cohere Embed 4. Semantic similarity measures how closely the wording relates to your description; it is not a confidence or probability score.</p>
      </div>
      <div className="pattern-search">
        <input
          aria-labelledby="incident-report-search-title"
          aria-describedby="incident-report-search-help"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Describe incident details, e.g. a forced window or payment diversion…"
          maxLength={2000}
        />
        <button
          className="primary"
          disabled={incidentSearching || query.trim().length < 3 || !validSimilarity}
          onClick={() => search()}
        >
          {incidentSearching ? "Searching reports…" : "Search incident reports"}
        </button>
        {(results || incidentSearching) && (
          <button
            onClick={() => {
              incidentRequest.current?.abort();
              setIncidentSearching(false);
              setQuery("");
              setResults(null);
              setError("");
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="incident-similarity-filter">
        <label>Minimum similarity (%)<input type="number" min="10" max="100" step="1" value={minSimilarityPercent} aria-invalid={!validSimilarity} onChange={e => setMinSimilarityPercent(e.target.value)} /></label>
        <span>Default 40%. Raise to narrow results or lower to broaden, then search again.</span>
      </div>
      {incidentSearching && <p className="incident-search-status" role="status">Embedding your description and searching authorised report narratives…</p>}
      {!results && (
        <div className="pattern-examples">
          <span>Try:</span>
          {examples.map((x) => (
            <button
              key={x}
              onClick={() => {
                setQuery(x);
                search(x);
              }}
            >
              {x}
            </button>
          ))}
        </div>
      )}
      {error && <p className="pattern-error">Search error: {error}</p>}
      <div className="dds-note">
        <b>Deep Data Security enforced</b>
        <span>
          The vector query joins only secure incident and report views, so
          changing the demo user changes the result set.
        </span>
      </div>
      <div className="result-graph-launch">
        <button type="button" ref={graphButtonRef} aria-expanded={showResultGraph} onClick={() => setShowResultGraph(open => !open)}>{showResultGraph ? "Hide result relationships" : "Explore result relationships"}</button>
        <span>{graphSeeds.patternCodes.length} patterns · {graphSeeds.incidentRefs.length} incidents · {graphSeeds.postRefs.length} visible posts, plus related context</span>
      </div>
      {showResultGraph && <ResultRelationships user={user} seeds={graphSeeds} onClose={() => { setShowResultGraph(false); graphButtonRef.current?.focus(); }} onOpenIncident={ref => setDetailObject({ type: "incident", label: ref, INCIDENT_REF: ref })} />}
      {results && (
        <>
          <div className="pattern-results-head">
            <div>
              <h3>Matched incident reports</h3>
              <p>
                {results.results.length} authorised results for “{results.query}
                ”
              </p>
            </div>
            <span>
              {results.model} · {results.dimensions}d · cosine ·{" "}
              {results.elapsed}ms
            </span>
          </div>
          <p className="incident-search-status">Minimum applied: {(results.minSimilarity * 100).toFixed(0)}% · {results.coverage.embedded.toLocaleString()} of {results.coverage.reports.toLocaleString()} authorised reports indexed. Scores show semantic similarity, not confidence.</p>
          {results.notice && <p className="incident-search-status" role="status">{results.notice}</p>}
          {results.results.length === 0 && results.coverage.embedded > 0 && <p className="incident-search-empty" role="status">No reports met the {(results.minSimilarity * 100).toFixed(0)}% minimum similarity. Add more incident detail or lower the minimum and search again.</p>}
          <div className="pattern-results incident-semantic-results">
            {results.results.map((r, i) => (
              <article key={r.INCIDENT_REF}>
                <div className="match-score">
                  #{i + 1}
                  <b>{(r.SIMILARITY_SCORE * 100).toFixed(1)}%</b>
                  <small>Semantic similarity</small>
                </div>
                <div>
                  <div className="pattern-meta">
                    <span>{r.CATEGORY_NAME}</span>
                    <span>{r.SUBURB}</span>
                    <span>{String(r.OCCURRED_AT).slice(0, 10)}</span>
                  </div>
                  <h3>{r.MODUS_OPERANDI.replaceAll("-", " ")}</h3>
                  <p>{r.REPORT_SUMMARY}</p>
                  <small>
                    {r.INCIDENT_REF} · {r.INCIDENT_STATUS.replaceAll("_", " ")}
                  </small>
                  <div className="pattern-result-actions">
                    <button type="button" onClick={() => openWorkspace("incidents", { query: r.INCIDENT_REF })}>Open incident</button>
                    <button type="button" onClick={() => openWorkspace("geography", { patternCode: activePattern?.PATTERN_CODE, query: r.INCIDENT_REF })}>View on map</button>
                    {activePattern?.CASE_REF && <button type="button" onClick={() => openWorkspace("graph")}>Relationship graph</button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <section className="community-signals">
        <header className="community-signals__head">
          <div><small>SIMULATED PUBLIC STREAM · EXTERNAL AND UNVERIFIED</small><h2>Community Pattern Signals</h2><p>Public-post momentum provides contextual awareness. It remains separate from authorised records unless an analyst records a reviewed comparison link.</p></div>
          <span>LIVE WATCHED FEED</span>
        </header>
        <div className="community-signals__summary">
          <article><small>Observed signals</small><b>{Number(signalSummary?.POST_COUNT_72H || 0).toLocaleString("en-AU")}</b><span>in the last 72 hours</span></article>
          <article><small>Public sources</small><b>{Number(signalSummary?.SOURCE_COUNT_72H || 0)}</b><span>contributing context</span></article>
          <article><small>Elevated signals</small><b>{Number(signalSummary?.ELEVATED_COUNT_72H || 0)}</b><span>requiring review context</span></article>
          <article><small>Reviewed links</small><b>{Number(signalSummary?.LINKED_INCIDENT_COUNT || 0)}</b><span>{linkedShare < .1 ? "<0.1" : linkedShare.toFixed(1)}% of authorised incidents</span></article>
          <article className="community-signals__summary-action"><small>Review boundary</small><b>Keep context separate</b><span>Public signals are not incident evidence</span></article>
        </div>
        <div className="community-signals__controls">
          <label>Watched pattern<select value={patternFilter} onChange={(event) => setPatternFilter(event.target.value)}><option value="">All watched patterns</option>{watchedPatterns.map((pattern) => <option key={pattern.PATTERN_CODE} value={pattern.PATTERN_CODE}>{pattern.PATTERN_NAME}</option>)}</select></label>
          <label>Momentum<select value={momentumFilter} onChange={(event) => setMomentumFilter(event.target.value)}><option value="">All momentum levels</option><option value="critical">Critical</option><option value="elevated">Elevated</option><option value="rising">Rising</option><option value="normal">Normal</option></select></label>
          <label className="community-signals__linked"><input type="checkbox" checked={linkedOnly} onChange={(event) => setLinkedOnly(event.target.checked)} />Reviewed incident links only</label>
          {(patternFilter || momentumFilter || linkedOnly) && <button type="button" onClick={() => { setPatternFilter(""); setMomentumFilter(""); setLinkedOnly(false); }}>Clear filters</button>}
        </div>
        <div className="community-signals__feed-heading">
          <div><h3>Matched Community Pattern Signals</h3><p>Public-post momentum and reviewed comparison links within the selected filters.</p></div>
          <span>{signalPosts.length} shown</span>
        </div>
        <div className="community-signals__feed">
          {signalPosts.map((post) => <article key={post.POST_REF}>
            <header><div><b>{post.SOURCE_NAME}</b><span>{post.PLATFORM_LABEL} · {post.SUBURB || "Location not stated"}</span></div><em className={`momentum-${post.MOMENTUM_FLAG}`}>{post.MOMENTUM_FLAG}</em></header>
            <p>{post.POST_TEXT}</p>
            <div className="community-signals__meta"><span>{post.TOPIC_LABEL}</span><span>Signal {Number(post.SIGNAL_SCORE).toFixed(0)}/100</span><span>{Number(post.REACH_COUNT).toLocaleString("en-AU")} reach</span><span>{String(post.POSTED_AT).slice(0,16).replace("T"," ")}</span></div>
            {post.LINKED_INCIDENT_REFS ? <div className="community-signals__link"><span>Reviewed comparison—not evidence</span>{String(post.LINKED_INCIDENT_REFS).split(", ").map((incidentRef) => <button type="button" key={incidentRef} onClick={() => setDetailObject({ type: "incident", label: incidentRef, INCIDENT_REF: incidentRef })}>{incidentRef}</button>)}<small>Maximum contextual confidence {Number(post.MAX_LINK_CONFIDENCE).toFixed(0)}%</small></div> : <div className="community-signals__unlinked">No incident relationship recorded</div>}
          </article>)}
          {!signalPosts.length && <p className="community-signals__empty">No public posts match the selected filters.</p>}
        </div>
        <footer>{signalNotice}</footer>
      </section>
      <small className="pattern-footnote">
        Descriptive pattern matching only. It does not identify
        people, predict crime, or support operational decisions.
      </small>
      <ObjectDetailModal object={detailObject} onClose={() => setDetailObject(null)} user={user} />
    </section>
  );
}
function Dashboard({ dash }) {
  let s = dash?.summary || {};
  return (
    <Metrics
      values={[
        ["Authorised incidents", s.INCIDENT_COUNT, "#c74634"],
        ["Open records", s.OPEN_COUNT, "#aa643b"],
      ]}
    />
  );
}
function Panel(p) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{p.title}</h2>
          <p>{p.sub}</p>
        </div>
        <span>Governed data</span>
      </div>
      {p.children}
    </section>
  );
}
function Bars({ rows, n }) {
  let max = Math.max(1, ...rows.map((r) => +r.COUNT));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r[n]}>
          <label>{r[n]}</label>
          <i>
            <b style={{ width: (r.COUNT / max) * 100 + "%", background: r.DISPLAY_COLOR || undefined }} />
          </i>
          <em>{r.COUNT}</em>
        </div>
      ))}
    </div>
  );
}
function IncidentExplorer({ user, initialQuery = "" }) {
  const blank = { q: initialQuery, category: "", suburb: "", status: "", area: "" };
  const [filters, setFilters] = useState(blank), [lovs, setLovs] = useState({ categories: [], suburbs: [], statuses: [], areas: [] }), [rows, setRows] = useState([]), [selectedRef, setSelectedRef] = useState(""), [detail, setDetail] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(""), [askOpen, setAskOpen] = useState(false), [askMode, setAskMode] = useState("sql");
  useEffect(() => { fetch("/api/incidents/filters", { headers: { "X-Demo-User": user } }).then(async (r) => { const data = await r.json(); if (!r.ok) throw Error(data.error || "Filter lists unavailable"); return data; }).then((data) => { setLovs(data); setFilters(blank); }).catch((e) => setError(e.message)); }, [user, initialQuery]);
  useEffect(() => { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); }); setLoading(true); fetch("/api/incidents?" + params, { headers: { "X-Demo-User": user } }).then(async (r) => { const data = await r.json(); if (!r.ok) throw Error(data.error || "Incident search unavailable"); return data; }).then((data) => { setRows(data); setSelectedRef((current) => data.some((row) => row.INCIDENT_REF === current) ? current : (data[0]?.INCIDENT_REF || "")); }).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [filters, user]);
  useEffect(() => { if (!selectedRef) { setDetail(null); return; } fetch("/api/incidents/" + encodeURIComponent(selectedRef), { headers: { "X-Demo-User": user } }).then(async (r) => { const data = await r.json(); if (!r.ok) throw Error(data.error || "Incident detail unavailable"); return data; }).then(setDetail).catch((e) => setError(e.message)); }, [selectedRef, user]);
  const change = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  const selected = detail?.incident;
  const display = (value) => value == null || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const Filter = ({ name, label, values }) => <label><span>{label}</span><select value={filters[name]} onChange={(event) => change(name, event.target.value)}><option value="">All {label.toLowerCase()}s</option>{values.map((item) => <option key={item.VALUE} value={item.VALUE}>{item.VALUE} ({item.RECORD_COUNT})</option>)}</select></label>;
  return <section className="incident-explorer">
    <header className="incident-explorer__head"><div><small className="kicker">RELATIONAL SEARCH · DEEP DATA SECURITY</small><h2>Incident Explorer</h2><p>Search and inspect authorised incident records. Filter lists are generated from the records visible to the active data-security scope.</p></div><div className="incident-explorer__head-actions"><button onClick={() => { setAskMode("sql"); setAskOpen(true); }} disabled={!selectedRef}>Ask Me (SQL)</button><button className="llm" onClick={() => { setAskMode("llm"); setAskOpen(true); }} disabled={!selectedRef}>Ask Me (LLM)</button><button className="llm" onClick={() => { setAskMode("oci"); setAskOpen(true); }} disabled={!selectedRef}>Ask Me (OCI GenAI)</button><span>{loading ? "Refreshing…" : `${rows.length} returned`}</span></div></header>
    <section className="incident-explorer__filters"><label className="incident-explorer__generic"><span>GENERIC INCIDENT SEARCH</span><input value={filters.q} onChange={(event) => change("q", event.target.value)} placeholder="Incident ref, suburb, category, pattern, or report wording…" /></label><div className="incident-explorer__lovs"><Filter name="category" label="Crime category" values={lovs.categories} /><Filter name="suburb" label="Suburb" values={lovs.suburbs} /><Filter name="status" label="Incident status" values={lovs.statuses} /><Filter name="area" label="Patrol area" values={lovs.areas} /></div><div className="incident-explorer__filter-foot"><span>Parameter LOVs reflect only authorised records.</span><button onClick={() => setFilters(blank)} disabled={!Object.values(filters).some(Boolean)}>Clear parameters</button></div></section>
    {error && <p className="pattern-error">Incident Explorer error: {error}</p>}
    <div className="incident-explorer__workspace">
      <section className="incident-result-list"><header><div><small>SEARCH RESULTS</small><h3>Authorised incidents</h3></div><span>{rows.length}</span></header><div className="incident-result-list__rows">{rows.map((row) => <button key={row.INCIDENT_REF} onClick={() => setSelectedRef(row.INCIDENT_REF)} className={row.INCIDENT_REF === selectedRef ? "active" : ""}><div><b>{row.INCIDENT_REF}</b><span>{row.CATEGORY_NAME}</span></div><p>{row.SUBURB} · {row.AREA_NAME}</p><small>{String(row.INCIDENT_STATUS || "").replaceAll("_", " ")} · {String(row.OCCURRED_AT || "").slice(0, 10)}</small></button>)}{!loading && !rows.length && <p className="incident-result-list__empty">No authorised incidents match these parameters.</p>}</div></section>
      <section className="incident-detail-form"><header><div><small>SELECTED INCIDENT RECORD</small><h3>{selected?.INCIDENT_REF || "Select an incident"}</h3><p>{selected ? `${selected.CATEGORY_NAME} · ${selected.SUBURB}` : "Choose a returned record to view the governed incident form."}</p></div><span>read only</span></header>{selected && <><form><label><span>Executive category</span><input readOnly value={display(selected.CATEGORY_NAME)} /></label><label><span>Detailed category</span><input readOnly value={display(selected.DETAILED_CATEGORY_NAME)} /></label><label><span>Incident reference</span><input readOnly value={display(selected.INCIDENT_REF)} /></label><label><span>Status</span><input readOnly value={display(selected.INCIDENT_STATUS).replaceAll("_", " ")} /></label><label><span>Severity band</span><input readOnly value={display(selected.SEVERITY_BAND)} /></label><label><span>Occurred at</span><input readOnly value={display(selected.OCCURRED_AT)} /></label><label><span>Patrol area</span><input readOnly value={display(selected.AREA_NAME)} /></label><label><span>Suburb</span><input readOnly value={display(selected.SUBURB)} /></label><label><span>Location type</span><input readOnly value={display(selected.LOCATION_TYPE)} /></label><label className="full"><span>Address details (synthetic / masked)</span><input readOnly value={[selected.ADDRESS_LINE_1, selected.ADDRESS_LOCALITY, selected.ADDRESS_REGION, selected.ADDRESS_POSTCODE, selected.ADDRESS_COUNTRY_CODE].filter(Boolean).join(", ") || "—"} /></label><label><span>Address precision</span><input readOnly value={display(selected.ADDRESS_PRECISION).replaceAll("_", " ")} /></label><label className="full"><span>Modus operandi</span><input readOnly value={display(selected.MODUS_OPERANDI)} /></label><label><span>Property category</span><input readOnly value={display(selected.PROPERTY_CATEGORY)} /></label><label><span>Vehicle descriptor</span><input readOnly value={display(selected.VEHICLE_DESCRIPTOR)} /></label></form><section className="incident-detail-form__narrative"><small>REPORT SUMMARY</small><p>{display(selected.REPORT_SUMMARY)}</p><small>REPORT NARRATIVE</small><p>{display(selected.REPORT_TEXT)}</p></section><div className="incident-detail-form__related"><article><small>EVIDENCE</small><b>{detail.evidence.length}</b><p>{detail.evidence.map((item) => item.EVIDENCE_TYPE).join(", ") || "No evidence items linked"}</p></article><article><small>PERSON LINKS</small><b>{detail.people.length}</b><p>{detail.people.map((item) => `${item.PERSON_REF} (${item.CONNECTION_TYPE.replaceAll("_", " ")})`).join(", ") || "No person links in this record"}</p></article></div><details className="incident-detail-form__json"><summary>View record attributes</summary><pre>{display(selected.INCIDENT_ATTRIBUTES)}</pre></details></>}</section>
    </div>
    {selected && <button className="incident-ask-me__launch" onClick={() => { setAskMode("sql"); setAskOpen(true); }}>Ask Me (SQL) about {selected.INCIDENT_REF}</button>}
    {selected && <button className="incident-ask-me__launch llm" onClick={() => { setAskMode("llm"); setAskOpen(true); }}>Ask Me (LLM) about {selected.INCIDENT_REF}</button>}
    {selected && <button className="incident-ask-me__launch llm" onClick={() => { setAskMode("oci"); setAskOpen(true); }}>Ask Me (OCI GenAI) about {selected.INCIDENT_REF}</button>}
    {askOpen && (["llm", "oci"].includes(askMode) ? <LlmIncidentAskMe incidentRef={selectedRef} incident={selected} user={user} provider={askMode} onClose={() => setAskOpen(false)} /> : <IncidentAskMe incidentRef={selectedRef} incident={selected} user={user} mode={askMode} onClose={() => setAskOpen(false)} />)}
    <small className="incident-explorer__footnote">All results and related-record details are returned through the active scoped database views. This is demonstration data only.</small>
  </section>;
}
function IncidentAskMe({ incidentRef, incident, user, mode, onClose }) {
  const prompts = [
    ["overview", "Incident record", "Show the selected incident, report, and recorded-link counts."],
    ["local", "Suburb context", "Show same-suburb incidents within 14 days either side."],
    ["similar", "Similar incidents", "Find authorised records with the same category or modus operandi."],
    ["relationships", "Recorded links", "Show the incident's case, evidence, and person-link context."],
  ];
  const [input, setInput] = useState(""), [result, setResult] = useState(null), [working, setWorking] = useState(false), [error, setError] = useState("");
  const ask = (action = "") => { const question = String(input).trim(); if(mode === "llm" && !question) { setError("Enter a question for Ask Me (LLM)."); return; } const startedAt = new Date(); setWorking(true); setError(""); fetch(mode === "llm" ? "/api/incidents/ask-llm-v2" : "/api/incidents/ask", { method: "POST", headers: { "Content-Type": "application/json", "X-Demo-User": user }, body: JSON.stringify({ incidentRef, action, question }) }).then(async (response) => { const body = await response.json(); if (!response.ok) throw Error(body.error || "Incident question unavailable"); return body; }).then((body) => { const finishedAt = new Date(); setResult({ ...body, answer: `${body.answer}\n\nStarted: ${startedAt.toLocaleTimeString()} · Finished: ${finishedAt.toLocaleTimeString()} · Elapsed: ${((finishedAt - startedAt) / 1000).toFixed(1)}s` }); }).catch((e) => setError(e.message)).finally(() => setWorking(false)); };
  const value = (item) => item == null ? "—" : typeof item === "object" ? JSON.stringify(item) : String(item);
  return <div className="incident-ask-me" role="dialog" aria-modal="true" aria-label="Ask about selected incident"><section><header><div><small>{mode === "llm" ? "ASK ME (LLM) · LOCAL QWEN" : "ASK ME (SQL) · SCOPED INCIDENT CONTEXT"}</small><h2>{incidentRef}</h2><p>{incident ? `${incident.CATEGORY_NAME} · ${incident.SUBURB}` : "Selected incident"}</p></div><button onClick={onClose} aria-label="Close Ask Me">×</button></header><p className="incident-ask-me__notice">{mode === "llm" ? "The local LLM generates a read-only query over approved scoped views, then explains only the returned records. Generated SQL is audited." : "Use a guided question or enter your own. Requests select reviewed, read-only tools and return only records in your active data-security scope."}</p>{mode !== "llm" && <div className="incident-ask-me__tiles">{prompts.map(([action, title, description]) => <button key={action} disabled={working} onClick={() => ask(action)}><b>{title}</b><span>{description}</span></button>)}</div>}<div className="incident-ask-me__input"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && ask()} placeholder={mode === "llm" ? "Ask any factual question about the authorised incident data…" : "Ask about this incident, its suburb, similar incidents, or recorded links…"} /><button disabled={working} onClick={() => ask()}>{working ? "Thinking…" : "Ask"}</button></div>{error && <p className="pattern-error">Ask Me error: {error}</p>}{result && <article className="incident-ask-me__result"><header><div><small>{result.model || result.topic?.replaceAll("_", " ")}</small><h3>{result.title}</h3></div><span>{result.rowCount} rows · {result.elapsed}ms</span></header><p>{result.answer}</p><details><summary>View generated SQL</summary><pre>{result.generatedSql || result.sql}</pre></details>{result.rows.length > 0 && <div><table><thead><tr>{result.columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{result.rows.map((row, rowIndex) => <tr key={rowIndex}>{result.columns.map((column) => <td key={column}>{value(row[column])}</td>)}</tr>)}</tbody></table></div>}<small>Record context only. It does not determine responsibility, risk, or an operational response.</small></article>}</section></div>;
}
function LlmIncidentAskMe({ incidentRef, incident, user, provider = "llm", onClose }) {
  const prompts = [
    ["Incident record", "What are the key recorded details, report summary, and current status for this incident?"],
    ["Suburb context", "What other authorised incidents occurred in the same suburb as this incident?"],
    ["Similar incidents", "Which authorised incidents have a similar category or modus operandi to this incident?"],
    ["Recorded links", "What recorded case, evidence, and person-link context is available for this incident?"],
  ];
  const [input, setInput] = useState(""), [result, setResult] = useState(null), [working, setWorking] = useState(false), [error, setError] = useState("");
  const label = provider === "oci" ? "Ask Me (OCI GenAI)" : "Ask Me (LLM)", modelLabel = provider === "oci" ? "OCI GENAI · LLAMA 3.3 70B · CHICAGO" : "LOCAL QWEN";
  const ask = (question = input) => { const text = String(question).trim(); if (!text || working) return; const startedAt = new Date(); setWorking(true); setError(""); fetch(provider === "oci" ? "/api/incidents/ask-oci" : "/api/incidents/ask-llm-v2", { method: "POST", headers: { "Content-Type": "application/json", "X-Demo-User": user }, body: JSON.stringify({ incidentRef, question: text }) }).then(async (response) => { const body = await response.json(); if (!response.ok) throw Error(body.error || "LLM question unavailable"); return body; }).then((body) => { const finishedAt = new Date(); setResult({ ...body, answer: `${body.answer}\n\nStarted: ${startedAt.toLocaleTimeString()} · Finished: ${finishedAt.toLocaleTimeString()} · Elapsed: ${((finishedAt - startedAt) / 1000).toFixed(1)}s` }); }).catch((e) => setError(e.message)).finally(() => setWorking(false)); };
  const value = (item) => item == null ? "—" : typeof item === "object" ? JSON.stringify(item) : String(item);
  return <div className="incident-ask-me" role="dialog" aria-modal="true" aria-label={`${label} about selected incident`}><section><header><div><small>{label.toUpperCase()} · {modelLabel}</small><h2>{incidentRef}</h2><p>{incident ? `${incident.CATEGORY_NAME} · ${incident.SUBURB}` : "Selected incident"}</p></div><button onClick={onClose} aria-label="Close Ask Me">×</button></header><p className="incident-ask-me__notice">Choose a guided question or ask your own. {provider === "oci" ? "Gemini generates a read-only scoped query, then explains only its returned records." : "The local LLM generates a read-only scoped query, then explains only its returned records."}</p><div className="incident-ask-me__tiles">{prompts.map(([title, question]) => <button key={title} disabled={working} onClick={() => ask(question)}><b>{title}</b><span>{question}</span></button>)}</div><div className="incident-ask-me__input"><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && ask()} placeholder="Ask any factual question about the authorised incident data…" /><button disabled={working || !input.trim()} onClick={() => ask()}>{working ? "Thinking…" : "Ask"}</button></div>{error && <p className="pattern-error">{label} error: {error}</p>}{result && <article className="incident-ask-me__result"><header><div><small>{result.model}</small><h3>{result.title}</h3></div><span>{result.rowCount} rows · {result.elapsed}ms</span></header><p>{result.answer}</p><details><summary>View generated SQL</summary><pre>{result.generatedSql}</pre></details>{result.rows.length > 0 && <div><table><thead><tr>{result.columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{result.rows.map((row, rowIndex) => <tr key={rowIndex}>{result.columns.map((column) => <td key={column}>{value(row[column])}</td>)}</tr>)}</tbody></table></div>}<small>Record context only. It does not determine responsibility, risk, or an operational response.</small></article>}</section></div>;
}
function Records({ title, subtitle, rows }) {
  return (
    <Panel title={title} sub={subtitle}>
      <Table rows={rows} />
    </Panel>
  );
}
function Table({ rows }) {
  if (!rows.length) return <p>No authorised records available.</p>;
  let cols = Object.keys(rows[0]).filter(
    (k) => !["INCIDENT_ID", "LATITUDE", "LONGITUDE"].includes(k),
  );
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c.replaceAll("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>{String(r[c] ?? "").slice(0, 120)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function IncidentMapFocus({ incident }) {
  const map = useMap();
  useEffect(() => {
    if (incident) map.flyTo([Number(incident.LATITUDE), Number(incident.LONGITUDE)], Math.max(map.getZoom(), 12), { duration: 0.45 });
  }, [incident, map]);
  return null;
}
function IncidentMap({ user, initialQuery = "", initialPatternCode = "" }) {
  const [incidents, setIncidents] = useState([]);
  const [selectedRef, setSelectedRef] = useState("");
  const [detailObject, setDetailObject] = useState(null);
  const [layers, setLayers] = useState({ incidents: true, priority: true, categories: true, suburbs: false });
  const [filters, setFilters] = useState({ query: "", category: "", suburb: "", area: "", status: "", month: "" });
  const [filterOptions, setFilterOptions] = useState({ categories: [], suburbs: [], areas: [], statuses: [] });
  const [coverage, setCoverage] = useState([]);
  const [mapSummary, setMapSummary] = useState({ TOTAL_COUNT: 0, OPEN_COUNT: 0 });
  const [timeBounds, setTimeBounds] = useState({ EARLIEST_DATE: "", LATEST_DATE: "" });
  const [timeRange, setTimeRange] = useState({ from: "", to: "" });
  const [markerLimit, setMarkerLimit] = useState(2500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadMap = (nextFilters = filters, nextLimit = markerLimit, nextTimeRange = timeRange) => {
    const params = new URLSearchParams({ limit: String(nextLimit) });
    const keys = { query: "q", category: "category", suburb: "suburb", area: "area", status: "status", month: "month" };
    Object.entries(keys).forEach(([key, parameter]) => { if (nextFilters[key]) params.set(parameter, nextFilters[key]); });
    if (nextTimeRange.from) params.set("from", nextTimeRange.from);
    if (nextTimeRange.to) params.set("to", nextTimeRange.to);
    setLoading(true); setError("");
    const endpoint = initialPatternCode ? "/api/watched-patterns/" + encodeURIComponent(initialPatternCode) + "/map" : "/api/incidents/map/timeline?" + params.toString();
    fetch(endpoint, { headers: { "X-Demo-User": user } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw Error(data.error || "Map data unavailable"); return data; })
      .then((data) => { const bounds=data.timeBounds||{}; setIncidents(data.rows || []); setCoverage(data.coverage || []); setMapSummary(data.summary || { TOTAL_COUNT: 0, OPEN_COUNT: 0 }); setTimeBounds(bounds); setTimeRange((current) => current.from && current.to ? current : { from: bounds.EARLIEST_DATE || "", to: bounds.LATEST_DATE || "" }); setSelectedRef(data.rows?.[0]?.INCIDENT_REF || ""); })
      .catch((requestError) => { setIncidents([]); setCoverage([]); setMapSummary({ TOTAL_COUNT: 0, OPEN_COUNT: 0 }); setError(requestError.message); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const initialFilters = { query: initialQuery, category: "", suburb: "", area: "", status: "", month: "" };
    setFilters(initialFilters); setMarkerLimit(2500); setTimeBounds({ EARLIEST_DATE: "", LATEST_DATE: "" }); setTimeRange({ from: "", to: "" });
    fetch("/api/incidents/filters", { headers: { "X-Demo-User": user } }).then((response) => response.json()).then(setFilterOptions).catch(() => setFilterOptions({ categories: [], suburbs: [], areas: [], statuses: [] }));
    loadMap(initialFilters, 2500, { from: "", to: "" });
  }, [user, initialQuery, initialPatternCode]);

  const mapped = incidents.filter((item) => Number.isFinite(Number(item.LATITUDE)) && Number.isFinite(Number(item.LONGITUDE)));
  const isOpen = (item) => !["resolved", "closed_no_further_action"].includes(String(item.INCIDENT_STATUS || "").toLowerCase());
  const isPriority = (item) => isOpen(item) || String(item.SEVERITY_BAND || "").toLowerCase() === "high";
  const totalCount = Number(mapSummary.TOTAL_COUNT || 0);
  const openCount = Number(mapSummary.OPEN_COUNT || 0);
  const priority = mapped.filter(isPriority);
  const suburbCounts = coverage.reduce((all, item) => ({ ...all, [item.SUBURB]: Number(item.INCIDENT_COUNT) }), {});
  const busiestSuburb = coverage[0] ? [coverage[0].SUBURB, Number(coverage[0].INCIDENT_COUNT)] : null;
  const selected = mapped.find((item) => item.INCIDENT_REF === selectedRef) || mapped[0];
  const visibleMarkers = mapped;
  const choose = (item, openDetail = false) => { setSelectedRef(item.INCIDENT_REF); if (openDetail) setDetailObject({ ...item, type: "incident" }); };
  const toggle = (name) => setLayers((current) => ({ ...current, [name]: !current[name] }));
  const dayNumber = (value) => value ? Math.round(Date.parse(value + "T00:00:00Z") / 86400000) : 0;
  const dayString = (value) => new Date(value * 86400000).toISOString().slice(0, 10);
  const earliestDay = dayNumber(timeBounds.EARLIEST_DATE), latestDay = dayNumber(timeBounds.LATEST_DATE);
  const startDay = dayNumber(timeRange.from || timeBounds.EARLIEST_DATE), endDay = dayNumber(timeRange.to || timeBounds.LATEST_DATE);
  const changeTime = (edge, value) => setTimeRange((current) => { const next = { ...current, [edge]: dayString(Number(value)) }; return edge === "from" && next.to && next.from > next.to ? { ...next, to: next.from } : edge === "to" && next.from && next.to < next.from ? { ...next, from: next.to } : next; });
  const displayDate = (value) => value ? new Date(value + "T00:00:00Z").toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
  const timeSpan = Math.max(1, latestDay - earliestDay);
  const timeStartPercent = Math.max(0, Math.min(100, ((startDay - earliestDay) / timeSpan) * 100));
  const timeEndPercent = Math.max(0, Math.min(100, ((endDay - earliestDay) / timeSpan) * 100));
  const applyTimeRange = () => loadMap(filters, markerLimit, timeRange);
  const shiftTimeRange = (direction) => {
    const width = Math.max(0, endDay - startDay), nextStart = Math.max(earliestDay, Math.min(latestDay - width, startDay + direction)), next = { from: dayString(nextStart), to: dayString(nextStart + width) };
    setTimeRange(next); loadMap(filters, markerLimit, next);
  };
  const categoryColor = (item) => {
    if (!layers.categories) return "";
    return item.DISPLAY_COLOR || "#437c94";
  };
  const suburbCenters = coverage.map((item) => ({ name: item.SUBURB, lat: Number(item.LATITUDE), lng: Number(item.LONGITUDE), count: Number(item.INCIDENT_COUNT) }));
  const priorities = [
    { label: "Active incident workload", value: `${openCount.toLocaleString("en-AU")} open records`, text: "Authorised records still reported, assigned, or under review in this filtered set.", tone: "red" },
    { label: "Priority map markers", value: `${priority.length} highlighted`, text: "Priority emphasis is descriptive and based on record status and category.", tone: "amber" },
    { label: "Coverage context", value: busiestSuburb ? `${busiestSuburb[0]} · ${busiestSuburb[1]}` : "No mapped area", text: "Highest suburb volume in the current filtered security scope.", tone: "teal" },
  ];

  return (
    <section className="incident-map-page">
      <section className="incident-map-intro">
        <small className="kicker">ORACLE SPATIAL · DEEP DATA SECURITY</small>
        <h2>Incident Map</h2>
        <p>Explore approximate incident locations, priority context, and authorised records within the active data-security scope.</p>
      </section>

      <div className="incident-map-stats">
        <article><i>◎</i><b>{mapped.length.toLocaleString("en-AU")}</b><span>Displayed map markers</span><small>of {totalCount.toLocaleString("en-AU")} matching records</small></article>
        <article><i>◌</i><b>{openCount.toLocaleString("en-AU")}</b><span>Active incidents</span><small>reported, assigned or under review</small></article>
        <article><i>⌖</i><b>{Object.keys(suburbCounts).length}</b><span>Suburbs represented</span><small>authorised coverage</small></article>
        <article><i>!</i><b>{priority.length.toLocaleString("en-AU")}</b><span>Priority markers</span><small>in the displayed marker set</small></article>
      </div>

      <section className="incident-map-filters">
        <div className="incident-map-section-head"><div><small>MAP FILTERS · AUTHORISED DATA</small><h3>Search and refine the spatial view</h3><p>Apply a flexible search or list-of-values filter, then choose how many authorised incident markers to draw.</p></div><span>{loading ? "Refreshing…" : `${totalCount.toLocaleString("en-AU")} matching records`}</span></div>
        <form onSubmit={(event) => { event.preventDefault(); loadMap(filters, markerLimit, timeRange); }}>
          <label className="map-filter-search"><span>Search</span><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Incident, category, suburb, modus or title…" /></label>
          <label><span>Crime category</span><select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="">All categories</option>{filterOptions.categories.map((item) => <option key={item.VALUE} value={item.VALUE}>{item.VALUE} ({item.RECORD_COUNT})</option>)}</select></label>
          <label><span>Suburb</span><select value={filters.suburb} onChange={(event) => setFilters((current) => ({ ...current, suburb: event.target.value }))}><option value="">All suburbs</option>{filterOptions.suburbs.map((item) => <option key={item.VALUE} value={item.VALUE}>{item.VALUE} ({item.RECORD_COUNT})</option>)}</select></label>
          <label><span>Patrol area</span><select value={filters.area} onChange={(event) => setFilters((current) => ({ ...current, area: event.target.value }))}><option value="">All authorised areas</option>{filterOptions.areas.map((item) => <option key={item.VALUE} value={item.VALUE}>{item.VALUE} ({item.RECORD_COUNT})</option>)}</select></label>
          <label><span>Status</span><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option>{filterOptions.statuses.map((item) => <option key={item.VALUE} value={item.VALUE}>{String(item.VALUE).replaceAll("_", " ")} ({item.RECORD_COUNT})</option>)}</select></label>
          <label><span>Month</span><select value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}><option value="">May and June 2026</option><option value="2026-05">May 2026</option><option value="2026-06">June 2026</option></select></label>
          <label><span>Markers to draw</span><select value={markerLimit} onChange={(event) => { const nextLimit = Number(event.target.value); setMarkerLimit(nextLimit); loadMap(filters, nextLimit); }}><option value="500">500 markers</option><option value="2500">2,500 markers</option><option value="5000">5,000 markers</option><option value="25000">All matching markers</option></select></label>
          <div className="map-filter-actions"><button className="primary" type="submit">Update map</button><button type="button" onClick={() => { const reset = { query: "", category: "", suburb: "", area: "", status: "", month: "" }; const resetTime={ from: timeBounds.EARLIEST_DATE, to: timeBounds.LATEST_DATE }; setFilters(reset); setTimeRange(resetTime); setMarkerLimit(2500); loadMap(reset, 2500, resetTime); }}>Clear</button></div>
        </form>
        {error && <p className="pattern-error">Map query error: {error}</p>}
        <small className="incident-map-filter-note">Suburb labels and coverage totals always use the full filtered result; marker drawing is intentionally selectable to keep the interactive map responsive.</small>
      </section>

      <section className="incident-map-priorities">
        <div className="incident-map-section-head"><div><small>INCIDENT PRIORITIES</small><h3>Current map review priorities</h3><p>Database-backed descriptive context from the incidents visible in this security scope.</p></div><span>Oracle Spatial</span></div>
        <div className="incident-map-priority-grid">
          {priorities.map((item) => <article className={item.tone} key={item.label}><small>{item.label}</small><b>{item.value}</b><p>{item.text}</p></article>)}
        </div>
      </section>

      <section className="incident-map-panel">
        <header className="incident-map-panel__head">
          <div><small>APPROXIMATE COORDINATES</small><h3>Authorised incident locations</h3><p>{selected ? `${selected.INCIDENT_REF} · ${selected.CATEGORY_NAME} · ${selected.SUBURB}` : "Loading authorised incident locations…"}</p></div>
          <div className="incident-map-toggles">
            <span>Mouse wheel to zoom · drag to pan · {mapped.length.toLocaleString("en-AU")} markers drawn</span>
          </div>
        </header>
        <div className="incident-leaflet-map" aria-label="Approximate incident map">
          <MapContainer center={[-34.9285, 138.6]} zoom={10} minZoom={8} maxZoom={16} scrollWheelZoom preferCanvas className="incident-leaflet-map__canvas">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution="Tiles © Esri" />
            <IncidentMapFocus incident={selected} />
            {layers.suburbs && suburbCenters.map((suburb) => <CircleMarker key={suburb.name} center={[suburb.lat, suburb.lng]} radius={1} pathOptions={{ opacity: 0, fillOpacity: 0 }} interactive={false}><Tooltip permanent direction="center" className="incident-suburb-label">{suburb.name}</Tooltip></CircleMarker>)}
            {layers.incidents && visibleMarkers.map((item) => {
              const highlighted = isPriority(item) && layers.priority;
              const color = highlighted ? "#c74634" : categoryColor(item) || "#437c94";
              return <CircleMarker key={item.INCIDENT_REF} center={[Number(item.LATITUDE), Number(item.LONGITUDE)]} radius={item.INCIDENT_REF === selectedRef ? 10 : highlighted ? 8 : 5} pathOptions={{ color: item.INCIDENT_REF === selectedRef ? "#f3c756" : "#fff", weight: item.INCIDENT_REF === selectedRef ? 4 : 1, fillColor: color, fillOpacity: .82 }} eventHandlers={{ click: () => choose(item, true) }}>{mapped.length <= 5000 && <Tooltip sticky><b>{item.INCIDENT_REF}</b><br />{item.CATEGORY_NAME}<br />{item.SUBURB} · {String(item.INCIDENT_STATUS || "").replaceAll("_", " ")}</Tooltip>}</CircleMarker>;
            })}
          </MapContainer>
          {timeBounds.EARLIEST_DATE && <section className="incident-map-timeline-overlay" style={{ "--time-start": `${timeStartPercent}%`, "--time-end": `${timeEndPercent}%` }} aria-label="Historical incident time slider">
            <header><div><small>OCCURRED AT · AUTHORISED TIME RANGE</small><b>Historical incident time</b></div><span>{displayDate(timeRange.from)} <i>→</i> {displayDate(timeRange.to)}</span></header>
            <div className="incident-map-timeline-overlay__range"><i /><em /><input type="range" min={earliestDay} max={latestDay} value={Math.min(startDay, endDay)} onChange={(event) => changeTime("from", event.target.value)} aria-label="Start date" /><input type="range" min={earliestDay} max={latestDay} value={Math.max(startDay, endDay)} onChange={(event) => changeTime("to", event.target.value)} aria-label="End date" /></div>
            <div className="incident-map-timeline-overlay__ticks">{Array.from({ length: 5 }, (_, index) => <span key={index} style={{ left: `${index * 25}%` }} />)}</div>
            <footer><span>{displayDate(timeBounds.EARLIEST_DATE)}</span><div><button onClick={() => shiftTimeRange(-1)} title="Previous time window">‹</button><button onClick={() => { const full={ from: timeBounds.EARLIEST_DATE, to: timeBounds.LATEST_DATE }; setTimeRange(full); loadMap(filters, markerLimit, full); }} title="Show full period">↔</button><button onClick={() => shiftTimeRange(1)} title="Next time window">›</button><button className="apply" onClick={applyTimeRange}>Apply</button></div><span>{displayDate(timeBounds.LATEST_DATE)}</span></footer>
          </section>}
          <div className="incident-map-layers" aria-label="Incident map layers"><b>☷ &nbsp; MAP LAYERS</b><button className={layers.incidents ? "active" : ""} onClick={() => toggle("incidents")}><i />Incident locations</button><button className={layers.suburbs ? "active suburb" : ""} onClick={() => toggle("suburbs")}><i />Suburb labels</button><button className={layers.categories ? "active category" : ""} onClick={() => toggle("categories")}><i />Crime categories</button><button className={layers.priority ? "active priority" : ""} onClick={() => toggle("priority")}><i />Priority incidents</button></div>
          <div className="incident-map-key"><span><i className="standard" /> Incident</span><span><i className="priority" /> Priority review</span><span><i className="selected" /> Selected record</span></div>
        </div>
      </section>

      <section className="incident-map-records">
        <div className="incident-map-section-head"><div><small>AUTHORISED INCIDENT RECORDS</small><h3>Incident records on the map</h3><p>Select a displayed record to focus its matching marker on the map.</p></div><span>{mapped.length.toLocaleString("en-AU")} displayed</span></div>
        <div className="incident-map-table-wrap"><table><thead><tr><th>Incident</th><th>Category</th><th>Suburb</th><th>Status</th><th>Occurred</th></tr></thead><tbody>{mapped.slice(0, 16).map((item) => <tr key={item.INCIDENT_REF} tabIndex="0" onClick={() => choose(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") choose(item); }} className={item.INCIDENT_REF === selectedRef ? "selected" : ""}><td><b>{item.INCIDENT_REF}</b><small>{item.MODUS_OPERANDI || "Incident record"}</small></td><td>{item.CATEGORY_NAME}</td><td>{item.SUBURB}</td><td><span className={`incident-status ${isOpen(item) ? "open" : "closed"}`}>{String(item.INCIDENT_STATUS || "").replaceAll("_", " ")}</span></td><td>{String(item.OCCURRED_AT || "").slice(0, 10)}</td></tr>)}</tbody></table></div>
      </section>
      <ObjectDetailModal object={detailObject} onClose={() => setDetailObject(null)} user={user} />
    </section>
  );
}
function IncidentCapacityAnalytics({ user, initialTab = "demand" }) {
  const [tab, setTab] = useState(initialTab), [days, setDays] = useState(30), [data, setData] = useState({}), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => setTab(initialTab), [initialTab]);
  useEffect(() => { setLoading(true); setError(""); const header = { "X-Demo-User": user }; Promise.all([fetch("/api/analytics/summary", { headers: header }), fetch("/api/analytics/demand?days=" + days, { headers: header }), fetch("/api/analytics/areas", { headers: header }), fetch("/api/analytics/trend?days=" + days, { headers: header }), fetch("/api/analytics/vector-groups", { headers: header }), fetch("/api/analytics/case-capacity", { headers: header })]).then(async (responses) => { const values = await Promise.all(responses.map(async (response) => { const body = await response.json(); if (!response.ok) throw Error(body.error || "Analytics unavailable"); return body; })); return values; }).then(([summary, demand, areas, trend, vectors, cases]) => setData({ summary, demand, areas, trend, vectors, cases })).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [user, days]);
  const tabs = [["demand", "Incident Demand", "Category activity and active workload"], ["areas", "Area Workload", "Authorised patrol-area context"], ["trend", "Volume Trend", "Historical rolling incident volume"], ["vectors", "Vector Groups", "Pattern similarity context"], ["cases", "Case Context", "Case, evidence, and POI relationships"]];
  const summary = data.summary || {}, demand = data.demand?.results || [], areas = data.areas || [], trend = data.trend?.results || [], vectors = data.vectors?.results || [], cases = data.cases || [];
  const maxDemand = Math.max(1, ...demand.map((row) => Number(row.CURRENT_COUNT)));
  const maxTrend = Math.max(1, ...trend.map((row) => Number(row.INCIDENT_COUNT)));
  const points = trend.map((row, index) => `${trend.length < 2 ? 50 : (index / (trend.length - 1)) * 100},${94 - (Number(row.INCIDENT_COUNT) / maxTrend) * 82}`).join(" ");
  const activePoints = trend.map((row, index) => `${trend.length < 2 ? 50 : (index / (trend.length - 1)) * 100},${94 - (Number(row.ACTIVE_COUNT) / maxTrend) * 82}`).join(" ");
  return <section className="incident-capacity-analytics">
    <header className="ica-head"><div><small className="kicker">SQL ANALYTICS · VECTOR SEARCH · DEEP DATA SECURITY</small><h2>Incident and Capacity Analytics</h2><p>Descriptive analysis of authorised incident activity, relationship workload, and pattern groups. It does not predict crime, identify people, or recommend deployments.</p></div><span>demonstration analytics</span></header>
    <div className="ica-stats"><article className="sienna"><small>INCIDENTS IN LAST 30 DAYS</small><b>{Number(summary.INCIDENT_COUNT || 0).toLocaleString("en-AU")}</b><span>authorised descriptive volume</span></article><article className="red"><small>ACTIVE RECORDS</small><b>{Number(summary.ACTIVE_COUNT || 0).toLocaleString("en-AU")}</b><span>reported, assigned, or under review</span></article><article className="teal"><small>PATROL AREAS IN SCOPE</small><b>{summary.AREA_COUNT || 0}</b><span>security-filtered geography</span></article><article className="plum"><small>PATTERN CATEGORIES</small><b>{summary.CATEGORY_COUNT || 0}</b><span>authorised incident categories</span></article></div>
    <div className="ica-tabs" role="tablist">{tabs.map(([key, label, detail]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)} role="tab" aria-selected={tab === key}><b>{label}</b><small>{detail}</small></button>)}</div>
    {error && <p className="pattern-error">Analytics error: {error}</p>}
    {loading ? <section className="ica-panel ica-loading">Refreshing authorised analytics…</section> : <>
      {tab === "demand" && <section className="ica-panel"><header><div><small>INCIDENT DEMAND REVIEW</small><h3>Category activity and active-record context</h3><p>Compare current and immediately prior historical windows; this is descriptive workload context, not a demand prediction.</p></div><div className="ica-window">{[7, 30, 90].map((value) => <button key={value} className={days === value ? "active" : ""} onClick={() => setDays(value)}>{value} days</button>)}</div></header><div className="ica-demand">{demand.map((row) => { const current = Number(row.CURRENT_COUNT), prior = Number(row.PRIOR_COUNT), delta = prior ? ((current - prior) / prior) * 100 : 0; return <article key={row.CATEGORY_NAME}><div><b>{row.CATEGORY_NAME}</b><span>{current.toLocaleString("en-AU")} incidents · {row.ACTIVE_COUNT} active</span></div><i><em style={{ width: `${(current / maxDemand) * 100}%` }} /></i><strong className={delta > 0 ? "up" : ""}>{delta >= 0 ? "+" : ""}{delta.toFixed(0)}%<small>vs prior {days}d</small></strong></article>; })}</div><footer>Engine: Oracle SQL conditional aggregation over scoped incident records · active-context comparison only.</footer></section>}
      {tab === "areas" && <section className="ica-panel"><header><div><small>PATROL-AREA WORKLOAD SEGMENTS</small><h3>Authorised capacity context by geographic scope</h3><p>Visible volume, active-record share, and category breadth for the current 30-day history.</p></div></header><div className="ica-area-grid">{areas.map((row, index) => <article key={row.AREA_NAME}><span className={`ica-area-dot dot-${index}`} /><small>{row.AREA_NAME}</small><b>{Number(row.INCIDENT_COUNT).toLocaleString("en-AU")}</b><p>incidents in historical window</p><div><span>{row.ACTIVE_COUNT} active records</span><strong>{row.ACTIVE_RATIO}% active share</strong></div><em>{row.CATEGORY_COUNT} categories represented</em></article>)}</div><footer>Security scope changes the areas and totals shown. This view does not rank areas for operational action.</footer></section>}
      {tab === "trend" && <section className="ica-panel"><header><div><small>HISTORICAL INCIDENT VOLUME TREND</small><h3>{days}-day authorised activity history</h3><p>Rolling observed volume and active-record count. There is no future crime forecast or deployment recommendation.</p></div><div className="ica-window">{[7, 30, 90].map((value) => <button key={value} className={days === value ? "active" : ""} onClick={() => setDays(value)}>{value} days</button>)}</div></header><div className="ica-trend"><div className="ica-trend__legend"><span>Observed incident volume</span><span>Active-record volume</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Historical incident volume trend"><line x1="0" y1="94" x2="100" y2="94" /><polyline points={points} className="ica-trend__all" /><polyline points={activePoints} className="ica-trend__active" /></svg><div><span>{trend[0]?.DAY_LABEL || "—"}</span><span>{trend[trend.length - 1]?.DAY_LABEL || "—"}</span></div></div><footer>Engine: Oracle date bucketing and SQL aggregation over records visible in the active DDS scope.</footer></section>}
      {tab === "vectors" && <section className="ica-panel"><header><div><small>VECTOR PATTERN GROUPS</small><h3>Incident narrative groups</h3><p>Groups are based on the existing 8-dimensional scenario vectors used by Crime Pattern Signals.</p></div><span className="ica-tech">{data.vectors?.model} · {data.vectors?.dimensions}d · {data.vectors?.distance}</span></header><div className="ica-vector-grid">{vectors.map((row, index) => <article key={row.MODUS_OPERANDI}><i className={`vector-${index % 5}`} /> <small>GROUP {String(index + 1).padStart(2, "0")}</small><h3>{String(row.MODUS_OPERANDI || "control record").replaceAll("-", " ")}</h3><div><b>{Number(row.INCIDENT_COUNT).toLocaleString("en-AU")}</b><span>incidents</span></div><p>{row.CATEGORY_COUNT} category types · {row.ACTIVE_RATIO}% active-record share</p></article>)}</div><footer>Oracle Vector Search context only. These vectors describe demonstration scenarios; they are not people, risk, or prediction embeddings.</footer></section>}
      {tab === "cases" && <section className="ica-panel"><header><div><small>CASE AND RELATIONSHIP CONTEXT</small><h3>Authorised case workload</h3><p>Connected records visible through case-to-incident joins within the active data-security scope.</p></div></header><div className="ica-case-table"><table><thead><tr><th>Case</th><th>Pattern</th><th>Status</th><th>Incidents</th><th>Evidence</th><th>Person profiles</th></tr></thead><tbody>{cases.map((row) => <tr key={row.CASE_REF}><td><b>{row.CASE_REF}</b></td><td>{row.PATTERN_LABEL}</td><td><span>{String(row.CASE_STATUS).replaceAll("_", " ")}</span></td><td>{row.INCIDENT_COUNT}</td><td>{row.EVIDENCE_COUNT}</td><td>{row.PERSON_COUNT}</td></tr>)}</tbody></table></div><footer>Relationship totals describe demonstration data connected to visible incidents. They are not assessments of persons or case priority.</footer></section>}
    </>}
  </section>;
}
const CRIME_ASKS = [
  ["DEMAND RISK", "Incident Demand Context", "Which incident categories have the highest recent authorised volume?"],
  ["QUALITY SIGNALS", "Incident Data Quality", "What does record completeness look like across authorised incident categories?"],
  ["LOGISTICS", "Geographic and Patrol Coverage", "How is authorised incident activity distributed across patrol areas?"],
  ["OPERATIONS", "Active Incident Operations", "What is the authorised incident status mix?"],
  ["SERVICE REQUESTS", "Incident Reports", "Which categories have the most authorised incident reports?"],
  ["SITES", "Patrol Areas", "Which patrol areas and suburbs are in my authorised data scope?"],
  ["SIGNAL TRENDS", "Incident Signal Trends", "What is the recent authorised incident signal trend?"],
  ["PATHWAYS", "Case Relationships", "What relationship context is available across authorised case files?"],
];
function AskCrimeData({ user }) {
  const [messages, setMessages] = useState([]), [input, setInput] = useState(""), [mode, setMode] = useState("narrate"), [sending, setSending] = useState(false), [error, setError] = useState(""), [v2Open, setV2Open] = useState(false);
  const ask = (value) => { const question = String(value || input).trim(); if (!question || sending) return; setInput(""); setError(""); setMessages((current) => [...current, { role: "user", text: question, mode }]); setSending(true); fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json", "X-Demo-User": user }, body: JSON.stringify({ question, mode }) }).then(async (response) => { const body = await response.json(); if (!response.ok) throw Error(body.error || "Ask Crime Data unavailable"); return body; }).then((response) => setMessages((current) => [...current, { role: "assistant", ...response }])).catch((e) => setError(e.message)).finally(() => setSending(false)); };
  const renderValue = (value) => value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return <section className="ask-crime-data">
    <header className="ask-crime-data__head"><div><small className="kicker">GOVERNED NATURAL-LANGUAGE QUESTIONS · ORACLE SQL</small><h2>Ask Crime Data</h2><p>Ask guided questions about authorised incident activity. The assistant selects a reviewed SQL template, Oracle executes it against scoped views, and the page explains or displays the result.</p></div><div className="ask-crime-data__head-actions"><button onClick={() => setV2Open(true)}>Ask Crime V2 ↗</button><span>read-only governed queries</span></div></header>
    <section className="ask-crime-data__assistant"><header><div><i>✦</i><div><h3>Crime Data Assistant</h3><p>Guided natural-language questions over the Crime Data schema.</p></div></div>{messages.length > 0 && <button onClick={() => { setMessages([]); setError(""); }}>Clear conversation</button>}</header><div className="ask-crime-data__modes"><b>Response mode</b>{[["narrate", "Explain answer"], ["showsql", "Show SQL"], ["runsql", "Run query"]].map(([key, label]) => <button key={key} className={mode === key ? "active" : ""} onClick={() => setMode(key)}>{label}</button>)}<span>All modes use reviewed, read-only SQL templates and the active data-security scope.</span></div><div className="ask-crime-data__conversation">{!messages.length && <div className="ask-crime-data__empty"><b>Ask about incident demand, data quality, geography, operations, incident reports, patrol areas, signal trends, or case relationships.</b><p>Choose a guided crime-data question below, or enter your own question using the same safe domains.</p><div className="ask-crime-data__schema"><span>Queryable data domains</span><b>Incidents</b><b>Reports</b><b>Patrol Areas</b><b>Cases</b><b>Evidence</b><b>POI Profiles</b></div></div>}{messages.map((message, index) => message.role === "user" ? <div className="ask-message ask-message--user" key={index}><p>{message.text}</p><small>{message.mode === "narrate" ? "Explain answer" : message.mode === "showsql" ? "Show SQL" : "Run query"}</small></div> : <div className="ask-message ask-message--assistant" key={index}><header><b>{message.title}</b><span>{message.rowCount} row{message.rowCount === 1 ? "" : "s"} · {message.elapsed}ms</span></header>{message.mode !== "showsql" && <><p>{message.answer}</p><ul>{message.keyFindings?.map((finding) => <li key={finding}>{finding}</li>)}</ul></>}{message.mode === "showsql" || message.mode === "runsql" ? <details open={message.mode === "showsql"}><summary>Generated governed SQL</summary><pre>{message.sql}</pre></details> : <details><summary>Inspect generated governed SQL</summary><pre>{message.sql}</pre></details>}{message.mode === "runsql" && <div className="ask-message__table"><table><thead><tr>{message.columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{message.rows.map((row, rowIndex) => <tr key={rowIndex}>{message.columns.map((column) => <td key={column}>{renderValue(row[column])}</td>)}</tr>)}</tbody></table></div>}</div>)}{sending && <div className="ask-message ask-message--loading">Preparing governed SQL…</div>}{error && <p className="pattern-error">Ask Crime Data error: {error}</p>}</div><footer><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && ask()} placeholder="Ask a guided question about authorised crime data…" /><button className="primary" disabled={sending || !input.trim()} onClick={() => ask()}>{sending ? "Asking…" : "Ask Crime Data"}</button></footer></section>
    <section className="ask-crime-data__examples"><header><div><small>GUIDED QUESTION AREAS</small><h3>Crime data questions</h3><p>Select any question to run it in the chosen response mode.</p></div><span>8 reviewed prompts</span></header><div>{CRIME_ASKS.map(([heading, topic, question]) => <article key={heading}><small>{heading}</small><b>{topic}</b><p>{question}</p><button onClick={() => ask(question)}>Ask →</button></article>)}</div></section>
    <small className="ask-crime-data__footnote">The assistant does not generate arbitrary executable SQL. It maps guided questions to reviewed, read-only templates that query scoped database views; results remain demonstration-only and descriptive.</small>
    {v2Open && <AskCrimeV2 user={user} onClose={() => setV2Open(false)} />}
  </section>;
}
const CRIME_V2_PROMPTS = [
  ["Incident overview", "What is the incident status mix by category in my authorised data scope?"],
  ["Pattern activity", "Show watched crime patterns with their linked incident and social-post counts."],
  ["Evidence context", "Which incident categories have the most linked evidence items?"],
  ["Patrol-area view", "Show incident volume by patrol area and category for my authorised data scope."],
  ["Scenario cases", "List watched patterns with linked incident references and relationship labels."],
  ["Recent signals", "What watched pattern incidents occurred most recently in my authorised data scope?"]
];
function AskCrimeV2({ user, onClose }) {
  const history = useConversationHistory();
  const [messages, setMessages] = useState([]), [input, setInput] = useState(""), [sending, setSending] = useState(false), [error, setError] = useState("");
  const ask = (value) => { const question = String(value || input).trim(); if (!question || sending) return; setInput(""); setError(""); setMessages((current) => [...current, { role: "user", text: question }]); setSending(true); fetch("/api/ask-v2", { method: "POST", headers: { "Content-Type": "application/json", "X-Demo-User": user }, body: JSON.stringify({question, historyThreadId:history.threadId}) }).then(history.readResponse).then(response => setMessages((current) => [...current, { role: "assistant", ...response }])).catch(e => setError(e.message)).finally(() => setSending(false)); };
  const value = (item) => item == null ? "—" : typeof item === "object" ? JSON.stringify(item) : String(item);
  return <div className="ask-crime-v2" role="dialog" aria-modal="true" aria-label="Ask Crime V2 Data Assistant"><section><header><div><small>OCI GENAI · NATIVE ADB SELECT AI</small><h2>Ask Crime V2</h2><p>Conversational crime-data exploration with OCI GenAI Llama 4 Maverick. Each question becomes Select AI SQL, is validated as read-only, then runs in your active data-security scope.</p></div><button onClick={onClose} aria-label="Close Ask Crime V2">×</button></header><div className="ask-crime-v2__meta"><span>meta.llama-4-maverick-17b-128e-instruct-fp8</span><span>Chicago · secure views · audit trail</span></div><div className="ask-crime-v2__prompts"><b>Try a data-assistant prompt</b><div>{CRIME_V2_PROMPTS.map(([title, question]) => <button key={title} disabled={sending} onClick={() => ask(question)}><strong>{title}</strong><span>{question}</span></button>)}</div></div><div className="ask-crime-v2__messages">{!messages.length && <p className="ask-crime-v2__empty">Ask across incidents, reports, evidence, categories, patrol areas, watched patterns, linked incidents, and linked social posts.</p>}{messages.map((message, index) => message.role === "user" ? <div className="ask-message ask-message--user" key={index}><p>{message.text}</p></div> : <article className="ask-message ask-message--assistant" key={index}><header><b>{message.title}</b><span>{message.rowCount} rows · {message.elapsed}ms</span></header><p>{message.answer}</p>{message.rowCount === 0 && <div className="ask-crime-v2__no-data"><b>No data found</b><span>The query completed successfully, but returned no records in your active data-security scope. Try a broader question or different wording.</span></div>}<ul>{message.keyFindings.map(finding => <li key={finding}>{finding}</li>)}</ul><details><summary>View Select AI generated SQL</summary><pre>{message.generatedSql}</pre></details>{message.rows.length > 0 && <div className="ask-message__table"><table><thead><tr>{message.columns.map(column => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{message.rows.map((row, rowIndex) => <tr key={rowIndex}>{message.columns.map(column => <td key={column}>{value(row[column])}</td>)}</tr>)}</tbody></table></div>}</article>)}{sending && <div className="ask-message ask-message--loading">Select AI is preparing read-only SQL…</div>}{error && <p className="pattern-error">Ask Crime V2 error: {error}</p>}</div><HistorySaveNotice history={history}/><footer><input autoFocus value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => event.key === "Enter" && ask()} placeholder="Ask a factual question across authorised crime data…" /><button className="primary" disabled={sending || !input.trim()} onClick={() => ask()}>{sending ? "Thinking…" : "Ask Crime V2"}</button></footer><small className="ask-crime-v2__notice">Descriptive synthetic data only. The assistant cannot write data, infer responsibility, assess risk, or recommend operational action.</small></section></div>;
}
function VehiclePartsChallenge({ user, onClose }) {
  const [data, setData] = useState(null), [step, setStep] = useState(0), [error, setError] = useState("");
  useEffect(() => { fetch("/api/challenges/vehicle-parts", { headers: { "X-Demo-User": user } }).then(async response => { const body = await response.json(); if (!response.ok) throw Error(body.error || "Challenge data unavailable"); return body; }).then(setData).catch(e => setError(e.message)); }, [user]);
  const date = value => value ? new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—";
  const stages = ["Mission", "Discover", "Connect", "Reveal", "Technical debrief"];
  if (error) return <div className="crime-challenge" role="dialog" aria-modal="true"><section><header><h2>Challenge unavailable</h2><button onClick={onClose}>×</button></header><p className="pattern-error">{error}</p></section></div>;
  if (!data) return <div className="crime-challenge" role="dialog" aria-modal="true"><section className="crime-challenge__loading">Loading the investigation challenge…</section></div>;
  const { pattern, incidents = [], posts = [], summary = {}, evidence = {} } = data;
  return <div className="crime-challenge" role="dialog" aria-modal="true" aria-label="CrimeData Investigation Challenge"><section><header><div><small>CRIMEDATA INVESTIGATION CHALLENGE · SYNTHETIC TRAINING</small><h2>The Vanishing Vehicle Parts</h2><p>Use the available crime-data context to investigate an emerging pattern. The scenario design is intentionally hidden until the grand reveal.</p></div><button onClick={onClose} aria-label="Close challenge">×</button></header><nav>{stages.map((label, index) => <span key={label} className={index === step ? "active" : index < step ? "done" : ""}>{index + 1}. {label}</span>)}</nav><main>{step === 0 && <section className="crime-challenge__mission"><small>MISSION CARD</small><h3>Several overnight reports describe missing vehicle components across nearby suburbs.</h3><p>Use the evidence trail to identify what context is available, what is merely unverified public context, and what remains incomplete for analyst review.</p><button className="primary" onClick={() => setStep(1)}>Begin investigation →</button></section>}{step === 1 && <section className="crime-challenge__panel"><small>DISCOVER · WATCHED PATTERN AND INCIDENT CONTEXT</small><h3>What does the data suggest?</h3><p>{pattern?.PATTERN_SUMMARY}</p><div className="crime-challenge__stats"><article><b>{summary.INCIDENT_COUNT}</b><span>linked incidents</span></article><article><b>{summary.SUBURB_COUNT}</b><span>suburbs represented</span></article><article><b>{date(summary.FIRST_OCCURRED_AT)}–{date(summary.LAST_OCCURRED_AT)}</b><span>observed window</span></article></div><p className="crime-challenge__hint">Try in the main app: open the Crime Pattern Signals page and search for vehicle components, catalytic converters, or overnight car parks.</p><button className="primary" onClick={() => setStep(2)}>Review relationship context →</button></section>}{step === 2 && <section className="crime-challenge__panel"><small>CONNECT · RECORDS, EVIDENCE AND PUBLIC CONTEXT</small><h3>What is linked, and what is missing?</h3><div className="crime-challenge__split"><article><b>Authorised incident records</b><span>{incidents.length} linked records · {evidence.REPORTED_INCIDENT_COUNT} with reports · {evidence.EVIDENCE_COUNT} evidence items</span><ul>{incidents.slice(0, 4).map(item => <li key={item.INCIDENT_REF}>{item.INCIDENT_REF} · {item.SUBURB} · {date(item.OCCURRED_AT)}</li>)}</ul></article><article><b>Public-post context</b><span>{posts.length} posts · simulated, external and unverified</span><ul>{posts.slice(0, 4).map(item => <li key={item.POST_REF}>{item.POST_REF} · {item.SUBURB} · {item.VERIFICATION_STATUS}</li>)}</ul></article></div><p className="crime-challenge__hint">The distinction matters: public posts add context but do not verify or prove an incident link.</p><button className="primary" onClick={() => setStep(3)}>View grand reveal →</button></section>}{step === 3 && <section className="crime-challenge__reveal"><small>GRAND REVEAL</small><h3>{pattern?.PATTERN_NAME}</h3><p>This is the deliberately designed <b>Vehicle Parts Harvesting</b> synthetic scenario in Adelaide Data Set V2. Its linked incidents and public posts provide a controlled training series; incomplete links are intentional teaching points, not errors.</p><div><article><b>Designed clues</b><span>Overnight timing, vehicle-component context, repeated suburb activity, linked evidence and public-signal records.</span></article><article><b>What remains bounded</b><span>Public posts are unverified. The data does not establish responsibility, risk, or an operational response.</span></article></div><button className="primary" onClick={() => setStep(4)}>How Oracle made this possible →</button></section>}{step === 4 && <section className="crime-challenge__debrief"><small>TECHNICAL DEBRIEF</small><h3>What you just used</h3><div>{[["Vector Search","Find incident narratives with similar component-removal language despite wording differences."],["Spatial + SQL","Reveal approximate location and time context across the linked activity."],["Relationships + JSON","Connect watched patterns, incidents, reports, evidence and public-post context."],["Select AI Agent V2","The next build will plan these controlled tools, reflect on gaps, and retain only the active challenge context."],["Deep Data Security + Audit","Keep results scoped to the active user and retain a reviewable run trail."]].map(([title, text]) => <article key={title}><b>{title}</b><span>{text}</span></article>)}</div><footer><button onClick={() => setStep(0)}>Replay challenge</button><button className="primary" onClick={onClose}>Return to console</button></footer></section>}</main></section></div>;
}
function ArtMarketChallenge({ user, onClose }) {
  const [data, setData] = useState(null), [step, setStep] = useState(0), [error, setError] = useState("");
  useEffect(() => { fetch("/api/challenges/art-market", { headers: { "X-Demo-User": user } }).then(async response => { const body=await response.json(); if(!response.ok) throw Error(body.error || "Challenge data unavailable"); return body; }).then(setData).catch(e=>setError(e.message)); }, [user]);
  if(error) return <div className="crime-challenge" role="dialog" aria-modal="true"><section><header><h2>Challenge unavailable</h2><button onClick={onClose}>×</button></header><p className="pattern-error">{error}</p></section></div>;
  if(!data) return <div className="crime-challenge" role="dialog" aria-modal="true"><section className="crime-challenge__loading">Loading the investigation challenge…</section></div>;
  const {pattern,incidents=[],posts=[],summary={},evidence={}}=data, stages=["Mission","Discover","Connect","Reveal","Technical debrief"];
  return <div className="crime-challenge" role="dialog" aria-modal="true" aria-label="Gallery Payment Puzzle"><section><header><div><small>CRIMEDATA INVESTIGATION CHALLENGE · SYNTHETIC TRAINING</small><h2>The Gallery Payment Puzzle</h2><p>Investigate a series of unusual payment-document and provenance signals. The designed scenario remains hidden until the grand reveal.</p></div><button onClick={onClose}>×</button></header><nav>{stages.map((label,index)=><span key={label} className={index===step?"active":index<step?"done":""}>{index+1}. {label}</span>)}</nav><main>{step===0&&<section className="crime-challenge__mission"><small>MISSION CARD</small><h3>Several payment and supporting-document anomalies have appeared around the local art market.</h3><p>Identify the authorised record context, distinguish unverified commentary from reported information, and note the gaps requiring analyst review.</p><button className="primary" onClick={()=>setStep(1)}>Begin investigation →</button></section>}{step===1&&<section className="crime-challenge__panel"><small>DISCOVER · DOCUMENT AND PAYMENT CONTEXT</small><h3>What is the watched pattern?</h3><p>{pattern?.PATTERN_SUMMARY}</p><div className="crime-challenge__stats"><article><b>{summary.INCIDENT_COUNT}</b><span>linked incidents</span></article><article><b>{summary.SUBURB_COUNT}</b><span>suburbs represented</span></article><article><b>{summary.FIRST_OCCURRED_AT?new Date(summary.FIRST_OCCURRED_AT).toLocaleDateString("en-AU",{month:"short",day:"numeric"}):"—"}</b><span>first linked record</span></article></div><button className="primary" onClick={()=>setStep(2)}>Review linked context →</button></section>}{step===2&&<section className="crime-challenge__panel"><small>CONNECT · INCIDENTS, RECORDS AND PUBLIC CONTEXT</small><h3>What can be reviewed?</h3><div className="crime-challenge__split"><article><b>Authorised records</b><span>{incidents.length} linked incidents · {evidence.REPORTED_INCIDENT_COUNT} reports · {evidence.EVIDENCE_COUNT} evidence items</span><ul>{incidents.slice(0,4).map(item=><li key={item.INCIDENT_REF}>{item.INCIDENT_REF} · {item.SUBURB} · {item.RELATIONSHIP_LABEL}</li>)}</ul></article><article><b>Public-post context</b><span>{posts.length} posts · simulated, external and unverified</span><ul>{posts.slice(0,4).map(item=><li key={item.POST_REF}>{item.POST_REF} · {item.SUBURB} · {item.VERIFICATION_STATUS}</li>)}</ul></article></div><p className="crime-challenge__hint">Document irregularities and public commentary are context for review; they do not establish fraud, responsibility, or a connected case.</p><button className="primary" onClick={()=>setStep(3)}>View grand reveal →</button></section>}{step===3&&<section className="crime-challenge__reveal"><small>GRAND REVEAL</small><h3>{pattern?.PATTERN_NAME}</h3><p>This is the synthetic <b>Art Market Payments</b> training scenario in Adelaide Data Set V2. The designed clues concern payment instructions, invoices, receipts, and provenance-related documents—not conclusions about any person or organisation.</p><div><article><b>Designed clues</b><span>Repeated document anomalies, payment context, linked records, and unverified public context.</span></article><article><b>What remains bounded</b><span>The scenario supports an analyst-review exercise only. It makes no fraud determination or operational recommendation.</span></article></div><button className="primary" onClick={()=>setStep(4)}>How Oracle made this possible →</button></section>}{step===4&&<section className="crime-challenge__debrief"><small>TECHNICAL DEBRIEF</small><h3>What you just used</h3><div>{[["Vector Search","Find related report language despite differences in invoice, receipt and payment wording."],["Relationships + JSON","Connect watched-pattern links, incidents, reports, evidence and structured document context."],["Select AI Agent V2","The future agent will plan controlled review steps and flag missing data before it prepares a brief."],["Deep Data Security + Audit","Keep every result scoped, descriptive, and reviewable." ]].map(([title,text])=><article key={title}><b>{title}</b><span>{text}</span></article>)}</div><footer><button onClick={()=>setStep(0)}>Replay challenge</button><button className="primary" onClick={onClose}>Return to console</button></footer></section>}</main></section></div>;
}
function ServiceAccessChallenge({ user, onClose }) { const [data,setData]=useState(null),[step,setStep]=useState(0),[error,setError]=useState(""); useEffect(()=>{fetch("/api/challenges/service-access",{headers:{"X-Demo-User":user}}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error||"Challenge data unavailable");return b;}).then(setData).catch(e=>setError(e.message));},[user]); if(error)return <div className="crime-challenge"><section><p className="pattern-error">{error}</p></section></div>;if(!data)return <div className="crime-challenge"><section className="crime-challenge__loading">Loading the investigation challenge…</section></div>;const {pattern,incidents=[],posts=[],summary={},evidence={}}=data,stages=["Mission","Discover","Connect","Reveal","Technical debrief"];return <div className="crime-challenge" role="dialog" aria-modal="true" aria-label="After-hours Access Trail"><section><header><div><small>CRIMEDATA INVESTIGATION CHALLENGE · SYNTHETIC TRAINING</small><h2>The After-hours Access Trail</h2><p>Investigate repeated after-hours property-entry signals without treating a pattern as proof of responsibility.</p></div><button onClick={onClose}>×</button></header><nav>{stages.map((x,i)=><span key={x} className={i===step?"active":i<step?"done":""}>{i+1}. {x}</span>)}</nav><main>{step===0&&<section className="crime-challenge__mission"><small>MISSION CARD</small><h3>Several reports refer to access through rear, side, and service-entry points outside trading hours.</h3><p>Review the authorised incident context, timing, and clearly separated public-post signals.</p><button className="primary" onClick={()=>setStep(1)}>Begin investigation →</button></section>}{step===1&&<section className="crime-challenge__panel"><small>DISCOVER · ACCESS AND TIME CONTEXT</small><h3>What is being watched?</h3><p>{pattern?.PATTERN_SUMMARY}</p><div className="crime-challenge__stats"><article><b>{summary.INCIDENT_COUNT}</b><span>linked incidents</span></article><article><b>{summary.SUBURB_COUNT}</b><span>suburbs represented</span></article><article><b>{posts.length}</b><span>unverified public posts</span></article></div><button className="primary" onClick={()=>setStep(2)}>Review relationship context →</button></section>}{step===2&&<section className="crime-challenge__panel"><small>CONNECT · AUTHORISED AND EXTERNAL CONTEXT</small><h3>What is available for review?</h3><div className="crime-challenge__split"><article><b>Authorised incident records</b><span>{incidents.length} linked incidents · {evidence.REPORTED_INCIDENT_COUNT} reports · {evidence.EVIDENCE_COUNT} evidence items</span><ul>{incidents.slice(0,4).map(x=><li key={x.INCIDENT_REF}>{x.INCIDENT_REF} · {x.SUBURB} · {x.LOCATION_TYPE}</li>)}</ul></article><article><b>Public-post context</b><span>{posts.length} posts · simulated, external and unverified</span><ul>{posts.slice(0,4).map(x=><li key={x.POST_REF}>{x.POST_REF} · {x.SUBURB} · {x.VERIFICATION_STATUS}</li>)}</ul></article></div><p className="crime-challenge__hint">The challenge distinguishes authorised records from external commentary. Neither establishes a person’s responsibility.</p><button className="primary" onClick={()=>setStep(3)}>View grand reveal →</button></section>}{step===3&&<section className="crime-challenge__reveal"><small>GRAND REVEAL</small><h3>{pattern?.PATTERN_NAME}</h3><p>This is the synthetic <b>After-hours Service Access</b> scenario. The designed clues focus on broad access-point and time context, allowing participants to practise secure pattern exploration.</p><div><article><b>Designed clues</b><span>After-hours timing, rear/service access context, linked reports, and separated public-signal records.</span></article><article><b>What remains bounded</b><span>The scenario does not identify a person, prove a connection, or recommend an operational response.</span></article></div><button className="primary" onClick={()=>setStep(4)}>How Oracle made this possible →</button></section>}{step===4&&<section className="crime-challenge__debrief"><small>TECHNICAL DEBRIEF</small><h3>What you just used</h3><div>{[["Spatial + SQL","Explore approximate location and time context across authorised records."],["Vector Search","Find related access-language narratives despite wording differences."],["Relationships + JSON","Connect watched patterns, incidents, reports, evidence, and public context."],["Select AI Agent V2","The next build will plan controlled tools and explicitly reflect on gaps."],["Deep Data Security + Audit","Scope the data and retain a reviewable activity trail."]].map(([a,b])=><article key={a}><b>{a}</b><span>{b}</span></article>)}</div><footer><button onClick={()=>setStep(0)}>Replay challenge</button><button className="primary" onClick={onClose}>Return to console</button></footer></section>}</main></section></div>;}
function NightPrecinctChallenge({ user, onClose }) { const [data,setData]=useState(null),[step,setStep]=useState(0),[error,setError]=useState("");useEffect(()=>{fetch("/api/challenges/night-precinct",{headers:{"X-Demo-User":user}}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error||"Challenge data unavailable");return b;}).then(setData).catch(e=>setError(e.message));},[user]);if(error)return <div className="crime-challenge"><section><p className="pattern-error">{error}</p></section></div>;if(!data)return <div className="crime-challenge"><section className="crime-challenge__loading">Loading the investigation challenge…</section></div>;const {pattern,incidents=[],posts=[],summary={},evidence={}}=data,stages=["Mission","Discover","Connect","Reveal","Technical debrief"];return <div className="crime-challenge" role="dialog" aria-modal="true" aria-label="Night Precinct Ripple"><section><header><div><small>CRIMEDATA INVESTIGATION CHALLENGE · SYNTHETIC TRAINING</small><h2>The Night Precinct Ripple</h2><p>Explore an entertainment-precinct scenario while keeping public signals distinct from authorised incident records.</p></div><button onClick={onClose}>×</button></header><nav>{stages.map((x,i)=><span key={x} className={i===step?"active":i<step?"done":""}>{i+1}. {x}</span>)}</nav><main>{step===0&&<section className="crime-challenge__mission"><small>MISSION CARD</small><h3>Community commentary describes rising activity around an entertainment precinct as the evening progresses.</h3><p>Identify the authorised record context, timing, and data gaps without equating public commentary with verified incidents.</p><button className="primary" onClick={()=>setStep(1)}>Begin investigation →</button></section>}{step===1&&<section className="crime-challenge__panel"><small>DISCOVER · TIME, PLACE AND ACTIVITY CONTEXT</small><h3>What is being watched?</h3><p>{pattern?.PATTERN_SUMMARY}</p><div className="crime-challenge__stats"><article><b>{summary.INCIDENT_COUNT}</b><span>linked incidents</span></article><article><b>{summary.SUBURB_COUNT}</b><span>suburbs represented</span></article><article><b>{posts.length}</b><span>unverified public posts</span></article></div><button className="primary" onClick={()=>setStep(2)}>Review relationship context →</button></section>}{step===2&&<section className="crime-challenge__panel"><small>CONNECT · AUTHORISED AND EXTERNAL CONTEXT</small><h3>What can be reviewed?</h3><div className="crime-challenge__split"><article><b>Authorised incident records</b><span>{incidents.length} linked incidents · {evidence.REPORTED_INCIDENT_COUNT} reports · {evidence.EVIDENCE_COUNT} evidence items</span><ul>{incidents.slice(0,4).map(x=><li key={x.INCIDENT_REF}>{x.INCIDENT_REF} · {x.SUBURB} · {x.CATEGORY_NAME}</li>)}</ul></article><article><b>Public-post context</b><span>{posts.length} posts · simulated, external and unverified</span><ul>{posts.slice(0,4).map(x=><li key={x.POST_REF}>{x.POST_REF} · {x.SUBURB} · {x.VERIFICATION_STATUS}</li>)}</ul></article></div><p className="crime-challenge__hint">Public-post momentum can provide context, but it does not validate an incident, establish a connection, or determine a response.</p><button className="primary" onClick={()=>setStep(3)}>View grand reveal →</button></section>}{step===3&&<section className="crime-challenge__reveal"><small>GRAND REVEAL</small><h3>{pattern?.PATTERN_NAME}</h3><p>This is the synthetic <b>Entertainment Precinct Night Activity</b> scenario. It is designed to teach the separation of authorised records, spatial/time context, and simulated public signals.</p><div><article><b>Designed clues</b><span>Night-time context, entertainment-precinct activity, linked records, and a separate public-signal stream.</span></article><article><b>What remains bounded</b><span>No public post verifies an incident, and the scenario does not predict escalation or recommend patrol allocation.</span></article></div><button className="primary" onClick={()=>setStep(4)}>How Oracle made this possible →</button></section>}{step===4&&<section className="crime-challenge__debrief"><small>TECHNICAL DEBRIEF</small><h3>What you just used</h3><div>{[["Spatial + SQL","Explore the authorised time and place context."],["Vector Search","Find semantically related incident narratives."],["Social signal separation","Keep external, simulated and unverified posts distinct from authorised records."],["Select AI Agent V2","The future agent will plan controlled tools and reflect on incomplete context."],["Deep Data Security + Audit","Respect scope and retain a reviewable workflow."]].map(([a,b])=><article key={a}><b>{a}</b><span>{b}</span></article>)}</div><footer><button onClick={()=>setStep(0)}>Replay challenge</button><button className="primary" onClick={onClose}>Return to console</button></footer></section>}</main></section></div>;}
function RetailTransitChallenge({ user, onClose }) { const [data,setData]=useState(null),[step,setStep]=useState(0),[error,setError]=useState("");useEffect(()=>{fetch("/api/challenges/retail-transit",{headers:{"X-Demo-User":user}}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error||"Challenge data unavailable");return b;}).then(setData).catch(e=>setError(e.message));},[user]);if(error)return <div className="crime-challenge"><section><p className="pattern-error">{error}</p></section></div>;if(!data)return <div className="crime-challenge"><section className="crime-challenge__loading">Loading the investigation challenge…</section></div>;const {pattern,incidents=[],posts=[],summary={},evidence={}}=data,stages=["Mission","Discover","Connect","Reveal","Technical debrief"];return <div className="crime-challenge" role="dialog" aria-modal="true" aria-label="Retail and Transit Trail"><section><header><div><small>CRIMEDATA INVESTIGATION CHALLENGE · SYNTHETIC TRAINING</small><h2>The Retail and Transit Trail</h2><p>Explore missing-property signals across retail and transport settings while keeping public commentary distinct from authorised records.</p></div><button onClick={onClose}>×</button></header><nav>{stages.map((x,i)=><span key={x} className={i===step?"active":i<step?"done":""}>{i+1}. {x}</span>)}</nav><main>{step===0&&<section className="crime-challenge__mission"><small>MISSION CARD</small><h3>Reports and community signals describe missing property in retail and transport settings.</h3><p>Review the authorised record context, place, time, and linked signals without treating the pattern as proof about any person.</p><button className="primary" onClick={()=>setStep(1)}>Begin investigation →</button></section>}{step===1&&<section className="crime-challenge__panel"><small>DISCOVER · PLACE AND PROPERTY CONTEXT</small><h3>What is being watched?</h3><p>{pattern?.PATTERN_SUMMARY}</p><div className="crime-challenge__stats"><article><b>{summary.INCIDENT_COUNT}</b><span>linked incidents</span></article><article><b>{summary.SUBURB_COUNT}</b><span>suburbs represented</span></article><article><b>{posts.length}</b><span>unverified public posts</span></article></div><button className="primary" onClick={()=>setStep(2)}>Review relationship context →</button></section>}{step===2&&<section className="crime-challenge__panel"><small>CONNECT · AUTHORISED AND EXTERNAL CONTEXT</small><h3>What can be reviewed?</h3><div className="crime-challenge__split"><article><b>Authorised incident records</b><span>{incidents.length} linked incidents · {evidence.REPORTED_INCIDENT_COUNT} reports · {evidence.EVIDENCE_COUNT} evidence items</span><ul>{incidents.slice(0,4).map(x=><li key={x.INCIDENT_REF}>{x.INCIDENT_REF} · {x.SUBURB} · {x.LOCATION_TYPE}</li>)}</ul></article><article><b>Public-post context</b><span>{posts.length} posts · simulated, external and unverified</span><ul>{posts.slice(0,4).map(x=><li key={x.POST_REF}>{x.POST_REF} · {x.SUBURB} · {x.VERIFICATION_STATUS}</li>)}</ul></article></div><p className="crime-challenge__hint">Public signals can provide context, but they do not establish a connection, identify a person, or determine a response.</p><button className="primary" onClick={()=>setStep(3)}>View grand reveal →</button></section>}{step===3&&<section className="crime-challenge__reveal"><small>GRAND REVEAL</small><h3>{pattern?.PATTERN_NAME}</h3><p>This is the synthetic <b>Retail and Transport Theft Activity</b> scenario. Its designed clues let participants practise working with setting, timing, linked reports, and a separately governed public-signal stream.</p><div><article><b>Designed clues</b><span>Retail and transit setting context, repeated missing-property themes, linked records, and separated public signals.</span></article><article><b>What remains bounded</b><span>The scenario does not identify a person, prove responsibility, predict future activity, or recommend an operational response.</span></article></div><button className="primary" onClick={()=>setStep(4)}>How Oracle made this possible →</button></section>}{step===4&&<section className="crime-challenge__debrief"><small>TECHNICAL DEBRIEF</small><h3>What you just used</h3><div>{[["Spatial + SQL","Explore authorised time and place context across the linked records."],["Vector Search","Find related missing-property narratives despite wording differences."],["Relationships + JSON","Connect watched patterns, incidents, reports, evidence, and public context."],["Select AI Agent V2","The next build will plan controlled tools and explicitly reflect on incomplete context."],["Deep Data Security + Audit","Scope the data and retain a reviewable activity trail."]].map(([a,b])=><article key={a}><b>{a}</b><span>{b}</span></article>)}</div><footer><button onClick={()=>setStep(0)}>Replay challenge</button><button className="primary" onClick={onClose}>Return to console</button></footer></section>}</main></section></div>;}
function ChallengeLauncher({ user, onClose }) { const [selected,setSelected]=useState(""); if(selected==="vehicle") return <VehiclePartsChallenge user={user} onClose={onClose}/>; if(selected==="art") return <ArtMarketChallenge user={user} onClose={onClose}/>; if(selected==="service") return <ServiceAccessChallenge user={user} onClose={onClose}/>; if(selected==="night") return <NightPrecinctChallenge user={user} onClose={onClose}/>; if(selected==="retail") return <RetailTransitChallenge user={user} onClose={onClose}/>; return <div className="crime-challenge" role="dialog" aria-modal="true" aria-label="Investigation challenges"><section><header><div><small>CRIMEDATA INVESTIGATION CHALLENGES</small><h2>Choose a synthetic scenario</h2><p>Explore the data, then reveal how Oracle capabilities supported the investigation workflow.</p></div><button onClick={onClose}>×</button></header><main className="crime-challenge__chooser"><button onClick={()=>setSelected("vehicle")}><small>CHALLENGE 01</small><b>The Vanishing Vehicle Parts</b><span>Overnight component-removal signals, location/time context, and unverified community posts.</span></button><button onClick={()=>setSelected("art")}><small>CHALLENGE 02</small><b>The Gallery Payment Puzzle</b><span>Payment-document anomalies, record links, and unverified art-market commentary.</span></button><button onClick={()=>setSelected("service")}><small>CHALLENGE 03</small><b>The After-hours Access Trail</b><span>After-hours access signals, authorised records, and separated external context.</span></button><button onClick={()=>setSelected("night")}><small>CHALLENGE 04</small><b>The Night Precinct Ripple</b><span>Entertainment-precinct activity, spatial/time context, and separated public signals.</span></button><button onClick={()=>setSelected("retail")}><small>CHALLENGE 05</small><b>The Retail and Transit Trail</b><span>Missing-property signals across retail and transport settings, with separately governed public context.</span></button></main></section></div>; }
function NativeAgentV2({ user, onClose, onSaved }) { const history=useConversationHistory(); const [conversationId,setConversationId]=useState(""),[question,setQuestion]=useState("Investigate watched pattern VEHICLE_PARTS_HARVESTING for the current Adelaide synthetic profile."),[result,setResult]=useState(null),[sending,setSending]=useState(false),[error,setError]=useState("");const run=()=>{if(!question.trim()||sending)return;setSending(true);setError("");fetch("/api/agent-v2/run",{method:"POST",headers:{"Content-Type":"application/json","X-Demo-User":user},body:JSON.stringify({question,conversationId,historyThreadId:history.threadId})}).then(history.readResponse).then(b=>{setResult(b);setConversationId(b.conversationId);}).catch(e=>setError(e.message)).finally(()=>{setSending(false);onSaved?.();});};return <div className="crime-challenge" role="dialog" aria-modal="true" aria-label="CrimeData Select AI Agent V2"><section><header><div><small>ORACLE SELECT AI AGENT · NATIVE ADB TEAM</small><h2>CrimeData Agent V2</h2><p>Real DBMS_CLOUD_AI_AGENT execution: planning, controlled tool use, reflection, and short case-scoped memory.</p></div><button onClick={onClose}>×</button></header><main className="crime-challenge__panel"><small>START A SYNTHETIC WATCHED-PATTERN CASE</small><div className="crime-agent-console__prompts"><button onClick={()=>setQuestion("Investigate watched pattern VEHICLE_PARTS_HARVESTING for the current Adelaide synthetic profile.")}>Investigate Vehicle Parts Harvesting</button><button onClick={()=>setQuestion("Is the current Adelaide synthetic profile ready to demonstrate watched pattern VEHICLE_PARTS_HARVESTING?")}>Assess Vehicle Parts data readiness</button><button onClick={()=>setQuestion("Investigate watched pattern RETAIL_TRANSIT_THEFT for the current Adelaide synthetic profile.")}>Investigate Retail and Transit Trail</button></div><div className="crime-agent-console__workspace"><div className="crime-agent-console__chat"><HistorySaveNotice history={history}/><footer><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run()} placeholder="Ask about a watched pattern using its pattern code…"/><button className="primary" disabled={sending||!question.trim()} onClick={run}>{sending?"Running native team…":"Run Agent V2"}</button></footer>{error&&<p className="pattern-error">Agent V2 error: {error}</p>}{result&&<article className="crime-agent-message agent"><header><span>Native ADB team</span><b>{result.team}</b><small>{result.elapsed}ms</small></header><p>{result.answer}</p><div className="crime-challenge__stats">{result.layers.map(x=><article key={x}><b>✓</b><span>{x}</span></article>)}</div><small>Conversation: {result.conversationId}. Memory is limited to this case conversation, five turns, and one-day retention.</small></article>}</div></div><footer><button disabled={sending} onClick={()=>{setConversationId("");setResult(null);history.reset();}}>Start new case memory</button><button className="primary" onClick={onClose}>Return to console</button></footer></main></section></div>;}
function CaseReadinessV1({ user, onClose, onSaved }) { const history=useConversationHistory(); const [scenarios,setScenarios]=useState([]),[patternCode,setPatternCode]=useState(""),[result,setResult]=useState(null),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[error,setError]=useState("");useEffect(()=>{fetch("/api/case-readiness/scenarios",{headers:{"X-Demo-User":user}}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error||"Scenarios unavailable");return b;}).then(b=>{setScenarios(b.scenarios||[]);setPatternCode(b.scenarios?.[0]?.PATTERN_CODE||"");}).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[user]);const prepare=()=>{if(!patternCode||sending)return;setSending(true);setError("");fetch("/api/case-readiness/prepare",{method:"POST",headers:{"Content-Type":"application/json","X-Demo-User":user},body:JSON.stringify({patternCode,historyThreadId:history.threadId})}).then(history.readResponse).then(setResult).catch(e=>setError(e.message)).finally(()=>{setSending(false);onSaved?.();});};return <div className="crime-challenge" role="dialog" aria-modal="true" aria-label="Evidence and Case-Readiness Agent V1"><section><header><div><small>EVIDENCE & CASE-READINESS · REVIEW-ONLY V1</small><h2>Prepare an investigator review pack</h2><p>Bring authorised record coverage, explicit gaps and training procedure context together. This is a thinking aid, not a finding or operational instruction.</p></div><button onClick={onClose}>×</button></header><main className="crime-challenge__panel">{loading?<p>Loading authorised scenarios…</p>:<><label className="case-readiness__label">Synthetic watched-pattern scenario<select value={patternCode} onChange={e=>{setPatternCode(e.target.value);setResult(null);history.reset();}}>{scenarios.map(s=><option key={s.PATTERN_CODE} value={s.PATTERN_CODE}>{s.PATTERN_NAME}</option>)}</select></label><button className="primary" onClick={prepare} disabled={!patternCode||sending}>{sending?"Preparing review pack…":"Prepare review-only brief"}</button>{error&&<p className="pattern-error">{error}</p>}<HistorySaveNotice history={history}/>{result&&<div className="case-readiness"><article><small>AUTHORISED PATTERN CONTEXT</small><h3>{result.pattern.PATTERN_NAME}</h3><p>{result.pattern.PATTERN_SUMMARY}</p></article><div className="crime-challenge__stats"><article><b>{result.coverage.INCIDENT_COUNT}</b><span>authorised incidents</span></article><article><b>{result.coverage.REPORT_COUNT}</b><span>authorised reports</span></article><article><b>{result.coverage.EVIDENCE_COUNT}</b><span>evidence metadata records</span></article></div><article><small>EXPLICIT GAPS FOR HUMAN REVIEW</small><ul>{result.gaps.map(x=><li key={x}>{x}</li>)}</ul></article><article><small>TRAINING PROCEDURE CONTEXT · NOT AN APPROVED POLICY LIBRARY</small><ul>{result.guidance.map(g=><li key={g.title}><b>{g.title}</b> · {g.section} · {g.version}</li>)}</ul></article><article><small>INVESTIGATOR QUESTIONS</small><ul>{result.questions.map(x=><li key={x}>{x}</li>)}</ul></article><article><small>AUTHORISED RECORD COVERAGE</small><div className="case-readiness__records">{result.records.map(r=><span key={r.INCIDENT_REF}>{r.INCIDENT_REF} · reports {r.REPORT_COUNT} · evidence {r.EVIDENCE_COUNT}</span>)}</div></article><p className="crime-challenge__hint">{result.safeguards[0]} {result.safeguards[2]}</p><small>Audit: review pack prepared · human review required · no external action taken</small></div>}</>}</main></section></div>;}
const CRIME_AGENT_TEAMS = [
  { id: "signals", heading: "SIGNALS", name: "Signals Agent", description: "Incident demand, data quality, and historical signal context", prompts: ["Which incident categories have the highest recent authorised volume?", "What does record completeness look like across authorised incident categories?", "What is the recent authorised incident signal trend?"] },
  { id: "requests", heading: "REQUESTS", name: "Requests Agent", description: "Incident reports, active records, and case relationship context", prompts: ["Which categories have the most authorised incident reports?", "What is the authorised incident status mix?", "What relationship context is available across authorised case files?"] },
  { id: "logistics", heading: "LOGISTICS", name: "Logistics Agent", description: "Geographic coverage and authorised patrol-area context", prompts: ["How is authorised incident activity distributed across patrol areas?", "Which patrol areas and suburbs are in my authorised data scope?"] },
];
function CrimeDataAgentConsole({ user }) {
  const history = useConversationHistory();
  const [team, setTeam] = useState("signals"), [input, setInput] = useState(""), [messages, setMessages] = useState([]), [auditRevision, setAuditRevision] = useState(0), [sending, setSending] = useState(false), [error, setError] = useState(""), [challengeOpen, setChallengeOpen] = useState(false), [nativeAgentOpen, setNativeAgentOpen] = useState(false), [caseReadinessOpen,setCaseReadinessOpen]=useState(false);
  const refreshActions = () => setAuditRevision(value => value + 1);
  useEffect(() => { setMessages([]); refreshActions(); }, [user]);
  const activeTeam = CRIME_AGENT_TEAMS.find((item) => item.id === team) || CRIME_AGENT_TEAMS[0];
  const run = (value) => { const question = String(value || input).trim(); if (!question || sending) return; setInput(""); setError(""); setMessages((current) => [...current, { role: "user", text: question }]); setSending(true); fetch("/api/agents/run", { method: "POST", headers: { "Content-Type": "application/json", "X-Demo-User": user }, body: JSON.stringify({question,historyThreadId:history.threadId}) }).then(history.readResponse).then((result) => { setMessages((current) => [...current, { role: "agent", ...result }]); }).catch((e) => setError(e.message)).finally(() => {setSending(false); refreshActions();}); };
  const display = (value) => value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return <section className="crime-agent-console">
    <header className="crime-agent-console__head"><div><small className="kicker">AI AGENTS · GOVERNED ORACLE SQL · JSON AUDIT</small><h2>CrimeData AI Agent Console</h2><p>Coordinate guided agents that reason over authorised crime data, execute reviewed read-only Oracle SQL, and log each workflow for audit visibility.</p></div><div className="crime-agent-console__head-actions"><button onClick={() => setCaseReadinessOpen(true)}>Evidence & Case-Readiness V1 ↗</button><button onClick={() => setNativeAgentOpen(true)}>Run native Agent V2 ↗</button><button onClick={() => setChallengeOpen(true)}>AI-Agent-V2 Challenge ↗</button><span>guided and native workflows</span></div></header>
    <section className="crime-agent-console__teams"><header><div><small>AGENT TEAMS</small><h3>Choose a specialist context</h3></div><span>3 agents · scoped data</span></header><div>{CRIME_AGENT_TEAMS.map((item) => <button key={item.id} className={team === item.id ? `active ${item.id}` : item.id} onClick={() => { setTeam(item.id); setInput(item.prompts[0]); }}><small>{item.heading}</small><b>{item.name}</b><p>{item.description}</p><em>{item.prompts.length} guided tools</em></button>)}</div></section>
    <section className="crime-agent-console__workspace"><div className="crime-agent-console__chat"><header><div><small>ACTIVE AGENT</small><h3>{activeTeam.name}</h3><p>{activeTeam.description}</p></div>{messages.length > 0 && <button disabled={sending} onClick={() => { setMessages([]); setError(""); history.reset(); }}>Clear</button>}</header><div className="crime-agent-console__prompts"><span>Try a guided workflow:</span>{activeTeam.prompts.map((prompt) => <button key={prompt} onClick={() => run(prompt)}>{prompt}</button>)}</div><div className="crime-agent-console__messages">{!messages.length && <div className="crime-agent-console__empty"><b>{activeTeam.heading} agent ready</b><p>Select a guided workflow or ask a question about the active agent’s data domain.</p><small>Every response uses a reviewed SQL template and the active data-security scope.</small></div>}{messages.map((message, index) => message.role === "user" ? <div className="crime-agent-message user" key={index}>{message.text}</div> : <div className="crime-agent-message agent" key={index}><header><span>{message.agent}</span><b>{message.title}</b><small>{message.rowCount} rows · {message.elapsed}ms</small></header><p>{message.answer}</p><ul>{message.findings.map((finding) => <li key={finding}>{finding}</li>)}</ul><details><summary>Agent SQL and tool context</summary><pre>{message.sql}</pre></details><div className="crime-agent-message__table"><table><thead><tr>{message.columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{message.rows.slice(0, 12).map((row, rowIndex) => <tr key={rowIndex}>{message.columns.map((column) => <td key={column}>{display(row[column])}</td>)}</tr>)}</tbody></table></div></div>)}{sending && <div className="crime-agent-message loading">Agent is preparing governed SQL…</div>}{error && <p className="pattern-error">Agent console error: {error}</p>}</div><HistorySaveNotice history={history}/><footer><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && run()} placeholder={`Ask the ${activeTeam.name}…`} /><button className="primary" disabled={sending || !input.trim()} onClick={() => run()}>{sending ? "Running…" : "Run agent"}</button></footer></div><AgentAuditTrail user={user} revision={auditRevision}/></section>
    <small className="crime-agent-console__footnote">Agents provide descriptive demonstration-data context only. They do not identify people, predict incidents, assign risk, recommend deployments, or make operational policing decisions.</small>
    {challengeOpen && <ChallengeLauncher user={user} onClose={() => setChallengeOpen(false)} />}
    {nativeAgentOpen && <NativeAgentV2 user={user} onSaved={refreshActions} onClose={() => {setNativeAgentOpen(false); refreshActions();}} />}
    {caseReadinessOpen && <CaseReadinessV1 user={user} onSaved={refreshActions} onClose={() => {setCaseReadinessOpen(false); refreshActions();}} />}
  </section>;
}
function Feature({ page, dash }) {
  let o = {
    geography: [
      "Incident Map",
      "Spatial context over approximate coordinates, patrol-area polygons, and descriptive density layers.",
      "Spatial",
    ],
    analytics: [
      "Analytics",
      "Descriptive category, time, geographic, and scenario coverage analysis. No predictive policing outputs are produced.",
      "Analytics",
    ],
    ask: [
      "Ask Crime Data",
      "A governed natural-language-to-SQL experience will display read-only SQL and run it within the active data scope.",
      "Natural-language SQL",
    ],
    agents: [
      "AI Assistant Console",
      "Local AI assistants explain authorised records and keep an auditable activity history.",
      "Governed AI",
    ],
  }[page];
  return (
    <>
      <Hero title={o[0]} text={o[1]} />
      <section className="empty">
        <span>{o[2]}</span>
        <h2>Guided demonstration surface</h2>
        <p>
          This page is ready for its dedicated API and visualisation. The
          current user has {dash?.summary?.INCIDENT_COUNT || 0} authorised
          demonstration records.
        </p>
      </section>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
