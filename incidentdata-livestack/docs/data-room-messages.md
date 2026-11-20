# Data Room — Messages & Conversations

First release: 14 September 2026, FU40 (port **8706**). Synthetic, non-operational demo.

## Scene2b_Drug conversation JSON — 8 October update

Parser `cdr-messages-v4` recognises `conversations[]` JSON exports containing separately titled conversations, each with a `messages[]` array and message `body` fields. Capability discovery (`cdr-capabilities-v5`) checks this nested structure in Oracle JSON. Source conversation IDs, timestamps with explicit offsets, message IDs, source order and JSON Pointers are retained. Previous v1–v3 snapshots remain readable; the version change makes an older analysis eligible for a fresh build.

The uploaded **Scene2b_Drug.zip** batch (`DR-20261008-16a5c780-38ff-470c`) has been built: **3 conversations, 12 messages, 5 source participants**. Its unrelated `narrative.txt` remains listed as skipped in Messages coverage without raising a tile warning. The release image for this update was `scene2b-messages-20261008b`.

## Brussels conference messages — 8 October update

Parser `cdr-messages-v5` reads the original `Brussels_Conference_Trail_Evidence_v1.zip` message sources directly. The group JSON declares participants as `person_id`/`display_name` objects and refers to speakers by `sender_id`; the importer validates those references and retains the original IDs, message bodies, timestamps and JSON Pointers. The SMS export has named participants, explicit offset timestamps and numbered speaker blocks; its reader retains exact source text offsets. Conversation membership is recorded without inferring individual recipients.

The uploaded Brussels batch (`DR-20261008-c0152548-6973-4a38`) has **2 conversations, 38 messages and 3 source participants**: 24 JSON group messages and 14 SMS messages. The unchanged original source hashes were checked before rebuilding. The FU40 app image is `brussels-messages-20261008`. Four existing v4 snapshots were rebuilt under v5 so their tiles remain current.

## messaging-space view

Choose **Message order → messaging-space** inside a conversation. This adds a read-only chat layout alongside the existing automatic and original-source-order views: coloured bubbles, left/right alignment, date separators and portrait/initial thumbnails beside each sender. **Right-side participant** selects which speaker appears on the right; other speakers stay left with their own colours. In group chats, sides do not imply individual recipients or relationships. The view choice persists when selecting another conversation. Message text, original sequence, search with surrounding context, pagination, source references and downloads remain unchanged.

Portraits are presentation-only **POI catalogue matches**, not verified identities. The view reads the existing batch-scoped `/poi-catalogue` endpoint and matches the whole speaker label or an explicitly source-declared `Full Name (handle)` against whole registered names/aliases (trimmed, NFC-normalised, case-insensitive). It does not use body mentions, partial/fuzzy names, inferred aliases or visual similarity. Multiple matching profiles or conflicting source-name declarations stay as initials. Only local `/poi/` raster assets are loaded; absent, loading or failed photos retain initials. A catalogue error does not block messages. Each matching portrait is labelled unverified, with its catalogue name/reference available in the label tooltip. This creates no identity assertions, graph links or POI records and requires no message rebuild or schema migration.

## Message-only ZIPs — 29 September update

Parser `cdr-messages-v3` recognises bracketed WhatsApp-style conversation logs, including Markdown-bold headers/speakers. Capability discovery (`cdr-capabilities-v4`) enables the Messages tile from file content; filenames, photos and AI descriptions are not prerequisites. Older v1/v2 snapshots remain readable and are marked stale until explicitly rebuilt.

For the existing **RedDirt_LargeTotal.zip** batch (`DR-20260929-94b1c772-d24d-4813`), refresh the app, open Data Room, select the batch and open **Messages**. Its 17 source files contain **160 messages, four source participants and 52 participant–conversation links**. None declares individual recipients, so there are no inferred direct-message links. For a newly uploaded batch, choose **Build messages** once after ingestion completes.

The workspace now starts with clickable participant cards using handle initials as avatars. When a conversation header explicitly records `Full Name (handle)`, the card can display that source-declared name with its handle. Conflicting source labels remain separate in the participant's detail panel; they never merge identities or create POIs. Select a participant, filter by recorded calendar month, search message text, and read the complete exchanges. Conversations are listed by recorded local date, with their source filename and date range. The optional network expands below the filters. Every message retains its original-source inspector and download link.

The new bracketed adapter accepts, for example:

```text
WhatsApp Conversation: Example One (one) and Example Two (two)
(Group: Private Chat - Started May 15, 2023)

[May 15, 2023, 8:45 PM]
one: Hello.

[May 15, 2023, 9:12 PM]
two: Thanks for the message.
```

