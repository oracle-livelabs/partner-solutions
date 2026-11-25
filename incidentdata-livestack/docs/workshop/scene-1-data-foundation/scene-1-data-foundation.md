# Scene 1: Data Foundation

## Introduction

Establish the active Adelaide data and scope, then use the five presenter tiles to introduce the database capabilities. The tile examples are local teaching simulations, not edits to Adelaide records.

Estimated Time: 25 minutes

![Conceptual platform capabilities](../images/technology-overview.png)

### Objectives

- Read the active profile and demo-persona context before interpreting any count.
- Explore JSON duality, Vector Search, Property Graph, Spatial and Deep Data Security.
- Locate the nine saved city profiles and distinguish profile review from restore.

## Task 1: Read the foundation screen

1. Select **Data Foundation**. Confirm the app title, active city and **Statewide administrator**. Read the incident, category, persona and watched-pattern cards as current-session values rather than fixed numbers.

    ![Data Foundation summary cards and capability tiles](../images/scene-1-data-foundation.png)

2. Talk through **Relational & JSON**, **Vector-ready narratives**, **Graph & spatial context** and **Deep Data Security**. Each panel introduces a capability; later scenes reveal the specific execution path.
3. Scroll to the saved dataset profile library beneath the foundation tiles. The nine city choices are Adelaide, Perth, Brisbane, Amsterdam, Brussels, Dublin, Boston, Chicago and Las Vegas. Review the saved profile information without changing the active data.

    ![Saved dataset profile library with Adelaide V3 active](../images/scene-1-profile-library.png)

4. For an instructor-led reset only: on the **Adelaide** tile (**ADELAIDE_DATA_V3**, *Adelaide Data Set V3 - Metro Suburb Coverage*), type the confirmation `ACTIVATE ADELAIDE_DATA_V3` and select **Restore Adelaide**, under the session's approved backup/recovery procedure. **Restore Adelaide NRT** instead shifts incident times so the latest incident is now; standard restore keeps the saved May–June 2026 dates. Allow a few minutes, then wait for the active profile and counts to refresh. Do not interpret a loading placeholder as the final state.

**Presenter note:** Adelaide V3 spreads 21,532 synthetic incidents across 394 official Greater Adelaide suburbs. Each patrol area is one connected region: Adelaide Central (5,488 incidents), Northern & Western Adelaide (8,883) and Southern & Eastern Adelaide (7,161). The Central, Northern and Southern analyst personas each see only their own area. The earlier Adelaide V2 profile is still listed under **Other saved profiles**. A different city can be used after its profile and exercise prerequisites are checked.

## Task 2: JSON Relational Duality Views

**Animated pause:** [One incident, two views](../powtoons/index.html?story=duality).

1. Select **JSON duality views**. In the invented `DEMO-101` example, compare related incident/report rows with one JSON document.
2. Choose **Two views, one record**, change the table status to **Under review** and observe the two displays change together. Reset the example.
3. Explain that a defined duality view maps selected rows to a document. JSON output alone does not establish that a duality view is deployed for every IncidentData endpoint.

![How a defined duality view relates rows and a document](../images/json-duality.png)

## Task 3: Oracle Vector Search

**Animated pause:** [Similarity is a lead](../powtoons/index.html?story=vector).

1. Select **Oracle Vector Search**, then **See similarity**. Compare Dog with the nearby Greyhound and Poodle examples; choose Car and read the changed ranking.
2. Explain that embeddings represent content numerically and distance helps rank related content. A score is not a probability or a person identification.
3. Later narrative and photo vector exercises require compatible prepared vectors in the selected profile. Check coverage before promising live matches.

![Conceptual vector retrieval path](../images/vector-search-flow.png)

## Task 4: Property Graph and Spatial

1. Select **Property Graph**. Follow Alex to a bicycle at one hop and the shop at two hops. Name the nodes, edges and recorded link types; the layout itself creates no relationship.
2. Select **Spatial**. Compare **Within distance** at 1 km with **In patrol area** in its invented grid. One tests distance, the other area membership.
3. Relate these concepts to the later case views and approximate incident map without claiming every drawn graph or map invokes a native database graph/spatial operator.

## Task 5: Deep Data Security

**Animated pause:** [Scope before search](../powtoons/index.html?story=security).

1. Select **Deep Sec · ABAC** and **Explore access decisions**. Compare North and Statewide area scope while keeping the other attributes visible.
2. Explain why a broader area can allow an additional standard record while a restricted record remains unavailable.
3. Reset the example. The tile is a local simulation; application scoped views and separately installed native DDS identities/grants are distinct demonstrations.

## Continue

Open **Incident Activity Center** to read current authorised Adelaide activity.
