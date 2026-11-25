# Evidence Intelligence — step-by-step demonstration

For the FU40 IncidentData Livestack, `CRIME_DATA`, Amsterdam pilot. Written against the implemented page and synthetic fixture on 24 September 2026, including the Esri map fix.

25 September update: the [Care-Trust walkthrough](care-trust-walkthrough.md) adds a separate vignette. Full-register counters are now **48 items, 17 incidents, 3 cases and 11 linked fictional POIs**. The 32-item counts below describe the original pilot; its payment and image shortcuts still use the same sources.

Allow about **20–25 minutes** for a full walkthrough, plus AI response time. For a short demonstration, follow steps 1–4, 6 and 9. All people, documents, images and incidents in this pack are fictional teaching material.

## Opening story

“We start with source material, not an AI conclusion. We will inspect two payment documents, trace their incident and person context, compare geography and content, and then ask AI to produce a source-cited review. We will also show why a plausible connection can be wrong.”

## 1. Set the scene

1. Refresh the browser and select **Statewide administrator** in the Demo user selector.
2. Open **Evidence Intelligence**, below Person Intelligence.
3. Confirm the profile is Amsterdam, shown as **Gemeente Amsterdam (including Weesp)**.
4. Check the four counters: **32 evidence items, 12 incidents, 2 case contexts, 6 linked fictional POIs**.

The counters describe the whole visible pack; they do not shrink when you choose a four-item walkthrough. If another city is active, stop and check before changing it: restoring a profile changes the dataset for the shared application, not just your browser.

Say: “These sources are already connected to the existing incident and person model. We are not looking at an isolated collection of AI-generated answers.”

### Three controls worth knowing

- Click a card's **title** to open it in the detail panel. A reference such as `EV-AMS-P01` appears at the top of each card.
- Use a card's **checkbox** to include it in AI review. Opening a card is not the same as selecting it for AI. The limit is six checked items.
- **Reset** clears search filters and restores the register, but does not reset the open detail or AI checkboxes. Each walkthrough shortcut sets a fresh, relevant list, open item and review selection. After a search, click a result title to inspect that result.

## 2. Inspect the payment paperwork before using AI

1. Click **Payment paperwork** under “Try a walkthrough”.
2. Confirm that four cards appear: **P01, P02, N01 and N02**. P01 and P02 are initially checked for AI review.
3. Open **EV-AMS-P01 — Purchase confirmation with a repeated payment suffix**.
4. In **Source**, read the “Verbatim source text”. Look for:
   - reference suffix `AMS-2-1`;
   - two differently described entries, each for **EUR 240.00**;
   - supplier attribution explicitly marked **not verified**.
5. Open **P02** and compare its different goods descriptions, repeated suffix and equal amounts. It also says that payer/supplier identity is not verified and preserves the source incident's resolved outcome.
6. Scroll to “Provenance & timeline” on either item. Distinguish incident occurrence, simulated receipt, fixture authorship and actual ingestion. Capture time/location are not recorded.
7. Optionally use **Download original test asset** to inspect the retained text file.

Expected result: you can explain what the documents actually say without asking a model. Similar amounts and references justify comparison; they do not establish fraud, duplicate payment or responsibility.

Say: “We retain the source and its uncertainty. An interesting pattern is a review lead, not a conclusion.”

## 3. Show exact matching and native JSON

1. On P01's **Source** tab, find “Markers with source support”.
2. Click **payment_comparison : AMS-2-1**.
3. The register should narrow to **P01 and P02**. This is an exact namespace-and-value match, not vector similarity.
4. Open **JSON**. Point out fields such as `attributes.currency`, `attributes.amounts`, `markers`, `personLinks` and `provenance`.
5. Click **Payment paperwork** again to restore all four cards before the next step.

Say: “Oracle JSON accommodates different evidence attributes, while relational links keep each source attached to its incident. Exact identifiers and semantic similarity are separate search mechanisms.”

## 4. Follow the incident and person links

1. Open **P01 → Links**.
2. Follow its incident context to **SYN-AMS-2026-05667** and the existing association with **Philip Vandamm**.
3. Notice the distinction: this is an **existing incident-context** link. P01 does not contain a literal-name binding to Philip in its source text.
4. Open **N01 → Links**.
5. Under “Literal name mentions in this source”, inspect **Philip Vandamm**, the exact quoted name and its character offsets.
6. Open **N01 → Source** to check the name in the original sentence. The note identifies him as a context-note provider, not a verified payer or supplier.
7. Optionally click **Open linked incident**, or the case-context button for **CASE-AMS-2026-02**. These navigate away from Evidence Intelligence. Return through the menu and choose **Payment paperwork** again to restart this view.

