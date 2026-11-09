# IncidentData LiveStack — Functional Guide

**Functional Guide** · [Technical Guide](TECHNICAL.md) · [Project README](../README.md) · [Formatted page](functional-overview.html)

> This guide describes what people can do in the app. The [Technical Guide](TECHNICAL.md) follows the same sections and explains how each one is built.

IncidentData LiveStack is a browser workspace for exploring incident, evidence and case data, built to show Oracle AI Database 26ai in use: relational, JSON, vector, graph, spatial, Deep Data Security, Select AI and native agents. Every record is fictional.

| Lead profile | Period | City profiles | Database |
|---|---|---|---|
| Adelaide v5 · 21,513 incidents | 1 May – 30 Jun 2026, ACST | 9 cities, 6 shared watch patterns | `CRIME_DATA` on Autonomous DB |

**Contents:** [Access by persona](#access-depends-on-who-you-are) · [The journey](#the-journey) · [Data Room](#data-room-from-a-zip-of-material-to-a-reviewed-case-picture) · [Ground rules](#ground-rules) · [Around the app](#around-the-app)

## Access depends on who you are

Each session runs as a demo persona. Deep Data Security applies the scope inside the database, so pages, charts, graphs, AI answers and agent results all show only the records that persona may see.

| Persona | Scope |
|---|---|
| `statewide_admin` | All areas, plus profile setup and restore |
| `central_analyst` | Central area |
| `northern_analyst` | North and west |
| `southern_analyst` | South and east |
| `read_only_viewer` | Central totals only, no individual records |

Learn more: [Deep Data Security](deep-data-security.md) · [Presenter guide](deep-sec-presenter-guide.md) · How it's built: [Technical Guide › Security](TECHNICAL.md#security-and-personas)

## The journey

The app's menu follows an investigation: get oriented, read the situation, follow connections, then ask questions. The symbols match the ones in the app's menu.

### Get oriented

| Menu | What you do | Oracle features | Learn more |
|---|---|---|---|
| ◈ Welcome | Starting point and a summary of the active city profile | | |
| ▥ Workshop & Guides | Step-by-step demo scripts, presenter notes and short animated explainers | | [Adelaide workshop](workshop/README.md) |
| ▦ Data Foundation | Choose a city profile, restore it and check that it loaded correctly | JSON, saved profiles | [Restore a profile](../README.md#verify-a-incidentdata-setup-restore) · [Watch patterns by city](city-watch-pattern-consistency.md) |

### Read the situation

| Menu | What you do | Oracle features | Learn more |
|---|---|---|---|
| ▤ Incident Activity Center | Active workload, priority incidents and the busiest suburbs | relational | |
| ⌁ Incident Pattern Signals | Six watch patterns per city, with public-concern signals and the incidents and evidence behind them | vector, JSON | [Signals and watched patterns](adelaide-social-signals-and-watched-patterns.md) · [Pattern scenarios](synthetic-pattern-scenarios.md) |
| ◎ Incident Map | Incidents plotted at approximate suburb level | spatial | [Graph and spatial guide](graph-spatial-presenter-guides.md) |
| ▤ Incident Explorer | Open any incident: record, suburb, similar incidents and recorded links | vector similarity | [Semantic search](incident-semantic-search.md) · [Result relationships](result-relationships.md) |
| ◌ Incident and Capacity Analytics | Incident demand, area workload, volume trend, vector groups and case context | analytics, vector groups | [Vector search guide](vector-search-presenter-guide.md) |

### Follow the connections

| Menu | What you do | Oracle features | Learn more |
|---|---|---|---|
| ◉ Person Intelligence | Register of fictional persons of interest: portraits, identifiers, aliases, narratives and linked incidents | JSON, image vectors | [POI identifiers](poi-identifiers.md) · [Fictional POIs](fictional-network-pois.md) · [Visual search](poi-visual-search-ui.md) |
| ▧ Evidence Intelligence | Evidence linked to incidents and people, with six story shortcuts and original source documents | JSON, graph, spatial | [Walkthrough](evidence-intelligence-walkthrough.md) · [City evidence stories](city-evidence-consistency.md) · [The Care-Trust](care-trust-who-knows.md) |
| ⌘ Case Relationships | Graph of case, incident, person and evidence, with one to three hops | property graph | [Case relationships](../README.md#oracle-graph-explorer-case-relationships) · [Art market case](adelaide-art-market-graph-investigation.md) |

### Ask questions

| Menu | What you do | Oracle features | Learn more |
|---|---|---|---|
| ✦ Ask IncidentData | Ask in plain English; Select AI writes the SQL. Explain answer, Show SQL or Run query | Select AI | [Agent V2 scenarios](ai-agent-v2-plan.md) |
| ◉ AI Agent Console | Native agents with read-only tools and cited sources, including a case-readiness check. Conversations are saved | native ADB agents, JSON audit | [Conversation history](agent-conversation-history.md) · [Agent roadmap](../AGENTIC_FRAMEWORK_ROADMAP.md) |
| ◴ AI Opps | Every LLM call recorded: model, attempts, retries, tokens and duration | telemetry | [AI Ops](crimedata-ai-ops.md) |

How it's built: [Technical Guide › Feature map](TECHNICAL.md#feature-map)

## Data Room: from a ZIP of material to a reviewed case picture

Upload a bundle of mixed files (text, CSV, JSON, audio, photos). The Data Room processes it in seven stages and keeps every result in the database.

1. **Load**: upload and store the original archive
2. **Unzip**: count and catalogue each file
3. **Ingest**: store each source with its checksum
4. **Identify & describe**: AI description of every file, with previews
5. **Learn**: Batch Brief that cites its sources
6. **Connect**: vector and reference links, reviewed by an agent team
7. **Publish**: saved review pack (JSON plus manifest, connections and timeline CSVs)

Focused workspaces:

- **[Money Flows](data-room-money-flows.md)**: transfer graph with source rows, and a read-only agent that explains a route.
- **[Messages](data-room-messages.md)**: participant and thread graph with a conversation reader.
- **[People & Photos](data-room-people-photos.md)**: compare photo regions with possible register matches; each decision is audited.
- **[People mentioned](../README.md#people-mentioned-and-questioning-notification-simulation)** (October 2026): named people pulled from the material with exact quotes, grouped across sources and checked against the POI register.
- **Travel**: map of places mentioned in the sources.
- **Select AI Chat**: chat about the batch; threads are saved and private to each user.

Learn more: [Workspace guide](crime-data-room-workspace.md) · [Smart tiles](data-room-capabilities.md) · How it's built: [Technical Guide › Data Room](TECHNICAL.md#data-room-pipeline)

## Ground rules

- **Every claim has a source.** AI output points to exact excerpts or rows. Anything unverified shows as "Not stated" or is left out with a warning.
- **AI output is a draft.** Groupings, matches and connections need a person to review them. They don't establish identity or guilt.
- **No scoring or prediction.** No suspect ranking, risk scores, predictions or recommended actions. Agents only read.
- **Everything is audited.** Agent tool calls, review decisions and conversations are logged as JSON in the database.

Learn more: [Agent roadmap and guardrails](../AGENTIC_FRAMEWORK_ROADMAP.md) · How it's enforced: [Technical Guide › Guardrails](TECHNICAL.md#how-the-ground-rules-are-enforced)

## Around the app

- **APEX**: DickTracy applications built on the same `CRIME_DATA` schema.
- **SQL Developer**: direct SQL access through the `CrimeData_ADB` connection.
- **GitHub**: app source in [`fucci/CrimeDataLiveStack`](https://github.com/fucci/CrimeDataLiveStack); Adelaide v5 data in [`fucci/CrimeDataLiveStack-data`](https://github.com/fucci/CrimeDataLiveStack-data).

---

Synthetic, non-operational demonstration. No record represents a real person, address or incident. Adelaide profile generator 5.0.0, seed 20260828.

**Functional Guide** · [Technical Guide](TECHNICAL.md) · [Project README](../README.md)
