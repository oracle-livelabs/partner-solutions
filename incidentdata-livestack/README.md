# IncidentData LiveStack

**Documentation:** [Functional Guide](docs/FUNCTIONAL.md) (what people can do) · [Technical Guide](docs/TECHNICAL.md) (how it is built)

20 October milestone: [baseline and replication notes](docs/baselines/2026-10-20/README.md) record the source tag, current runtime dependencies and state that must be transferred separately.

Current display and package branding is **IncidentData LiveStack**. Existing
database schemas, stored profile and telemetry keys, API routes, filenames and
container service names remain stable for compatibility.

Synthetic, non-operational demo for exploring Oracle relational, JSON, vector-ready, graph-ready, spatial-ready, and Deep Data Security concepts. No records represent real people or incidents.

24 September: [Evidence Intelligence implementation](docs/evidence-intelligence-implementation.md) adds 32 synthetic Amsterdam evidence items linked to 12 incidents and six fictional POIs, with scoped source assets, native JSON/vector/spatial/graph exploration, Select AI and a source-cited native agent. FU40 loading, saved-profile persistence and release checks are recorded alongside the implementation.

For a guided demonstration, use the [Evidence Intelligence step-by-step walkthrough](docs/evidence-intelligence-walkthrough.md), including exact clicks, expected results, presenter notes and the Oracle 26ai capability story.

25 September: [The Care-Trust: Who knows?](docs/care-trust-who-knows.md) connects Watch Pattern → public concern → incident → evidence with visible linkage reasons and return navigation. Version 2 adds six source documents and three public posts to the initial 16-source care pack, preserving original reports and roles. Its reusable skill is maintained in [skills/care-trust-who-knows](skills/care-trust-who-knows/SKILL.md). See the [v1 implementation notes](docs/care-trust-implementation.md) for the initial fictional POIs. The original [Payment-Evidence Vignette](docs/payment-evidence-vignette.md) remains independent.

Data Room: see the [current workspace guide](docs/crime-data-room-workspace.md) for the seven-stage pipeline, native ADB connection review, graph, data products and saved Select AI conversations on FU40 (port 8706).

20 October: all nine main city profiles use the [same six visible watch patterns](docs/city-watch-pattern-consistency.md), based on Adelaide's selection. The saved profile flags and current live flags are aligned; city-specific definitions and relationships are retained.

20 October: [shared evidence walkthroughs](docs/city-evidence-consistency.md) add the same six core stories and 24 locally linked sources to each of the nine cities. Evidence Intelligence includes six story shortcuts; existing local packs remain available.

15 September: [Saved conversation history](docs/agent-conversation-history.md) is available from the AI Agent Console's clickable JSON audit entries. New guided, Ask IncidentData V2, native-agent and case-readiness responses are saved for read-only review; older entries clearly identify missing historical responses.

15 September: [Ask IncidentData V2 long-text fix](docs/ask-crime-v2-long-text-fix.md) resolves the stack overflow when a generated query includes report narratives. The exact five-incident Norwood question is verified in the live browser; existing security scope and AI-agent configuration are unchanged.

15 September: [Smart exploration tiles and focused workspaces](docs/data-room-capabilities.md) now include Money Flows, Messages and [People & Photos](docs/data-room-people-photos.md). Photo regions have saved vector candidates, a native Photo → Region → POI graph and explicit, audited review decisions. The Money Flow workspace includes a separate, explicit read-only native ADB agent pilot with transaction citations and links into the same graph. The existing Connection Review agent and Batch Assistant remain unchanged.

Now available on FU40: [Money flows](docs/data-room-money-flows.md), with a native Oracle transfer graph and source-row inspection, and [Messages & Conversations](docs/data-room-messages.md), with a native participant/thread graph and source-linked conversation reader. Both have SUGA walkthroughs and verification notes. The broader [graph proposal](docs/batch-graphs-investigation-20260914.md) extends the [unified batch graph design](docs/unified-batch-evidence-graph-plan.md). Automatic scene-region detection and broader [object-search research](docs/scene-region-search-research.md) remain for later evaluation.

