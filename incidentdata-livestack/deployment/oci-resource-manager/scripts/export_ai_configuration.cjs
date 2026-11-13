'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {connect,rows,oracle:o}=require('../../../scripts/evidence-intelligence/connection.cjs');
(async()=>{
 const output=path.resolve(process.argv[2]||path.join(__dirname,'../artifacts/ai'));
 await fs.mkdir(output,{recursive:true,mode:0o700});const c=await connect();
 const result={version:1,destinationRebindingRequired:true,profiles:[],nativeAgents:{},errors:[]};
 try{
  await c.execute('SET TRANSACTION READ ONLY');
  const profiles=await rows(c,'SELECT profile_name,status FROM user_cloud_ai_profiles ORDER BY profile_name');
  const attrs=await rows(c,'SELECT profile_name,attribute_name,attribute_value FROM user_cloud_ai_profile_attributes ORDER BY profile_name,attribute_name');
  for(const p of profiles){const attributes={};
   for(const a of attrs.filter(a=>a.PROFILE_NAME===p.PROFILE_NAME)){
    const key=a.ATTRIBUTE_NAME.toLowerCase();let value=a.ATTRIBUTE_VALUE;
    if(key==='credential_name')value='OCI$RESOURCE_PRINCIPAL';
    else if(key==='oci_compartment_id')value='__DESTINATION_COMPARTMENT_OCID__';
    else if(/(?:^|_)(?:password|secret|api_key|private_key|access_token|auth_token|security_token|credential_value)$/.test(key))throw Error('Unexpected sensitive AI attribute; review export policy');
    else {try{value=JSON.parse(value);}catch{}}
    attributes[key]=value;
   }
   result.profiles.push({name:p.PROFILE_NAME,status:p.STATUS,attributes});
  }
  for(const [kind,view,attrView,nameColumn] of [
   ['tools','USER_AI_AGENT_TOOLS','USER_AI_AGENT_TOOL_ATTRIBUTES','TOOL_NAME'],
   ['agents','USER_AI_AGENTS','USER_AI_AGENT_ATTRIBUTES','AGENT_NAME'],
   ['tasks','USER_AI_AGENT_TASKS','USER_AI_AGENT_TASK_ATTRIBUTES','TASK_NAME'],
   ['teams','USER_AI_AGENT_TEAMS','USER_AI_AGENT_TEAM_ATTRIBUTES','AGENT_TEAM_NAME']]){
   const objects=await rows(c,'SELECT * FROM '+view);
   const values=await rows(c,'SELECT * FROM '+attrView);
   result.nativeAgents[kind]=objects.filter(row=>!['Y',1,'1'].includes(row.ORACLE_MAINTAINED)).map(row=>{
    const attributes={};
    for(const a of values.filter(a=>a[nameColumn]===row[nameColumn])){
     let value=a.ATTRIBUTE_VALUE;try{value=JSON.parse(value);}catch{}
     attributes[a.ATTRIBUTE_NAME.toLowerCase()]=value;
    }
    return {name:row[nameColumn],status:row.STATUS,description:row.DESCRIPTION,attributes};
   });
  }
  await fs.writeFile(path.join(output,'configuration.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({sourceUnchanged:true,profiles:result.profiles.length,agentMetadata:Object.fromEntries(Object.entries(result.nativeAgents).map(([kind,items])=>[kind,items.length])),errors:result.errors,output}));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error('AI export failed:',e.errorNum||e.code||e.message);process.exitCode=1;});