The introductory lines are optional. Full/three-letter English months, optional seconds, CRLF, UTF-8 BOM, multiline bodies, `**[timestamp]**` and `**speaker:**` are supported. Dates and 12-hour clocks are validated. Recorded local dates support calendar filtering but do not establish UTC chronology; messages retain source order when offsets are unrecorded. Unsupported shapes remain under coverage. Malformed recognised conversations reject the whole build, without saving partial exchanges. Original source files and prior AI stages are not rewritten.

## Try SUGA

1. Refresh FU40, choose **Data Room** as `statewide_admin`, and open **Suga_Scene4.zip** (`DR-20260914-13f650e8-dfa8-450e`).
2. In section D, find **Choose what to explore** and open the **Messages** tile. The complete conversation workspace opens in a large panel. SUGA's message snapshot has already been built.
3. Select either conversation in the graph or list to open its complete exchange. Selecting Julian shows both threads; selecting Vivienne shows the second.
4. Search for **do not represent me as having agreed**. Open the second conversation if needed. Its 16 messages remain visible, with Vivienne's statement highlighted. **Next match** scrolls to it.
5. Expand a message's **Source** row to see its exact reference and original record. Use **Open source file details** or **Download original source**.
6. Switch between chronological and original source order. Chronological order is available only when every message has a usable timestamp with a known numeric UTC offset.
7. Close the workspace or press Escape to return to the same page position. Search, participant selection and the open conversation are retained for this selected batch/user until a reload. Source details open inside the workspace, with a Back button that restores the reader position.

The standalone workflow requires only completed ingestion, not AI descriptions, batch learning or Agent review. It does not alter Money Flows, POI/photo searches, the existing connection-review graph or Batch Assistant. These imported source conversations are never written to the analyst's `CDR_CHAT_THREADS`.

## Verified SUGA content

| Source | Conversation | Messages | Source participants |
| --- | --- | --- | --- |
| `first_convo.json` | `SUGA-CHAT-001`, SUGA concept discussion | 12 | Julian Cross, Tony Kapoor, George Horner |
| `2nd_Convo.txt` | `SUGA-CHAT-002` | 16 | Julian Cross, Vivienne Hartley |

Four distinct source-name nodes connect to two thread nodes through **five participation links**. Sender totals are Julian 14, Tony 3, George 3 and Vivienne 8. Neither SUGA source declares individual recipients, so **zero direct-message links are inferred**. Mentioning a person in a message body does not add that person as a thread participant.

The reader retains the complete exchange, including objections and qualifications. A graph connection means source participation, not agreement, guilt, an established business association, or a link to a particular money transfer.

## Parsing, timestamps and evidence

Supported adapters:

- **JSON:** one top-level `messages` array containing string `sender` and `text`; optional ISO `timestamp`, `message_id`, `recipient`/`recipients`, `reply_to`, and top-level `thread_id`, `title`, `participants`. A missing thread ID creates a clearly labelled provisional grouping by source file.
- **Conversation JSON:** a top-level `conversations` array; each entry has a non-empty `messages` array with string `sender` and `body`, and may declare `conversation_id`, `title` and `participants`. Message timestamps, IDs and explicit recipients follow the same validation rules. Each entry remains a separate thread even if source IDs repeat.
- **Referenced group JSON:** a top-level `messages` array with `sender_id`, `sent_at` and `text`, plus declared participant objects with `person_id` and `display_name`. Unknown sender IDs reject the build; group membership does not imply direct recipients.
- **SMS export TXT:** `SMS CONVERSATION EXPORT` header, explicit named participants with source IDs, and `[message ID | timestamp with offset] Sender` blocks followed by message bodies. Source blocks and message offsets are preserved.
- **Structured TXT:** `SYNTHETIC CONVERSATION`, then `Thread:`, `Participants:`, `Date:`, optional `Time zone:` and `HH:mm — Full Name:` speaker blocks. Supports the SUGA source and the same explicitly structured format. Multiline message bodies are retained; malformed timed headers reject the entire build. One thread per TXT file.
- **Bracketed chat TXT:** the format illustrated above, with an inline speaker after each bracketed date; one source conversation per file.
- **Dated speaker-block TXT:** date/time sections such as `05 Jul 2025 – 18:42`, followed by separate `handle:` speaker lines and multiline bodies. Optional `sender → recipient:` or `sender -> recipient:` records an explicit recipient. Section dates are retained without inventing individual message times.
- **CSV:** `sender_ref,recipient_ref,message,sent_at`, optional `message_id,thread_id,reply_to`. Without a declared thread ID, records are provisionally grouped by source file and exact participant pair. Explicit recipients generate separately typed directed graph edges; the main visual still shows thread participation, with a companion direct-record table.