## Run IncidentData LiveStack

```bash
cd /home/opc/livestack/policeAdelaide
cp .env.example .env
podman compose up --build -d
```

The FU40 Autonomous Database deployment uses <http://localhost:8706> with
`compose.fu40.yml`. The local database stack uses <http://localhost:8705>. The services use isolated ports: app 8705, DB 1533, ORDS 8381, Ollama 11445.

Deep Data Security requires Oracle 23.26.2+. The local image is version-gated in the schema bootstrap. See [docs/deep-data-security.md](docs/deep-data-security.md).

For Autonomous Database, the repeatable direct-logon demonstration is split
into [Basic](demos/DDS_Basic_CrimeData_ADB/README.md) persona access and
[Advanced](demos/DDS_Advanced_CrimeData_ADB/README.md) entitlement-aware
access kits, plus a [Cross-Table Grant](demos/DDS_CTG_CrimeData_ADB/README.md)
kit that derives report access from authorized incident rows. All three use
distinct `ACI_B_*`, `ACI_A_*`, and `ACI_C_*` artifacts, so they can coexist on
one ADB database. They use ADB wallet service aliases and do not require a PDB
container switch.

## May-June 2026 synthetic data profile

The current Adelaide profile is generated deterministically by
[`generate_adelaide_crime_dataset.py`](/home/opc/generate_adelaide_crime_dataset.py)
with generator version 5.0.0 and seed 20260828. It creates exactly 21,513
fully synthetic incidents for May and June 2026. The profile uses concise
database-owned executive groups, detailed category drill-down, approximate
suburb-level coordinates, and natural report titles and narratives. Synthetic
provenance remains in structured metadata and the application-level notice.

[`db/demo/15_load_adelaide_synthetic_21513_v5.sql`](db/demo/15_load_adelaide_synthetic_21513_v5.sql)
loads and validates the profile transactionally, then captures it into the
recoverable Adelaide Z_BASE profile. The data does not represent real local
events, people, addresses, or suburb-level SAPOL statistics.

### Adelaide synthetic address enrichment

[`scripts/enrich_crime_incidents_adelaide_boundaries.py`](scripts/enrich_crime_incidents_adelaide_boundaries.py)
adds an approximate street-style display label, suburb, and postcode to the
active Adelaide v5 profile. Suburb and postcode come from the local official
SA boundary extract. The street line is deterministically generated and is not
a reverse-geocoded or real premise address; enriched rows are marked
`masked_vicinity` with source `ADELAIDE_BOUNDARY_SYNTH_STREET`.

Run a complete dry run and inspect its review file before applying:

```bash
python3 scripts/enrich_crime_incidents_adelaide_boundaries.py \
  --review-csv /home/opc/scratch/adelaide-v5-address-enrichment-review.csv \
  --repair-unmatched-land-points

python3 scripts/enrich_crime_incidents_adelaide_boundaries.py \
  --review-csv /home/opc/scratch/adelaide-v5-address-enrichment-review.csv \
  --repair-unmatched-land-points \
  --apply
```

Apply mode checks the active profile, requires all 21,513 points to match a
Greater Adelaide boundary, keeps report locality text aligned with any changed
suburb, validates the fields, and commits once.
The optional land-point repair is data-driven and moves only otherwise
unmatched synthetic coordinates to the nearest locality polygon within two
kilometres; each movement is recorded in the review CSV.

For a guided Vector → JSON → relational → Property Graph → DDS walkthrough of the planted fictional cross-area series, use [db/tutorial/02_sapol_may_jun_2026_walkthrough.sql](db/tutorial/02_sapol_may_jun_2026_walkthrough.sql). The walkthrough makes no identity, responsibility, risk, or operational decision claim.

For the Adelaide v5 hidden-linkage exercise, load
[`db/demo/16_add_adelaide_service_corridor_series.sql`](db/demo/16_add_adelaide_service_corridor_series.sql)
and follow the [Case Relationships investigation guide](docs/adelaide-service-corridor-investigation.md).

