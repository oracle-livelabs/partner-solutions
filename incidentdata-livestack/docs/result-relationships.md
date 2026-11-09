# Explore result relationships

On **Crime Pattern Signals**, select **Explore result relationships** below the
incident search. The panel uses the current catalogue matches, selected watched
pattern, incident/report results, and visible public posts as starting references.
It refreshes when those references change. Changing the demo user clears the page
and graph before loading the new user's data.

The graph adds bounded related context, including recorded pattern members,
reviewed post-to-incident comparisons, and up to four report-vector matches per
pattern. Thick node borders mark starting records; other nodes are added context.
Filters control node and connection types. Select nodes or lines to inspect their
description and provenance; incidents can open the existing detail dialog.
Pan/zoom and Fit graph are available, along with keyboard-selectable nodes and a
record/connection list for an alternative to the canvas.

## Relationship meanings

- Solid lines: recorded watched-pattern membership.
- Dashed lines: explicitly reviewed post-to-incident comparisons.
- Dotted lines: cosine similarity between stored Cohere Embed 4 pattern and
  incident-narrative vectors in the active profile. Similarity is separate from
  membership even when the same pair has both relationships.

Public posts remain unverified. Neither semantic similarity nor a reviewed
comparison establishes evidence, causation, or operational impact. Comparison
confidence is labelled separately from cosine similarity.

## Implementation and limits

`POST /api/patterns/result-relationships` accepts `patternCodes` (up to 12),
`incidentRefs` (30), and `postRefs` (30). References are bound through JSON_TABLE;
client-supplied text and scores are never used as relationship evidence. Every
incident and post is joined through the active user's secure view, including
expansion and final node details. Pattern definitions use the existing active,
UI-visible catalogue contract.

This is a read-only graph projection of ADB relationship tables and stored
vectors, rendered with D3. It does not create an Oracle property graph or write
relationships, scores, embeddings, or database records. No GenAI request is made
when the graph opens.

Expansion is limited to 12 patterns, 20 recorded members of each type per
pattern, 120 reviewed comparisons, 60 incidents, and 60 posts. The response warns
when limits truncate context. Edges with missing endpoints are removed. Missing
vector capability produces an explicit warning while recorded links remain
available. Disconnected result nodes are retained.

## Validation and deployment

- `npm test`: seed validation, dangling-link exclusion, distinct provenance,
  and empty/invalid endpoint requests.
- `npm run build`: frontend production build.
- `node scripts/check_result_relationships.js`: read-only ADB integration check
  using the app's configured environment; validates every returned node against
  secure views for four demo users, including administrator references reused
  under restricted users.
- Browser checks cover graph loading, selection, line filters, zoom, list access,
  responsive layout, and clearing the graph on user changes.

The OCI app on port 8706 receives the updated frontend and backend module, with
an app-only restart. Source changes are included in the repository for future
image builds. The running container's entrypoints before this change were saved
to `/tmp/crimedata-graph-backup.uB0vVn`; prior hashed frontend assets are retained.
