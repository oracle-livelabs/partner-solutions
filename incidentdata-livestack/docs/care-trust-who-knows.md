# The Care-Trust: Who knows?

Amsterdam · FU40 · synthetic teaching story · knowledge set `KS-CARE-TRUST-001`, version 2.

Status, 26 September: the desktop journey, mobile-header correction and additive database records are live on FU40 port 8706. The complete live walkthrough, map tiles and restricted-access checks passed. Refresh the browser to load the latest interface; Amsterdam remains active.

**Something is missing. Someone depends on help. Who knows their circumstances — and what did they have permission to do?**

## Walk it through

Refresh the browser and choose **Statewide administrator**. Amsterdam should be active.

1. Open **Crime Pattern Signals**. Select **Residential Daytime Occupancy Test Burglary**.
2. In **The Care-Trust: Who knows?**, read the first concern: someone wants to ask about missing belongings and privacy but worries about losing help. Click **Follow this lead**.
3. You are now at the original tool-case incident. Read **Why linked**: a separate private follow-up supplied the report reference; the public post did not identify the event. Click **Inspect … linked evidence sources**.
4. Use **1. A small concern**, then **2. Who knows?**. The register changes to just the documents needed for each question. Read the assignment, outward message, directory and provenance. Who had a recorded role is not necessarily who sent a message.
5. Click **3. Check permission**. The second resident permitted a limited transport enquiry. Does that explain the first resident's concern? The interface carries the original lead while showing a clearly labelled comparison question.
6. Optionally click **4. Follow the money question**. Read the spending concern, shopping permission, entry list and reconciliation. One apparent duplicate is explained; a different entry remains unresolved. No source identifies the payment helper or proves care-funding fraud.

For any question, open **AI review**. Its documents and question are preselected. Try **Draft with Select AI**, then **Run native agent review**. Check the draft against its cited sources; valid references are not a factuality guarantee.

Observed review caveat: one Select AI draft said the larger entry's settlement was unconfirmed by citing the earlier incomplete list, overlooking the later reconciliation which displays it as settled. It is the **refund completion** that remains unconfirmed. The same draft described the incident link as being “through” the case reference; the actual source relationship is the direct evidence-to-incident link, with the case as additional context. The native-agent sample preserved the important uncertainty but duplicated its answer and left some gap statements without inline citations. These are unreviewed drafts, not passed factual-quality assessments.

Finish with: **“What do we actually know, what has an ordinary explanation, and what source would clarify the remaining concern?”**

You do not need to remember any record IDs. **Back to watch pattern** preserves the watch. From Links, open a person or incident, then **Return to evidence review** to restore the source, comparison set, selected review items and tab. A generated draft is not retained across this return trip; rerun it if needed.

## What changed

- Visible, source-supported Watch → signal/incident → evidence hand-offs, with exact linked-incident retrieval rather than broad text matching.
- Six additional evidence sources H17–H22, three public posts and two reviewed comparison links in both live and saved Amsterdam. Total Evidence Intelligence register: **54 sources**; Care-Trust: **22 sources**. The watch retains **six incidents** and now has **11 public posts**.
- The third new public post asks about a care invoice. It has **no incident/evidence link**; it is not a hidden proof of a care-fraud network.
- Original incident narratives, resolved outcomes, existing POI roles, all earlier evidence and access entitlements are preserved. No new person or incident was invented in this extension.
- Reusable skill: `$care-trust-who-knows`, with a maintained source under `skills/care-trust-who-knows` and a local installed copy.

## Capability demonstrations

JSON and relational joins preserve typed permission/source details and explicit review edges. Vector comparison of the entry list retrieves its qualifying reconciliation; other semantically similar payment documents are not thereby connected to this case. Native property-graph Links retain the distinction between incident context and literal person mentions. Map shows approximate incident context, never a care schedule or residence. Select AI and the native agent draft source-cited, read-only reviews.

The v2 extension adds no geolocation or image data. Existing map and generated-image comparison features remain available. A money-source graph can inherit Lena Harper through the incident; this does **not** identify her as the financial helper. Financial sources contain no literal name bindings.

## Authenticity and limits

The fictional dependency, limited-permission and financial-oversight details draw on [Amsterdam's financial safety guidance](https://www.amsterdam.nl/ouderen-financieel-veilig/). Personal financial abuse is kept distinct from care-funding fraud; the [IGJ/IKZ report](https://www.igj.nl/documenten/2023/07/27/signalen-fraude-in-de-zorg-2022) itself distinguishes fraud suspicions from established fraud. No real victim, provider, offender or unverified prevalence statistic was transplanted into the data.

The skill-creator guidance shaped the reusable workflow and acceptance contract. The incident-description quality guidance kept original reports intact and made new concerns explicitly attributed supplements.

Implementation: `backend/investigation-trail.js`, `backend/care-trust-story.json`, `frontend/src/InvestigationTrail.jsx`, `scripts/care-trust-v2`. Verification and release receipts are under `care_trust_v2_20260925`. Data scripts reject conflicting existing rows and default to rollback. Release scripts are tied to their captured base image; do not blindly replay a completed release.

Final verification, 26 September: 32 test files pass; the guarded staged/committed/idempotence runs passed 14 database assertions; the corrected local preview passed 27 browser checks, including both native AI modes. The final live release passed 24 end-to-end browser checks and 26 further map/access checks, including all four restricted personas, mismatched references and the deliberately unlinked post. Seven native HTTP checks confirmed source hashes, graph context, Spatial distances, JSON markers, text/image vector ranking and the active profile. New live/saved rows and vectors were exported for recovery; protected original-record fingerprints still match.

The [Care-Trust continuity skill](../skills/care-trust-who-knows/SKILL.md) guided the exact-link, return-navigation and access-boundary acceptance tests. This final deployment changed frontend assets only; backend files, database records, entitlements and container settings stayed unchanged. Both AI modes were already exercised against FU40 in the corrected preview; they were not rerun for the frontend-only release, and the factual/presentation qualifications above remain recorded. The temporary preview process is stopped.
