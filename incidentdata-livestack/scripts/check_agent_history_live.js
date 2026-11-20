'use strict';
// Transactional integration checks. All fixture rows are rolled back; no AI calls.
const assert = require('node:assert/strict');
const oracledb = require('oracledb');
const {createAgentHistory} = require('../backend/agent-history');
(async () => {
  if (process.env.ORACLE_USER !== 'CRIME_DATA' || !/fu40/i.test(process.env.ORACLE_CONNECTION_STRING || '')) throw Error('Expected FU40 IncidentData.');
  const wallet = process.env.ORACLE_WALLET_LOCATION;
  const connection = await oracledb.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:wallet,configDir:wallet,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
  try {
    connection.callTimeout = 15000;
    const db = async (user, fn) => {
      await connection.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:userName); END;', {userName:user});
      // Deliberately suppress the helper's commit for rollback-only test fixtures.
      return fn({execute:connection.execute.bind(connection), commit:async () => {}});
    };
    const history = createAgentHistory(db), user = 'read_only_viewer';
    const context = await history.prepare(user, 'agent_query');
    const narrative = 'Oracle JSON history — 会話. '.repeat(2000);
    const ids = [];
    for (let i = 0; i < 12; i++) {
      const response = await history.save(user, 'agent_query', context,
        {answer:`Original answer ${i}`, rows:i === 11 ? [{NARRATIVE:narrative}] : [], columns:['NARRATIVE']},
        {question:`Rollback-only history test ${i}`,title:'Rollback-only history regression'});
      assert.equal(response.historySaved,true); ids.push(response.auditActionId);
    }
    const resumed = await history.prepare(user,'agent_query',context.threadId);
    assert.equal(resumed.threadId,context.threadId);
    const latest = await history.read(user,ids[11]);
    assert.equal(latest.total,12); assert.equal(latest.page,2); assert.equal(latest.turns.length,2);
    assert.equal(latest.turns[1].response.rows[0].NARRATIVE,narrative);
    const earliest = await history.read(user,ids[11],1);
    assert.equal(earliest.turns.length,10); assert.equal(earliest.turns[0].actionId,ids[0]);
    const feed = await history.list(user);
    assert.equal(feed[0].ACTION_ID,ids[11]); assert.equal(feed[0].PAYLOAD.response,undefined);
    await assert.rejects(history.read('statewide_admin',ids[11]),{status:404});
    await assert.rejects(history.prepare('statewide_admin','agent_query',context.threadId),{status:404});
    await assert.rejects(history.prepare(user,'select_ai_v2_query',context.threadId),{status:404});
    const legacy = await connection.execute(`INSERT INTO analyst_actions(user_name,action_type,payload) VALUES(:userName,'agent_query',JSON(:payload)) RETURNING action_id INTO :id`, {userName:user,payload:JSON.stringify({question:'Legacy original question',rowCount:5}),id:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}});
    const old = await history.read(user,legacy.outBinds.id[0]);
    assert.equal(old.turns[0].status,'limited'); assert.equal(old.turns[0].response,null);
    console.log(JSON.stringify({checks:'Oracle JSON persistence, long text, 12-turn paging, compact feed, owner/workflow isolation, legacy fallback',longTextCharacters:narrative.length,fixtureRows:13,fixtureRetention:'rolled back'}));
  } finally {await connection.rollback(); await connection.close();}
})().catch(error => {console.error(error.message);process.exitCode=1;});
