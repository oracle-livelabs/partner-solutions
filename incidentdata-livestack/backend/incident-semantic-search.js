const DEFAULT_MIN_SIMILARITY = 0.4;
function parseSearch(body = {}) {
  const { query, topK = 12, minSimilarity = DEFAULT_MIN_SIMILARITY } = body || {};
  if (typeof query !== 'string' || query.trim().length < 3 || query.trim().length > 2000) {
    throw Object.assign(new Error('Enter an incident description between 3 and 2,000 characters.'), { status: 400 });
  }
  if (!Number.isInteger(topK) || topK < 1 || topK > 30 || typeof minSimilarity !== 'number' || !Number.isFinite(minSimilarity) || minSimilarity < 0.1 || minSimilarity > 1) {
    throw Object.assign(new Error('Use 1–30 results and a minimum similarity between 10% and 100%.'), { status: 400 });
  }
  return { query: query.trim(), topK, minSimilarity };
}

// Both coverage and ranking use authorised reports from the active profile and model.
async function searchReports(c, options, embedding) {
  const { PATTERN_EMBEDDING_MODEL: model, PATTERN_EMBEDDING_DIMENSIONS: dimensions, embedPatternTexts, vectorLiteral } = embedding;
  const { query, topK, minSimilarity } = options;
  const profile = (await c.execute(`SELECT p.profile_code FROM z_base_active_dataset_profile a
    JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`)).rows[0]?.PROFILE_CODE;
  if (!profile) throw Object.assign(new Error('No active data profile is selected.'), { status: 503 });
  const coverageRow = (await c.execute(`SELECT COUNT(DISTINCT i.incident_ref) reports,COUNT(DISTINCT n.incident_ref) embedded
    FROM secure_crime_incidents_v i JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id
    LEFT JOIN incident_narrative_embeddings_v4 n ON n.incident_ref=i.incident_ref AND n.profile_code=:profile AND n.embedding_model=:model`, { profile, model })).rows[0];
  const coverage = { reports: Number(coverageRow.REPORTS), embedded: Number(coverageRow.EMBEDDED) };
  const meta = { query, model, dimensions, method: 'VECTOR_DISTANCE(COSINE)', profile, minSimilarity, topK, coverage };
  if (!coverage.embedded) return { ...meta, results: [], notice: coverage.reports ? 'No compatible narrative embeddings are available for authorised reports in this profile.' : 'No authorised reports are available in this profile.' };
  const [vector] = await embedPatternTexts([query], 'SEARCH_QUERY');
  if (!Array.isArray(vector) || vector.length !== dimensions || vector.some(v => !Number.isFinite(v))) throw Error('Invalid query embedding');
  const result = await c.execute(`WITH scored AS (
    SELECT i.incident_ref,i.suburb,i.modus_operandi,i.incident_status,i.occurred_at,cat.category_name,r.report_summary,
      1-VECTOR_DISTANCE(n.embedding,TO_VECTOR(:vector),COSINE) raw_similarity
    FROM incident_narrative_embeddings_v4 n
    JOIN secure_crime_incidents_v i ON i.incident_ref=n.incident_ref
    JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id
    JOIN incident_categories cat ON cat.category_id=i.category_id
    WHERE n.embedding_model=:model AND n.profile_code=:profile
      AND n.profile_code=(SELECT p.profile_code FROM z_base_active_dataset_profile a
        JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1)
  ) SELECT incident_ref,suburb,modus_operandi,incident_status,occurred_at,category_name,report_summary,
      ROUND(raw_similarity,4) similarity_score
    FROM scored WHERE raw_similarity>=:minSimilarity
    ORDER BY raw_similarity DESC,incident_ref FETCH FIRST :topK ROWS ONLY`,
    { vector: vectorLiteral(vector), model, profile, minSimilarity, topK });
  return { ...meta, results: result.rows,
    notice: coverage.embedded < coverage.reports ? `Only ${coverage.embedded} of ${coverage.reports} authorised reports have compatible narrative vectors. Results cover that subset.` : null };
}

function registerIncidentSemanticSearch(app, db, embedding) {
  app.post('/api/patterns/semantic-search', async (req, res) => {
    const started = Date.now();
    try {
      const options = parseSearch(req.body);
      const result = await db(req.demoUser, c => searchReports(c, options, embedding));
      res.json({ ...result, elapsed: Date.now() - started });
    } catch (error) {
      console.error('Incident narrative search error:', error.message);
      res.status(error.status || 503).json({ error: error.status ? error.message : 'Semantic incident search is temporarily unavailable. Please try again; no category-based fallback was used.' });
    }
  });
}
module.exports = { parseSearch, searchReports, registerIncidentSemanticSearch, DEFAULT_MIN_SIMILARITY };
