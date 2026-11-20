'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const oracledb = require('oracledb');
const {executeSelectAiV2Results} = require('../backend/ask-crime-v2-results');
const {registerAgentConsoleRoutes} = require('../backend/agent-console-routes');
const {createAgentHistory} = require('../backend/agent-history');

const source = fs.readFileSync(require.resolve('../backend/server'), 'utf8');
const copySource = source.slice(source.indexOf('function presentationCopy('), source.indexOf('\napp.use(', source.indexOf('function presentationCopy(')));
const presentationCopy = vm.runInNewContext(`(${copySource})`, {Date});
const routeSource = source.slice(source.indexOf('const SELECT_AI_V2_PROFILE'), source.indexOf('const SELECT_AI_AGENT_V2_TEAM'));
const question = 'show me the last 5 incidents in norwood, including report summary and narrative';
const validSql = 'SELECT report_summary, report_text FROM secure_incident_reports_v FETCH FIRST 5 ROWS ONLY';

test('fetches CLOB and NCLOB by type, independently of generated column names', async () => {
  const globalFetchAsString = [...oracledb.fetchAsString];
  const result = {rows: []};
  const connection = {execute: async (sql, binds, options) => {
    assert.equal(sql, `SELECT /* Ask Crime V2 text results */ * FROM (${validSql}) WHERE ROWNUM<=100`);
    assert.deepEqual(binds, {});
    assert.equal(options.outFormat, oracledb.OUT_FORMAT_OBJECT);
    for (const name of ['REPORT_TEXT', 'ReportNarrative', 'Narrative with spaces']) {
      for (const dbType of [oracledb.DB_TYPE_CLOB, oracledb.DB_TYPE_NCLOB]) {
        assert.deepEqual(options.fetchTypeHandler({name, dbType}), {type: oracledb.STRING});
      }
    }
    for (const dbType of [oracledb.DB_TYPE_VARCHAR, oracledb.DB_TYPE_NUMBER, oracledb.DB_TYPE_DATE, oracledb.DB_TYPE_JSON, oracledb.DB_TYPE_BLOB]) {
      assert.equal(options.fetchTypeHandler({name: 'OTHER', dbType}), undefined);
    }
    return result;
  }};
  assert.equal(await executeSelectAiV2Results(connection, validSql), result);
  assert.deepEqual(oracledb.fetchAsString, globalFetchAsString, 'Other routes retain their fetch configuration');
});

function harness({failures = 0, rows = [], generatedSql = validSql} = {}) {
  const state = {prompts: [], queries: [], audit: [], closed: 0, errors: []};
  let handler;
  const dependencies = {
    Date, oracledb, executeSelectAiV2Results,
    ops:require('../backend/ai-ops-telemetry'),
    console: {error: (...args) => state.errors.push(args)},
    db: async (user, fn) => {
      assert.equal(user, 'northern_analyst');
      let open = true;
      try {
        return await fn({
          execute: async (sql, binds, options) => {
            assert(open, 'Fetch must finish before the connection is released');
            if (sql.includes('DBMS_CLOUD_AI.GENERATE')) {
              state.prompts.push(binds.prompt);
              return {rows: [{GENERATED_SQL: generatedSql}]};
            }
            if (sql.startsWith('INSERT INTO analyst_actions')) {
              state.audit.push(JSON.parse(binds.payload.val));
              return {outBinds:{actionId:[101]}};
            }
            state.queries.push(sql);
            assert.match(sql, /WHERE ROWNUM<=100$/);
            assert.equal(options.fetchTypeHandler({name: 'Any narrative alias', dbType: oracledb.DB_TYPE_CLOB}).type, oracledb.STRING);
            assert.equal(options.fetchTypeHandler({name: 'Any narrative alias', dbType: oracledb.DB_TYPE_NCLOB}).type, oracledb.STRING);
            await Promise.resolve();
            assert(open);
            if (state.queries.length <= failures) throw Error('ORA-00904: invalid identifier');
            return {rows};
          },
          commit: async () => {assert(open);},
        });
      } finally {open = false; state.closed++;}
    },
  };
  const generate = vm.runInNewContext(routeSource + '\nselectAiV2Generate;', dependencies);
  registerAgentConsoleRoutes({post:(path, fn) => {if (path === '/api/ask-v2') handler = fn;}}, {
    db:dependencies.db, history:createAgentHistory(dependencies.db, presentationCopy), selectAiV2Generate:generate,
    profile:'CRIMEDATA_SELECT_AI_V2', model:'test-model', nativeTeam:'test-team',
  });
  return {state, run: async (body = {question}) => {
    const response = {statusCode: 200, status(code) {this.statusCode = code; return this;}, json(payload) {
      this.body = JSON.parse(JSON.stringify(presentationCopy(payload)));
      return this;
    }};
    await handler({body, demoUser: 'northern_analyst'}, response);
    return response;
  }};
}