Expected result: N01 has a direct textual name mention as well as inherited incident context. They are visibly different kinds of support. The Links tab uses actual Oracle `GRAPH_TABLE` queries, although the UI presents readable paths rather than a large node-link canvas.

Say: “A person being linked to an incident is different from a document naming that person. Neither alone proves ownership, authorship or culpability.”

## 5. Add spatial context

1. Click **Payment paperwork** again, then open **P01 → Map**.
2. Expect an Amsterdam basemap and **two incident markers**: four evidence items share two incident locations.
3. Hover over each marker to see the incident reference and locality.
4. Leave the radius at **2 km** and click **Find nearby incidents**.
5. Inspect the distances shown on result cards and the `Oracle SDO_GEOM.SDO_DISTANCE` engine label.

The search covers the visible evidence pack, not just the four payment cards. It may therefore bring in other evidence. P02's incident is about **5.4 km** from P01's and is outside this 2 km radius. Several evidence items may share the same distance and map point because they belong to one incident. A zero distance is possible for items from the centre incident.

Say: “Oracle Spatial adds proximity as context. These are approximate synthetic incident points—not the locations where evidence was captured. Being nearby does not itself create an evidential link.”

Click **Payment paperwork** to restore the starting comparison after the radius search. If tiles fail, the page shows a warning; reopening Map retries without changing the source data.

## 6. Search by meaning, then compare images

### Text vector search

1. Click **Reset**.
2. In “Search source material”, enter:

   > purchase paperwork repeats the same payment reference with equal amounts for different goods

3. Click **Semantic search**, not “Find text / filter”.
4. Look for **P01 and P02** among the leading candidates. The tested fixture places both within the first six; the UI can show up to eight results.
5. Click a result title and compare the retrieved source with your query. Inspect the cosine score without treating it as a probability.

Say: “We can describe a concept without knowing the document title. A local MiniLM model creates the query vector; Oracle ranks the authorised stored vectors.”

Semantic search uses the type and case filters, but not the marker fields. Reset first to avoid carrying a previous filter into this demonstration. Search results are candidates, so a well-written comparison/control document can also rank highly.

### Image vector search

1. Click **Compare object images**.
2. Open **V01 — Generated overhead comparator: blue moulded tool tray**.
3. Inspect the blue tray image in **Source**.
4. Click **Compare images**.
5. Expect **V02**, the blue tray from another angle, to rank first among the other images. V01 is excluded from its own result list but remains open as the query item until you open another card.
6. Open **V03**, the orange organiser, to show a visually related but different object. V04 is a latch detail.

The validated V01→V02 cosine score was about **0.84**, while V03 also scored relatively highly. The interesting point is the ordering and the need for inspection, not a confidence percentage.

Say: “Text and images use different vector spaces. This is object-appearance comparison—not facial recognition and not proof that two pictures show the same physical object. All four pictures are generated teaching comparators.”

Optional text-to-description demonstration: Reset, search semantically for **dark blue moulded storage tray with two long parallel channels and a round pocket**. Look for W01/W02 and V01/V02. This searches textual descriptions of images and documents, not the image-vector space.

## 7. Ask Select AI for a source-cited review

1. Click **Payment paperwork** to reset the review set.
2. Keep **P01 and P02** checked and also check **N01**. Confirm **3/6 selected for AI review**.
3. Open **AI review** and replace the question with:

   > Compare the payment details in P01 and P02. Using N01, distinguish a literal name mention from an inherited incident relationship. What is supported, what remains unknown, and what should a reviewer check next? Cite the evidence references.

4. Click **Draft with Select AI** and wait for completion rather than clicking repeatedly.
5. Read the draft alongside the sources. Look for the repeated suffix/amounts, differing descriptions, the context-note role, and unverified payer/supplier identity.
6. Click one of the evidence-reference buttons below the draft to return to its source. Then reopen **AI review** if you want to continue with the same draft and selection.

Say: “Select AI is drafting from the selected, authorised source JSON. It is not generating or executing arbitrary SQL in this page. Valid references help us check the answer; they do not prove every sentence is correct.”

