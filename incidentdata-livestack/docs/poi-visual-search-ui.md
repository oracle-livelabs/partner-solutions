# Person Intelligence visual search — 13 September 2026

FU40 port 8706 presents visual and narrative search side by side on desktop,
stacking on narrower screens. One shared results section displays either
Visual search results or Narrative search results according to the latest
search started. Choosing a file automatically searches; submitting the narrative
form switches the result type. Late responses cannot switch the active type.
Each result card shows its reference portrait, name, rank and raw cosine
similarity score; narrative results also show the profile description.
The uploaded image remains visible across searches and profile selections.
Automatically selected-profile narrative neighbours are in a collapsed panel.

The old Test selected portrait action loaded the sidebar selection as a new
query, which made an uploaded Darnell image appear to change into Tessa. This
action has been removed. Clear image search resets the query; Choose another
image replaces it. New queries clear stale results, cancel earlier requests,
and ignore late responses. Errors appear next to the retained query image.

Implementation: `frontend/src/PoiVisualSearch.jsx` and
`frontend/src/poi-visual-search.css`, consumed by PersonIntelligence in
`frontend/src/main.jsx`. CLIP and the database search are unchanged.

Browser verification:

```sh
NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules \
  node scripts/test_poi_visual_browser.cjs --live
```

Omit `--live` to serve the local built frontend through browser request
interception while using the FU40 API. The checks cover the real Darnell upload
and ranking, preview persistence when browsing profiles, delayed responses,
query failure, clear, desktop alignment, exclusive result types, cross-search
response races, and 760/600px layouts. Fault and delay responses are
intercepted only in the test browser.

Deployment uses `local/adelaide-crime-intelligence:poi-dual-ui-20260913` in
`compose.fu40.yml`. This UI-only image layers the built frontend over the prior
`cdr-workspace-20260912` image using `scripts/Containerfile.poi-ui` and a minimal
build context containing `dist/`. The original image is retained for rollback.
Future full builds can use the regular Containerfile and the current compose
image tag. The existing redeploy helper recreates only the FU40 app.
