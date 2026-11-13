// Read-only, bounded expansion of result references. Recheck every record in secure views.
function references(value, name, max) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max || value.some(v => typeof v !== 'string' || !v.trim() || v.length > 120)) {
    const error = new Error(`${name} must contain at most ${max} valid references.`);
    error.status = 400;
    throw error;
  }
  return [...new Set(value.map(v => v.trim()))];
}
const list = bind => `SELECT ref FROM JSON_TABLE(:${bind}, '$[*]' COLUMNS (ref VARCHAR2(120) PATH '$'))`;
const unique = values => [...new Set(values)];

function assembleGraph(patterns, incidents, posts, memberships, comparisons, similarities, seeds) {
  const nodes = [
    ...patterns.map(p => ({ id: `pattern:${p.PATTERN_CODE}`, type: 'pattern', ref: p.PATTERN_CODE, label: p.PATTERN_NAME, detail: p.PATTERN_SUMMARY, reason: p.WHY_WATCH, source: 'Watched pattern catalogue', matched: seeds.patternCodes.includes(p.PATTERN_CODE) })),
    ...incidents.map(i => ({ id: `incident:${i.INCIDENT_REF}`, type: 'incident', ref: i.INCIDENT_REF, label: i.INCIDENT_REF, detail: i.REPORT_SUMMARY, category: i.CATEGORY_NAME, suburb: i.SUBURB, date: i.OCCURRED_AT, status: i.INCIDENT_STATUS, source: 'Authorised incident and report', matched: seeds.incidentRefs.includes(i.INCIDENT_REF) })),
    ...posts.map(p => ({ id: `post:${p.POST_REF}`, type: 'post', ref: p.POST_REF, label: p.SOURCE_NAME || p.POST_REF, detail: p.POST_TEXT, suburb: p.SUBURB, date: p.POSTED_AT, status: p.VERIFICATION_STATUS, momentum: p.MOMENTUM_FLAG, source: 'Simulated public post · unverified', matched: seeds.postRefs.includes(p.POST_REF) })),
  ];
  const ids = new Set(nodes.map(n => n.id));
  const edges = [
    ...memberships.map(m => ({ source: `pattern:${m.PATTERN_CODE}`, target: `${m.KIND}:${m.REF}`, type: 'membership', label: 'Recorded membership', detail: m.RELATIONSHIP_LABEL, provenance: m.KIND === 'incident' ? 'WATCHED_PATTERN_INCIDENTS' : 'WATCHED_PATTERN_POSTS' })),
    ...comparisons.map(c => ({ source: `post:${c.POST_REF}`, target: `incident:${c.INCIDENT_REF}`, type: 'reviewed', label: 'Reviewed comparison', detail: 'Recorded analyst comparison; the public post remains unverified and is not incident evidence.', score: Number(c.LINK_CONFIDENCE), scoreLabel: 'Contextual confidence (%)', provenance: 'SOCIAL_POST_INCIDENT_LINKS · reviewed' })),
    ...similarities.map(s => ({ source: `pattern:${s.PATTERN_CODE}`, target: `incident:${s.INCIDENT_REF}`, type: 'similarity', label: 'Semantic similarity', detail: 'Top narrative match for this pattern in the active profile. Similar wording does not establish a recorded relationship.', score: Number(s.SIMILARITY_SCORE), scoreLabel: 'Cosine similarity', provenance: 'Stored Cohere Embed 4 vectors · 1536 dimensions' })),
  ].filter(e => ids.has(e.source) && ids.has(e.target));
  return { nodes, edges: [...new Map(edges.map(e => [`${e.source}|${e.target}|${e.type}`, e]))].map(([id, e]) => ({ id, ...e })) };
}

