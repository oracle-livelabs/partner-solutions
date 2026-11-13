'use strict';

const {randomUUID} = require('node:crypto');
const oracledb = require('oracledb');
const PAGE_SIZE = 10;
const fail = (status, message) => Object.assign(new Error(message), {status});
const json = value => typeof value === 'string' ? JSON.parse(value) : value || {};
const options = {outFormat: oracledb.OUT_FORMAT_OBJECT, fetchInfo: {PAYLOAD: {type: oracledb.STRING}}};
const fields = 'action_id,action_type,created_at,JSON_SERIALIZE(payload RETURNING CLOB) payload';
const labels = {agent_query: 'Guided agent', select_ai_v2_query: 'Ask IncidentData V2', select_ai_agent_v2_run: 'Native Agent V2', case_readiness_brief_prepared: 'Case-readiness brief'};

function turn(row) {
  const payload = json(row.PAYLOAD);
  const complete = payload.historyVersion === 1 && payload.response && typeof payload.response === 'object';
  return {actionId: row.ACTION_ID, actionType: row.ACTION_TYPE, createdAt: row.CREATED_AT,
    title: payload.title || payload.question || payload.topic || labels[row.ACTION_TYPE] || 'Recorded activity',
    question: payload.question || null, response: complete ? payload.response : null,
    status: complete ? payload.historyStatus || 'complete' : 'limited',
    details: Object.fromEntries(Object.entries(payload).filter(([key]) => !['response','historyVersion','historyThreadId','historyStatus'].includes(key)))};
}

