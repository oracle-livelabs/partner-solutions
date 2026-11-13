'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
(async()=>{
 const {AGENT_FRAMEWORK_INTERNALS:guide}=await import('../frontend/src/agent-framework-internals.mjs');
 const template=fs.readFileSync('scripts/inspect_native_agent_trace.cjs','utf8'),a=template.indexOf('  o.fetchAsString='),b=template.indexOf('  console.log(JSON.stringify(result',a);
 const body=String.raw`
  o.fetchAsString=[o.CLOB];
  const examples=JSON.parse(process.env.AGENT_INSPECTION_EXAMPLES),result={readOnly:true,newModelCalls:0,queries:[],toolChecks:[]};
  const execution=(await c.execute("SELECT team_exec_id FROM user_ai_agent_team_history WHERE team_name='CRIMEDATA_PATTERN_INVESTIGATION_TEAM' ORDER BY start_date DESC FETCH FIRST 1 ROW ONLY")).rows[0];
  if(!execution)throw Error('A recorded team execution is required for the history examples');
  for(const example of examples){
   if(example.kind==='plsql')continue;
   for(const statement of example.code.split(';').map(s=>s.trim()).filter(Boolean)){
    if(!/^SELECT\b/i.test(statement))throw Error('Unexpected non-SELECT inspection example');
    const binds=statement.includes(':team_exec_id')?{team_exec_id:execution.TEAM_EXEC_ID}:{};
    const rows=(await c.execute(statement,binds)).rows;result.queries.push({title:example.title,rows:rows.length});
   }
  }
  const block=examples.find(e=>e.kind==='plsql').code;
  for(const role of ['statewide_admin','central_analyst','northern_analyst','southern_analyst','read_only_viewer']){
   await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('central_analyst');DBMS_OUTPUT.ENABLE(NULL); END;");
   await c.execute(block.replace("SET_IDENTIFIER('statewide_admin')","SET_IDENTIFIER('"+role+"')"));
   const value=await c.execute('BEGIN DBMS_OUTPUT.GET_LINE(:line,:status); END;',{line:{dir:o.BIND_OUT,type:o.STRING,maxSize:32767},status:{dir:o.BIND_OUT,type:o.NUMBER}});
   if(value.outBinds.status!==0)throw Error('Missing tool JSON output');
   const tool=JSON.parse(value.outBinds.line);
   if(!Object.hasOwn(tool,'evidence_items'))throw Error('Unexpected tool output');
   const identity=(await c.execute("SELECT SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER') identity FROM dual")).rows[0].IDENTITY;
   if(identity!=='central_analyst')throw Error('SQL Workshop block failed to restore identity');
   result.toolChecks.push({role,incidents:tool.linked_incidents,reports:tool.incidents_with_reports,evidence:tool.evidence_items,identityRestored:true});
  }
  result.passed=true;
`;
 const wrapper=template.slice(0,a)+body+template.slice(b);
 const start=wrapper.indexOf('const code=String.raw`')+'const code=String.raw`'.length,end=wrapper.indexOf('`;\nprocess.stdout.write',start),code=wrapper.slice(start,end);
 const output=execFileSync('podman',['exec','--env','AGENT_INSPECTION_EXAMPLES='+JSON.stringify(guide.examples),'policeadelaide_app-fu40_1','node','-e',code],{encoding:'utf8',timeout:120000});
 fs.writeFileSync('agent_framework_explain_20261015/sql-validation.json',output);const result=JSON.parse(output);console.log(JSON.stringify({passed:result.passed,selectChecks:result.queries.length,roleChecks:result.toolChecks.length,readOnly:true,newModelCalls:0}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
