const sql=(title,code,note)=>({title,code,note});
const plsql=(title,code,note)=>({kind:'plsql',title,code,note});

export const AGENT_FRAMEWORK_INTERNALS={
 title:'AI Agent Console',
 engine:'Native Agent V2 · From question to recorded tool results',
 badges:['DBMS_CLOUD_AI_AGENT','PL/SQL Tools','One Agent · Six Tools','Case Memory','JSON Audit','Scoped Views'],
 what:'Run native Agent V2 hands your question to a registered Oracle agent team. The LLM interprets the request, calls permitted PL/SQL tools, and writes a review brief from their returned facts. The Signals, Requests and Logistics teams on the main console remain guided SQL workflows.',
 why:'An agentic workflow combines model reasoning with controlled access to data. Inspecting the tool inputs and outputs lets a learner connect each reported count or coverage gap to a recorded database result.',
 how:'The browser supplies the question, demo identity and case reference. Node checks conversation ownership, establishes the database session identity and calls RUN_TEAM. Oracle manages model/tool exchanges; our six functions execute fixed, read-only SQL and return JSON. The browser displays the completed answer, not a stream of individual stage events.',
 flow:[
  ['Choose a watch','Six tiles use the active dataset’s Incident Pattern Signals catalogue. Selecting a tile fills the question; Run Agent V2 submits it.'],
  ['Establish identity and case','The app validates the request and saved-conversation ownership. DBMS_SESSION.SET_IDENTIFIER supplies the demo identity used by secured views.'],
  ['Create or reuse memory','DBMS_CLOUD_AI.CREATE_CONVERSATION creates a new case when needed; follow-ups reuse its conversation ID. The app requests five-turn conversation length and one-day retention.'],
  ['Start the native team','DBMS_CLOUD_AI_AGENT.RUN_TEAM invokes CRIMEDATA_PATTERN_INVESTIGATION_TEAM: one investigator agent assigned to one task.'],
  ['Retrieve facts through tools','The model requests permitted tools with p_pattern_code. Their registered PL/SQL functions read secured views and return JSON counts and context.'],
  ['Write and reflect','The model uses returned facts to compose the brief and discuss coverage. Planning and reflection are instructions in the agent/task configuration.'],
  ['Record and review','Oracle retains team/task/tool execution history. Node separately saves the displayed exchange in ANALYST_ACTIONS and invocation telemetry in AI_OPS_EVENTS.']
 ],
 lessons:[
  {title:'CRIME_DATA object map',intro:'The team, agent, task, tools and model profile are framework registrations. The six data-retrieval functions are standalone PL/SQL objects in CRIME_DATA. DBMS_CLOUD_AI_AGENT and DBMS_CLOUD_AI are Oracle-supplied packages accessed by this schema.',items:[
   ['CRIMEDATA_SELECT_AI_V2','Model profile: OCI, us-chicago-1, meta.llama-4-maverick-17b-128e-instruct-fp8.'],
   ['CRIMEDATA_PATTERN_INVESTIGATION_TEAM','Sequential team. Its agents attribute connects one investigator to one investigation task. The configured long_term_memory_length is 5.'],
   ['CRIMEDATA_PATTERN_INVESTIGATOR','Agent role, permitted tools and model profile. short_term_memory_length is 5; enable_human_tool is false.'],
   ['CRIMEDATA_PATTERN_INVESTIGATION_TASK','Instructions: identify the pattern code, plan, retrieve definition/links/area-time/report-evidence/readiness, write a brief, and reflect on gaps.'],
   ['CRIMEDATA_PATTERN_BRIEF_TOOL','Calls CRIME_DATA.CRIMEDATA_AGENT_PATTERN_BRIEF: pattern definition and monitoring rationale.'],
   ['CRIMEDATA_PATTERN_LINKS_TOOL','Calls CRIME_DATA.CRIMEDATA_AGENT_PATTERN_LINKS: authorised incident counts and separately labelled simulated public-post counts.'],
   ['CRIMEDATA_AREA_TIME_TOOL','Calls CRIME_DATA.CRIMEDATA_AGENT_AREA_TIME_SUMMARY: suburb/patrol-area counts and occurrence dates.'],
   ['CRIMEDATA_EVIDENCE_REPORT_TOOL','Calls CRIME_DATA.CRIMEDATA_AGENT_EVIDENCE_REPORT_SUMMARY: report and evidence-item coverage.'],
   ['CRIMEDATA_SUPPORTING_RECORDS_TOOL','Calls CRIME_DATA.CRIMEDATA_AGENT_SUPPORTING_RECORDS: exact source excerpts from profile-scoped authored teaching cases, including the Adelaide Gallery Refund Puzzle. These supplements are kept separate from original incident evidence.'],
   ['CRIMEDATA_READINESS_TOOL','Calls CRIME_DATA.CRIMEDATA_AGENT_READINESS: incident, report, evidence, mapped-record and public-post coverage.']
  ]},
  {title:'What the four stage tiles actually mean',intro:'The four ticks are configured capability labels returned after a successful response. They are not live progress events or independent proof that every stage occurred in this run. Use Oracle execution history to establish actual task and tool activity.',items:[
   ['Planning','The agent role asks the model to state a compact plan, and the task describes the retrieval sequence. This is LLM instruction, rather than a separate planning PL/SQL procedure.'],
   ['Controlled tool use','Six registered tools map to six fixed SQL functions. A tool-history record shows its name, input pattern code and returned output. The earlier vehicle-parts demonstration recorded all five tool calls.'],
   ['Reflection','The task requests a Reflection section stating sufficient, incomplete, inconsistent or no-data. These words are generated assessments of coverage; a reflection label does not establish investigative completeness.'],
   ['Case-scoped memory','Follow-ups reuse an owned conversation reference. Asking about the previous answer can demonstrate continuity; a first-turn memory tick alone cannot. Changing the active dataset or demo user resets the dialog’s case context.']
  ]},
  {title:'City context, access and model boundaries',intro:'The same functions serve every city because p_pattern_code is looked up in the currently loaded dataset. The dialog obtains watch names and counts from the same endpoint as Incident Pattern Signals; when there are more than six watches it takes the first six in page order.',items:[
   ['Secured SQL data','Functions use AUTHID DEFINER and query the existing secure views. Geographic visibility follows CLIENT_IDENTIFIER and entitlements; an unknown or out-of-scope pattern can yield no-data or zero coverage. The selectable demo identity is not production authentication.'],
   ['LLM and SQL responsibilities','The model selects tools and writes the explanation. The functions execute reviewed SQL and return JSON. These six tools do not offer unrestricted generated SQL, DML, DDL, web search or notifications.'],
   ['Where vectors fit','The aggregate tools use recorded pattern links and SQL summaries; the sixth tool retrieves exact authored teaching-source excerpts. They do not generate embeddings or perform vector similarity search. Vector searches on Incident Pattern Signals are a separate path.'],
   ['What is measured','AI Ops records the native invocation, outcome and duration. Internal model-call counts and token usage are unavailable to this app path. A model response, an application audit record and Oracle tool history describe different parts of the run.'],
   ['History scope','Oracle USER_AI_AGENT_* history views expose schema-level framework records. Application conversation ownership and demo-user filtering are enforced separately; setting a demo identifier does not make those metadata views owner-filtered.']
  ]},
  {title:'A short teaching walkthrough',intro:'Use the popup to run the agent; use the read-only queries below to inspect the resulting execution. Opening this Explain panel performs neither action.',items:[
   ['1 · Choose','Select a tile and inspect its pattern code and active dataset in the populated question. The selection itself makes no model call.'],
   ['2 · Run','Press Run Agent V2. Read the brief and note the conversation ID and elapsed time.'],
   ['3 · Trace','Find that conversation in team history. Use its TEAM_EXEC_ID to inspect task and tool history; compare an answer’s counts with the tool JSON.'],
   ['4 · Follow up','Ask which coverage gap was identified and which tool result supports it. Check that the conversation ID is reused.'],
   ['5 · Change context','Load another city dataset, reopen the dialog and inspect its watched-pattern tiles. The new case uses the new active data.']
  ]}
 ],
 implementationExamples:[
  plsql('Implementation: a fixed SQL tool function',`CREATE OR REPLACE FUNCTION crimedata_agent_evidence_report_summary (
  p_pattern_code IN VARCHAR2
) RETURN CLOB AUTHID DEFINER
IS
  l_result CLOB;
BEGIN
  SELECT JSON_OBJECT(
    'pattern_code' VALUE UPPER(TRIM(p_pattern_code)),
    'linked_incidents' VALUE COUNT(DISTINCT i.incident_id),
    'incidents_with_reports' VALUE COUNT(DISTINCT CASE
      WHEN r.report_id IS NOT NULL THEN i.incident_id END),
    'evidence_items' VALUE COUNT(DISTINCT e.evidence_id),
    'notice' VALUE 'Counts describe synthetic authorised record coverage only.'
    RETURNING CLOB
  ) INTO l_result
  FROM secure_watched_pattern_incidents_v wpi
  JOIN secure_crime_incidents_v i
    ON i.incident_ref = wpi.incident_ref
  LEFT JOIN secure_incident_reports_v r
    ON r.incident_id = i.incident_id
  LEFT JOIN secure_evidence_items_v e
    ON e.incident_id = i.incident_id
  WHERE wpi.pattern_code = UPPER(TRIM(p_pattern_code));
  RETURN l_result;
END;
/`,'Installed function reformatted for teaching. Its SELECT returns a JSON CLOB. This CREATE OR REPLACE definition is DDL and would replace the function if executed; use the USER_SOURCE inspection query below to read the installed version.'),
  plsql('Implementation: register a PL/SQL function as a tool',`BEGIN
  DBMS_CLOUD_AI_AGENT.CREATE_TOOL(
    tool_name => 'CRIMEDATA_PATTERN_BRIEF_TOOL',
    attributes => '{
      "instruction": "Retrieve a watched pattern definition and its monitoring rationale. Input p_pattern_code is required.",
      "function": "CRIME_DATA.CRIMEDATA_AGENT_PATTERN_BRIEF"
    }',
    status => 'ENABLED',
    description => 'Governed IncidentData read-only pattern definition tool'
  );
END;
/`,'Setup excerpt; the registration already exists. CREATE_TOOL stores a tool definition. Its function attribute is the bridge from the model’s tool request to our PL/SQL code.'),
  plsql('Implementation: register the agent and its tools',`BEGIN
  DBMS_CLOUD_AI_AGENT.CREATE_AGENT(
    agent_name => 'CRIMEDATA_PATTERN_INVESTIGATOR',
    attributes => '{
      "profile_name": "CRIMEDATA_SELECT_AI_V2",
      "role": "Use only assigned tools and returned data. State a compact plan, then a reflection and review brief. State gaps plainly.",
      "enable_human_tool": false,
      "short_term_memory_length": 5,
      "tools": [
        "CRIMEDATA_PATTERN_BRIEF_TOOL",
        "CRIMEDATA_PATTERN_LINKS_TOOL",
        "CRIMEDATA_AREA_TIME_TOOL",
        "CRIMEDATA_EVIDENCE_REPORT_TOOL",
        "CRIMEDATA_READINESS_TOOL",
        "CRIMEDATA_SUPPORTING_RECORDS_TOOL"
      ]
    }',
    status => 'ENABLED',
    description => 'Planning, controlled tool use and reflection agent'
  );
END;
/`,'Setup illustration with the role shortened for readability; the installed role includes additional synthetic-data boundaries. CREATE_AGENT stores configuration. Inspect USER_AI_AGENT_ATTRIBUTES below for the exact installed role.'),
  plsql('Implementation: assign the task and team',`BEGIN
  DBMS_CLOUD_AI_AGENT.CREATE_TASK(
    task_name => 'CRIMEDATA_PATTERN_INVESTIGATION_TASK',
    attributes => :task_attributes,
    status => 'ENABLED',
    description => 'Read-only watched-pattern investigation task'
  );

  DBMS_CLOUD_AI_AGENT.CREATE_TEAM(
    team_name => 'CRIMEDATA_PATTERN_INVESTIGATION_TEAM',
    attributes => '{
      "agents": [{
        "name": "CRIMEDATA_PATTERN_INVESTIGATOR",
        "task": "CRIMEDATA_PATTERN_INVESTIGATION_TASK"
      }],
      "process": "sequential",
      "long_term_memory_length": 5
    }',
    status => 'ENABLED',
    description => 'Sequential synthetic-pattern investigation team'
  );
END;
/`,'Setup excerpt, not a complete installer: :task_attributes is the JSON instruction, tools list and enable_human_tool=false supplied by the installer. These calls create registrations; the exact current instruction is available in USER_AI_AGENT_TASK_ATTRIBUTES.'),
  sql('Implementation: create a case conversation',`SELECT DBMS_CLOUD_AI.CREATE_CONVERSATION(
  :attributes
) AS conversation_id
FROM dual;

-- :attributes is supplied by the application:
-- {"title":"IncidentData Agent V2 case memory",
--  "description":"Short-lived synthetic watched-pattern investigation context.",
--  "retention_days":1,"conversation_length":5}`,'Runtime excerpt. CREATE_CONVERSATION persists a new conversation reference. The app reuses that reference for authorised follow-ups instead of creating one for every question.'),
  sql('Implementation: invoke the native team',`SELECT DBMS_CLOUD_AI_AGENT.RUN_TEAM(
  team_name   => :team,
  user_prompt => :prompt,
  params      => :params
) AS answer
FROM dual;

-- :team   = CRIMEDATA_PATTERN_INVESTIGATION_TEAM
-- :prompt = the question entered in the dialog
-- :params = {"conversation_id":"the-owned-case-conversation-id"}`,'Runtime excerpt. RUN_TEAM invokes the model and controlled tools and can incur model usage. The app establishes session identity and checks conversation ownership before this call; formatting, ANALYST_ACTIONS audit and AI Ops recording happen in Node around the invocation.')
 ],
 examples:[
  sql('Inspect the six installed functions',`SELECT object_name, status
FROM user_objects
WHERE object_type = 'FUNCTION'
  AND object_name IN (
    'CRIMEDATA_AGENT_PATTERN_BRIEF',
    'CRIMEDATA_AGENT_PATTERN_LINKS',
    'CRIMEDATA_AGENT_AREA_TIME_SUMMARY',
    'CRIMEDATA_AGENT_EVIDENCE_REPORT_SUMMARY',
    'CRIMEDATA_AGENT_READINESS',
    'CRIMEDATA_AGENT_SUPPORTING_RECORDS'
  )
ORDER BY object_name;`,'Read-only schema inspection. The six functions were VALID when this walkthrough was checked.'),
  sql('Read the installed PL/SQL source',`SELECT name, line, text
FROM user_source
WHERE type = 'FUNCTION'
  AND name IN (
    'CRIMEDATA_AGENT_PATTERN_BRIEF',
    'CRIMEDATA_AGENT_PATTERN_LINKS',
    'CRIMEDATA_AGENT_AREA_TIME_SUMMARY',
    'CRIMEDATA_AGENT_EVIDENCE_REPORT_SUMMARY',
    'CRIMEDATA_AGENT_READINESS',
    'CRIMEDATA_AGENT_SUPPORTING_RECORDS'
  )
ORDER BY name, line;`,'Reads the actual function definitions, without replacing objects or calling a model.'),
  sql('Inspect the agent and model profile',`SELECT agent_name, attribute_name, attribute_value
FROM user_ai_agent_attributes
WHERE agent_name = 'CRIMEDATA_PATTERN_INVESTIGATOR'
ORDER BY attribute_name;

SELECT profile_name, attribute_name, attribute_value
FROM user_cloud_ai_profile_attributes
WHERE profile_name = 'CRIMEDATA_SELECT_AI_V2'
  AND attribute_name IN ('provider', 'region', 'model')
ORDER BY attribute_name;`,'Run each SELECT separately in SQL Workshop. Shows the exact installed role, tool list and memory configuration, and model/provider/region; credential attributes are excluded.'),
  sql('Inspect the task and team configuration',`SELECT task_name, attribute_name, attribute_value
FROM user_ai_agent_task_attributes
WHERE task_name = 'CRIMEDATA_PATTERN_INVESTIGATION_TASK'
ORDER BY attribute_name;

SELECT agent_team_name, attribute_name, attribute_value
FROM user_ai_agent_team_attributes
WHERE agent_team_name = 'CRIMEDATA_PATTERN_INVESTIGATION_TEAM'
ORDER BY attribute_name;`,'Run each SELECT separately in SQL Workshop. The task contains the retrieval and Reflection instructions; the team connects one agent to that task.'),
  sql('Inspect tool-to-function mappings',`SELECT tool_name, attribute_value AS plsql_function
FROM user_ai_agent_tool_attributes
WHERE attribute_name = 'function'
  AND tool_name IN (
    'CRIMEDATA_PATTERN_BRIEF_TOOL',
    'CRIMEDATA_PATTERN_LINKS_TOOL',
    'CRIMEDATA_AREA_TIME_TOOL',
    'CRIMEDATA_EVIDENCE_REPORT_TOOL',
    'CRIMEDATA_READINESS_TOOL',
    'CRIMEDATA_SUPPORTING_RECORDS_TOOL'
  )
ORDER BY tool_name;`,'Reads registered function mappings; it does not invoke those tools.'),
  plsql('Test a tool without invoking the LLM',`DECLARE
  previous_id VARCHAR2(64) :=
    SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER');
  tool_result CLOB;
  PROCEDURE restore_context IS
  BEGIN
    IF previous_id IS NULL THEN
      DBMS_SESSION.CLEAR_IDENTIFIER;
    ELSE
      DBMS_SESSION.SET_IDENTIFIER(previous_id);
    END IF;
  END;
BEGIN
  -- Keep only ONE identity line active.
  DBMS_SESSION.SET_IDENTIFIER('statewide_admin');
  -- DBMS_SESSION.SET_IDENTIFIER('central_analyst');
  -- DBMS_SESSION.SET_IDENTIFIER('northern_analyst');
  -- DBMS_SESSION.SET_IDENTIFIER('southern_analyst');
  -- DBMS_SESSION.SET_IDENTIFIER('read_only_viewer');

  SELECT crimedata_agent_evidence_report_summary(
    'VEHICLE_PARTS_HARVESTING'
  ) INTO tool_result FROM dual;

  DBMS_OUTPUT.PUT_LINE(DBMS_LOB.SUBSTR(tool_result, 16000, 1));
  restore_context;
EXCEPTION
  WHEN OTHERS THEN
    restore_context;
    RAISE;
END;`,'Authorised demo diagnostic in CRIME_DATA. Run the complete block with DBMS Output enabled. Replace the pattern code with one from the active city’s tiles. It reads the fixed SQL tool result, makes no LLM request and restores the previous session identifier on success or failure. Counts reflect recorded coverage, not evidence that exists elsewhere.'),
  sql('Inspect the Adelaide Gallery Refund teaching sources',`SELECT case_title, source_ref, document_role, title,
       source_text, source_sha256
FROM secure_agent_demo_sources_v
WHERE case_code = 'GALLERY_REFUND_V1'
ORDER BY source_order;`,'These are three authored synthetic teaching documents under ART_MARKET_PAYMENTS in Adelaide V2. The view follows the active profile and demo-user incident scope. They are not original evidence from the anchor incident. The initial set contains an invoice, refund request and changed instruction email; the later payment-confirmation extension is not loaded.'),
  sql('Find a native team execution',`SELECT team_exec_id, state, start_date, end_date,
       conversation_id
FROM user_ai_agent_team_history
WHERE team_name = 'CRIMEDATA_PATTERN_INVESTIGATION_TEAM'
ORDER BY start_date DESC
FETCH FIRST 20 ROWS ONLY;`,'Match the conversation ID shown in the dialog, then use its TEAM_EXEC_ID in the following queries. This is schema-level framework history; application demo-user ownership is not applied by this metadata view.'),
  sql('Inspect the task for one execution',`SELECT team_exec_id, task_order, agent_name, task_name,
       state, start_date, end_date, input, result
FROM user_ai_agent_task_history
WHERE team_exec_id = :team_exec_id
ORDER BY task_order;`,'Bind the TEAM_EXEC_ID found above. Reads the actual task input, final result and execution state; it does not rerun the task.'),
  sql('Inspect the actual tool calls and returned JSON',`SELECT invocation_id, tool_name, agent_name,
       start_date, end_date, input, output
FROM user_ai_agent_tool_history
WHERE team_exec_id = :team_exec_id
ORDER BY start_date, invocation_id;`,'Bind the same TEAM_EXEC_ID. Each row identifies a recorded tool invocation, its input pattern code and returned output. These records provide stronger evidence of tool use than the four capability ticks.'),
  sql('Read your most recent recorded action types',`SELECT action_type, created_at
FROM analyst_actions
WHERE user_name = SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER')
ORDER BY created_at DESC
FETCH FIRST 20 ROWS ONLY;`,'Reads application audit metadata for the current database-session demo identity. An APEX SQL Workshop session may have a different identifier from the app; the tool-test block above demonstrates temporary identity selection and restoration.')
 ],
 point:'Use the complete chain for a demonstration: question → owned case → registered team → actual tool input/output → supported brief → saved audit. The LLM orchestrates and explains; secured SQL supplies the facts. A successful response and four ticks do not independently verify every stage or establish investigative completeness.'
};
