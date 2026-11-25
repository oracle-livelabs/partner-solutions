const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSearch, searchReports, registerIncidentSemanticSearch } = require('../backend/incident-semantic-search');

test('incident query validation and default threshold', () => {
  assert.deepEqual(parseSearch({query:' payment diversion '}), {query:'payment diversion',topK:12,minSimilarity:0.4});
  for (const body of [{}, {query:2}, {query:'ab'}, {query:'x'.repeat(2001)}, {query:'test',topK:31}, {query:'test',topK:1.5}, {query:'test',minSimilarity:0}, {query:'test',minSimilarity:'0.4'}, {query:'test',minSimilarity:NaN}]) {
    assert.throws(() => parseSearch(body), {status:400});
  }
});
test('no embedding coverage is explicit and avoids an OCI query call', async () => {
  let calls = 0;
  const c = { execute: async () => ({rows: ++calls === 1 ? [{PROFILE_CODE:'PROFILE_A'}] : [{REPORTS:5,EMBEDDED:0}]}) };
  const result = await searchReports(c, parseSearch({query:'payment diversion'}), {PATTERN_EMBEDDING_MODEL:'cohere.embed-v4.0',PATTERN_EMBEDDING_DIMENSIONS:1536,embedPatternTexts:()=>{throw Error('Must not embed');}});
  assert.deepEqual(result.results, []);
  assert.match(result.notice, /No compatible narrative embeddings/);
  assert.deepEqual(result.coverage, {reports:5,embedded:0});
});
test('embedding failures are surfaced with no category-vector fallback', async () => {
  let handler, calls = 0, status, response;
  const c = {execute: async () => ({rows: ++calls === 1 ? [{PROFILE_CODE:'PROFILE_A'}] : [{REPORTS:5,EMBEDDED:5}]})};
  registerIncidentSemanticSearch({post: (_, fn) => {handler=fn;}}, async (user, fn) => {assert.equal(user,'northern_analyst');return fn(c);}, {
    PATTERN_EMBEDDING_MODEL:'cohere.embed-v4.0',PATTERN_EMBEDDING_DIMENSIONS:1536,
    embedPatternTexts:async()=>{throw Error('OCI unavailable');}
  });
  const res={status:code=>{status=code;return res;},json:data=>{response=data;}};
  await handler({body:{query:'payment diversion'},demoUser:'northern_analyst'},res);
  assert.equal(status,503);
  assert.match(response.error,/no category-based fallback/);
  assert.equal(calls,2);
});
