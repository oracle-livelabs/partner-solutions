'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const oracledb = require('oracledb');
const {createAgentHistory, turn} = require('../backend/agent-history');
const {registerAgentConsoleRoutes} = require('../backend/agent-console-routes');
const threadId = '11111111-2222-4333-8444-555555555555';
const row = (id, payload, actionType = 'agent_query') => ({ACTION_ID:id, ACTION_TYPE:actionType, CREATED_AT:new Date('2026-09-15T01:00:00Z'), PAYLOAD:JSON.stringify(payload)});

test('older entries never fabricate an assistant answer', () => {
  const result = turn(row(1, {question:'What happened?', generatedSql:'SELECT example', rowCount:5}));
  assert.equal(result.status, 'limited'); assert.equal(result.response, null);
  assert.equal(result.question, 'What happened?'); assert.equal(result.details.rowCount, 5);
  assert.equal(turn(row(2, {})).question, null);
});

test('full responses and failures are identified without discarding original details', () => {
  const result = turn(row(1, {question:'Q', historyVersion:1, historyThreadId:threadId, historyStatus:'complete', response:{answer:'A', rows:[{VALUE:42}]}}));
  assert.equal(result.status, 'complete'); assert.deepEqual(result.response.rows, [{VALUE:42}]);
  assert.equal(result.details.historyThreadId, undefined);
  assert.equal(turn(row(2, {historyVersion:1, historyStatus:'failed', response:{error:'Unavailable'}})).status, 'failed');
});

test('new thread IDs are server-generated; ownership and workflow are checked on continuation', async () => {
  const calls = [];
  const history = createAgentHistory(async (user, fn) => fn({execute:async (sql, binds) => {calls.push({user, sql, binds}); return {rows:[]};}}));
  const first = await history.prepare('northern_analyst', 'agent_query');
  assert.match(first.threadId, /^[a-f0-9-]{36}$/); assert.equal(calls.length, 0);
  await assert.rejects(history.prepare('northern_analyst', 'agent_query', 'invalid'), {status:400});
  await assert.rejects(history.prepare('northern_analyst', 'agent_query', threadId), {status:404});
  assert.match(calls[0].sql, /user_name=:userName AND action_type=:actionType/);
  assert.equal(calls[0].binds.userName, 'northern_analyst'); assert.equal(calls[0].binds.actionType, 'agent_query');
});

test('native conversation IDs must match the owned thread before any native call', async () => {
  const history = createAgentHistory(async (user, fn) => fn({execute:async () => ({rows:[row(1, {historyThreadId:threadId, conversationId:'native-owned'})]})}));
  await assert.rejects(history.prepare('northern_analyst', 'select_ai_agent_v2_run', threadId, 'foreign-native'), {status:404});
  const context = await history.prepare('northern_analyst', 'select_ai_agent_v2_run', threadId, 'native-owned');
  assert.equal(context.nativeConversationId, 'native-owned'); assert.equal(context.existing, true);
});

test('saves full server responses with a CLOB bind and returns a history reference after commit', async () => {
  let saved, committed = false;
  const history = createAgentHistory(async (user, fn) => {
    assert.equal(user, 'northern_analyst');
    return fn({execute:async (sql, binds) => {
      assert.match(sql, /^INSERT INTO analyst_actions/); assert.equal(binds.payload.type, oracledb.CLOB);
      saved = JSON.parse(binds.payload.val); return {outBinds:{actionId:[301]}};
    }, commit:async () => {committed = true;}});
  }, value => ({...value, answer:value.answer.replace('synthetic','demonstration')}));
  const response = {question:'Q', answer:'synthetic answer', rows:[{NARRATIVE:'会話'.repeat(25000)}]};
  const result = await history.save('northern_analyst', 'agent_query', {threadId}, response, {question:'Original synthetic question', title:'Title'});
  assert(committed); assert.equal(result.auditActionId, 301); assert.equal(result.historySaved, true);
  assert.equal(saved.question, 'Original synthetic question'); assert.equal(saved.response.answer, 'demonstration answer');
  assert.equal(saved.response.rows[0].NARRATIVE, response.rows[0].NARRATIVE);
  assert.equal(saved.response.auditActionId, undefined);
});

test('a storage failure is explicit and does not issue a nonexistent new thread ID', async () => {
  const history = createAgentHistory(async () => {throw Error('Simulated storage outage');});
  const response = await history.save('user', 'agent_query', {threadId, existing:false}, {answer:'Still visible'});
  assert.equal(response.historySaved, false); assert.equal(response.historyThreadId, null);
  assert.match(response.historyWarning, /could not be saved/); assert.equal(response.answer, 'Still visible');
});