async function loadGraph(c, seeds) {
  const rows = async (sql, binds) => (await c.execute(sql, binds)).rows;
  const patterns = await rows(`SELECT w.pattern_code,w.pattern_name,w.pattern_summary,w.why_watch
    FROM watched_crime_patterns w WHERE w.active=1 AND w.activate_ui='Y' AND (
      w.pattern_code IN (${list('patterns')}) OR EXISTS (
        SELECT 1 FROM watched_pattern_incidents wi JOIN secure_crime_incidents_v i ON i.incident_ref=wi.incident_ref
        WHERE wi.pattern_code=w.pattern_code AND i.incident_ref IN (${list('incidents')})) OR EXISTS (
        SELECT 1 FROM watched_pattern_posts wp JOIN secure_social_media_posts_v p ON p.post_ref=wp.post_ref
        WHERE wp.pattern_code=w.pattern_code AND p.post_ref IN (${list('posts')})))
    ORDER BY CASE WHEN w.pattern_code IN (${list('patterns')}) THEN 0 ELSE 1 END,w.pattern_code FETCH FIRST 13 ROWS ONLY`,
    { patterns: JSON.stringify(seeds.patternCodes), incidents: JSON.stringify(seeds.incidentRefs), posts: JSON.stringify(seeds.postRefs) });
  const warnings = [];
  if (patterns.length > 12) warnings.push('Pattern context is limited to 12 patterns.');
  patterns.length = Math.min(patterns.length, 12);
  const memberships = await rows(`SELECT * FROM (
    SELECT wi.pattern_code,'incident' kind,wi.incident_ref ref,wi.relationship_label,
      ROW_NUMBER() OVER (PARTITION BY wi.pattern_code ORDER BY wi.incident_ref) rn
      FROM watched_pattern_incidents wi JOIN secure_crime_incidents_v i ON i.incident_ref=wi.incident_ref
      WHERE wi.pattern_code IN (${list('patterns')})
    UNION ALL
    SELECT wp.pattern_code,'post' kind,wp.post_ref ref,wp.relationship_label,
      ROW_NUMBER() OVER (PARTITION BY wp.pattern_code ORDER BY wp.post_ref) rn
      FROM watched_pattern_posts wp JOIN secure_social_media_posts_v p ON p.post_ref=wp.post_ref
      WHERE wp.pattern_code IN (${list('patterns')})) WHERE rn<=21`, { patterns: JSON.stringify(patterns.map(p => p.PATTERN_CODE)) });
  if (memberships.some(m => Number(m.RN) > 20)) warnings.push('Recorded context is limited to 20 members of each type per pattern.');
  const visibleMemberships = memberships.filter(m => Number(m.RN) <= 20);
  // Stored embeddings only: no GenAI calls or vector writes.
  const similarities = [];
  try {
    for (const p of patterns) {
      similarities.push(...await rows(`SELECT :patternCode pattern_code,i.incident_ref,
        ROUND(1-VECTOR_DISTANCE(n.embedding,p.embedding,COSINE),4) similarity_score
        FROM watched_pattern_embeddings p JOIN incident_narrative_embeddings_v4 n
          ON n.profile_code=(SELECT pr.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles pr ON pr.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1)
          AND n.embedding_model=p.embedding_model
        JOIN secure_crime_incidents_v i ON i.incident_ref=n.incident_ref
        JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id WHERE p.pattern_code=:patternCode
        ORDER BY VECTOR_DISTANCE(n.embedding,p.embedding,COSINE),i.incident_ref FETCH FIRST 4 ROWS ONLY`, { patternCode: p.PATTERN_CODE }));
    }
  } catch (error) {
    console.error('Result graph similarity unavailable:', error.message);
    warnings.push('Narrative similarity is unavailable or incomplete; recorded relationships are still shown.');
  }
  const incidentRefs = unique([...seeds.incidentRefs, ...visibleMemberships.filter(m => m.KIND === 'incident').map(m => m.REF), ...similarities.map(s => s.INCIDENT_REF)]);
  const postRefs = unique([...seeds.postRefs, ...visibleMemberships.filter(m => m.KIND === 'post').map(m => m.REF)]);
  const comparisons = await rows(`SELECT l.post_ref,l.incident_ref,l.link_confidence
    FROM social_post_incident_links l JOIN secure_social_media_posts_v p ON p.post_ref=l.post_ref
    JOIN secure_crime_incidents_v i ON i.incident_ref=l.incident_ref
    WHERE l.review_status='reviewed' AND (l.incident_ref IN (${list('incidents')}) OR l.post_ref IN (${list('posts')}))
    ORDER BY l.post_ref,l.incident_ref FETCH FIRST 121 ROWS ONLY`, { incidents: JSON.stringify(incidentRefs), posts: JSON.stringify(postRefs) });
  if (comparisons.length > 120) warnings.push('Reviewed comparisons are limited to 120 links.');
  comparisons.length = Math.min(comparisons.length, 120);
  const incidents = await rows(`SELECT i.incident_ref,i.suburb,i.occurred_at,i.incident_status,cat.category_name,r.report_summary
    FROM secure_crime_incidents_v i JOIN incident_categories cat ON cat.category_id=i.category_id
    LEFT JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id
    WHERE i.incident_ref IN (${list('refs')}) ORDER BY CASE WHEN i.incident_ref IN (${list('seeds')}) THEN 0 ELSE 1 END,i.incident_ref
    FETCH FIRST 61 ROWS ONLY`, { refs: JSON.stringify(unique([...incidentRefs, ...comparisons.map(x => x.INCIDENT_REF)])), seeds: JSON.stringify(seeds.incidentRefs) });
  const posts = await rows(`SELECT p.post_ref,p.post_text,p.posted_at,p.suburb,p.verification_status,p.momentum_flag,s.source_name
    FROM secure_social_media_posts_v p JOIN social_media_sources s ON s.source_code=p.source_code
    WHERE p.post_ref IN (${list('refs')}) ORDER BY CASE WHEN p.post_ref IN (${list('seeds')}) THEN 0 ELSE 1 END,p.post_ref
    FETCH FIRST 61 ROWS ONLY`, { refs: JSON.stringify(unique([...postRefs, ...comparisons.map(x => x.POST_REF)])), seeds: JSON.stringify(seeds.postRefs) });
  if (incidents.length > 60 || posts.length > 60) warnings.push('This neighbourhood is limited to 60 incidents and 60 posts. Narrow your search for more detail.');
  incidents.length = Math.min(incidents.length, 60);
  posts.length = Math.min(posts.length, 60);
  return { ...assembleGraph(patterns, incidents, posts, visibleMemberships, comparisons, similarities, seeds), warnings,
    scope: 'Current result references plus bounded related context in your authorised data scope. Up to four semantic report matches per pattern. Connections describe relevance, not causation or impact.' };
}

function registerResultRelationships(app, db) {
  app.post('/api/patterns/result-relationships', async (req, res) => {
    try {
      const seeds = { patternCodes: references(req.body?.patternCodes, 'patternCodes', 12), incidentRefs: references(req.body?.incidentRefs, 'incidentRefs', 30), postRefs: references(req.body?.postRefs, 'postRefs', 30) };
      if (!Object.values(seeds).some(v => v.length)) return res.json({ nodes: [], edges: [], warnings: [], scope: 'Select a watched pattern or run a search first.' });
      res.json(await db(req.demoUser, c => loadGraph(c, seeds)));
    } catch (error) {
      console.error('Result relationship graph error:', error.message);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to load result relationships. Please try again.' });
    }
  });
}
module.exports = { registerResultRelationships, assembleGraph, references, loadGraph };