The four generated fictional NByNW profiles support separate portrait and
narrative vector searches. See the
[POI multimodal search guide](docs/nbynw-poi-multimodal-search.md) for the data
model, verification prompts, and future generated-case-image loader.
The exercise reuses 12 existing incidents, preserves the 21,513 total, and
reveals partial evidence and semantic-similarity paths progressively at one,
two, and three graph hops.

The Incident Activity Center and Crime Pattern Signals pages also include a
privacy-limited simulated public-post stream and four data-driven watched crime
patterns. See the [social signals and watched-pattern walkthrough](docs/adelaide-social-signals-and-watched-patterns.md). Only 15 of the 21,513
incidents have a reviewed post comparison, and a link is context—not evidence.

## Perth locality enrichment pilot

## Brisbane capability layer

After loading the Brisbane 42,317-record re-cut, enable its generated
teaching capabilities with:

```bash
npm run enable:brisbane-capabilities
```

This adds three generated fictional POIs, a 12-incident governed graph case,
six privacy-limited simulated public-context posts, and an eight-dimension
incident vector for every record. The command is repeatable, validates the
result, and refreshes the `BRISBANE_DATA` snapshot. It must be run only after
the social-signal, vector, graph, and POI schema migrations have been applied.
See [the Brisbane walkthrough](docs/brisbane-night-market-circuit-walkthrough.md).

[scripts/enrich_perth_localities.py](scripts/enrich_perth_localities.py) provides a 50-record, dry-run-first locality enrichment pilot. It accepts latitude/longitude but requests only suburb/locality resolution from its configured geocoding service; it intentionally discards street, building, and premise data. Proposed rows remain marked `locality_only`, with a synthetic address-context label.

Install its Oracle driver dependency, set `ORACLE_USER`, `APP_SCHEMA_PASSWORD`, and `ORACLE_CONNECTION_STRING` (for a host run, `localhost:1533/FREEPDB1`), then review a CSV before applying any changes:

```bash
python3 -m pip install -r scripts/requirements-locality-enrichment.txt
python3 scripts/enrich_perth_localities.py \
  --email data-owner@example.com \
  --user-agent 'IncidentDataLiveStack/1.0 (data-owner@example.com)' \
  --review-csv ./perth-locality-review.csv
```

The public Nominatim endpoint is capped at one request per second and is appropriate only for this 50-record pilot. For a larger job, configure a licensed or self-hosted geocoding service, keep the same locality-only output contract, and retain the review and provenance process.

## Oracle Graph Explorer (Case Relationships)

The fourth **Graph view** option uses the supplied **Oracle Graph Visualization
Library 26.4.0**. The existing Investigation, Pathway and D3 force-directed views
remain available. Choose Hierarchical, Force-directed or Radial inside the Oracle view;
double-click a record for its existing scoped detail dialog. The accessible node
list offers the same action without canvas interaction. A case node shows its
case summary. Native search and legend filters act on the loaded graph only.
Enter Exploration Mode to select/group/hide nodes; Undo and Reset exploration
restore the local view. Nothing is saved to the database.

In **Highlight connecting groups**, **Clustered force-directed** becomes
available when there are computed incident groups and recorded comparison links.
Link-free results retain the other layouts; Oracle's clustered algorithm needs
at least one edge. It uses Oracle's native
`force` layout with `clusterEnabled: true` and `clusterBy: 'comparison_group'`.
The group property is passed from the existing authorised, threshold-based
analysis, not derived by the layout. Group labels and colours identify those
groups, not risk. All incident nodes and recorded edges remain available;
`hideUnclusteredVertices` is false. Threshold changes recompute the group
property. Leaving this layer switches a selected clustered layout to ordinary
Force-directed. The other layouts retain their selection across layers; changing
case or persona restores the existing Hierarchical default. The three-layer
starting view and all other defaults are unchanged.

Radial changes positions only, with no additional relationships. Outward
branches do not indicate evidence strength, importance or geographical distance.
Run `node scripts/test_oracle_layouts_browser.cjs --local` for GET-only checks
against the real Oracle constructor/renderer, or omit `--local` after release.

