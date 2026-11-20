# Vector Search presenter walkthrough

On **Data Foundation**, choose **Oracle Vector Search** to open the presenter pop-up. This pilot has four steps and short talk tracks. Use Next/Back or the step buttons, and close with Close, Finish or Escape. Keyboard focus returns to the tile.

1. Explain that a vector is an ordered list of numbers. An embedding model maps content into a numeric representation; real models typically use many dimensions.
2. Select Dog, Cat and Car. The illustrative chart and ranking show dog breeds near Dog, animal concepts closer together than Car, and why the nearest result can still be a weak match. The coordinates are chosen by hand for teaching, not measured embeddings. The two-number example uses Euclidean distance and excludes the query item itself.
3. Explain the embedding model, Oracle’s native VECTOR storage, SQL distance comparisons and approximate-search indexes. The optional SQL example matches the teaching diagram; actual search metrics should match the embedding model. The app’s incident narrative search uses VECTOR_DISTANCE with cosine distance.
4. Connect the idea to differently worded incident reports, then explain why a similarity score is a retrieval aid rather than proof of a case relationship. “Greyhound dog” versus “Greyhound bus” illustrates the importance of context.

The pop-up is local explanatory content. Opening it or changing the query examples does not run a vector model or a database query. Property Graph and Spatial have separate presenter walkthroughs, described in [Graph and Spatial presenter guides](graph-spatial-presenter-guides.md).

References: [Oracle AI Vector Search overview](https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/overview-ai-vector-search.html), [vector indexes and distance metrics](https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/manage-different-categories-vector-indexes.html).

Verification: build the frontend, then run `NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules node scripts/test_vector_presenter_browser.cjs --local`. Omit `--local` to check the deployed app. Checks cover the examples, optional SQL, narrow-screen layout, keyboard focus, Escape, Finish and reopening. Browser checks permit GET requests only.
