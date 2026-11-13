# Data Room — Identify/Describe

Historical stage-four guide. For the deployed seven-stage workspace, vectors, connection graph, native ADB review and saved chat, see [the current workspace guide](crime-data-room-workspace.md).

## Demo sequence

1. Open **Data Room** and select an inventory-ready batch from history (or load a new synthetic ZIP).
2. In **C. Content Headlines**, select **Run Identify/Describe**. This explicitly sends the selected batch's content to the configured OCI Generative AI models. No historic batches are automatically submitted.
3. Watch per-run item counts and the fourth pipeline stage. The first three ingestion stages do not rerun.
4. Open an item's **Details** to see its draft headline, longer description, extracted details, source references, limitations and model provenance. The original file and inventory headline are retained separately.
5. For text, each extracted detail includes a verified exact quote and its zero-based, end-exclusive UTF-16 offsets. This verifies that the quote exists, **not** that the model's interpretation is correct. Headlines/descriptions are AI summaries, not independently verified facts.
6. For photos, details identify approximate visual locations. These are unverified observations—not recognised identities or POI links. Receipt text is best-effort visual transcription, not validated OCR.
7. If a response fails format, source-reference or service checks, its inventory headline remains available and the failure is shown. **Retry unfinished descriptions** starts a new run for missing/failed items only, preserving completed descriptions. Prior attempts remain available in item details.

Sample already described: `DR-20260912-38be78f8-7a8c-448a`, visible to the statewide administrator. It has eight descriptions: six text/record items and two staged scene photos. Its first run had six successes and two rejected CSV responses; a targeted retry completed the other two without replacing those six successes or changing source checksums. Historical prompt version v1 appears on the first six results; the tighter CSV quoting prompt is v2 on the retry.

## Models and boundaries

- Text: `CDR_TEXT_MODEL`, falling back to the app's `OCI_GENAI_MODEL` (currently `meta.llama-3.3-70b-instruct`).
- Images: `CDR_IMAGE_MODEL`, default `meta.llama-4-maverick-17b-128e-instruct-fp8`.
- Region: existing `OCI_GENAI_REGION` (currently `us-chicago-1`). Credentials and compartment are the existing OCI app configuration. Other pages' model settings are unchanged.
- Oracle documents image input and Chicago on-demand support for [Llama 4 Maverick](https://docs.oracle.com/en-us/iaas/Content/generative-ai/meta-llama-4-maverick.htm).
- Text: first 24,000 characters per item, read from the original ADB BLOB, not the shorter UI preview. Coverage and truncation are explicit in each result. This is bounded inventory summarisation, not exhaustive extraction of large CSV files.
- Images: original PNG/JPEG bytes, up to 5 MiB for this stage. Larger images remain stored but get an explicit description-limit failure. No image conversion or modification is performed.
- One item per model request, temperature zero, maximum 1,800 output tokens, 60-second abort deadline, one SDK request attempt. Invalid/unsupported outputs are rejected, not silently converted into invented descriptions.
- Uploaded content is untrusted input. The model has no tools, browsing, SQL execution, other batch items or POI catalogue. Instructions embedded in content are not instructions to the worker. All outputs render as escaped text.

This is an ADB-persisted, Node-orchestrated OCI inference stage, **not native ADB agent-team execution**. Learn-what-is-there, connections, embeddings, graphs and saved Select AI batch chat are still not enabled. Production authentication, real evidence handling and automatic person identification remain out of scope.

## Persistence, scope and retries

Additive tables:

- `CDR_AI_RUNS`: requested-by, pinned text/image models, region/prompt version, counters, times, status and recovery lease.
- `CDR_AI_RESULTS`: per-item attempt, source SHA-256, draft JSON/headline or error, model, prompt version, OCI request ID and timestamp. Original item BLOBs and inventory metadata are unchanged.
- `SECURE_CDR_AI_RUNS_V` / `SECURE_CDR_AI_RESULTS_V`: scoped through the existing secure batch/item views; results additionally require the current source hash to match.

A unique conditional index permits one active run per batch. Repeated active-run requests return the same run. A fully complete stage rejects another run; retrying a failed finalisation with all item results already committed performs a zero-item finalisation without new inference.

The worker polls every 2.5 seconds and uses a 120-second token lease. It checks the requesting user's scope before each source read/persisted step. On recovery it skips results already committed by that run. A cloud response lost before persistence may need another inference call (at-least-once execution); three interrupted recoveries exhaust the automatic limit and require an explicit retry. A queued run whose prompt version differs from the deployed code stops and requires a new retry, preventing incorrect prompt attribution. Explicit retry preserves all completed items. Current item details show the latest 20 attempts; all stored attempts remain in ADB.

## Deployment and checks

Apply migrations in order using the existing Oracle environment, before starting the updated server:

```sh
node scripts/setup_data_room.js
node scripts/setup_data_room_descriptions.js
```

Both are additive/repeatable. The second makes stage four available on old batches but does not enqueue any inference. Both scripts are included in `Containerfile`; rebuild from this workspace for future container recreation.

```sh
node test/data-room-ai.test.js
node test/data-room-description-queue.test.js
npm test
npm run build
```

The live test below explicitly invokes OCI inference on the named existing synthetic sample if it is not already fully described. It verifies source hashes, exact text quotes, model/request provenance, scope isolation, active-run deduplication and preservation of successes during retry:

```sh
node scripts/test_data_room_descriptions_live.js --run-synthetic-tests --batch=DR-20260912-38be78f8-7a8c-448a
```

Pre-upgrade running-app backend module and UI index backup: `/tmp/crimedata-describe-backup.LY4A9f`. Original archive/content data was not removed or overwritten.

## MP3/M4A transcription in Stage 4

After inventory is ready, choose **Run Identify/Describe**. MP3/M4A items use the configured OCI audio model to transcribe the original audio, then the text model describes the saved transcript. Open the MP3’s **Details** to read the full transcript or choose **Download transcript TXT**. The original MP3 remains downloadable.

The transcript records its source-audio checksum, text checksum, provider model, region, prompt version and request ID. It is unreviewed machine output: check names, numbers, speaker labels and unclear speech against the recording. Quotes and character offsets in its description refer to the transcript, not a verified recording. Full transcripts are saved, while descriptions analyse a bounded excerpt of up to 24,000 characters. Provider output limits can reject longer recordings rather than silently accepting truncated output.

The Batch Brief and subsequent Data Room analysis use the transcript-derived description. Connections also use the matching saved transcript and label literal references from machine output. A transcript is committed before its description; retrying a failed summary reuses that transcript when its checksum and source audio still match. Scope follows the existing batch owner/persona checks. MP4 remains storage and download only.

Audio input uses the existing [OCI AudioUrl API](https://docs.oracle.com/en-us/iaas/tools/typescript/latest/modules/_generativeaiinference_lib_model_audio_url_.audiourl.html). `CDR_AUDIO_MODEL` defaults to `google.gemini-2.5-flash`.

Speaker-turn transcripts also appear as audio conversations in Batch Explorer → Messages after rebuilding the message snapshot. **Create audio dialogue** upgrades an older paragraph-only transcript. Neutral speaker labels are derived from voices and remain unreviewed; they do not establish the speakers’ identities. Older transcript downloads and saved description versions remain readable.

M4A recordings use the same Stage 4 transcript, source-checksum and speaker-turn workflow as MP3, with `audio/m4a` input. The original container bytes are retained; no filename-only conversion takes place. [Gemini audio format documentation](https://ai.google.dev/gemini-api/docs/audio?hl=en) lists this input format. Both formats appear as audio conversations after rebuilding Messages. Existing upload and output limits apply.
