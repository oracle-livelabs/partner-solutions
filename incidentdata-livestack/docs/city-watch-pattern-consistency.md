# Shared six-pattern city selection

Verified on FU40 on 20 October 2026. All nine main Data Foundation city profiles
now expose the same six watch-pattern codes as `ADELAIDE_DATA_V2`:

| Pattern code | Topic |
| --- | --- |
| `SERVICE_ACCESS` | After-hours service access |
| `ART_MARKET_PAYMENTS` | Payment-document anomalies |
| `NIGHT_PRECINCT_ACTIVITY` | Entertainment precinct activity |
| `RESIDENTIAL_OCCUPANCY_BURGLARY` | Residential daytime occupancy-test burglary |
| `VEHICLE_PARTS_HARVESTING` | Vehicle parts harvesting |
| `CONSTRUCTION_SITE_MATERIAL_THEFT` | Construction site material theft |

| City | Profile | Previously visible | Now visible |
| --- | --- | ---: | ---: |
| Adelaide | `ADELAIDE_DATA_V2` | 6 | 6 |
| Perth | `PERTH_DATA_V2` | 10 | 6 |
| Brisbane | `BRISBANE_DATA_V2` | 21 | 6 |
| Amsterdam | `AMSTERDAM_DATA_V1` | 6 | 6 |
| Brussels | `BRUSSELS_DATA_V1` | 6 | 6 |
| Dublin | `DUBLIN_CITY_DATA_V1` | 6 | 6 |
| Boston | `BOSTON_DATA_V2` | 21 | 6 |
| Chicago | `CHICAGO_DATA_V2` | 21 | 6 |
| Las Vegas | `LAS_VEGAS_DATA_V2` | 21 | 6 |

Only `ACTIVATE_UI` flags were updated in `Z_BASE_WATCHED_CRIME_PATTERNS` and
the live `WATCHED_CRIME_PATTERNS` table. All other watch columns were compared
before and after and matched. Definitions, active status, city-specific wording,
ordering, case references, relationships, and vectors are preserved. Other saved
profiles were not targeted. No incident, post, case, evidence or embedding data
was created or changed.

Perth V2 was active during the change and remained active, with its activation
marker unchanged. Standard profile restore copies the saved watch flags to the
live table, so each of the nine city selections retains these six choices.
Explicit administrator hide actions can still change visibility later.

## Audit and maintenance

Run from the repository directory with access to Podman:

```bash
node scripts/align_city_watch_patterns.cjs --check
node scripts/align_city_watch_patterns.cjs --dry-run
node scripts/align_city_watch_patterns.cjs --apply
```

The default is a read-only audit. Dry-run performs the planned updates, verifies
all nine selections and preservation of the other watch columns, then rolls back
and verifies the original rows. Apply performs the same verification and commits
one transaction. The script locks the watch tables and active-profile marker
while writing and fails if a selected definition is absent or inactive. It reads
the nine profile codes from `frontend/src/foundation-profiles.mjs`; it never
switches datasets or calls an embedding model. Redirect stdout to retain the JSON
receipt, which includes the original watch rows and exact flag changes.

The committed change was independently verified through a fresh database audit
and the live `/api/watched-patterns` endpoint. Both matched the six shared codes,
and a repeated audit proposed zero updates. The transactional rehearsal also
verified rollback before the committed application.