Free-form narrative and other text/JSON/CSV shapes are listed under coverage, not interpreted by an LLM. Recognition is based on supported content structure, not a `Red_Dirt_*.txt` or other filename. Images are outside message parsing. There is no transcript summarisation, entity-resolution model or appearance matching in this feature.

Each record preserves its source item ID, original SHA-256, raw record, source order and locator:

- JSON: array position and JSON Pointer, including the body pointer.
- TXT: line numbers, exact body and block offsets into the UTF-8-decoded source, measured as UTF-16 code units with an exclusive end. Separator newlines between speaker blocks are excluded from the displayed body but retained in the raw block. CRLF, BOM and multiline content are tested.
- CSV: original data-record ordinal, excluding the header and blank records; quoted multiline values count as one record.

Source names/handles are matched exactly after trimming and NFC normalization, within one batch. No surname matching, alias inference or automatic POI linking is performed. Identical source thread IDs in different files remain separate threads. Duplicate source message IDs remain distinct records. A reply reference resolves only if its message ID is unique within that thread; unresolved or ambiguous references remain visible without an inferred reply link.

Original timestamp strings and source timezone headers are retained. Known offsets produce a separate UTC instant for ordering; equal instants retain source order. Timezone abbreviations alone do not assign an offset. Missing timestamps, offset-free local times and unknown `-00:00` offsets force source order. The application does not assign its server/browser timezone or invent per-message timing.

## Graph, persistence and scopes

Four additive tables:

- `CDR_MSG_RUNS`: parser version, source fingerprint, creator and immutable graph/coverage snapshot JSON.
- `CDR_MSG_NODES`: source participants and conversation threads.
- `CDR_MSG_RECORDS`: message text CLOB, source/order/timestamp metadata and original-record JSON.
- `CDR_MSG_LINKS`: typed participant→thread memberships and, only where recorded, sender→recipient message edges.

Four `SECURE_CDR_MSG_*_V` views enforce the existing demo-user batch scope. Native **`CDR_MSG_GRAPH_V1`** uses the scoped node/link views. The graph endpoint reads `GRAPH_TABLE` and reconciles returned endpoints, types and message counts with its saved snapshot. Composite foreign keys and run-scoped node keys prevent cross-snapshot edges; the record view also checks original source-item membership in the same batch.

The application visual is custom React/SVG. Source-message search uses literal, case-insensitive `INSTR` against scoped Oracle CLOBs, not SQL wildcards. `%` and `_` remain literal search characters. The reader returns 40 messages per page and a complete matching-position index; searching does not remove contextual messages. Highlight markup is bounded to 200 occurrences per message, retaining the remaining text. Missing/unrecognised source schemas are visible in coverage. Direct-record tables show the first 100 links, with all messages retained in the reader.

Limits: **2 MiB per text source, 8 MiB combined text inputs, 2,000 messages, 40 threads, 60 participants, 80 total graph nodes, 2,500 links and 32,000 bytes per message body**. Recognised malformed or oversized sources fail without a partial snapshot. Build and removal share the existing batch row lock; builds commit atomically and identical source/version fingerprints reuse the saved run. Batch removal deletes message links, records, nodes and runs before original source items. Existing operational tables are untouched.

API under `/api/data-room/batches/:id`:

- `POST /messages`: build/reuse; denied for `read_only_viewer`.
- `GET /messages?q=…`: native graph, thread/participant summaries and match counts.
- `GET /messages/threads/:threadId?runId=…&q=…&page=1&order=auto`: paginated source reader. `order` accepts `auto`, `source`, or `time` where all timestamps are usable. Run and thread IDs must belong to the selected visible batch.

## Deployment and verification

Apply `node scripts/setup_data_room_messages.js` in the target's existing application environment **before publishing the new backend**. This migration creates only the message objects and does not register or change an AI Agent. FU40 was verified with graph-over-view support on Oracle 26ai `23.26.3.3.0`.

Current release image: `localhost/adelaide-crime-intelligence:messaging-space-20260929`, pinned in `compose.fu40.yml`. It adds only the built frontend to `localhost/adelaide-crime-intelligence:messages-v3-20260929`; every backend module, existing graph snapshot and description-retry fix is retained. The previous image is retained for rollback. `scripts/redeploy_data_room_workspace.js` reuses the running application's protected settings and recreates only the FU40 service on port 8706, with `--no-deps`. Check active ingestion/AI/room jobs before redeployment.