All four views consume the same `/api/graph/network` response and existing demo
persona/scoped-SQL checks. This is a visualization integration, **not** a new
`GRAPH_TABLE` query implementation or a change to database policies. It adds no
automatic expansion, query console, identity matching or inferred relationships.
POI photos use only the supplied node's local portrait reference; a missing photo
leaves an ordinary person node. Relationships with endpoints outside the bounded
API response are omitted with an explicit count, not silently completed.

`frontend/public/vendor/oracle-graph/26.4.0/provenance.json` records the original
archive hash and license notice. Vendor files are unmodified; Oracle's license
terms still apply. React lazy-loads `OracleCaseGraph.jsx`, and a same-origin iframe
isolates Oracle's styles. It is **not** a separate security principal. The iframe
CSP permits the SDK's required style-expression evaluation only in that document,
blocks connections and external assets, and forbids inline scripts. API strings
remain data properties, never executable style expressions.

Run `npm test` and `npm run build`. With Playwright available, run
`node scripts/test_oracle_graph_browser.cjs --local` to preview the build against
the running port-8706 API, or omit `--local` after deployment. Browser-only
fixtures exercise photos, literal hostile-looking labels, bounded edges and
stale responses; the test blocks non-GET and external requests.

**Explore in layers** works in all four renderers and starts with the original
2-hop network. **Add similarity links** loads 3 hops while keeping case, people
and evidence visible. **Highlight connecting groups** then focuses on incidents
and their recorded similarity edges, temporarily hiding the other context.
Each layer explains what changed. **Advanced controls** starts closed and holds
manual hop controls, the grouping threshold and technical relationship notes.
Similarity edges with scores at or above
the adjustable threshold (default `0.75`) form undirected connected groups;
scored comparisons crossing between groups are highlighted orange. Isolated
incidents are single-node groups. These are cross-group links, not necessarily
sole-path graph bridges. Unknown/invalid scores do not form groups or qualify
for highlighting, and missing endpoints are omitted with a count.

Select an orange edge, or use **Connecting link explanation**, to read the
stored reason and score. No AI explanation or new relationship is generated.
**Back to original** restores the usual 2-hop context, default threshold and
closed advanced controls, and clears the explanation. The selected case and
renderer are retained. Switching case or persona also starts at the original
layer. Manual hop controls leave the connecting-groups focus; 1 hop is an
explicit case-and-incident override, while choosing Original network restores 2.
Analysis is recomputed only from the bounded, authorised API response,
not the complete database graph. Scores are comparison values, not confidence
or proof. No database schema, queries or DDS policies are changed.

On Adelaide `CASE-2026-0317`, the default threshold yields five groups and four
connecting comparisons. `CASE-2026-0421` yields three groups and three connecting
comparisons. These are synthetic teaching relationships. Run
`node scripts/test_case_connecting_links_browser.cjs --local` for the GET-only
preview checks (or omit `--local` after release), including all renderers, edge
selection, keyboard access, thresholds, empty results, literal reasons, bounded
scope and delayed responses. Use `NODE_PATH` for an external Playwright install.

FU40 release, 29 September 2026: `oracle-graph-264-20260929` is a frontend-only
overlay of `messaging-space-20260929` (the rollback image). All 36 test files,
the production build, live Oracle browser checks, live Messaging Space checks,
and the unchanged 160-message batch verification passed. The release audit
confirmed unchanged backend hashes, previous assets, environment hash, mounts,
other containers and batch state; no database migration was applied.

FU40 release, 30 September 2026: `connecting-links-20260930` adds the shared
connecting-links focus as a frontend-only overlay. Rollback image:
`oracle-graph-264-20260929`. All 37 test files, the production build, live
connecting-links checks across all four renderers, the Oracle exploration
regression and Messaging Space regression passed. The release audit preserved
all backend hashes, previous assets, vendor SDK files, configuration, mounts,
other containers and the existing batch state. No database migration was applied.

