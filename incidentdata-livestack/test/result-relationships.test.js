const test = require('node:test');
const assert = require('node:assert/strict');
const { references, assembleGraph, registerResultRelationships } = require('../backend/result-relationships');

test('seed validation rejects oversized, non-string and malformed inputs', () => {
  assert.deepEqual(references([' I-1 ', 'I-1'], 'incidents', 30), ['I-1']);
  for (const input of ['I-1', [null], [''], Array(31).fill('I-1'), ['x'.repeat(121)]]) {
    assert.throws(() => references(input, 'incidents', 30), { status: 400 });
  }
});

test('graph keeps only authorised nodes and non-dangling links, with distinct provenance', () => {
  const graph = assembleGraph(
    [{ PATTERN_CODE: 'W1', PATTERN_NAME: 'Watch' }],
    [{ INCIDENT_REF: 'I1', REPORT_SUMMARY: 'Visible report' }],
    [{ POST_REF: 'P1', POST_TEXT: 'Unverified context' }],
    [{ PATTERN_CODE: 'W1', KIND: 'incident', REF: 'I1', RELATIONSHIP_LABEL: 'Recorded' },
      { PATTERN_CODE: 'W1', KIND: 'incident', REF: 'HIDDEN' }],
    [{ POST_REF: 'P1', INCIDENT_REF: 'I1', LINK_CONFIDENCE: 70 }, { POST_REF: 'HIDDEN', INCIDENT_REF: 'I1' }],
    [{ PATTERN_CODE: 'W1', INCIDENT_REF: 'I1', SIMILARITY_SCORE: 0.8 }],
    { patternCodes: ['W1'], incidentRefs: ['HIDDEN'], postRefs: ['P1'] });
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 3);
  assert.deepEqual(graph.edges.map(e => e.type), ['membership', 'reviewed', 'similarity']);
  assert.equal(graph.nodes.find(n => n.type === 'incident').matched, false);
  assert.equal(graph.edges[1].score, 70);
  assert.equal(graph.edges[2].score, 0.8);
  assert(!JSON.stringify(graph).includes('HIDDEN'));
});

test('endpoint does no database work for empty or invalid seeds', async () => {
  let handler;
  registerResultRelationships({ post: (path, fn) => { handler = fn; } }, () => { throw Error('Must not query'); });
  let status = 200, body;
  const res = { status(code) { status = code; return this; }, json(value) { body = value; return this; } };
  await handler({ body: {}, demoUser: 'read_only_viewer' }, res);
  assert.deepEqual(body.nodes, []);
  await handler({ body: { incidentRefs: 'bad' } }, res);
  assert.equal(status, 400);
});
