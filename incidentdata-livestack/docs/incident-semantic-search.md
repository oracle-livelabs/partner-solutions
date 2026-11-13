# Incident narrative semantic search

The **Search incident reports** input now embeds the user's description with OCI
GenAI Cohere Embed 4 (`SEARCH_QUERY`, 1536 dimensions), then ranks compatible
stored narrative vectors in ADB's `incident_narrative_embeddings_v4`. The original
eight-dimensional keyword/category query path has been removed from this input.
The separate legacy analytics scenario vectors are unchanged.

The default minimum cosine similarity is 0.40, shown as **40%**. Users may choose
10–100% and run the search again. The cutoff is applied to the raw score before
rounding and limiting results, so low-scoring rows do not fill the list. Ranking
is descending similarity, then incident reference to break ties consistently.
Scores display one decimal place and are explicitly labelled **Semantic
similarity**. They are not probabilities, confidence levels, or a finding that
records are related. The threshold is an adjustable demo filter, not a calibrated
relevance guarantee.

The endpoint remains `POST /api/patterns/semantic-search`, accepting `query`,
optional `topK` (1–30, default 12), and `minSimilarity` (0.10–1.00, default 0.40).
Responses include the applied threshold, model, dimensions, active profile,
authorised report/vector coverage, elapsed time and results. Missing coverage is
reported explicitly; embedding-service failures return an error with no fallback
to category vectors. Results use the active profile, matching embedding model,
and secure incident/report views. No stored records or embeddings are modified.

Clear, repeated searches, and demo-user changes cancel obsolete client requests.
The relationship graph receives only the current successful incident results,
plus the existing selected patterns and public-post context.

## Demo

1. Search for **payment diversion** with the default 40% minimum.
2. Point out graded narrative similarity and returned report wording.
3. Raise the minimum to 50% and search again; this short query may return no
   matches. Explain that the threshold controls inclusion, not model confidence.
4. Try **forced entry through a rear window** at 40% for a different narrative
   neighbourhood.
5. Open **Explore result relationships** to inspect recorded and semantic links.

At validation on the active Adelaide V2 profile, all 21,532 authorised
administrator reports had compatible vectors. “payment diversion” returned
roughly 40.5–42.2% in its top 12 results. The northern and southern analyst scopes
returned six and two results respectively at 40%. These are observations, not
fixed expectations for future datasets.

Validation: `npm test`, `npm run build`, and
`node scripts/check_incident_semantic_search.js` in the existing app's OCI
environment. Integration checks cover score variation, order, thresholding,
unrelated queries, and authorised references under four demo users. Browser checks
cover labels, threshold changes, empty/error states, and graph integration.

Deployment targets the existing OCI app on port 8706, with an app-only restart.
Pre-change entrypoints are in `/tmp/crimedata-semantic-backup.tdrrAF`; old hashed
frontend assets remain available for rollback.
