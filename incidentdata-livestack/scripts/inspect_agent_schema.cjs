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
  result.functions=(await c.execute("SELECT object_name,status FROM user_objects WHERE object_type='FUNCTION' AND object_name LIKE 'CRIMEDATA_AGENT_%' ORDER BY object_name")).rows;
  result.functionSource=(await c.execute("SELECT name,line,text FROM user_source WHERE type='FUNCTION' AND name LIKE 'CRIMEDATA_AGENT_%' ORDER BY name,line")).rows;
  for(const [view,target] of [['USER_AI_AGENT_ATTRIBUTES','CRIMEDATA_PATTERN_INVESTIGATOR'],['USER_AI_AGENT_TASK_ATTRIBUTES','CRIMEDATA_PATTERN_INVESTIGATION_TASK'],['USER_AI_AGENT_TEAM_ATTRIBUTES','CRIMEDATA_PATTERN_INVESTIGATION_TEAM'],['USER_AI_AGENT_TOOL_ATTRIBUTES','CRIMEDATA_PATTERN_BRIEF_TOOL'],['USER_CLOUD_AI_PROFILE_ATTRIBUTES','CRIMEDATA_SELECT_AI_V2']]){
   try{
    const meta=(await c.execute('SELECT * FROM '+view+' WHERE 1=0')).metaData.map(x=>x.name);
    const name=meta.find(n=>n.endsWith('_NAME')&&n!=='ATTRIBUTE_NAME');
    const filter=view.includes('PROFILE')?" AND LOWER(attribute_name) IN ('model','provider','region')":'';
    result[view]=(await c.execute('SELECT * FROM '+view+' WHERE '+name+'=:target'+filter,{target})).rows;
   }catch(e){result[view]={error:e.message};}
  }
  console.log(JSON.stringify(result,null,2));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
process.stdout.write(execFileSync('podman',['exec',process.argv[2]||'policeadelaide_app-fu40_1','node','-e',code],{encoding:'utf8',timeout:180000}));