FU40 follow-up release, 30 September 2026: `graph-layers-20260930` makes the
original 2-hop network the default and introduces the three-layer stepper.
Advanced controls and technical notes are collapsed initially. All 37 test
files, the production build, live three-layer checks across all four renderers,
Oracle exploration and Messaging Space regressions passed. The release changes
only frontend assets; backend, SDK, settings, mounts, other containers and batch
state were verified unchanged. Rollback image: `connecting-links-20260930`.

FU40 layout release, 30 September 2026: `oracle-layouts-20260930` adds native
Radial and, within Highlight connecting groups, Clustered force-directed.
Existing defaults are unchanged. Pointer focus no longer scrolls the page
between graph clicks; link-free results do not offer the SDK's clustered
algorithm. All 37 test files, the production build, live native-layout checks,
four-renderer layer checks, Oracle exploration and Messaging Space regressions
passed. The frontend-only release audit confirmed unchanged backend, vendor
SDK, configuration, mounts, other containers and existing batch state. No
database migration was applied. Rollback image: `graph-layers-20260930`.

## AI Opps

The **AI Opps** page follows **Data Room** and reports stack-wide
model, native-agent and vector-processing activity. It includes usage charts,
filters and read-only trace details, distinguishing measured tokens from missing
usage and non-LLM work. The 30 September runtime sweep adds a 31-operation coverage
register, Ask Detective and publishing-worker capture, local speech measurements,
validation/retry attribution, and separate AI/workflow durations. Historical usage
is not reconstructed; native internal tokens remain explicitly unavailable.
See [the AI Opps guide](docs/crimedata-ai-ops.md) for
coverage, setup, verification, access controls and rollback.

## Oracle Internals explanations

Every navigation page has a collapsed **Explain** control. Open it to see the
page's **Oracle Internals**: what's happening, why it matters, how it works,
coloured capability badges, a three-step data-flow diagram and copyable SQL.
Desktop panels resize by dragging the edge or using its arrow keys. On narrow
screens the control and scrollable explanation appear above the page content.

The 14 explanations and 15 bounded SELECT examples live in
`frontend/src/oracle-internals-content.mjs`; the shared presentation is
`frontend/src/OracleInternalsPanel.jsx`. SQL is copied into an authorised SQL
client with the intended demo identity already set; opening the panel does not
execute SQL, invoke a model, restore a profile or queue a job. Clipboard access
falls back to selecting the SQL on ordinary HTTP deployments.

Content distinguishes scoped joins from native property-graph demonstrations,
map markers from Spatial distance calculations, guided workflows from native
AI, and observed analytics from predictions. Data Room and AI Opps explanations
cover the September 2026 capabilities. Read-only verification:

```sh
node scripts/check_oracle_internals_sql.cjs
NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules node scripts/test_oracle_internals_browser.cjs --local
```

The SQL check runs every example under administrator and limited-viewer contexts
in read-only transactions. The browser check previews built assets against live
GET APIs and exercises navigation, keyboard/resize controls, clipboard fallback
and mobile layouts. Existing Person Intelligence page reads can record a
non-model workflow outcome; panel interactions make no network requests.

FU40 release, 30 September 2026: `oracle-internals-20260930`, built with
`scripts/Containerfile.oracle-internals` on the accepted AI Opps image. The app on
port 8706 receives only built frontend assets; the 8705 instance and publishing
worker are unchanged. Live all-page browser checks, both-context SQL checks and
the Oracle graph layout preview passed. The production build retains its existing
large-bundle warning. Before/after manifests in
`/tmp/crimedata-oracle-internals.4ueY1e` verified unchanged backend, configuration,
mounts, prior assets, source batches, publications and other container identities.
Rollback: set the compose app image to
`localhost/adelaide-crime-intelligence:ai-ops-sweep-20260930` and use the existing
protected redeploy helper after checking queues are idle. No database rollback
is required.

## Perth V2 Data Foundation tile