for (const failures of [0, 1]) {
  test(`route serialises full long-text results after ${failures} SQL retries`, async () => {
    const narrative = 'Norwood report — café discussion. '.repeat(1500);
    const rows = [{ReportSummary: 'Report summary', 'Report narrative': narrative, NCLOB_TEXT: '会話 — café', NUMBER_VALUE: 5, OCCURRED_AT: new Date('2026-06-30T09:00:00Z'), ATTRIBUTES: {source: 'demo'}, NULL_TEXT: null}];
    const {state, run} = harness({failures, rows});
    const response = await run();
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.rows[0]['Report narrative'], narrative);
    assert.equal(response.body.rows[0].NULL_TEXT, null);
    assert.equal(response.body.rows[0].NCLOB_TEXT, '会話 — café');
    assert.equal(response.body.rows[0].NUMBER_VALUE, 5);
    assert.equal(response.body.rows[0].OCCURRED_AT, '2026-06-30T09:00:00.000Z');
    assert.deepEqual(response.body.rows[0].ATTRIBUTES, {source: 'demo'});
    assert.equal(response.body.rowCount, 1);
    assert.equal(response.body.generatedSql, validSql);
    assert.equal(state.queries.length, failures + 1);
    assert.equal(state.prompts.length, failures + 1);
    assert.equal(state.prompts[0], question);
    if (failures) assert.match(state.prompts[1], /previous Oracle SQL failed with: ORA-00904/);
    assert.equal(state.audit.length, 1);
    assert.equal(state.audit[0].rowCount, 1);
    assert.equal(state.closed, 2 * (failures + 1) + 1);
    assert.deepEqual(state.errors, []);
  });
}

test('empty results remain a successful response', async () => {
  const {run} = harness();
  const response = await run();
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.rowCount, 0);
  assert.deepEqual(response.body.rows, []);
  assert.deepEqual(response.body.columns, []);
});

test('second SQL failure remains an error, with no unbounded retry and an explicitly failed audit', async () => {
  const {run, state} = harness({failures: 2});
  const response = await run();
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /ORA-00904/);
  assert.equal(state.queries.length, 2);
  assert.equal(state.prompts.length, 2);
  assert.equal(state.audit.length, 1);
  assert.equal(state.audit[0].historyStatus, 'failed');
});

test('empty question and out-of-scope SQL never reach the executor', async () => {
  const empty = harness();
  assert.equal((await empty.run({question: ' '})).statusCode, 400);
  assert.equal(empty.state.prompts.length, 0);
  const invalid = harness({generatedSql: 'SELECT * FROM persons_of_interest'});
  const response = await invalid.run();
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /outside the approved read-only crime-data scope/);
  assert.equal(invalid.state.queries.length, 0);
  assert.equal(invalid.state.audit.length, 1);
  assert.equal(invalid.state.audit[0].historyStatus, 'failed');
});

test('regression fixture reproduces the original formatter overflow for driver-shaped cycles', () => {
  const lob = {};
  lob.connection = {lob};
  assert.throws(() => presentationCopy({rows: [{REPORT_TEXT: lob}]}), /Maximum call stack size exceeded/);
});
