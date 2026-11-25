'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {WATCH_CODES, visible, planFlags} = require('../scripts/align_city_watch_patterns.cjs');
const fixture = () => [...WATCH_CODES, 'LOCAL_CITY_SERIES'].map((PATTERN_CODE, i) => ({
  PATTERN_CODE, ACTIVE: 1, ACTIVATE_UI: 'Y', PATTERN_NAME: `Local name ${i}`, CASE_REF: `LOCAL-${i}`,
}));

test('city alignment hides additional watches and preserves local definitions', () => {
  const rows = fixture(), original = structuredClone(rows);
  assert.deepEqual(planFlags(rows, 'city'), [{code: 'LOCAL_CITY_SERIES', before: 'Y', flag: null}]);
  assert.deepEqual(rows, original);
});

test('city alignment enables the same six codes and is idempotent', () => {
  const rows = fixture().map(r => ({...r, ACTIVATE_UI: null}));
  const changes = planFlags(rows, 'city');
  assert.equal(changes.length, 6);
  for (const change of changes) rows.find(r => r.PATTERN_CODE === change.code).ACTIVATE_UI = change.flag;
  assert.deepEqual(visible(rows), [...WATCH_CODES].sort());
  assert.deepEqual(planFlags(rows, 'city'), []);
});

test('missing or inactive shared definitions stop alignment rather than fabricating records', () => {
  assert.throws(() => planFlags(fixture().slice(1), 'city'), /missing active definition SERVICE_ACCESS/);
  const rows = fixture(); rows[0].ACTIVE = 0;
  assert.throws(() => planFlags(rows, 'city'), /missing active definition SERVICE_ACCESS/);
  assert.throws(() => planFlags([...fixture(), fixture()[0]], 'city'), /duplicate pattern/);
});
