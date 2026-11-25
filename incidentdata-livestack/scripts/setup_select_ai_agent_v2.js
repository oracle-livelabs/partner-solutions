/* Create the governed IncidentData Select AI Agent V2 foundation.
 *
 * This is intentionally a narrow first release: the team can plan, call five
 * read-only custom tools, and reflect on coverage. It does not have an NL2SQL,
 * web-search, notification, DML, or DDL tool. Each custom tool reads the
 * existing secure views, so the session CLIENT_IDENTIFIER still determines
 * geographic scope.
 */
require('dotenv').config();
const oracledb = require('oracledb');

const PROFILE = 'CRIMEDATA_SELECT_AI_V2';
const TEAM = 'CRIMEDATA_PATTERN_INVESTIGATION_TEAM';
const AGENTS = ['CRIMEDATA_PATTERN_INVESTIGATOR'];
const TASKS = ['CRIMEDATA_PATTERN_INVESTIGATION_TASK'];
const LEGACY_AGENTS = ['CRIMEDATA_PATTERN_PLANNER','CRIMEDATA_PATTERN_REVIEWER'];
const LEGACY_TASKS = ['CRIMEDATA_PATTERN_PLAN_TASK','CRIMEDATA_PATTERN_RESEARCH_TASK','CRIMEDATA_PATTERN_REFLECT_TASK'];
const TOOLS = ['CRIMEDATA_PATTERN_BRIEF_TOOL','CRIMEDATA_PATTERN_LINKS_TOOL','CRIMEDATA_AREA_TIME_TOOL','CRIMEDATA_EVIDENCE_REPORT_TOOL','CRIMEDATA_READINESS_TOOL'];

