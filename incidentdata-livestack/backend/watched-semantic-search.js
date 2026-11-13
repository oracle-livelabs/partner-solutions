'use strict';
async function searchWatchedPatterns(c,{query,topK=6},embedding) {
  const {PATTERN_EMBEDDING_MODEL:model,PATTERN_EMBEDDING_DIMENSIONS:dimensions,embedPatternTexts,vectorLiteral}=embedding;
  const row=(await c.execute(`SELECT COUNT(*) patterns,COUNT(e.pattern_code) embedded
    FROM watched_crime_patterns w LEFT JOIN watched_pattern_embeddings e
      ON e.pattern_code=w.pattern_code AND e.embedding_model=:model AND e.embedding IS NOT NULL
    WHERE w.active=1 AND w.activate_ui='Y'`,{model})).rows[0];
  const coverage={patterns:Number(row.PATTERNS),embedded:Number(row.EMBEDDED)};
  if(!coverage.embedded)throw Object.assign(new Error(coverage.patterns
    ?'Watched-pattern search is unavailable: the visible watches have no compatible saved vectors. The watch cards and recorded relationships remain available.'
    :'No active watched patterns are visible in this dataset.'),{status:503,coverage});
  const [vector]=await embedPatternTexts([query],'SEARCH_QUERY');
  const result=await c.execute(`SELECT w.pattern_code,w.pattern_name,w.pattern_summary,w.why_watch,w.pattern_kind,w.pattern_status,w.case_ref,w.display_color,
    ROUND(1-VECTOR_DISTANCE(e.embedding,TO_VECTOR(:vector),COSINE),4) similarity_score
    FROM watched_pattern_embeddings e JOIN watched_crime_patterns w ON w.pattern_code=e.pattern_code
    WHERE w.active=1 AND w.activate_ui='Y' AND e.embedding_model=:model AND e.embedding IS NOT NULL
    ORDER BY VECTOR_DISTANCE(e.embedding,TO_VECTOR(:vector),COSINE),w.pattern_code FETCH FIRST :topK ROWS ONLY`,
    {vector:vectorLiteral(vector),topK,model});
  const notice='Semantic relevance ranks synthetic monitoring definitions only. It is not a finding, prediction, or evidence of a connection; analyst review is required.';
  return {query,model,dimensions,method:'VECTOR_DISTANCE(COSINE)',coverage,results:result.rows,
    notice:(coverage.embedded<coverage.patterns?`Only ${coverage.embedded} of ${coverage.patterns} visible watches have compatible vectors. Results cover that subset. `:'')+notice};
}
module.exports={searchWatchedPatterns};
