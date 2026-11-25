# Continuity contract

## Identity and source layers

Canonical knowledge set: `KS-CARE-TRUST-001`. Display title: **The Care-Trust: Who knows?** Earlier “Who knew?” wording is a historical alias, not another knowledge set. Amsterdam's parent watch is `RESIDENTIAL_OCCUPANCY_BURGLARY`; its case is `CASE-AMS-2026-03`. The Payment-Evidence Vignette remains independent.

Public posts contain no resident/client identifiers, care-worker names, private medical information, residence or actionable visit schedules. A private synthetic follow-up may supply an exact incident reference and permission to record a concern. That creates an explicit comparison edge, not corroboration or a verified public identity. Keep unlinked awareness posts unlinked.

Evidence must distinguish original report facts from authored supplements. Store stable evidence/incident/post IDs, provenance, simulated receipt vs source dates vs generation dates, source hashes, source-supported typed markers and declared linkage basis. A hash checks retained bytes, not authenticity. Existing POI incident links are contextual; only exact supported text spans justify literal-name mentions.

Keep four hypotheses distinct:

- Property loss / burglary in the unchanged source report.
- Possible misuse of private care information.
- Possible unauthorised personal spending or coercion (*financieel misbruik*).
- Possible false care-funding claims (*zorgfraude*), requiring separate claim/invoice evidence.

A shopping discrepancy does not establish a public-care funding claim. A provider match does not identify a worker. A worker assignment does not establish message authorship, payment use, attendance or guilt. Consent is client-, purpose- and time-bounded. Requested refunds are not completed refunds; voided authorisations are not settled duplicate purchases.

## Navigation acceptance

Watch → public concern → original incident → linked source → comparison question → person/incident context → return.

Each step must say what connects it and what the relationship does not establish. “Linked incidents” means exact recorded links, not a broad keyword query. A post-to-evidence route must pass through a reviewed incident relationship and authorised incident/evidence views. Reject a supplied post/incident mismatch. A user/profile change clears or revalidates the trail; stored UI state never grants access.

Question-sized comparison sets can span incidents, but visibly indicate this widening. Preserve the initial lead as origin, not as evidence that every comparison source belongs to it. Back controls restore the selected source, visible set, selected review IDs and filters. Do not silently retain an out-of-filter active document.

## Capabilities and tests

| Capability | Demonstrate | Do not imply |
|---|---|---|
| Relational + JSON | Explicit post/incident edges, permission fields, typed markers, provenance | A shared string is a verified identity |
| Vector | Rank related source material, including a qualifying addendum | Similarity is a probability or a recorded link |
| Property graph | Scoped person–incident–evidence paths with link summaries | The person handled every incident-linked item |
| Spatial | Approximate incident locality and distance | A residence, care visit, evidence capture point or attendance |
| Select AI | Draft from selected sources with citations | Valid citations prove the draft's interpretation |
| Native agents | Separate source and relationship tools; audited read-only review | Autonomous culpability or case-status decisions |

Minimum meaningful tests: positive source trail; exact six-incidents Amsterdam filter where unchanged; unknown/mismatched context; unlinked public post; all restricted demo personas; live/saved parity; unchanged original-report and role hashes; duplicate/refund counter-evidence; malicious source ignored; allowed-citations-only; native tool audit; UI return trip and mobile layout. Test source hashes and vector dimensions/model bindings, not just titles or counts.

## Current repository landmarks

Within the CrimeData-LiveStack repository:

- `backend/care-trust-story.json`: source references and review questions, not an answer key.
- `backend/investigation-trail.js`: scoped, read-only explicit-link traversal.
- `frontend/src/InvestigationTrail.jsx`: visible hand-offs and linkage basis.
- `testdata/evidence-intelligence/care-trust-v1`: immutable initial 16 sources, two fictional POIs and three contextual links.
- `testdata/evidence-intelligence/care-trust-v2`: six additive sources H17–H22, three public posts, two reviewed comparison edges, one unlinked awareness post. `expected.json` is evaluator-only.
- `scripts/care-trust-v2`: generated-fixture validation, local embeddings, guarded database and release procedures. Read the implementation before invoking external mutations.
- `docs/care-trust-who-knows.md`: simple user walkthrough and implementation boundaries.

Capture before mutation; reject conflicting existing rows; default a data load to rollback; test within the staged transaction; persist live and saved profile rows together. Do not broaden entitlements. Do not automatically rerun a failed commit/deploy: inspect receipt and current state first. A new city or changed base records require fresh fact cards and a new version, not bypassed assertions.
