# POI aliases, accounts and phone numbers

`PERSONS_OF_INTEREST` remains the person register. The new `POI_IDENTIFIERS` table holds any number of identifier assertions for each person. The existing `ALIAS_NAME` remains compatible with existing screens and scripts.

| Field | Purpose |
| --- | --- |
| `DATASET_PROFILE_ID`, `PERSON_REF` | Stable logical link to a fictional POI in a city profile |
| `IDENTIFIER_TYPE` | `alias`, `username`, `email`, or `phone` |
| `NAMESPACE` | Account platform (e.g. telegram, instagram, x); `unspecified` when unknown; `general`, `email`, or `e164` for other types |
| `IDENTIFIER_VALUE`, `NORMALIZED_VALUE` | Original value and conservative lookup representation |
| `REVIEW_STATUS` | proposed, declared, confirmed, rejected |
| `SOURCE_REF`, `SOURCE_NOTE`, `RECORDED_BY` | Attribution for the asserted link |
| `REVIEWED_BY`, `REVIEWED_AT` | Required for confirmed assertions |
| `VALID_FROM`, `VALID_TO` | Optional validity window; end is exclusive |

A value can belong to multiple POIs. Lookups return every eligible assertion and mark ambiguous results; they never silently merge people. A phone number can also be reassigned over time. Declared means an explicit fictional scenario annotation, not an independently verified identity. Proposed/rejected/expired/future assertions do not match.

The physical `PERSON_ID` changes during city restores, so this table deliberately has no foreign key to the live person row. The profile foreign key is enforced in Oracle; the importer checks that each `(profile, PERSON_REF)` exists in `Z_BASE_PERSONS`. Direct SQL writers must enforce that same person-key check. `SECURE_POI_IDENTIFIERS_V` joins the active profile marker and `SECURE_PERSONS_OF_INTEREST_V`, restricting records to visible live POIs. Saved inactive-profile identifiers remain stored independently of the restore procedure. No restore procedure or live POI columns were changed.

Aliases are compared with Unicode compatibility normalization, case folding and collapsed whitespace. Unknown-platform usernames remain case sensitive. Known case-insensitive platforms have explicit normalization rules. Email domains are folded to lowercase while local parts are preserved. Phone input needs an explicit international country code; optional extensions use `;ext=123`. No local-country guess is made.

## Initial fictional data

The seed is `testdata/poi-identifiers/fictional-scenario.json`. All nine selectable city profiles have the same seven records:

- Declared usernames: `kappa66 → George Kaplan`, `evek81 → Eve Kendall`, `pipp68 → Philip Vandamm`, `thorny58 → Clara Thornhill`.
- Proposed alias examples for Philip: `pippy`, `pippster`, `vanders`. The owner described these as possibilities; they remain excluded from matching pending confirmation.

The initial seven-record seed did not invent email addresses or phone numbers. Platforms were not inferred from the original handles. The additional city-standard pack below adds explicitly generated fictional contact details.

The original batch annotation JSON and previously generated Detective Room packages remain intact. **This change installs the database model and backend read/match helpers. Existing UI searches and the room generator still use their previous data paths; they have not yet been switched to this register.** There is no identifier editing screen in this change. These boundaries avoid implying that stored aliases already affect every search surface.

## Installation and maintenance

```sh
node scripts/setup_poi_identifiers.cjs --apply
node scripts/setup_poi_identifiers.cjs --check
node scripts/setup_poi_identifiers.cjs --dry-run
node scripts/check_poi_identifiers_live.cjs
```

The tool targets the existing FU40 CRIME_DATA connection, guards the profile marker, and imports the seed into the nine foundation profiles without switching cities. An optional JSON path after the mode supplies additional records in the same format. Default records are proposals. A duplicate assertion with changed attribution, validity or status fails explicitly; this importer does not silently overwrite review decisions. Existing assertions are retained.

Oracle DDL commits separately: `--apply` installs the additive schema before inserting data transactionally. `--dry-run` requires the schema already installed and rolls back data; it never executes DDL. The deterministic assertion key includes profile, POI, type, namespace, normalized value and source reference. Repeated imports add no duplicates. Review changes currently require an explicit operator database update with attribution; no review mutation API is provided.

`backend/poi-identifiers.js` exposes `prepare`, `normalize`, `list(connection)` and `match(connection, {type, value, namespace, at})`. Application callers must use the established per-user Oracle session identifier. Reads use the scoped view. This module does not perform arbitrary text extraction or visual identification.

The live verifier inserts example accounts/numbers, shared identifiers, rejected and expired assertions only inside a rolled-back transaction. It checks scoped visibility and matching without publishing those examples or activating another city.


## Standard additional identifiers across nine cities (20 October 2026)

At the scenario owner’s request, `testdata/poi-identifiers/city-standard-v1.json` adds **5–7 identifiers to every existing POI**, independently of the original mappings. The nine cities contain 143 person/city records representing 19 distinct fictional people. The pack adds 812 rows in total; with the original 63 rows the identifier register contains 875 assertions.

Every person receives a fictional alias, two synthetic social handles (telegram and instagram), an email and a phone number. Some receive a second email and/or second phone. Generated identifiers are `declared` fictional scenario data, with generator attribution and an explicit note that they were not extracted from evidence. The three original proposed aliases retain their proposed status. No actual accounts were looked up or created.

Shared `PERSON_REF` values use identical identifiers in every city where that person exists. City-specific people retain their existing city membership; the importer does not create POIs in other cities. Identifier counts vary deterministically from 5 to 7 across people. The original name and single alias columns remain intact.

Emails use the [IANA special-use `.test` domain](https://www.iana.org/assignments/special-use-domain-names). Phones use [Ofcom’s drama-reserved mobile range](https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbers-for-drama), represented internationally as `+447700900xxx`. These same fictional numbers apply across cities; they do not imply a UK residence. Handles start with `demo_` and are labelled synthetic rather than asserted as real platform accounts.

```sh
# Deterministically rebuild the committed pack from its saved POI catalogue:
node scripts/build_city_poi_identifiers.cjs
# Default import mode rolls back all candidate additions:
node scripts/load_city_poi_identifiers.cjs --dry-run
node scripts/load_city_poi_identifiers.cjs --apply
node scripts/load_city_poi_identifiers.cjs --check
node scripts/check_poi_identifiers_live.cjs
```

`city-catalogue.json` captures the reviewed person references, display names and city membership. The loader compares it with the database before making changes, locks the relevant tables and active profile marker, checks all original assertions remain byte-for-byte equivalent as returned by Oracle, verifies shared-person consistency and commits only once. There is no DDL in this importer. A repeat import adds zero rows; unexpected source, review, name or membership changes fail for explicit review. Do not extend this version’s allocation by reordering the catalogue: add future identifiers as a new pack version and preserve existing allocations.

Checks and receipts are under `docs/verification/city-poi-identifiers-20261020/`. Existing screens and Detective Room generation still need a separate integration change to consume the database register.