Messaging-space verification, 29 September 2026: deployed image `da6cc2af222caa6817780cc4b836a30ef3332cc07a98c8903b9b7cfd1c4514d6`. All 35 test files and the production build pass. Live browser checks pass for two/four-speaker layouts, unchanged text, view persistence, portrait/initial fallbacks, search, source inspection/download and second-page match navigation, at widths 760/600/390 with no JavaScript errors or data writes. All four RedDirt catalogue portraits return image content successfully; the hidden-batch catalogue request is denied. Deployment audits confirmed all backend files, settings, mounts, other containers and batch data were preserved. The existing 160-message snapshot below remains unchanged.

Verified live on 29 September 2026: image `3ded397b927ac9e23fd1690fce8289247693aa4051f36f329efbf54ab008c070`; RedDirt snapshot `f207712d-9fa3-4df1-b34d-063de526fb89`. All 160 original messages reconcile, all 17 sources are imported, and the native graph returns 52 participation links. Repeat builds reuse the same snapshot; hidden-scope reads and read-only builds are denied. All 34 test files pass, the production build succeeds (existing chunk-size warning), and live browser tests pass at desktop and 760/600/390 widths with no JavaScript errors. Deployment checksum checks confirmed that unrelated backend code, retained frontend assets, settings, mounts and other containers were preserved. Source inventory, AI descriptions/stages and Money Flows were unchanged.

Verification scripts:

- `node test/data-room-messages.test.js`: parsing, locators, Unicode/CRLF/BOM, timestamps, duplicates/replies, literal content, bounds and scope rejection.
- `npm test` and `npm run build`: complete regression suite and production frontend build.
- `node test/message-presentation.test.js`: source-order presentation, colours, recorded dates, exact scoped catalogue matching, conflicting/ambiguous names and safe portrait paths.
- `scripts/test_messaging_space_browser.cjs`: read-only chat layout, original-text equality, two/four-speaker alignment, thumbnails and fallbacks, search/source/download, second-page match navigation and widths 760/600/390. `--local` previews local built assets against the existing API; fault and pagination fixtures are browser-only and do not write data.
- `node scripts/verify_bracketed_messages_live.js`: read-only verification of all 160 messages, original source hashes/offsets, native graph counts, participant labels, search context and denied scopes. `--build` explicitly builds/reuses only the named RedDirt batch. Confirms source inventory, stages, descriptions and Money Flows are unchanged.
- `scripts/test_bracketed_messages_browser.cjs`: RedDirt participant avatars, full exchanges, participant/month filters, search context, source inspector/download and widths 760/600/390. `--preview` serves local built assets and read-only message fixtures before deployment. Playwright is supplied through `NODE_PATH`.
- `scripts/verify_suga_messages_live.js`: builds/reuses SUGA only, reconciles all 28 original messages and graph counts, tests exact search, zones, locators, idempotency and denied users; confirms Money Flows, source hashes, stages and workspace records are unchanged.
- `scripts/verify_message_edges_live.js`: isolated uncommitted fixtures for pagination, literal search, explicit recipients, duplicate IDs, timezone/tie ordering, missing timestamps, hidden graph/reader data, cross-run foreign keys and deletion order. All fixture writes roll back.
- `scripts/test_suga_messages_browser.cjs`: live Playwright test of both readers, graph/participant selection, source inspection/download, search context, keyboard access, stale-request isolation, persistence and narrow widths 760/600. Playwright is supplied through `NODE_PATH`, not a production dependency.

Agent integration, message-derived links to financial events, POI identity assertions, free-form transcript adapters and inclusion in Stage 7 review-pack exports remain future work. Original source files can be downloaded from every displayed message.

## SMS CSV and audio dialogue

Messages supports CSV headers `sender_ref,recipient_ref,message,sent_at` and `sender,recipient,text,timestamp`. `thread_id` or `conversation_id` identifies a source-declared thread; absent an ID, exact sender/recipient pairs group within each file. Original headers, values, message IDs, timestamps, UTC offsets and row numbers remain available in source details. Ambiguous duplicate/alias columns fail rather than choosing a value.

Run Stage 4 Identify/Describe to save MP3/M4A speaker turns, then choose **Build messages** or **Verify / rebuild messages** in Batch Explorer. Existing paragraph-only transcripts can be upgraded with **Create audio dialogue** in Stage 4. Audio appears as its own conversation, with ordered dialogue turns, transcript offsets and a transcript TXT download. Speakers use neutral machine-assigned labels such as Speaker A; labels are scoped to the recording and never merged with named SMS participants. Unknown timing and recipients remain unrecorded. Check speech and speaker separation against the retained original audio.

Audio conversations cite the original audio checksum, saved transcript checksum and description version. Message snapshots become stale when the transcript or parser changes; rebuilding Messages reads saved transcripts and does not invoke transcription. Original text messages and unreviewed machine dialogue remain distinguishable in the reader and source panels.
