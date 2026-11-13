# Brisbane Night Market Circuit — graph walkthrough

This is a bounded, fictional teaching scenario in the Brisbane May–June 2026 profile. It contains no real people, addresses, incidents, attribution, or operational recommendation. The relationship is deliberately framed as a context to review, not a conclusion.

## Enable the capability layer

Load the Brisbane re-cut first, then run:

```bash
npm run enable:brisbane-capabilities
```

The command is repeatable. It refreshes the `BRISBANE_DATA` recoverable
snapshot only after validating the Brisbane incident total and capability
counts.

## What was planted

- Twelve existing synthetic records retain their original category, date, and approximate suburb-level point; the total profile stays at **42,317 incidents**.
- `BRIS-CASE-026` links the records through the Oracle `crime_case_network` property graph.
- Three fictional profile nodes and one synthetic evidence node per incident provide graph edges. A small subset of narratives includes one of four incomplete fictional artefacts: `Q7`, `midnight changeover`, `folded blue token`, or `R-26`.
- The selected records use a blended demonstration vector. It makes the series discoverable through a broad semantic prompt, but does not make a relationship claim.
- Three generated fictional POIs have eight-dimensional synthetic profile vectors and governed incident links. They are not real people and are never identity, biometric, or culpability results.
- Six simulated, privacy-limited public-context posts appear in Community Signals. Two have explicit analyst-reviewed comparison links; every post remains a non-evidentiary external signal.

## Guided discovery in the application

1. Open **Crime Pattern Signals** and search for `after-hours stock movement`. The result set contains the selected records alongside similar synthetic property-context records.
2. Inspect several result details. Look for the deliberately incomplete fictional artefacts in the narrative; no single artefact appears in every record.
3. Open **Case Relationships**. Select **BRIS-CASE-026 — Cross-area commercial-context review** and set graph depth to **3**.
4. Follow the graph from the case node to the 12 incident nodes, then to their evidence and fictional profile nodes. Edges show only governed, relational context.
5. Compare categories, broad areas, and the different artefacts. The teaching outcome is a defensible statement of *shared fictional context under review*, never attribution, identity, prediction, or deployment guidance.
6. Open **Person Intelligence** to inspect the three generated `BPOI-2026-026*` profiles and **Community Signals** to filter the `BRIS_NIGHT_MARKET` watched pattern.

## Read-only SQL checkpoints

Run these as the application schema user with `CLIENT_IDENTIFIER` set to `statewide_admin`, or use the corresponding governed app views.

```sql
-- Initial breadcrumb: the controlled series label and broad context.
SELECT i.incident_ref, c.category_name, i.suburb, i.occurred_at, r.report_summary
FROM secure_crime_incidents_v i
JOIN incident_categories c ON c.category_id = i.category_id
JOIN secure_incident_reports_v r ON r.incident_id = i.incident_id
WHERE i.modus_operandi = 'after-hours-market-circuit'
ORDER BY i.occurred_at;

-- Graph-ready relational path: case -> incident -> evidence/profile.
SELECT cf.case_ref, i.incident_ref, e.evidence_type, p.person_ref, l.connection_type
FROM case_files cf
JOIN case_incident_links cil ON cil.case_id = cf.case_id
JOIN secure_crime_incidents_v i ON i.incident_id = cil.incident_id
LEFT JOIN evidence_items e ON e.incident_id = i.incident_id
LEFT JOIN person_incident_links l ON l.incident_id = i.incident_id
LEFT JOIN secure_persons_of_interest_v p ON p.person_id = l.person_id
WHERE cf.case_ref = 'BRIS-CASE-026'
ORDER BY i.incident_ref, e.evidence_type;
```

The `crime_case_network` Oracle Property Graph is defined in `db/schema/05_case_relationship_graph.sql`; the Case Relationships page renders the same case, incident, evidence, and fictional-profile relationships from the scoped tables.