test('history reads are owner-scoped, paginated, and never execute stored SQL', async () => {
  const calls = [], anchor = row(17, {question:'Q', historyVersion:1, historyThreadId:threadId, response:{answer:'Saved'}});
  const history = createAgentHistory(async (user, fn) => fn({execute:async (sql, binds) => {
    calls.push({sql, binds}); assert.match(sql, /^SELECT /); assert.equal(binds.userName, user);
    return {rows:calls.length === 1 ? [anchor] : calls.length === 2 ? [{TOTAL:17, POSITION:17}] : [anchor]};
  }}));
  const result = await history.read('northern_analyst', '17');
  assert.equal(result.page, 2); assert.equal(result.pages, 2); assert.equal(result.total, 17);
  assert.equal(result.selectedActionId, 17); assert.equal(result.turns[0].response.answer, 'Saved');
  assert.equal(calls[2].binds.skip, 10); assert.equal(calls[2].binds.pageSize, 10);
  assert(calls.every(call => /user_name=:userName/.test(call.sql)));
});

test('unknown or foreign action IDs return the same 404 before thread details are read', async () => {
  let calls = 0;
  const history = createAgentHistory(async (user, fn) => fn({execute:async () => {calls++; return {rows:[]};}}));
  await assert.rejects(history.read('user', '17'), {status:404}); assert.equal(calls, 1);
  await assert.rejects(history.read('user', '1 OR 1=1'), {status:400});
  await assert.rejects(history.read('user', '17', '-1'), {status:400}); assert.equal(calls, 1);
});

test('legacy native exchanges are grouped only by the recorded conversation, user and workflow', async () => {
  let calls = 0;
  const anchor = row(2, {question:'Q', conversationId:'legacy-native'}, 'select_ai_agent_v2_run');
  const history = createAgentHistory(async (user, fn) => fn({execute:async (sql, binds) => {
    calls++; if (calls > 1) {assert.match(sql, /action_type=:actionType/); assert.equal(binds.threadKey, 'legacy-native');}
    return {rows:calls === 1 ? [anchor] : calls === 2 ? [{TOTAL:2, POSITION:2}] : [anchor]};
  }}));
  assert.equal((await history.read('user','2')).turns[0].status, 'limited');
});

test('compact list does not retrieve saved result snapshots', async () => {
  const history = createAgentHistory(async (user, fn) => fn({execute:async (sql, binds) => {
    assert(!sql.includes('JSON_SERIALIZE')); assert(!sql.includes('$.response')); assert.match(sql, /FETCH FIRST 8/);
    assert.equal(binds.userName, 'user'); return {rows:[{ACTION_ID:1,ACTION_TYPE:'agent_query',HISTORY_VERSION:'1',HISTORY_STATUS:'complete',QUESTION:'Useful question'}]};
  }}));
  const list = await history.list('user'); assert.equal(list[0].PAYLOAD.question, 'Useful question'); assert.equal(list[0].HISTORY_STATUS, 'complete');
});

test('rejected history ownership prevents query execution and audit writes', async () => {
  const routes = new Map(); let writes = 0, calls = 0;
  registerAgentConsoleRoutes({post:(path, fn) => routes.set(path, fn)}, {
    history:{prepare:async () => {throw Object.assign(Error('Not found'),{status:404});}, save:async () => {writes++;}},
    db:async () => {calls++;},
  });
  const res = {status(value) {this.code=value;return this;}, json(value) {this.body=value;}};
  for (const path of ['/api/agents/run','/api/ask-v2','/api/agent-v2/run']) {
    await routes.get(path)({body:{question:'Q',historyThreadId:threadId},demoUser:'user'}, res);
    assert.equal(res.code, 404);
  }
  assert.equal(calls, 0); assert.equal(writes, 0);
});

test('native runs archive their original answer and reuse only the owned native conversation', async () => {
  const routes = new Map(), calls = [], saved = [];
  let context = {threadId,existing:false};
  registerAgentConsoleRoutes({post:(path, fn) => routes.set(path, fn)}, {
    nativeTeam:'NATIVE_TEST_TEAM',
    history:{prepare:async () => context, save:async (user, type, ctx, response, details) => {saved.push({user,type,ctx:{...ctx},response,details});return response;}},
    db:async (user, fn) => {assert.equal(user,'northern_analyst');return fn({execute:async (sql, binds, options) => {
      calls.push({sql,binds});
      if (sql.includes('CREATE_CONVERSATION')) return {rows:[{CONVERSATION_ID:'owned-native'}]};
      if (sql.includes('RUN_TEAM')) {assert.equal(JSON.parse(binds.params).conversation_id,'owned-native');assert.equal(options.fetchInfo.ANSWER.type,oracledb.STRING);return {rows:[{ANSWER:'Original native answer'}]};}
      return {};
    }});},
  });
  const handler = routes.get('/api/agent-v2/run'), res = {json(value) {this.body=value;},status() {return this;}};
  await handler({demoUser:'northern_analyst',body:{question:'First question'}},res);
  context = {threadId,existing:true,nativeConversationId:'owned-native'};
  await handler({demoUser:'northern_analyst',body:{question:'Follow-up',historyThreadId:threadId,conversationId:'owned-native'}},res);
  assert.equal(calls.filter(call=>call.sql.includes('CREATE_CONVERSATION')).length,1);
  assert.equal(calls.filter(call=>call.sql.includes('RUN_TEAM')).length,2);
  assert.equal(saved.length,2); assert.equal(saved[1].response.answer,'Original native answer');
  assert.equal(saved[1].details.question,'Follow-up'); assert.equal(saved[1].details.conversationId,'owned-native');
});
