# Adelaide V2 — The Care-Trust: Who knows?

The residential watch now has an Adelaide-specific Care-Trust teaching pack saved under `ADELAIDE_DATA_V2` (profile 6), case `CASE-V2-RES-001`. The original `ADELAIDE_DATA` baseline is untouched. This is fictional teaching material, not a claim about South Australian residents, workers or providers.

## Walkthrough

Select **Adelaide Data Set V2** through the normal Data Foundation restore workflow when ready. Use **Statewide Admin**, or **Southern Analyst** for the locality-scoped journey.

1. Open **Crime Pattern Signals → Residential Daytime Occupancy Test Burglary**.
2. In **The Care-Trust: Who knows?**, follow the first public concern. A separate private follow-up supplies the exact Marion report reference; the public post itself identifies nobody.
3. Inspect the unchanged incident, then select **Inspect linked evidence sources**.
4. Follow the five question buttons: **A small concern → Who knows? → Check permission → Check the spending → Test the wider pattern**.
5. Use **Links** to inspect a fictional documentary contact, then **Return to evidence review**. The source selection, focused document and tab should be retained.

The story asks who knew a resident's private circumstances and what they were permitted to do. It separates a residential approach concern, possible information misuse, and personal shopping support. It does not turn a care allocation into evidence of attendance, message authorship, spending or guilt.

## What is saved

- Seven original residential reports and their statuses remain unchanged; Mitchell Park stays resolved.
- Twenty-one source documents, `EV-ADL-H01`–`EV-ADL-H21`, span all seven report contexts.
- Two wholly fictional documentary contacts, Ellis Ward and Rowan Hale, have four source-supported contextual incident links. No photographs or identifying real-person material were used.
- Three non-identifying public concerns have two explicitly reviewed comparison links; the general invoice-awareness post remains unlinked.
- Twenty-one evidence text vectors and two saved person-narrative vectors are source-hash-bound. Evidence vectors are profile-keyed and do not rely on active numeric incident IDs.
- The application story registry, evidence-reference validation, scoped asset paths and walkthrough controls recognise Adelaide independently of Amsterdam.

The payment records use AUD and bounded grocery permission. A later reconciliation records a voided authorisation and a still-unconfirmed refund request. No care-funding invoice or claim is supplied. This is not a separate implementation of the **Payment-Document Anomaly Chain** watch.

## South Australian context

The fictional themes were informed by South Australia's [DHS guidance on responding to financial abuse](https://dhs.sa.gov.au/how-we-help/ageing-well/support-for-adult-safety-and-wellbeing/guides-for-service-providers/responding-to-financial-abuse), which discusses consent, dependence on support and concerns about use of money or property, and the [Public Trustee's financial-abuse guidance](https://www.publictrustee.sa.gov.au/financial-administration/protecting-yourself-against-financial-abuse). Checked 27 September 2026. These sources inform process realism, not evidence within the case or legal advice.

No Dutch prevalence figures, real case amounts, PGB arrangements, actual victim stories or real provider allegations were copied into Adelaide. No PINs, bank accounts, addresses, care schedules or exploitable absence windows appear in the new public signals or source pack.

## Validation and limits

The guarded loader defaults to rollback, rejects conflicting existing rows and fingerprints original Adelaide, target-V2 and active-city records. A staged load, saved-only commit and duplicate-free repeat-load check have receipts in `care_trust_adelaide_20260927/`.

`verify-saved.cjs` runs the real backend trail, exact-marker, vector and distance SQL against a read-only projection of saved Adelaide rows, using the actual secure-view predicates and saved entitlements. It also checks mismatched references and unlinked signals. It never activates Adelaide. The browser test is explicitly fixture-backed: it verifies navigation, retained state, source selection and a 390px layout, not database execution.

Restore compatibility is checked against the captured live restore implementation: story-bearing tables are copied with reference-based ID remapping, and profile-keyed evidence vectors persist. **A committed city-switch round trip, Adelaide's active native property graph, and Adelaide Select AI/native-agent generation still require a live check after activation.** A successful citation-reference check alone would not validate an AI interpretation.

Amsterdam was left active while this saved-profile work was performed. Detailed operational status is in the deployment and validation receipts; the screenshots are a preview, not evidence of an active city switch.
