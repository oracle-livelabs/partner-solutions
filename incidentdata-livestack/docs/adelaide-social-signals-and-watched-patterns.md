# Adelaide social signals and watched crime patterns

This vertical slice adapts the Healthcare Operations Command Center and Quality
& Capacity Signals interaction model for IncidentData without treating public
discussion as police information.

## Current Adelaide baseline

- 24 simulated public social-media posts across six fictional sources.
- 12 posts in the latest 72-hour replay window.
- Four data-driven watched crime patterns.
- 15 analyst-reviewed post-to-incident comparison links.
- 15 distinct linked incidents out of 21,513: **0.07%**.
- No new crime incidents and no person-to-post relationships.

The active and `ADELAIDE_DATA` Z_BASE copies contain the same rows. A controlled
restore has been completed successfully.

## Watched patterns

| Pattern | Kind | Incidents | Posts | Why it belongs |
|---|---:|---:|---:|---|
| After-hours service access | Case series | 12 | 6 | Uses the existing service-corridor graph and partial physical clues. |
| Art-market payment discrepancies | Case series | 8 | 6 | Uses the existing payment/provenance graph and POI context. |
| Entertainment-precinct night activity | Community signal | 6 | 6 | Demonstrates crowd, place, time and source-diversity context. |
| Retail and transport theft activity | Community signal | 6 | 6 | Demonstrates high-volume activity without claiming every post is related. |

The application reads these choices from `WATCHED_CRIME_PATTERNS`; names,
descriptions, search prompts, colours, order and active status are not hard-coded
in the UI. Membership lives in `WATCHED_PATTERN_INCIDENTS` and
`WATCHED_PATTERN_POSTS`, making the same application reusable for another city.

## User walkthrough

1. Open **Incident Activity Center**.
2. Note the **Community signals** and **Watched crime patterns** KPIs.
3. Compare the data-driven watched-pattern list with Authorised Activity Profile
   and Crime Category Signal Velocity.
4. Open **Crime Pattern Signals**.
5. Select a watched-pattern card. It runs the stored semantic-search prompt and
   filters the external post feed to the same watch.
6. Filter posts by momentum or select **Reviewed incident links only**.
7. Select a linked incident reference to open its governed incident details.
8. Repeat as a Central, Northern or Southern analyst; the post feed and incident
   relationships change with the database security scope.

## Data model

- `SOCIAL_MEDIA_SOURCES`: fictional public-source catalogue.
- `SOCIAL_MEDIA_POSTS`: text, broad locality, topic, descriptive momentum and
  verification state.
- `SOCIAL_POST_INCIDENT_LINKS`: explicit analyst-reviewed comparisons only.
- `WATCHED_CRIME_PATTERNS`: locality-owned pattern configuration.
- `WATCHED_PATTERN_INCIDENTS`: incident membership.
- `WATCHED_PATTERN_POSTS`: external-post membership.
- `SECURE_SOCIAL_MEDIA_POSTS_V`: patrol-area scoped post view.

The migration also creates matching `Z_BASE_*` tables and extends profile
capture/restore ordering. It fixes `PERSONS_OF_INTEREST.OWNING_PATROL_AREA_ID`
remapping discovered during the controlled restore test.

## Interpretation controls

- A post is an unverified external signal, not a crime report or evidence.
- Momentum is a descriptive replay score, not a crime-risk or person-risk score.
- A reviewed link means only that time, broad place or public wording was judged
  compatible enough for comparison.
- The feed contains no real accounts, posts, incidents or people.
- There is no automated incident creation, person matching or operational action.

## Repeatable load

Apply the schema layer once:

```text
@db/migrations/20260825_add_social_signal_layer.sql
```

Validate and then apply the Adelaide profile rows:

```text
@db/demo/18_add_adelaide_social_signals_and_watches.sql ROLLBACK
@db/demo/18_add_adelaide_social_signals_and_watches.sql APPLY
```

Finally capture `ADELAIDE_DATA` from IncidentData Setup so the new layer is retained
by future profile restores.

