# IncidentData AI-Agent-V2 — Planning and Considerations

## Purpose

Add an **AI-Agent-V2** launch button to the IncidentData AI Agent Console. V2 will use Oracle Autonomous AI Database Select AI Agent (`DBMS_CLOUD_AI_AGENT`) with the existing OCI GenAI profile based on `meta.llama-4-maverick-17b-128e-instruct-fp8` in Chicago.

It is an analyst-augmentation demonstration for generated data. It must not predict crime, identify people, assess individual risk, recommend patrol deployment, make operational decisions, write to operational tables, or treat public posts as verified evidence.

## Why V2 is different

The existing Agent Console is a deliberately deterministic workflow: the application routes a question to a reviewed SQL template and records an audit event.

V2 will be a real Select AI Agent team. The database agent can select and sequence constrained tools, evaluate whether results answer the question, retain approved conversational context, and present its working trail for analyst review.

## Recommended first-release scenarios

### 1. Watched pattern investigation brief

Prompt: **“Investigate Vehicle Parts Harvesting for the current Adelaide profile.”**

Expected outcome: an explainable investigation starter containing the pattern definition, linked incidents, linked public-post context, time and suburb spread, available report/evidence context, and clear data gaps.

This is the strongest demonstration because it connects watched patterns, relational data, reports, evidence, spatial/time context, vector work, and the social-signal layer.

### 2. Data readiness review

Prompt: **“Is Adelaide Data Set V2 ready to demonstrate the Vehicle Parts Harvesting scenario?”**

Expected outcome: a checklist of incident/report coverage, coordinate availability, evidence links, watched-pattern links, social-post links, vector coverage, and any missing components.

This is practical, safe, and valuable for a data and AI demonstration. It also avoids implying that the system is making policing recommendations.

## Next scenarios, after the first release

| Scenario | Example request | Safe output |
|---|---|---|
| Pattern comparison | “Compare Vehicle Parts Harvesting with Construction Site Material Theft.” | Similarities/differences in pattern definitions, linked record counts, time, area, evidence types, and post context. |
| Area/time briefing | “Summarise overnight activity in Adelaide Central over the selected period.” | Descriptive category, pattern, and time breakdown; no deployment recommendation. |
| Cross-source context review | “What public-post context is linked to this watched pattern?” | Clearly labelled, unverified public-post context beside authorised incident records. |

## Four agent layers in the UI

| Framework layer | Visible V2 behaviour |
|---|---|
| Planning | Display a concise proposed sequence: retrieve pattern → inspect links → assess time/area context → produce review brief. |
| Tool Use | Show each permitted tool invoked, its status, and a concise result summary. |
| Reflection | State whether the returned data was sufficient, incomplete, inconsistent, or needs analyst clarification. |
| Memory Management | Retain only the current case focus, selected date range, and analyst-approved intent for follow-up requests. Provide a **Clear case memory** control. |

The UI should not expose hidden model chain-of-thought. It should show a compact, auditable plan, tool history, and outcome rationale.

## Initial Agent team

Use one team, **CRIMEDATA_PATTERN_INVESTIGATION_TEAM**, with a sequential process. Start with a small, controlled tool catalogue rather than unrestricted database access.

| Tool | Implementation direction | Returns |
|---|---|---|
| `PATTERN_BRIEF` | Custom read-only PL/SQL function | Definition, watch rationale, status, and display metadata. |
| `PATTERN_LINKS` | Custom read-only PL/SQL function | Linked incident and public-post counts, references, and relationship labels. |
| `AREA_TIME_SUMMARY` | Custom read-only PL/SQL function | Authorised date/suburb/patrol-area distribution. |
| `EVIDENCE_REPORT_SUMMARY` | Custom read-only PL/SQL function | Aggregate report and evidence context; no unrestricted narrative dump. |
| `DATA_READINESS_CHECK` | Custom read-only PL/SQL function | Scenario readiness metrics and transparent missing-data flags. |
| `SQL` | Built-in Select AI NL2SQL, later phase only | Read-only SQL over the existing secure V2 views, validated by the application before display. |