const functions = [
  `CREATE OR REPLACE FUNCTION crimedata_agent_pattern_brief(p_pattern_code IN VARCHAR2) RETURN CLOB AUTHID DEFINER IS l_result CLOB; BEGIN SELECT JSON_OBJECT('pattern_code' VALUE w.pattern_code,'pattern_name' VALUE w.pattern_name,'summary' VALUE w.pattern_summary,'why_watch' VALUE w.why_watch,'kind' VALUE w.pattern_kind,'status' VALUE w.pattern_status RETURNING CLOB) INTO l_result FROM secure_watched_crime_patterns_v w WHERE w.pattern_code=UPPER(TRIM(p_pattern_code)); RETURN l_result; EXCEPTION WHEN NO_DATA_FOUND THEN SELECT JSON_OBJECT('status' VALUE 'no_data','message' VALUE 'No watched pattern is visible in the current authorised scope.' RETURNING CLOB) INTO l_result FROM dual; RETURN l_result; END;`,
  `CREATE OR REPLACE FUNCTION crimedata_agent_pattern_links(p_pattern_code IN VARCHAR2) RETURN CLOB AUTHID DEFINER IS l_result CLOB; BEGIN SELECT JSON_OBJECT('pattern_code' VALUE UPPER(TRIM(p_pattern_code)),'linked_incidents' VALUE COUNT(DISTINCT wpi.incident_ref),'linked_public_posts' VALUE COUNT(DISTINCT wpp.post_ref),'public_post_notice' VALUE 'Posts are simulated, external, and unverified; they do not validate an incident.' RETURNING CLOB) INTO l_result FROM secure_watched_crime_patterns_v w LEFT JOIN secure_watched_pattern_incidents_v wpi ON wpi.pattern_code=w.pattern_code LEFT JOIN secure_watched_pattern_posts_v wpp ON wpp.pattern_code=w.pattern_code WHERE w.pattern_code=UPPER(TRIM(p_pattern_code)) GROUP BY w.pattern_code; RETURN l_result; EXCEPTION WHEN NO_DATA_FOUND THEN SELECT JSON_OBJECT('status' VALUE 'no_data','message' VALUE 'No watched pattern is visible in the current authorised scope.' RETURNING CLOB) INTO l_result FROM dual; RETURN l_result; END;`,
  `CREATE OR REPLACE FUNCTION crimedata_agent_area_time_summary(p_pattern_code IN VARCHAR2) RETURN CLOB AUTHID DEFINER IS l_result CLOB; BEGIN SELECT JSON_OBJECT('pattern_code' VALUE UPPER(TRIM(p_pattern_code)),'linked_incidents' VALUE COUNT(DISTINCT i.incident_id),'suburbs' VALUE COUNT(DISTINCT i.suburb),'patrol_areas' VALUE COUNT(DISTINCT p.area_name),'first_occurrence' VALUE TO_CHAR(MIN(i.occurred_at),'YYYY-MM-DD'),'last_occurrence' VALUE TO_CHAR(MAX(i.occurred_at),'YYYY-MM-DD') RETURNING CLOB) INTO l_result FROM secure_watched_pattern_incidents_v wpi JOIN secure_crime_incidents_v i ON i.incident_ref=wpi.incident_ref JOIN patrol_areas p ON p.patrol_area_id=i.patrol_area_id WHERE wpi.pattern_code=UPPER(TRIM(p_pattern_code)); RETURN l_result; END;`,
  `CREATE OR REPLACE FUNCTION crimedata_agent_evidence_report_summary(p_pattern_code IN VARCHAR2) RETURN CLOB AUTHID DEFINER IS l_result CLOB; BEGIN SELECT JSON_OBJECT('pattern_code' VALUE UPPER(TRIM(p_pattern_code)),'linked_incidents' VALUE COUNT(DISTINCT i.incident_id),'incidents_with_reports' VALUE COUNT(DISTINCT CASE WHEN r.report_id IS NOT NULL THEN i.incident_id END),'evidence_items' VALUE COUNT(DISTINCT e.evidence_id),'notice' VALUE 'Counts describe synthetic authorised record coverage only.' RETURNING CLOB) INTO l_result FROM secure_watched_pattern_incidents_v wpi JOIN secure_crime_incidents_v i ON i.incident_ref=wpi.incident_ref LEFT JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id LEFT JOIN secure_evidence_items_v e ON e.incident_id=i.incident_id WHERE wpi.pattern_code=UPPER(TRIM(p_pattern_code)); RETURN l_result; END;`,
  `CREATE OR REPLACE FUNCTION crimedata_agent_readiness(p_pattern_code IN VARCHAR2) RETURN CLOB AUTHID DEFINER IS l_result CLOB; BEGIN SELECT JSON_OBJECT('pattern_code' VALUE UPPER(TRIM(p_pattern_code)),'incidents' VALUE COUNT(DISTINCT i.incident_id),'reports' VALUE COUNT(DISTINCT r.report_id),'evidence_items' VALUE COUNT(DISTINCT e.evidence_id),'mapped_incidents' VALUE COUNT(DISTINCT CASE WHEN i.latitude IS NOT NULL AND i.longitude IS NOT NULL THEN i.incident_id END),'linked_public_posts' VALUE COUNT(DISTINCT wpp.post_ref),'readiness_note' VALUE 'Review coverage and gaps with an analyst; this is not an operational suitability assessment.' RETURNING CLOB) INTO l_result FROM secure_watched_crime_patterns_v w LEFT JOIN secure_watched_pattern_incidents_v wpi ON wpi.pattern_code=w.pattern_code LEFT JOIN secure_crime_incidents_v i ON i.incident_ref=wpi.incident_ref LEFT JOIN secure_incident_reports_v r ON r.incident_id=i.incident_id LEFT JOIN secure_evidence_items_v e ON e.incident_id=i.incident_id LEFT JOIN secure_watched_pattern_posts_v wpp ON wpp.pattern_code=w.pattern_code WHERE w.pattern_code=UPPER(TRIM(p_pattern_code)) GROUP BY w.pattern_code; RETURN l_result; EXCEPTION WHEN NO_DATA_FOUND THEN SELECT JSON_OBJECT('status' VALUE 'no_data','message' VALUE 'No watched pattern is visible in the current authorised scope.' RETURNING CLOB) INTO l_result FROM dual; RETURN l_result; END;`
];

const toolDefinitions = [
  ['CRIMEDATA_PATTERN_BRIEF_TOOL','CRIME_DATA.CRIMEDATA_AGENT_PATTERN_BRIEF','Retrieve a watched pattern definition and its monitoring rationale. Input p_pattern_code is required.'],
  ['CRIMEDATA_PATTERN_LINKS_TOOL','CRIME_DATA.CRIMEDATA_AGENT_PATTERN_LINKS','Retrieve aggregate authorised incident links and separately labelled public-post links. Input p_pattern_code is required.'],
  ['CRIMEDATA_AREA_TIME_TOOL','CRIME_DATA.CRIMEDATA_AGENT_AREA_TIME_SUMMARY','Retrieve authorised time, place, suburb, patrol-area and location-type coverage. Input p_pattern_code is required.'],
  ['CRIMEDATA_EVIDENCE_REPORT_TOOL','CRIME_DATA.CRIMEDATA_AGENT_EVIDENCE_REPORT_SUMMARY','Retrieve aggregate authorised report and evidence coverage. Input p_pattern_code is required.'],
  ['CRIMEDATA_READINESS_TOOL','CRIME_DATA.CRIMEDATA_AGENT_READINESS','Assess descriptive dataset coverage and transparent gaps for a watched pattern. Input p_pattern_code is required.'],
];

