# Data Room — Section G: Crime Expert Assistant

Section G is a private-by-default analyst workspace layered over an existing Data Room batch. It does not change the seven-stage batch pipeline or Stage 7 data-product exports.

## What it provides

- A private theory register: theory, supporting source references, test plan, counterevidence, review status and rationale.
- A private investigation-board starting view that separates hypotheses from source references.
- Private narrative and learning notes.
- A cited Select AI chat which receives only the current Batch Brief, its source manifest and the selected private theory. It treats uploaded material as untrusted data, not instructions.
- A **Generate detective first cut** action. It uses the dedicated `CDR_CRIME_DETECTIVE_V1` Google Gemini 2.5 Flash profile to propose one cautious, source-cited hunch. The draft is editable and must be copied into a private theory before it can be considered or reviewed.

The assistant labels its output as an unreviewed draft. It must distinguish evidence, possible patterns, counterevidence and gaps. It does not identify people from images, infer guilt, predict crime or recommend operational action.

## Privacy and scope

The tables and `SECURE_CDR_EXPERT_*_V` views restrict theories, notes and assistant runs to the owner demo-user and to batches visible through the existing Data Room scope. These private records are removed with their Data Room batch. They do not modify source files, Batch Assistant conversations, messages, money flows, the connections graph, incident data or POI data.

## Deploy

Run the additive migration once in the existing application environment before publishing the backend:

```sh
node scripts/setup_data_room_expert.js
```

In addition to the private tables, the repeatable migration creates the dedicated Gemini profile from the existing Select AI provider credential. It does not alter the existing Batch Assistant or connection-review profile.

Then publish the backend and frontend build using the project’s normal deployment workflow. The migration is repeatable and creates only `cdr_expert_*` tables, indexes and scoped views.

## Use

Select a batch, complete a current Batch Brief, then open Section G. Draft theories and notes can be stored first; the assistant becomes available when the brief is current. Enter only manifest references such as `S01 S03` as theory evidence. Assistant citations are source references, not proof that a theory is supported.