The main Perth tile targets `PERTH_DATA_V2` (Perth Data Set V2 - Mixed Suburb
Coverage): 33,511 saved incidents across 287 locality labels, captured on
1 October 2026. The previous `PERTH_DATA` profile remains accessible under
**Other saved profiles**. Counts and review capabilities come from the catalogue.
V2 supports **standard restore** following the 1 October application acceptance
checks. Select Perth, enter `ACTIVATE PERTH_DATA_V2`, then choose **Restore Perth**
to replace the global active dataset. Selecting or reviewing its tile alone does
not activate it. NRT, capture and delete remain disabled for this profile.

This saved profile contains incidents, reports, evidence and 33,511 narrative
vectors (1,536 dimensions) and 21 shared watch definitions (six enabled for
display), but no saved people or cases. The watch catalogue was copied from
`PERTH_DATA` on 1 October; old Perth case/post links were not transplanted. Its
synthetic coverage bucket has no existing locality-analyst entitlements: Statewide
Admin sees the V2 incidents; existing locality analysts and the limited viewer see
none. No shared accounts, Mobile access mappings or grants were changed. Original
source-readiness declarations and historical-boundary/official-calibration
limitations remain visible and were not relabelled as completed research.

FU40 frontend release: `perth-v2-tile-20261001`, using
`scripts/Containerfile.perth-v2-tile`. The retained rollback image is
`oracle-internals-20260930`; use the protected redeploy helper with idle queues.
No database migration or dataset load is part of this tile update.

Activation support release: `perth-v2-activation-20261001`, built with
`scripts/Containerfile.perth-v2-activation`. Only `setup-profile-selection.js` and
`profile-library.js` change in the runtime image; the prior frontend and AI Opps
release are preserved. Rollback image: `perth-v2-tile-20261001`.

Acceptance evidence is in `perth_v2_activation_20261001/`. A rehearsal used the
installed restore package body in an anonymous PL/SQL block with both COMMITs
replaced by NULL, then explicitly rolled back. All 23 mapped tables matched saved
content, semantic vectors matched in full, and five demo-user scopes plus Mobile
views were checked. An independent connection continued to see `PERTH_DATA`.
Before/after hashes verified rollback of the operational data and active marker;
Oracle identity sequences can consume values during this uncommitted rehearsal.
The package itself was not modified. The spatial checker passed for all 30,511
physical points; 3,000 reference-only rows are intentionally unmapped. All 38
Node test-runner files and the browser confirmation preview passed. Activation
support is available separately from the user's eventual committed restore.

Saved-watch catalogue update: `perth-v2-watches-20261001`, built with
`scripts/Containerfile.perth-v2-watches`, corrects only the setup notice in
`profile-library.js`. Its rollback image is `perth-v2-activation-20261001`.
The database addition contains the 21 shared definitions from the original
Perth snapshot, including their colours, queries and six enabled display flags.
The two old Perth-specific definitions and their historical relationships were
excluded. No incident memberships, social posts or pattern embeddings were
created. Only the saved catalogue was changed; the current live catalogue is
unchanged, and standard restore includes these definitions on the next restore.
The rollback rehearsal, committed rows and independent preservation verification
are recorded in `perth_v2_watch_patterns_20261001/`.

## Adelaide Data Set Profile

The Data Foundation page exposes the current Greater Adelaide demonstration data as the **Adelaide Data Set Profile**. Statewide administrators can load it from its recoverable database snapshot or delete it from the operational dataset; deletion does not remove the snapshot. They can also update the snapshot and export the core relational records.

For a near-real-time demonstration, **Restore Adelaide Data Set Profile NRT**, **Restore Perth Data Set Profile NRT**, and **Restore Brisbane Data Set Profile NRT** each restore their selected snapshot and shift every active incident occurrence timestamp by one shared offset so the most recent incident is at the current database time. They do not update `Z_BASE_*`; the standard restore continues to preserve the recorded May–June 2026 timestamps.

### Verify a IncidentData Setup restore

After applying [db/migrations/20260820_fix_z_base_profile_restore.sql](db/migrations/20260820_fix_z_base_profile_restore.sql), run the live restore check against a configured demonstration schema:

```bash
CRIMEDATA_RESTORE_TEST_PROFILE=ADELAIDE_DATA \
CONFIRM_CRIMEDATA_RESTORE_TEST=ADELAIDE_DATA \
npm run test:profile-restore
```

The test invokes the same `z_base_dataset_admin.restore_profile` package as the
Data Foundation button, verifies that the requested profile becomes active, and
checks that the live incident count equals its Z_BASE snapshot. It replaces the
active demonstration dataset, so use a chosen test profile rather than a live
operational dataset.

For an existing database created before this name was introduced, run [db/migrations/20260816_rename_adelaide_data_set_profile.sql](db/migrations/20260816_rename_adelaide_data_set_profile.sql) once as the application schema user before deploying the updated app.

### People mentioned and questioning notification simulation

In Data Room → Explore, **People mentioned** works with original TXT, CSV and
JSON excerpts and saved audio transcripts, without needing photos or a Batch
Brief. **Find people in material** invokes the configured text model and shows
one card for repeated normalized names or unique registered names/aliases across
sources. Each card retains all independently quoted mentions and their source
links; unknown details remain “Not stated”. Attributes whose exact values and
quotes cannot be verified are omitted, with an omission notice and downloadable
warning records, while valid person mentions are retained. Unnamed mentions remain separate.
The authorised POI register supplies possible name/alias matches. A unique match
reuses its existing portrait; ambiguous matches list candidates without selecting
a portrait. **View POI details** opens the scoped register record, including its
narrative, attributes, recent incident links and visual assets. Escape closes
this popup while keeping the Batch Explorer open. Grouping and matches are
reviewable AI drafts, rather than verified identities. No POI records or
identity/photo links are created. Input is limited to 24,000
characters per source, 80,000 combined, and 60 returned mentions. Coverage lists
partial and excluded sources. Results remain in the current workspace; use
**Download people notes** to retain them outside that session.

The People mentioned model panel names the configured LLM, provider and region
before extraction. Its AI Ops button opens this batch's activity ledger. Each
run shows attempts, retries, measured LLM duration, input/output/reasoning tokens,
provider total and trace reference. Totals include failed attempts and preserve
unknown usage instead of estimating it. Reasoning is not added to the provider
reported total a second time. AI Ops records `cdr.people.mentioned` per LLM
attempt and `cdr.people.outcome` for the request outcome; the latter has no token
charge. Gemini people extraction reserves up to 32,768 output tokens so its
reasoning does not consume the earlier 6,000/8,192 allowance before producing JSON.
People extraction has a bounded 180-second interactive deadline; worker calls
retain their 95-second lease-safe default. Invalid mention excerpts can use an
independently verified exact name excerpt. Unsupported anonymous mentions and
exact duplicates are omitted with source-check warnings, while other verified
people remain available. This avoids retrying an entire large batch for a single
bad quotation. Other operation budgets keep their defaults. Failed generation returns a
specific, safe message and trace rather than a generic Data Room outage.

Entering **Incident and Capacity Analytics** starts a ten-second simulation
timer. A photographed fictional POI is selected from the current user's scoped
profiles, preferring profiles with visible incident links. The dismissible
notification names Detective Karen Cannell and presents a random six-character
alphanumeric permission code, issued when the notification appears and expiring
two hours later. Times are shown in Australia/Adelaide. The code is demonstration
text and grants no application access; no contact or external notification is
sent. Leaving the page or changing demo user cancels the pending notification.
A new page entry starts a fresh simulation. No notification is fabricated when
profiles cannot be loaded or no authorised profile has a photo.

Validation: `node --test test/data-room-people-mentioned.test.js
test/notification-simulation.test.js` and
`node scripts/test_people_notification_browser.cjs --local` (read-only browser
preview using an extraction response fixture). Omit `--local` to check the
running frontend with that same browser-only fixture.

Grouped people and POI popup browser validation: `node scripts/test_people_grouped_browser.cjs`
(or `--local` for built frontend files). Extraction is supplied by a browser-only
fixture; register portraits and details are read from the running scoped API.
