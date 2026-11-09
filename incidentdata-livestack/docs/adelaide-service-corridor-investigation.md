# Adelaide hidden-linkage investigation walkthrough

This exercise uses `CASE-2026-0317`, **After-hours property reports under
comparative review**. Everything in the exercise—including incidents,
addresses, profiles, evidence, and relationships—is synthetic. The graph is a
review aid and does not establish identity, responsibility, risk, or an
operational conclusion.

## The intended reveal

Twelve reports span May and June, three security areas, several suburbs, and
four property-offence types. No report announces a common series. Further
comparison exposes five partial clue families:

| Clue family | Partial observation | Incidents |
|---|---|---:|
| Contact geometry | Three narrow contact points | 3 |
| Material transfer | Short amber polymer filament | 3 |
| Stock notation | Partial `M4-17` label notation | 2 |
| Alarm timing | Eleven-minute interruption | 2 |
| Route timing | Twelve-minute service window | 2 |

Moderate similarity edges connect these small groups into one review network.
That convergence is the teaching moment; none of the clues is conclusive by
itself.

## Walkthrough on the Case Relationships page

1. Start as **Statewide Administrator** and open **Case Relationships**.
2. Search for `after-hours property`, then choose `CASE-2026-0317`.
3. Select **1 Hop**. Observe 12 incidents spread across offence types and
   Adelaide areas. At this depth the case is a collection, not an answer.
4. Select **2 Hops**. Evidence nodes reveal individual observations. Open the
   incident nodes and compare their natural report text, modus operandi, and
   masked address details. The two person profiles are context-only bridges;
   their descriptions explicitly stop short of identification or attribution.
5. Group the evidence mentally by repeated class-level features: contact
   geometry, fibre, notation, alarm timing, and route timing.
6. Select **3 Hops**. Dashed red incident-to-incident edges show the moderate
   comparison relationships stored in Oracle's `crime_case_network` property
   graph. The separate clue groups now form a connected pathway.
7. Change the demo user to a regional analyst. Deep Data Security removes
   incidents and paths outside that user's area, illustrating why the same
   graph query can produce a different authorised view.
8. Use the [SQL/PGQ walkthrough](../db/tutorial/03_adelaide_service_corridor_walkthrough.sql)
   to reproduce each stage directly in Oracle AI Database.

## Address context used by the series

The addresses are deterministic `masked_vicinity` labels. Postcodes and
localities are boundary-derived, but no street label represents a real premise
or reported incident address.

| Incident | Locality | Masked street label | Postcode |
|---|---|---|---:|
| ACI-2026-07569 | Unley Park | 170 Flaxwood Court | 5061 |
| ACI-2026-17922 | Elizabeth East | 93 Woodlark Vale Avenue | 5112 |
| ACI-2026-10561 | Darlington | 239 Ambermere Parade | 5047 |
| ACI-2026-09330 | West Hindmarsh | 126 Reedbank Parade | 5007 |
| ACI-2026-07468 | Ridgehaven | 55 Clayridge Place | 5097 |
| ACI-2026-15938 | Glengowrie | 114 Cloverbank Parade | 5044 |
| ACI-2026-17199 | Adelaide | 79 Olivebrook Circuit | 5000 |
| ACI-2026-09252 | Salisbury East | 138 Nectarwood Crescent | 5109 |
| ACI-2026-07772 | Lonsdale | 254 Lemonmyrtle Crescent | 5160 |
| ACI-2026-10956 | Adelaide | 33 Zephyrbank Place | 5000 |
| ACI-2026-12708 | Golden Grove | 213 Bluegum Vale Close | 5125 |
| ACI-2026-18675 | Glengowrie | 7 Goldenwattle Court | 5044 |

## Useful starting references

- Seed incident: `ACI-2026-07569`
- Case: `CASE-2026-0317`
- Late-stage structured marker: `ADL_SERVICE_CORRIDOR_0317`
- Graph: `crime_case_network`
- Loader: `db/demo/16_add_adelaide_service_corridor_series.sql`