The first release should use the five custom PL/SQL tools. Add generic NL2SQL only after the behaviour, tool history, and security model are demonstrated and reviewed.

## Security and governance controls

- Agent profile uses the existing OCI GenAI model and dedicated `CRIME_DATA` schema profile.
- Each data tool reads secure views or applies the same `CLIENT_IDENTIFIER` geographic scope used by the app.
- No DML, DDL, email, notification, web-search, external REST, person-identification, or deployment tools in the initial team.
- Public posts remain visibly marked as simulated, external, and unverified.
- Agent output uses descriptive language and never asserts that a pattern proves a crime connection.
- Every run retains user, conversation ID, selected scenario, plan, tool calls, result status, and final response in the existing audit trail plus Select AI Agent history views.
- Memory is short and case-scoped. Do not persist personal, sensitive, or inferred content as long-term memory.

## Proposed user journey

1. Analyst opens **IncidentData AI Agent Console** and clicks **AI-Agent-V2**.
2. A pop-up offers two launch tiles: **Investigate a watched pattern** and **Assess data readiness**.
3. Analyst chooses a visible watched pattern and optional date window.
4. Agent presents the proposed plan and begins tool calls.
5. The UI streams a compact activity trail: Planned → Tool called → Result observed → Reflection → Brief ready.
6. Analyst can inspect the selected tool results, generated SQL where relevant, framework history, and the JSON audit record.
7. Follow-up question reuses only the active conversation's case memory; **Clear case memory** starts fresh.

## Delivery stages

### Stage 0 — readiness and design

- Confirm `DBMS_CLOUD_AI_AGENT` privileges for `CRIME_DATA`.
- Confirm the current Select AI profile can be referenced by an agent.
- Define the five read-only PL/SQL tool contracts and output JSON shapes.
- Add tests for scope enforcement and no-data outcomes.

### Stage 1 — database agent foundation

- Create the five controlled tool functions.
- Register the tools, agent, task, and sequential team with `DBMS_CLOUD_AI_AGENT`.
- Configure short-term conversation memory conservatively and short long-term memory for the team.
- Validate agent and tool history views, with a data-security test for each demo user.

### Stage 2 — application experience

- Add the **AI-Agent-V2** button and pop-up.
- Provide launch tiles, clear plan/tool/reflection/memory panels, result brief, SQL/tool inspection, and no-data states.
- Link the agent run to the existing JSON audit panel.

### Stage 3 — scenario validation and demonstration

- Validate the two launch scenarios with Adelaide Data Set V2.
- Test a scoped user and a statewide administrator.
- Capture a short walkthrough: pattern selected → plan → tool calls → reflection → reviewed brief → audit.

### Stage 4 — controlled expansion

- Add comparison and area/time briefing scenarios.
- Consider a tightly validated built-in SQL tool after a review of generated-query quality.
- Consider vector/RAG retrieval only where it materially improves pattern brief quality.

## Decisions to make before implementation

1. Keep the first release to the two recommended scenarios, or include pattern comparison immediately.
2. Decide whether the V2 team should be visible to all demo users or initially only `statewide_admin`.
3. Agree the maximum memory window. Recommendation: five short-term turns and five long-term task summaries.
4. Decide whether an analyst must explicitly approve a plan before the first tool runs. Recommendation: display the plan and permit a **Run investigation** confirmation for the demonstration.

## Success criteria

- A user can complete both launch scenarios from the app without writing SQL.
- Each run visibly demonstrates Planning, Tool Use, Reflection, and Memory Management.
- Tool access remains read-only and respects geographic security scope.
- Public-post limitations and no-data outcomes are clear.
- A reviewer can reconstruct the run from framework history plus the application audit record.