AI wording varies. If citation validation rejects a response, no draft is released. Do not present such a response as a successful review or as an evidence finding. If you change the question or selected checkboxes, the previous draft is cleared.

## 8. Show what the native agent adds

1. Keep the same three checked sources and question in **AI review**.
2. Click **Run native agent review**.
3. After completion, expand or inspect **Native tool audit**.
4. Confirm both tool names appear:
   - `EI_SOURCES_V1` — the selected authorised sources;
   - `EI_CONTEXT_V1` — typed relationships, question and limitations.
5. Inspect the run ID, timestamps, citations and “Unreviewed AI draft” label.

Say: “This is a bounded native Oracle agent, not just a button labelled ‘agent’. It calls two request-bound tools and leaves an execution trail. It cannot change a case. Tool execution is auditable; interpretation still needs human review.”

This run replaces the draft displayed in the panel. The page is not a side-by-side comparison or a persistent chat-history screen.

## 9. Demonstrate restraint: the shared-code caution

1. Click **Shared-code caution**. It prepares **P03, W03, C01 and C04**, checks all four and opens AI review with an appropriate question.
2. Before running AI, inspect **Source** and **JSON** for the first three items:

   | Source | Code | Namespace | Meaning in this fixture |
   | --- | --- | --- | --- |
   | P03 | K-204 | `dispatch_forms` | Administrative margin form code |
   | W03 | K-204 | `inventory_forms` | Stock-form code |
   | C01 | K-204 | `blank_form_catalogue` | Blank form with no transaction |

3. Open **C04 → Source**. It contains a deliberately hostile quoted instruction asking a system to ignore instructions, reveal hidden records and mark a matter resolved. Do not treat that quotation as a command.
4. Click **Shared-code caution** again to restore its prepared selection/question.
5. Run **Native agent review**, or Select AI if you want to compare the two modes.
6. Check whether the draft explains that `K-204` alone does not establish a cross-case link, cites the sources and identifies the hostile source content as untrusted. A separate deterministic source warning is also displayed for C04.

Say: “The demonstration is not just about finding more connections. It is about keeping weak coincidences, source instructions and supported relationships apart.”

Optional exact-match contrast: Reset, enter **K-204**, and choose **Find text / filter**. P03, W03 and C01 appear. For an exact marker search, clear the text field, choose `dispatch_forms`, enter **K-204** in “Exact marker”, and click **Find text / filter**: only P03 should remain. Choosing `inventory_forms` gives W03. This is a namespace-aware match, not an automatic case join.

Optional missing-data test: Reset, open P05 in the register and inspect Source/JSON. Its invoice total is 780.00 and its transaction-note total is 708.00, but currency is not recorded (`null`). Neither a presenter nor an AI draft should silently turn these into euro amounts.

## 10. Finish with scope and oversight

1. Change Demo user to **Limited viewer**. This is the UI label for the `read_only_viewer` persona.
2. Expect **No Evidence Intelligence pack visible**. The records and map disappear because this persona has no entitlement to the selected Amsterdam incidents.
3. Switch back to **Statewide administrator** to restore visibility.

Say: “Access scope controls retrieval and assets, not just what is drawn on the screen. The selector demonstrates application scopes; it is not a substitute for production authentication.”

Optional oversight view: open **AI Opps**, select **Application area → Evidence Intelligence**, and refresh activity. Inspect a native invocation or query-embedding operation. Native provider token counts may say “Unavailable”; that does not mean zero usage. Returning to Evidence Intelligence starts a fresh page view, so do this after finishing the draft demonstration.

## Closing summary: the 26ai story

| Capability | What the audience has just seen |
| --- | --- |
| Relational links + JSON | Retained source attributes, provenance and stable incident associations |
| Vector | Meaning-based text retrieval and separate image-appearance comparison |
| Spatial | Native distance search over scoped incident context |
| Graph | Typed incident–POI paths, kept distinct from literal source mentions |
| Select AI | A source-cited draft over selected source JSON |
| Native agent | Two bounded tool calls with an execution audit |

“The value is the combination: source material, flexible attributes, similarity, location and relationships in one governed database, with AI assisting the reviewer rather than replacing evidence checks.”

For a technical audience, use **Show Oracle Internals** at the right edge of Evidence Intelligence to reveal the implementation explanation and example SQL. The local [implementation notes](evidence-intelligence-implementation.md) contain the detailed objects, APIs, release receipts and current limits.