async function main() {
  const walletLocation = process.env.ORACLE_WALLET_LOCATION || '/home/opc/wallet';
  const connection = await oracledb.getConnection({ user: process.env.ORACLE_USER || 'CRIME_DATA', password: process.env.APP_SCHEMA_PASSWORD, connectString: process.env.ADB_CONNECT_STRING || 'fu40_medium', configDir: walletLocation, walletLocation, walletPassword: process.env.ADB_WALLET_PASSWORD });
  try {
    for (const ddl of functions) await connection.execute(ddl);
    await connection.execute(`BEGIN DBMS_CLOUD_AI_AGENT.DROP_TEAM(:name,TRUE); END;`, { name: TEAM });
    for (const name of [...TASKS,...LEGACY_TASKS]) await connection.execute(`BEGIN DBMS_CLOUD_AI_AGENT.DROP_TASK(:name,TRUE); END;`, { name });
    for (const name of [...AGENTS,...LEGACY_AGENTS]) await connection.execute(`BEGIN DBMS_CLOUD_AI_AGENT.DROP_AGENT(:name,TRUE); END;`, { name });
    for (const name of TOOLS) await connection.execute(`BEGIN DBMS_CLOUD_AI_AGENT.DROP_TOOL(:name,TRUE); END;`, { name });
    for (const [name, fn, instruction] of toolDefinitions) await connection.execute(`BEGIN DBMS_CLOUD_AI_AGENT.CREATE_TOOL(tool_name=>:name,attributes=>:attributes,status=>'ENABLED',description=>:description); END;`, { name, attributes: JSON.stringify({ instruction, function: fn }), description: `Governed IncidentData read-only tool: ${instruction}` });
    const coreRole = 'You are a governed assistant for synthetic IncidentData demonstration records. Use only your assigned tools and their returned data. Do not identify people, infer responsibility, predict incidents, assess individual risk, recommend deployment, or treat simulated public posts as verified evidence. State data gaps plainly.';
    await connection.execute(`BEGIN DBMS_CLOUD_AI_AGENT.CREATE_AGENT(agent_name=>:name,attributes=>:attributes,status=>'ENABLED',description=>:description); END;`, { name: AGENTS[0], attributes: JSON.stringify({ profile_name: PROFILE, role: `${coreRole} First state a compact plan, then use only registered tools, then provide a concise reflection and review brief.`, enable_human_tool: false, short_term_memory_length: 5, tools: TOOLS }), description: 'Planning, controlled tool-use, and reflection agent for IncidentData Pattern Investigation V2.' });
    await connection.execute(`BEGIN DBMS_CLOUD_AI_AGENT.CREATE_TASK(task_name=>:name,attributes=>:attributes,status=>'ENABLED',description=>:description); END;`, { name: TASKS[0], attributes: JSON.stringify({ instruction: 'For the request {query}: (1) identify the exact watched pattern code and state a short plan; (2) call the permitted read-only tools for definition, links, area/time, evidence/report coverage and readiness; (3) produce a concise factual review brief; (4) include a Reflection section stating sufficient, incomplete, inconsistent, or no-data. Never treat public posts as verified.', tools: TOOLS, enable_human_tool: false }), description: 'Sequential plan, controlled tool use, and reflection for one watched-pattern investigation.' });
    const teamAttributes = { agents: [{ name: AGENTS[0], task: TASKS[0] }], process: 'sequential', long_term_memory_length: 5 };
    await connection.execute(`BEGIN DBMS_CLOUD_AI_AGENT.CREATE_TEAM(team_name=>:name,attributes=>:attributes,status=>'ENABLED',description=>:description); END;`, { name: TEAM, attributes: JSON.stringify(teamAttributes), description: 'Governed, sequential IncidentData synthetic-pattern investigation team: planning, controlled tool use, and reflection.' });
    await connection.commit();
    const [teams, definition] = await Promise.all([connection.execute(`SELECT DBMS_CLOUD_AI_AGENT.LIST_TEAMS() value FROM dual`, {}, { fetchInfo: { VALUE: { type: oracledb.STRING } } }), connection.execute(`SELECT DBMS_CLOUD_AI_AGENT.DESCRIBE_TEAM(:name) value FROM dual`, { name: TEAM }, { fetchInfo: { VALUE: { type: oracledb.STRING } } })]);
    console.log(JSON.stringify({ configured: true, team: TEAM, agents: AGENTS, tasks: TASKS, tools: TOOLS, teams: teams.rows[0].VALUE, description: definition.rows[0].VALUE }));
  } finally { await connection.close(); }
}
main().catch(error => { console.error(error.message); process.exit(1); });
