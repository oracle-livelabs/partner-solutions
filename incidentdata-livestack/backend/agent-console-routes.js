'use strict';

const oracledb = require('oracledb');
const ops = require('./ai-ops-telemetry');
const {executeSelectAiV2Results} = require('./ask-crime-v2-results');

function registerAgentConsoleRoutes(app, {db, history, crimeAskTopic, crimeAgentTeam, crimeAgentLabel, selectAiV2Generate, profile, model, nativeTeam}) {
  // History is an archive of displayed exchanges. It does not add model memory
  // to guided queries or Ask IncidentData V2, or execute anything when history is read.
  function register(path, actionType, execute) {
    app.post(path, async (req, res) => {
      const question = String(req.body?.question || '').trim();
      if (!question) return res.status(400).json({error:'A question is required.'});
      let context;
      try {
        context = await history.prepare(req.demoUser, actionType, req.body?.historyThreadId,
          actionType === 'select_ai_agent_v2_run' ? req.body?.conversationId : undefined);
        const {response, details} = await execute(req, question, context);
        res.json(await history.save(req.demoUser, actionType, context, response, {...details, question}));
      } catch (error) {
        console.error(`${actionType} error:`, error.message);
        const response = {error:error.message};
        res.status(error.status || 400).json(context ? await history.save(req.demoUser, actionType, context, response,
          {question, ...(context.nativeConversationId ? {conversationId:context.nativeConversationId, team:nativeTeam} : {})}) : response);
      }
    });
  }

  register('/api/agents/run', 'agent_query', async (req, question) => {
    const started = Date.now(), topic = crimeAskTopic(question), team = crimeAgentTeam(topic.id);
    const result = await db(req.demoUser, connection => connection.execute(topic.sql));
    const rows = result.rows || [];
    const response = {team, agent:crimeAgentLabel(team), topic:topic.id, title:topic.title, question,
      answer:topic.answer(rows), findings:[`Routed to ${crimeAgentLabel(team)}.`,
        `Reviewed Oracle SQL template returned ${rows.length} scoped row${rows.length===1?'':'s'}.`,
        'Synthetic descriptive data only — no deployment, person, or risk recommendation.'],
      sql:topic.sql, columns:rows[0]?Object.keys(rows[0]):[], rows, rowCount:rows.length, elapsed:Date.now()-started};
    return {response, details:{team, topic:topic.id, title:topic.title, rowCount:rows.length}};
  });

  register('/api/ask-v2', 'select_ai_v2_query', async (req, question) => {
    const started = Date.now();
    let generatedSql = await selectAiV2Generate(req.demoUser, question), result;
    try {
      result = await db(req.demoUser, connection => executeSelectAiV2Results(connection, generatedSql));
    } catch (firstError) {
      generatedSql = await selectAiV2Generate(req.demoUser, `${question}\n\nThe previous Oracle SQL failed with: ${firstError.message}\nGenerate a corrected Oracle SELECT. Use double quotes only for identifiers, never single quotes for aliases.`,2);
      result = await db(req.demoUser, connection => executeSelectAiV2Results(connection, generatedSql));
    }
    const rows = result.rows || [];
    const response = {title:'IncidentData Assistant V2', question,
      answer:rows.length ? `Select AI generated a read-only query and Oracle returned ${rows.length} authorised row${rows.length===1?'':'s'}. Review the result and generated SQL below; the assistant does not infer responsibility, risk, or an operational response.` : 'Select AI generated a read-only query. No rows were returned in your active data-security scope.',
      keyFindings:[`Native ADB Select AI · ${model}`, 'Scoped to eight approved crime-data domains through secure views.', 'Generated SQL was validated before it was executed.'],
      generatedSql, columns:rows[0]?Object.keys(rows[0]):[], rows, rowCount:rows.length, elapsed:Date.now()-started, model:`OCI GenAI · ${model}`};
    return {response, details:{generatedSql, rowCount:rows.length, profile, model}};
  });

  register('/api/agent-v2/run', 'select_ai_agent_v2_run', async (req, question, context) => {
    const started = Date.now();
    const result = await db(req.demoUser, async connection => {
      await connection.execute('ALTER SESSION DISABLE PARALLEL QUERY');
      let conversationId = context.nativeConversationId;
      if (!conversationId) {
        const created = await connection.execute('SELECT DBMS_CLOUD_AI.CREATE_CONVERSATION(:attributes) conversation_id FROM dual', {
          attributes:JSON.stringify({title:'IncidentData Agent V2 case memory', description:'Short-lived synthetic watched-pattern investigation context.', retention_days:1, conversation_length:5}),
        });
        conversationId = created.rows?.[0]?.CONVERSATION_ID;
      }
      context.nativeConversationId = conversationId;
      const answer = await ops.nativeExecute(connection,{feature:'Native Agent V2',conversationId,team:nativeTeam},`SELECT DBMS_CLOUD_AI_AGENT.RUN_TEAM(team_name=>:team,user_prompt=>:prompt,params=>:params) answer FROM dual`, {
        team:nativeTeam, prompt:question, params:JSON.stringify({conversation_id:conversationId}),
      }, {fetchInfo:{ANSWER:{type:oracledb.STRING}}});
      return {conversationId, answer:answer.rows?.[0]?.ANSWER || ''};
    });
    const response = {title:'IncidentData Select AI Agent V2', team:nativeTeam, ...result, question, elapsed:Date.now()-started,
      layers:['Planning','Controlled tool use','Reflection','Case-scoped memory'],
      tools:['Pattern brief','Pattern links','Area and time summary','Evidence and report summary','Data readiness check','Supporting teaching records']};
    return {response, details:{team:nativeTeam, conversationId:result.conversationId}};
  });
}

module.exports = {registerAgentConsoleRoutes};