function createAgentHistory(db, formatResponse = value => value) {
  async function prepare(user, actionType, threadId, nativeConversationId) {
    if (threadId != null && threadId !== '' && (typeof threadId !== 'string' || !/^[a-f0-9-]{36}$/i.test(threadId))) throw fail(400, 'Invalid saved conversation identifier.');
    if (nativeConversationId && (typeof nativeConversationId !== 'string' || nativeConversationId.length > 128)) throw fail(400, 'Invalid native conversation identifier.');
    if (!threadId && !nativeConversationId) return {threadId: randomUUID(), existing: false};
    return db(user, async connection => {
      const clause = threadId ? "JSON_VALUE(payload,'$.historyThreadId')=:id" : "JSON_VALUE(payload,'$.conversationId')=:id";
      const result = await connection.execute(`SELECT ${fields} FROM analyst_actions WHERE user_name=:userName AND action_type=:actionType AND ${clause} ORDER BY action_id DESC FETCH FIRST 1 ROW ONLY`, {userName:user, actionType, id:threadId || nativeConversationId}, options);
      if (!result.rows.length) throw fail(404, 'Saved conversation not found for this demo user. Start a new conversation.');
      const payload = json(result.rows[0].PAYLOAD);
      if (nativeConversationId && payload.conversationId !== nativeConversationId) throw fail(404, 'Saved conversation not found for this demo user.');
      return {threadId: payload.historyThreadId || randomUUID(), existing: Boolean(payload.historyThreadId), nativeConversationId: payload.conversationId};
    });
  }

  async function save(user, actionType, context, response, details = {}) {
    try {
      const payload = {...details, question: details.question || response.question,
        historyVersion: 1, historyThreadId: context.threadId,
        historyStatus: response.error ? 'failed' : 'complete', response: formatResponse(response)};
      const actionId = await db(user, async connection => {
        const result = await connection.execute(`INSERT INTO analyst_actions(user_name,action_type,payload) VALUES(:demoUser,:action,JSON(:payload)) RETURNING action_id INTO :actionId`, {
          demoUser:user, action:actionType, payload:{val:JSON.stringify(payload), type:oracledb.CLOB},
          actionId:{dir:oracledb.BIND_OUT, type:oracledb.NUMBER},
        });
        await connection.commit();
        return result.outBinds.actionId[0];
      });
      return {...response, historySaved:true, historyThreadId:context.threadId, auditActionId:actionId};
    } catch (error) {
      console.error('Conversation history save error:', error.message);
      return {...response, historySaved:false, historyThreadId:context.existing ? context.threadId : null,
        historyWarning:'This exchange could not be saved to conversation history. The result below is still available in this session.'};
    }
  }

  async function list(user) {
    return db(user, async connection => {
      // Keep the compact feed small: responses and result tables are fetched only
      // when an entry is opened, never downloaded for every sidebar card.
      const result = await connection.execute(`SELECT action_id,action_type,created_at,
        JSON_VALUE(payload,'$.title' RETURNING VARCHAR2(4000)) title,
        JSON_VALUE(payload,'$.question' RETURNING VARCHAR2(4000)) question,
        JSON_VALUE(payload,'$.topic') topic, JSON_VALUE(payload,'$.historyVersion') history_version,
        JSON_VALUE(payload,'$.historyStatus') history_status
        FROM analyst_actions WHERE user_name=:userName ORDER BY action_id DESC FETCH FIRST 8 ROWS ONLY`, {userName:user}, {outFormat:oracledb.OUT_FORMAT_OBJECT});
      return result.rows.map(row => ({ACTION_ID:row.ACTION_ID, ACTION_TYPE:row.ACTION_TYPE, CREATED_AT:row.CREATED_AT,
        PAYLOAD:{title:row.TITLE, question:row.QUESTION, topic:row.TOPIC},
        HISTORY_STATUS:row.HISTORY_VERSION === '1' ? row.HISTORY_STATUS || 'complete' : 'limited'}));
    });
  }

  async function read(user, actionId, requestedPage) {
    if (!/^[1-9]\d{0,14}$/.test(String(actionId))) throw fail(400, 'Invalid audit entry.');
    if (requestedPage !== undefined && !/^[1-9]\d{0,5}$/.test(String(requestedPage))) throw fail(400, 'Invalid history page.');
    return db(user, async connection => {
      const anchorResult = await connection.execute(`SELECT ${fields} FROM analyst_actions WHERE user_name=:userName AND action_id=:actionId`, {userName:user, actionId:Number(actionId)}, options);
      if (!anchorResult.rows.length) throw fail(404, 'Audit entry not found for this demo user.');
      const anchor = anchorResult.rows[0], payload = json(anchor.PAYLOAD);
      let clause = 'action_id=:threadKey', threadKey = Number(actionId);
      if (payload.historyThreadId) {clause = "JSON_VALUE(payload,'$.historyThreadId')=:threadKey"; threadKey = payload.historyThreadId;}
      else if (anchor.ACTION_TYPE === 'select_ai_agent_v2_run' && payload.conversationId) {
        clause = "JSON_VALUE(payload,'$.conversationId')=:threadKey"; threadKey = payload.conversationId;
      }
      const filter = `user_name=:userName AND action_type=:actionType AND ${clause}`;
      const binds = {userName:user, actionType:anchor.ACTION_TYPE, threadKey};
      const counts = await connection.execute(`SELECT COUNT(*) total, COUNT(CASE WHEN action_id<=:actionId THEN 1 END) position FROM analyst_actions WHERE ${filter}`, {...binds, actionId:Number(actionId)}, {outFormat:oracledb.OUT_FORMAT_OBJECT});
      const {TOTAL:total, POSITION:position} = counts.rows[0];
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const page = requestedPage ? Number(requestedPage) : Math.max(1, Math.ceil(position / PAGE_SIZE));
      if (page > pages) throw fail(400, 'History page is outside this conversation.');
      const result = await connection.execute(`SELECT ${fields} FROM analyst_actions WHERE ${filter} ORDER BY action_id OFFSET :skip ROWS FETCH NEXT :pageSize ROWS ONLY`, {...binds, skip:(page-1)*PAGE_SIZE, pageSize:PAGE_SIZE}, options);
      return {title:turn(anchor).title, actionType:anchor.ACTION_TYPE, selectedActionId:Number(actionId),
        threadId:payload.historyThreadId || null, user, page, pages, total, pageSize:PAGE_SIZE,
        readOnly:true, turns:result.rows.map(turn)};
    });
  }

  function register(app) {
    const route = fn => async (req, res) => {try {res.json(await fn(req));} catch(error) {res.status(error.status || 500).json({error:error.status ? error.message : 'Saved conversation history is unavailable. Please try again.'});}};
    app.get('/api/agents/actions', route(req => list(req.demoUser)));
    app.get('/api/agents/actions/:id/thread', route(req => read(req.demoUser, req.params.id, req.query.page)));
  }
  return {prepare, save, list, read, register};
}

module.exports = {createAgentHistory, turn};
