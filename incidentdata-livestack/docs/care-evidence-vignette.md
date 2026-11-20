# Care-Evidence Vignette — Who knew?

Story proposal v1 · 25 September 2026 · wholly fictional teaching material.

Watch Pattern starting point: **Residential Daytime Occupancy Test Burglary** (`RESIDENTIAL_OCCUPANCY_BURGLARY`).

Status: original story proposal, now followed by an Amsterdam implementation. The source-compatible first version uses the existing tool-case and parcel reports, not the proposed jewellery losses. See the [current browser walkthrough](care-trust-walkthrough.md) and [implementation notes](care-trust-implementation.md). The proposal below is retained as design context, not a statement that every proposed fact was loaded.

## The hook

> A resident receiving care reports a missing keepsake. A second resident reports a similar loss. Their care records name the same worker. Then a separate source raises a troubling question: did private information travel beyond the care team?

One question carries the story: **Who knew, and how did they know?**

The deeper hypothesis is possible exploitation of a trusted care relationship: a worker may have disclosed private client information to an outside contact who may be connected to the losses. The sources must support each part separately; shared employment does not establish collusion.

## Four discoveries

1. **A personal loss.** Start with one resident's missing locket, not a network diagram. Their account and a property note establish what was reported, not who took it.
2. **An echo elsewhere.** A second report concerns a missing pocket watch. Search retrieves the similar account; the reviewer compares the sources.
3. **A trusted connection.** Separate care records name the same worker. That is a legitimate explanation for contact with both residents, and a reason to clarify the records, not proof of involvement.
4. **The unexpected lead.** A proposed, redacted synthetic communication suggests that private client information reached someone outside the care team. Check its provenance, meaning and participant attribution before proposing a connection to the losses.

Finish with a human question: **What independent evidence would confirm or rule out an unauthorised disclosure connected to these losses?** There is no automatic guilty-person reveal.

## Use the four supplied incidents as inspiration

These are proposed story roles, not database fact cards or ready-to-load reports. Existing rows must be inspected before selecting compatible anchors; incompatible details must not be retrofitted.

| Proposed account | Story contribution | What it cannot establish alone |
| --- | --- | --- |
| Resident A: missing locket and a care rota | The opening loss and first recorded care connection | Who removed the item or whether care access was misused |
| Resident B: missing pocket watch and a care note naming the same worker | A second source worth comparing | A common offender or coordinated timing |
| Resident C: family concern and a record of entrusted property | A question about consent, authority and the meaning of “safekeeping” | Theft merely because a worker held property or assisted a client |
| Resident D: missing medals and a resident's reported fear | The human stakes and need for a sensitive review | Independent corroboration of another account or an established threat |

Show only A and B in the opening five-minute story. C and D are optional corroboration or counter-evidence, not four simultaneous starting points. Use Resident A–D, Worker A, Contact B and company label `DEMO-CARE-01` until explicitly fictional profiles are designed; do not attribute wrongdoing to a real provider.

## The missing evidence bridge

The supplied summaries connect care records and losses but do not yet establish an outward disclosure or identify an outside participant. A future fixture should include:

- Source-backed care assignments with distinct client and worker identifiers, so a common provider is not mistaken for the same employee.
- A redacted synthetic communication extract and source-authentication note, with a fictional client reference that can be checked against a care record. Do not expose usable schedules, access arrangements or private medical details.
- Separate, reviewable account-to-person attribution. A worker's name on a rota, a handset association or a shared contact is not proof that they authored a message.
- An independent source for any proposed link between Contact B and an incident; otherwise that relationship remains an explicit gap.
- A benign comparison showing an authorised care-related communication or entrusted-property arrangement. The system must retain innocent explanations.

Each proposed relationship needs a type, supporting source, provenance and uncertainty. Do not create an evidence-to-offender edge by inference. Do not imply the whole care company is implicated.

## Keep the first version focused

Retain missing keepsakes, care records, attributed resident/family accounts and the proposed disclosure lead. Defer the ATM withdrawals, medication loss and wider financial exploitation to a later story decision; they would add separate questions now.

Common gloves, a drink brand, handwriting resemblance, a phone-number suffix, lack of visible forced entry and geographical proximity are weak comparison clues, not identity findings. Preserve witness wording and uncertainty rather than rewriting statements as established events. A resident's need for care must not automatically discredit their account.

The watch title is a starting lens, not a finding. Validate daytime and occupancy-test relevance against actual source rows before attaching incidents to it. None of the supplied summaries alone establishes an occupancy-testing event. If compatible anchors do not exist, propose a small separate synthetic series rather than changing unrelated incidents or silently reclassifying the watch.

## Evidence Intelligence presentation

Let text search find the echo, Source and JSON explain each record, and typed graph relationships separate resident, worker, company and outside contact. Spatial context is optional and uses approximate areas only; never present a map as a list of vulnerable households or care schedules. No image-comparison detour is needed.

Select AI or the bounded native agent can close with:

> In three short bullets: what is documented, what remains an allegation or an uncertain link, and what independent check could confirm or disprove the proposed disclosure? Cite each source. Do not infer guilt from care employment, shared objects or proximity.

Keep any presenter answer key separate from searchable evidence. An intended plot must not become an uncited fact in an AI answer.

## Before any data loading

Read compatible incident fact cards and preserve their category, time band, locality and status; decide which details require new records. Author a versioned synthetic fixture with explicit provenance, scoped access and evidence bindings. Validate narratives, chronology, scope, retrieval and the benign control before loading. No raw care rosters, operational entry details, real identifiers or precise residences belong in the demonstration.

This original brief did not itself create database rows or application controls. The separately documented Amsterdam implementation adds scoped evidence and documentary contacts; the remaining proposals here are not implied findings or loaded facts.
