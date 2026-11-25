# Scene-region search: deferred research and ZIP-pipeline test plan

Recorded: 13 September 2026. Update: the [manual-region and narrative POI candidate panel](data-room-poi-candidates.md) is now implemented in Stage 6. Automatic detection, persistent region indexing, reverse scene retrieval and object search remain deferred. The research below describes the broader proposal and its earlier baseline.
User direction: return to Data Room ZIP loading; consider scene-region
search later, potentially as part of the loader pipeline.

## Proposed capabilities

| Query | Proposed result |
| --- | --- |
| Mixed scene containing fictional characters | Highlighted regions and ranked candidate fictional profiles |
| Fictional reference portrait | Ranked stored scenes with the matching candidate region highlighted |
| Object reference image | Ranked scenes with a similar cup, book cover or pair of shoes highlighted |

Distinguish object category (a coffee cup), design (this cup design), and exact
physical instance (this particular cup). Similar appearance cannot reliably
distinguish physically different but visually identical items.

## What is already verified

Person Intelligence on FU40 port 8706 uses normalized 512-dimensional
`Xenova/clip-vit-base-patch32` image vectors and Oracle cosine distance.
Narrative search uses separate 384-dimensional MiniLM vectors. The UI presents
both search modes alongside one another with a shared, labelled results area.

All five reference portraits retrieve their own profiles first. Four unseen
fictional portrait variations also retrieved their intended profile first:

| Query file in `/home/opc/scratch/photos/test/` | First result | Score | Runner-up score |
| --- | --- | --- | --- |
| darnell-price-portrait-sheet (1).jpeg | Darnell Price | 0.7735 | 0.5857 |
| mara-vega-portrait-sheet (1).jpeg | Mara Vega | 0.7558 | 0.5604 |
| mara-vega-portrait-sheet (2).jpeg | Mara Vega | 0.6700 | 0.5172 |
| tessa-rowe-portrait-sheet (1).jpeg | Tessa Rowe | 0.7885 | 0.4166 |

These are similarity scores, not identity probabilities. This small portrait
test does not establish performance for mixed scenes, tiny/occluded regions,
unknown characters, or object-instance retrieval.

## Proposed approach, for evaluation

Start with manual region selection: draw a box on a scene, compare that crop
with reference vectors, and show results alongside the original scene and box.
This separates retrieval quality from detection quality. Keep test scenes out
of the reference set while measuring unseen-image performance.

Next, evaluate automatic detection and region vectors. Retain the source image,
checksum, dimensions, bounding-box coordinate convention, crop provenance,
model/version, vector dimension and processing run for every region. Reference
and query vectors must use compatible models and preprocessing. A separate
region index would support both scene-to-reference and reference-to-scene
retrieval; Oracle can store and compare the vectors.

Candidate technologies, not final selections:

- [Grounding DINO](https://huggingface.co/docs/transformers/model_doc/grounding-dino)
  supports text-guided object detection and bounding boxes. Detection locates a
  region; it does not establish which registered character or object it is.
- [CLIP](https://huggingface.co/openai/clip-vit-base-patch32) is our current
  whole-image baseline. Evaluate it on crops of the confirmed fictional cast;
  mixed-scene character matching is not yet verified.
- [DINOv2](https://github.com/facebookresearch/dinov2) provides visual features
  worth comparing for object designs. No project benchmark or model selection
  has been performed. Readable book-cover text could add a separate OCR signal.

Evaluation should include correct matches, similar distractors, unknown items,
angle/lighting variation, low resolution and occlusion. Measure top-ranked
retrieval, missed detections, false matches, score margins, latency and compute
cost. Allow an inconclusive/no-convincing-candidate result. Keep detector scores
separate from similarity scores and require review before saving an asserted
scene-to-character connection.

## Possible ZIP-pipeline integration

The existing seven stages are Load, Unzip, Ingest, Identify/Describe,
Learn-what-is-there, Understand-Connections and Create-Data-products.
Keep their current behaviour as the baseline. A later optional extension could:

1. Retain original images during ingestion as today.
2. Save reviewed/manual regions or detector suggestions after ingestion,
   alongside Identify/Describe outputs, with explicit processing status.
3. Generate separate region embeddings for the connections stage.
4. Present candidate matches with highlighted source regions for review.
5. Include reviewed results and provenance in versioned data products.

Respect existing batch/user scopes, limits, retry semantics and run versioning.
Do not silently turn visual similarity into an incident/POI relationship.
Implementation location, additional schema, detector, thresholds and resource
requirements remain to be decided after a small controlled evaluation.

Currently Data Room compares whole-scene image vectors and uses exact
checksums of two packaged assets for declared cast links. Uploading arbitrary
scenes, including scenes containing the five new fictional profiles, does not
automatically identify them or register new POIs.

## Resume ZIP testing next

Open FU40 port 8706 as `statewide_admin`, choose Data Room, then section A.
Use Download sample ZIP for a baseline or select a small synthetic test archive.
Confirm the synthetic-data checkbox and choose Load ZIP. Inspect the allocated
batch ID, first three stages and the inventory before requesting AI analysis.

Current archive limits from `backend/data-room-archive.js`: 20 MiB compressed,
40 MiB expanded, 8 MiB per file, 100 accepted files, 500 ZIP entries, and 20,000
CSV data rows. Supported files: TXT, CSV, JSON, JPG/JPEG, PNG, MP3, M4A and MP4. The current
Identify/Describe UI states a smaller 5 MiB image-analysis limit and a 24,000
character text-analysis bound; use images below 5 MiB for the end-to-end test.

Then explicitly run Identify/Describe, review descriptions, run learning,
connections and product creation through the existing controls. Check source
downloads/checksums, provenance, saved batch reopening and the resulting review
pack. Record gaps before adding region detection or matching to this workflow.

See [the current workspace guide](crime-data-room-workspace.md) for the known
completed sample and pipeline details. No new ZIP upload, inference run or
scene-search implementation was started when saving this research.

MP3/M4A/MP4 originals are retained with checksums and downloads. Stage 4 Identify/Describe transcribes MP3/M4A audio, saves an unreviewed machine transcript and describes it for later analysis. MP4 video analysis remains unavailable; supply JPG/PNG stills or TXT transcripts for video analysis. Existing upload and expansion limits apply.
