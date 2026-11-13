# Data Room model comparison and deployment

13 September 2026. Scoped to the fictional Scene2.zip batch `DR-20260913-e8c04a3b-ea5f-4fb2` on FU40, port 8706, OCI `us-chicago-1`.

## Deployed decision

| Job | Model |
| --- | --- |
| Identify/Describe: text and images | `google.gemini-2.5-flash` |
| Stage 5: source-linked Batch Brief | `xai.grok-4.6` |
| POI visual/narrative embeddings | Unchanged |

Versioned image: `local/adelaide-crime-intelligence:cdr-models-20260913`. Previous image retained: `local/adelaide-crime-intelligence:poi-dual-ui-20260913`. Global `OCI_GENAI_MODEL`, ZIP ingestion, POI search, graph connections and data-product stages were not changed.

## Evaluation

All 11 stored originals (9 PNG, 1 JSON, 1 TXT) were hash-checked and submitted to each contender. The evaluation used SELECT-only database access and wrote separate, versioned artifacts; it did not replace batch descriptions. All three brief contenders received the exact same saved-description snapshot, assembled from the Gemini evaluation results. These were inference calls through this tenancy's OCI endpoint, not estimates from model documentation.

| Description contender | Passed local validation | First-attempt passes | Elapsed total | Provider-reported total tokens |
| --- | ---: | ---: | ---: | ---: |
| Llama 3.3 text / Llama 4 Maverick images, with corrected-limit retests | 10/11 | 9/11 | 66.1 s | 36,073 |
| Gemini 2.5 Flash | 11/11 | 11/11 | 76.2 s | 30,083 |
| Grok 4.6 | 11/11 | 11/11 | 163.2 s | 32,463 |

Llama initially passed 9/11. An evaluator defect increased retry maxTokens to 8192, which these OCI Meta endpoints reject above 4096. The two affected descriptions and Llama brief were retested with both attempts capped at 4096. One description recovered on its retry; scene 9 still failed JSON parsing twice. The table substitutes those two corrected retests, rather than counting the rejected-parameter calls as model failures. Original artifacts remain available. This is a small, single-batch comparison, not a statistically robust benchmark.

| Brief contender, identical input | Outcome | Elapsed |
| --- | --- | ---: |
| Llama 3.3, corrected-limit retest | Failed citation validation twice | 30.2 s |
| Gemini 2.5 Flash | Failed citation validation twice | 40.9 s |
| Grok 4.6 | Passed on first attempt | 22.3 s |

The citation validator rejects empty lists, more than eight citations per entry, and IDs outside the supplied manifest with the same error. These failures therefore do **not** establish that the model invented source IDs specifically. Validation was not weakened to accept the output.

Grok's saved brief distinguishes allegations in the narrative text from observations in image descriptions and frames gaps as review questions. It still requires analyst review. References are validated for membership, not whether they substantiate every statement.

Token counts include reported reasoning usage where the provider includes it in totalTokens. Tokenization and billing differ by provider. The table excludes initial probes, discarded evaluator-defect attempts, brief calls and the final live retry. It is **not an invoice or dollar-cost comparison**; no verified OCI tariff was applied. Gemini averaged 6.9 seconds per description versus Grok's 14.8 seconds in this run.

## Quality limits

Spot-checks against the original scene 1 (market) and scene 9 (phone beside parking garage) support the main scene descriptions, but not perfect detail accuracy. For example, Grok generalized the two market subjects' gaze directions; Gemini described scene 9 as chest-up despite more torso being visible. Another Gemini output mentioned OCR text `444` in a limitation although the application had not supplied OCR text. These are reasons to retain unverified-draft labels and human review, not evidence that structured JSON prevents hallucinations. No formal ground-truth accuracy score or exhaustive visual audit was performed.

Grok accepted both image input and strict JSON_SCHEMA in live probes and all nine evaluated image calls. This documents observed endpoint behaviour only, not universal regional availability or contractual capability. Routine images remain on Gemini based on this batch's comparable completion and faster responses.

## Reliability changes

- Strict JSON_SCHEMA requests for the evaluated Gemini/Grok families; Meta retains prompt JSON plus existing local validators.
- Existing exact-source-quote, source-membership, output length and field checks remain enforced.
- One bounded retry for malformed, truncated or locally invalid output; no automatic retry for HTTP/access/parameter/network failures.
- Shared 95-second deadline below the worker's 120-second lease; per-request SDK retries disabled.
- 4096 initial output tokens; at most 8192 on retry for Gemini/Grok, 4096 for Meta.
- Stored attempt diagnostics: finish reason, token usage, timing, request ID, output hash and validation error. Failed output is not shown as a successful draft. Raw rejected model responses are not saved.
- Description and brief UI expose generation diagnostics. Prompt/protocol versions are `cdr-identify-v3` and `cdr-learn-v2`.

## Live verification and retained data

No ingestion or AI jobs were active before deployment. Model configuration was verified inside the recreated container. The normal retry endpoint requested exactly one unfinished item, scene 9, and succeeded using Gemini Flash (`7b9c2ef6-8079-4c41-9d61-a480bc2f9eae`). Scene2.zip now has **11/11 completed descriptions**. Its ten existing Llama descriptions and historical failures remain untouched; this batch intentionally has mixed model provenance. New descriptions use Gemini.

All 11 original source hashes still match the pre-comparison manifest. The archive hash remains `25da3021f534aaece566bd4ae8ac6a94835473f5f7a9c27c94b8c1f09b6840e2`. Stage 5 was left pending so the user can test **Run batch learning**; its configured model is Grok. No connections or products were generated as part of this change.

Local automated tests: all nine test files pass, including retry limits, source checks and failed-brief diagnostic persistence. Frontend production build passes (existing bundle-size warning).

Read-only live browser smoke test also passes: the new Gemini description, expanded generation diagnostics and previous-attempt history render without browser errors. Test: `scripts/test_data_room_models_browser.cjs`, using the existing Playwright installation via `NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules`. Screenshot: `/home/opc/scratch/crime-data-model-evaluation/live-description-diagnostics.png`.

Artifacts: `/home/opc/scratch/crime-data-model-evaluation/model-comparison-20260913/` (46 versioned JSON files, including manifest, per-model descriptions, common brief input, briefs, probes and retests). `summary.json` records the original comparison, before corrected Meta retests; use the retest files and the qualified table above for the corrected outcome.

Reproduction: `scripts/evaluate_data_room_models.js --run-comparison` runs only with an explicit flag in a CRIME_DATA container environment. `--probe` limits it to the four initial probes; `--retest-meta-cap` retests failed Meta artifacts separately. Existing artifact names are reused without new inference or overwrite. Use a fresh versioned output directory for an independent repeat.

Deployment helper accepts explicit `CDR_TEXT_MODEL`, `CDR_IMAGE_MODEL`, and `CDR_LEARNING_MODEL` overrides while preserving unrelated running settings. Rollback requires selecting the prior compose image and explicitly restoring the old description models; existing saved records must not be deleted. Older saved briefs are retained, but the new learning prompt version can mark them stale for current-source navigation.
