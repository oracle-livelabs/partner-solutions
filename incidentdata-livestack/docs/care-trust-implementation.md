# Care-Trust evidence pack — Amsterdam implementation

25 September 2026. Knowledge set `KS-CARE-TRUST-001`, version `1.0`; package `EI_AMSTERDAM_CARE_V1`; active/saved profile `AMSTERDAM_DATA_V1` (saved profile id 30). This is an additive implementation of [Who knew?](care-evidence-vignette.md). Start with the [short browser walkthrough](care-trust-walkthrough.md).

## Scope and source decisions

The original jewellery-loss examples were inspiration, not Amsterdam source facts. Six existing incidents in `CASE-AMS-2026-03` already describe daytime occupancy approaches and reported entrance damage. Their property descriptions and outcomes were retained. Five anchor the new supplementary sources:

| Incident | Retained property and status | Pack role |
| --- | --- | --- |
| `SYN-AMS-2026-12200` | Small tool case; assigned | Resident A, assignments, message and attribution |
| `SYN-AMS-2026-06302` | Sealed parcel; reported | Resident B, same worker, limited consent |
| `SYN-AMS-2026-06143` | Storage box; reported | Different-worker/provider comparison |
| `SYN-AMS-2026-14147` | Portable display; under review | Common-stock comparison, not a recovery |
| `SYN-AMS-2026-11012` | Hand tools; resolved | No-care-link control preserving the completed outcome |

The sixth watch incident, `SYN-AMS-2026-06351`, is unchanged and has no new pack source. No original narrative asserts a care connection: that context is expressly newly authored synthetic material in the supplementary evidence.

## Additions

- 16 evidence items `EV-AMS-H01`–`EV-AMS-H16`, with retained text assets, hashes, source JSON, quoted markers, exact name offsets and 384-dimensional MiniLM vectors.
- Two explicitly fictional `associate` profiles: Lena Harper (`POI-AMS-CARE-W01`) and Morgan Reed (`POI-AMS-CARE-X01`). Each has a narrative vector and no photograph or visual embedding.
- Three documentary incident associations: worker→A, worker→B and outside contact→A. Each link names its supporting sources and denies any inference of attendance or responsibility. Existing Noah Kim, Tessa Rowe and Darnell Price roles are unchanged.
- Matching saved-profile evidence, people, links and person-narrative vectors. Evidence vectors remain keyed by profile and stable evidence reference, independent of regenerated numeric IDs.
- Two walkthrough shortcuts, source-qualified native graph link summaries and direct navigation to the selected Person Intelligence profile.

The live and saved Amsterdam evidence totals move from 6,041 to 6,057. Evidence Intelligence exposes 48 items across 17 incidents and three cases, involving 11 fictional POIs. The whole profile has 15 people after adding two to its prior 13. All other saved profile counts remain unchanged. No incidents, watch links, case assignments or entitlements were added or overwritten.

## What is actually demonstrated

| Capability | Exercised path |
| --- | --- |
| JSON and exact search | Native source JSON; `care_worker:DEMO-WORKER-17` is distinct from the same value in `care_form_catalogue` |
| Evidence vectors | Local MiniLM query vectors; Oracle cosine ranking over scoped, current stored vectors |
| Person Intelligence | Two new narrative vectors, scoped profile detail and description search |
| Property graph | Actual `GRAPH_TABLE` evidence→incident→person paths, with stored link summaries; literal mentions remain separate |
| Spatial | Native `SDO_GEOM.SDO_DISTANCE`; unchanged approximate incident points and Esri basemap |
| Select AI | Source-cited review of the six selected fictional records |
| Native agent | Request-bound `EI_SOURCES_V1` and `EI_CONTEXT_V1` tools with an execution audit |
| Scope | Four existing restricted personas denied care evidence, assets, paths, profiles and review |

The new contacts are not a person-to-person collusion graph. The external contact is linked for documentary review, not because any source places them at a scene. No identity inference, recovered-property assertion, operational schedule or confirmed offender is supplied.

## Validation and receipts

`care_trust_20260925/` holds the preflight, rollback-only load, staged native checks, committed load, native verification, idempotence run, release manifests, browser receipts/screenshots and post-load backup.

The staged suite covers 47 native checks. Original payment matching and image ranking remain in regression coverage. Offline probes are checked against the combined old/new corpus; native cosine results agree with the offline calculation. Source-quality validation passes for the original incident fact cards and all 16 new evidence descriptions.

The final live browser run completed both main AI modes and the supplementary Select AI assumptions review. The agent called both required tools; all 16 source downloads matched their fixture hashes. Source-by-source inspection qualified the functional pass: one Select AI opening sentence blurred an inherited name association with a name in the message, and the assumptions draft compared a name with a worker identifier and paraphrased an outcome as a status. These are not adopted findings. The native-agent main draft kept assignment, account attribution, consent and authorship separate. Review results and limitations are retained in `ai-source-review.json`; this assistant review is not independent human approval, and successful citation checks do not certify every sentence.

Protected-record fingerprints include timestamp values and cover all 14,467 original incidents and reports, existing evidence, the prior 13 people, prior person links, cases, watch definitions/links and entitlements. The rerun adds zero rows. Full saved-profile activation/restore was not invoked, because that would replace the shared active dataset; saved/live row parity and the existing stable-reference restore contract are the checks used here.

## Files and replay

Authored builder and guarded capture/load/test tools live in `scripts/care-trust/`. The versioned fixture, source assets, vectors and knowledge-set definition live in `testdata/evidence-intelligence/care-trust-v1/`. `expected.json` is evaluator-only; it, the anchors, the knowledge-set instructions and the authoring code are not deployed or indexed as evidence. The image receives only runtime code, built UI and retained source assets.

The scoped evidence view has an explicit two-pack allowlist, retains the active-profile condition and joins authorised incidents. No access mapping is broadened. Runtime source downloads choose an allowlisted pack root and verify bytes against the stored hash.

Live image: `local/adelaide-crime-intelligence:care-trust-20260925-r2`. The initial Care-Trust image is retained, as is the pre-care image `local/adelaide-crime-intelligence:evidence-map-fix-20260924`. Ports, mounts and environment settings are preserved. The app deployment happened before the data commit, so new sources were never exposed through the previous H-reference-incompatible backend.

The first supplementary assumptions review was rejected by the citation guard; no draft was released. The prompt still contained an unrelated payment citation example and did not explicitly enumerate selected references. Revision 2 enumerates the exact selected citations and distinguishes them from references mentioned inside context. The original fail-closed guard is unchanged. Both the rejected-run note and subsequent verification are retained; citation acceptance is not a factual-accuracy guarantee.

The receipt files intentionally prevent blindly rerunning destructive/release steps. The loader defaults to rollback; it rejects conflicting existing data. Inspect existing receipts before any replay. The post-load backup contains the new live/saved rows and serialized vectors, with a manifest hash.

After data loading, an application-image rollback alone is not a complete data rollback: the earlier backend cannot open H references. An approved rollback would first restore the saved prior view definition to hide the new pack, then use the previous app image. Do not restore an entire city profile, delete records or change entitlements merely to undo this additive feature.
