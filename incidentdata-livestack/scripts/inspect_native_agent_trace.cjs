'use strict';
// Read-only vector coverage inventory. No embeddings, restores or dataset writes.
const {execFileSync}=require('node:child_process');
const code=String.raw`
const o=require('oracledb');o.outFormat=o.OUT_FORMAT_OBJECT;
(async()=>{
 const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
 try{
  c.callTimeout=30000;await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");await c.execute('SET TRANSACTION READ ONLY');
  o.fetchAsString=[o.CLOB];
  const result={};
  const cid='5DD82813-E515-120C-E063-BC5E000ACA9F';
  result.teams=(await c.execute('SELECT * FROM user_ai_agent_team_history WHERE conversation_id=:cid ORDER BY start_date DESC',{cid})).rows;
  if(!result.teams.length)result.latest=(await c.execute("SELECT * FROM user_ai_agent_team_history WHERE team_name='CRIMEDATA_PATTERN_INVESTIGATION_TEAM' ORDER BY start_date DESC FETCH FIRST 5 ROWS ONLY")).rows;
  result.executions=[];
  for(const t of result.teams){
   const id=t.TEAM_EXEC_ID;
   const tasks=(await c.execute('SELECT * FROM user_ai_agent_task_history WHERE team_exec_id=:id ORDER BY task_order',{id})).rows;
   const tools=(await c.execute('SELECT * FROM user_ai_agent_tool_history WHERE team_exec_id=:id ORDER BY start_date,invocation_id',{id})).rows;
   result.executions.push({id,tasks,tools});
  }
  console.log(JSON.stringify(result,null,2));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
process.stdout.write(execFileSync('podman',['exec',process.argv[2]||'policeadelaide_app-fu40_1','node','-e',code],{encoding:'utf8',timeout:180000}));
