# Evidence walkthroughs across nine cities

Released on FU40, port 8706, on 20 October 2026. Each main city profile has the
same core of **24 authored synthetic sources**, linked to **12 existing local
incidents**, with **six guided comparisons** matching the shared watch patterns.
Existing evidence and the additional local stories are retained.

Open **Evidence Intelligence → Six watch-pattern stories**. Each shortcut selects
four local sources and prepares a source-cited review question. The source set
supports the same presentation sequence in each city:

| Story | Reference suffixes | Comparison to demonstrate |
| --- | --- | --- |
| After-hours access | Q01–Q04 | Requested visit versus recorded attendance; compare two generated tray images without identifying a physical item |
| Payment-document trail | Q05–Q08 | Repeated reference, pending authorisation, one settled reservation and one voided authorisation; an unrelated blank-form namespace |
| Precinct timing and context | Q09–Q12 | Estimated observation time, proposed collection, later schedule correction and a separate roster-template namespace |
| Doorstep visits and alternatives | Q13–Q16 | Unanswered doorstep enquiry, a delivery alternative, disagreement about timing and a template control |
| Parts descriptions and provenance | Q17–Q20 | Incomplete part-family code, catalogue comparison, legitimate maintenance and an unsigned collection request |
| Worksite inventory and controls | Q21–Q24 | Outstanding stock transfer versus unexplained loss; generated organiser and latch illustrations with unknown capture provenance |

Evidence references start with `EV-<city>-`; for example, Perth's payment set is
`EV-PER-Q05` through `EV-PER-Q08`. The city prefixes are ADL, PER, BNE, AMS, BRU,
DUB, BOS, CHI and LV.

## Presenter sequence

1. Choose a city through the existing Data Foundation restore workflow. Open
   Evidence Intelligence and choose one of the six story shortcuts.
2. Read the four original supplement sources. Open the linked local incidents
   and compare their existing case/person associations. Supplement wording is
   newly authored teaching material; it is not a quotation from an incident report.
3. For **Payment-document trail**, compare the reference namespaces in JSON.
   The repeated suffix cannot join a blank template to a payment. Preserve the
   explicit voided-authorisation outcome and the unknown currency.
4. For **After-hours access**, select Q03 and choose **Compare images**. Q04 is
   the corresponding visual comparison. Similar shape does not identify the
   same physical tray. The four reused illustrations are labelled as generated
   teaching images, without a local recovery or capture claim.
5. Use **Links** for native incident-context graph paths and **Map** for
   approximate incident locations. A document association does not establish
   authorship, attendance, handling or ownership. An incident point is not an
   evidence capture location.
6. Open **AI review** and use Select AI or the native agent. Compare the draft's
   source citations, alternative explanations and missing verification. Both
   actions retain the existing scoped, read-only review behaviour.

## Coverage

The totals include pre-existing local story packs, so they deliberately differ.

| City | Existing Evidence Intelligence sources | New shared core | Total |
| --- | ---: | ---: | ---: |
| Adelaide | 21 | 24 | 45 |
| Perth | 76 | 24 | 100 |
| Brisbane | 76 | 24 | 100 |
| Amsterdam | 54 | 24 | 78 |
| Brussels | 0 | 24 | 24 |
| Dublin | 0 | 24 | 24 |
| Boston | 76 | 24 | 100 |
| Chicago | 76 | 24 | 100 |
| Las Vegas | 76 | 24 | 100 |

These are enriched Evidence Intelligence sources. Each city also retains its
larger general evidence register. Those general evidence totals were not made
artificially equal.

## Implementation and persistence

`EI_CITY_CORE_V1` adds 216 saved evidence rows in `Z_BASE_EVIDENCE_ITEMS` and
24 corresponding live rows for the active city. It adds 216 MiniLM text vectors
and 36 CLIP image vectors, keyed by city profile, stable evidence reference and
source hash. The existing four object illustrations and their matching image
vectors are reused by exact checksum; text embeddings were generated locally
using the existing cached model.

The loader validates the existing local incident, case and person links. It
inserts missing records, accepts identical duplicates and rejects differing
duplicates. No incidents, original evidence rows, cases, POIs, watch memberships,
entitlements or other saved profiles were replaced.

Saved evidence is copied and remapped by the existing standard restore package;
vectors remain keyed by profile and stable reference. No dataset restore was
performed during release. Perth V2 remained active with its activation marker
unchanged. The app's runtime settings, mounts, ports and unrelated backend files
were verified unchanged.

The scoped view allowlist adds this pack while retaining its secure incident
join and active-profile predicate. Detail, original asset, graph, search and AI
routes continue to use the same scope. Walkthrough buttons are derived only
from complete four-source sets visible to the current user. A partial scope
does not reveal references to hidden sources. Assets remain behind the authorised
API rather than public static URLs.

The current register limit is 100 enriched sources. All current city totals fit;
future additions beyond that limit require pagination or a larger scoped register
before claiming that every source or walkthrough is visible.

## Reproduce and verify

Scripts live under `scripts/evidence-intelligence/city-core/`. Run them from the
repository root with the existing FU40 Podman access:

```bash
# For a new fixture version: capture anchors and build sources, then embed locally.
node scripts/evidence-intelligence/city-core/build.cjs
node scripts/evidence-intelligence/city-core/embed.cjs

# Rehearse and roll back; add --apply for an authorised committed load.
node scripts/evidence-intelligence/city-core/load.cjs

# Audit the released data and read paths; --ai also runs two real review calls.
node scripts/evidence-intelligence/city-core/verify.cjs
node scripts/evidence-intelligence/city-core/browser.cjs
node scripts/evidence-intelligence/city-core/browser.cjs --fixtures
```

The builder refuses to overwrite the existing pack. Use a new version to refresh
anchors. Browser scripts accept `PLAYWRIGHT_MODULE` for an installed Playwright
module. `schema.cjs` previews the allowlist addition unless `--apply` is supplied;
the matching repeatable SQL is in
`db/migrations/20261020_city_evidence_core_view.sql`. The application setup script
also retains all existing pack allowlist entries.

`build-image.cjs` builds an isolated overlay from the running image; `deploy.cjs`
checks that Data Room work is idle, preserves runtime settings, verifies the
release and restores the previous app and view if those checks fail. Preserve
its JSON image receipt and pass it to `deploy.cjs` when releasing again.

## Verification evidence

All 50 test files and the production frontend build passed. Database checks
verified every saved source, local incident anchor, source hash and vector
dimension across all nine cities. The live active-city checks verified all
24 source downloads and checksums, denied assets from other profiles, retained
restricted-user scope, confirmed text/image ranking, and exercised Oracle
spatial and property-graph queries. Real Select AI and native-agent reviews
passed citation checks; the agent called both request-bound tools.

The live browser passed all six story shortcuts, four-source review selection,
image loading, review controls, JSON and mobile widths. A separate nine-city
fixture browser test checked the same UI without restoring any city. These
fixture display checks are distinct from the live saved-data checks.

Receipts are in [verification/city-evidence-core-20261020](verification/city-evidence-core-20261020/).
The previous application image remains available as
`localhost/incidentdata-livestack:description-quote-recovery-20261019-r1`.
