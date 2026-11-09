# Payment-Evidence Vignette

Story brief v1 · 25 September 2026 · fictional teaching material.

Watch Pattern: **Payment-Document Anomaly Chain**. Amsterdam case context: `CASE-AMS-2026-02`.

Status: codifies the agreed story using the existing v1 evidence fixture. This brief does not change the live UI, watch definitions, incident outcomes or database.

## The hook

> A purchase confirmation repeats a payment-reference suffix. Another document carries the same suffix, but describes different goods. Is there an ordinary explanation, or something worth following?

One question carries the demonstration: **Why does this reference appear in both?**

## Four discoveries

1. **Something odd.** Read `EV-AMS-P01`: two differently described entries, each EUR 240.00, and reference suffix `AMS-2-1`.
2. **Another occurrence.** Compare `EV-AMS-P02`: the same suffix and amounts appear with different goods descriptions. A suffix is not a unique transaction identifier.
3. **Someone who may clarify it.** Read `EV-AMS-N01` and `EV-AMS-N02`. Philip Vandamm is named as a context-note provider, not a verified payer, supplier or signatory.
4. **A useful next question.** Ask which original source supplied the reference and how the differing descriptions arose. Do not jump from a comparison to a finding of fraud.

## Source anchors

| Existing evidence | Existing incident | Source boundary |
| --- | --- | --- |
| P01 and N01 | `SYN-AMS-2026-05667`, Buiksloterham-Noord | Supplier attribution is unverified; Philip's role is contextual. |
| P02 and N02 | `SYN-AMS-2026-03505`, Vondelparkbuurt-West | The source incident is resolved without a finding of responsibility; preserve that outcome. |

These are the full references `EV-AMS-P01`, `EV-AMS-N01`, `EV-AMS-P02` and `EV-AMS-N02`. The common marker is `payment_comparison:AMS-2-1`, not an established payment identity or money trail.

## Short browser rehearsal

Open Evidence Intelligence under Statewide administrator with Amsterdam active, then choose **Payment paperwork**. Read P01 and P02 in Source; inspect N01 and N02 in Source and Links. Check all four items, open AI review, and use:

> In three short bullets: what connects these documents, what remains unexplained, and which original record should we obtain next? Cite the evidence references. Preserve the resolved incident outcome and do not assume fraud or a verified payer or supplier.

Choose **Draft with Select AI**. Treat the output as an unreviewed draft and check its claims against the sources. See the [full walkthrough](evidence-intelligence-walkthrough.md) for exact controls and optional capabilities.

## Future additions, not yet authored or loaded

An original invoice, provenance note or supplier clarification could explain one discrepancy while leaving another question open. Any addition must preserve source facts and incident status. Do not invent an established payment flow or connect this story to the tool-case or care-linked stories without new supporting evidence.

Keep the audience on one payment thread, revealed a document at a time. JSON, vector search, graph, spatial context and AI support the story; they are not separate required chapters.
