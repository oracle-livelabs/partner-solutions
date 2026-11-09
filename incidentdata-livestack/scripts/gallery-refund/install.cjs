'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {connect,rows,oracle}=require('../evidence-intelligence/connection.cjs');
const {toolInstruction,withContract}=require('./agent-contract.cjs');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'gallery_refund_20261015'),PACK=JSON.parse(fs.readFileSync(OUT+'/fixtures/initial-sources.json','utf8'));
const TOOL='CRIMEDATA_SUPPORTING_RECORDS_TOOL',FN='CRIME_DATA.CRIMEDATA_AGENT_SUPPORTING_RECORDS',AGENT='CRIMEDATA_PATTERN_INVESTIGATOR',TASK='CRIMEDATA_PATTERN_INVESTIGATION_TASK';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function guard(c){
 const p=(await rows(c,'SELECT USER schema_name,p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1'))[0];
 assert.equal(p.SCHEMA_NAME,'CRIME_DATA');assert.equal(p.PROFILE_CODE,PACK.profileCode,'Active city must remain Adelaide V2');
 assert.equal((await rows(c,"SELECT COUNT(*) n FROM user_ai_agent_team_history WHERE team_name='CRIMEDATA_PATTERN_INVESTIGATION_TEAM' AND end_date IS NULL AND start_date>SYSTIMESTAMP-INTERVAL '30' MINUTE"))[0].N,0,'Wait for current native runs before updating agent configuration');
 assert.equal((await rows(c,'SELECT COUNT(*) n FROM secure_watched_pattern_incidents_v WHERE pattern_code=:p AND incident_ref=:i',{p:PACK.patternCode,i:PACK.anchorIncidentRef}))[0].N,1);
 return p;
}
async function integrity(c){
 const result={};
 for(const t of ['crime_incidents','incident_reports','evidence_items','case_files','watched_crime_patterns','watched_pattern_incidents','incident_narrative_embeddings_v4','watched_pattern_embeddings','z_base_evidence_items','z_base_incident_narrative_vec','z_base_watched_pattern_vec'])result[t]=(await rows(c,'SELECT COUNT(*) n FROM '+t))[0].N;
 result.reportDigest=hash(await rows(c,'SELECT report_id,incident_id,report_summary,report_text FROM incident_reports ORDER BY report_id'));
 result.savedProfiles=await rows(c,'SELECT profile_code,dataset_profile_id FROM z_base_dataset_profiles ORDER BY profile_code');return result;
}
async function attrs(c,view,key,name){return Object.fromEntries((await rows(c,'SELECT attribute_name,attribute_value FROM '+view+' WHERE '+key+'=:n',{n:name})).map(r=>[r.ATTRIBUTE_NAME,r.ATTRIBUTE_VALUE]));}
async function set(c,name,type,attr,value){await c.execute('BEGIN DBMS_CLOUD_AI_AGENT.SET_ATTRIBUTE(object_name=>:n,object_type=>:t,attribute_name=>:a,attribute_value=>:v); END;',{n:name,t:type,a:attr,v:{val:value,type:oracle.CLOB}});}
async function validate(c){
 const scopes=[];
 for(const user of ['statewide_admin','central_analyst','northern_analyst','southern_analyst','read_only_viewer','unknown']){
  await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});
  const doc=JSON.parse((await rows(c,'SELECT crimedata_agent_supporting_records(:p) value FROM dual',{p:PACK.patternCode}))[0].VALUE);
  const allowed=['statewide_admin','central_analyst','read_only_viewer'].includes(user);assert.equal(doc.source_count,allowed?3:0,user+' source scope');assert.equal(doc.sources.length,doc.source_count);
  const byCase=JSON.parse((await rows(c,'SELECT crimedata_agent_supporting_records(:p) value FROM dual',{p:PACK.caseCode}))[0].VALUE);
  assert.equal(byCase.source_count,doc.source_count,user+' exact case scope');
  assert.deepEqual(byCase.sources,doc.sources,user+' case and pattern must return identical sources');
  if(allowed)assert.equal(byCase.pattern_code,PACK.patternCode);
  const unknown=JSON.parse((await rows(c,"SELECT crimedata_agent_supporting_records('UNKNOWN_CASE') value FROM dual"))[0].VALUE);assert.equal(unknown.source_count,0);
  if(allowed)for(const source of doc.sources){const expected=PACK.documents.find(d=>d.sourceRef===source.source_ref);assert(expected);assert.equal(source.source_text,expected.text);assert.equal(source.source_sha256,expected.sha256);assert.equal(source.case_code,PACK.caseCode);}
  const wrong=JSON.parse((await rows(c,"SELECT crimedata_agent_supporting_records('VEHICLE_PARTS_HARVESTING') value FROM dual"))[0].VALUE);assert.equal(wrong.source_count,0);
  scopes.push({user,sources:doc.source_count,caseCodeSources:byCase.source_count,wrongPatternSources:wrong.source_count,unknownSources:unknown.source_count});
 }
 await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");
 const assignments={};for(const [view,key,name] of [['user_ai_agent_attributes','agent_name',AGENT],['user_ai_agent_task_attributes','task_name',TASK]]){const a=await attrs(c,view,key,name);assert(JSON.parse(a.tools).includes(TOOL));assignments[name]=JSON.parse(a.tools);}
 assert.equal((await rows(c,"SELECT COUNT(*) n FROM user_objects WHERE object_name='CRIMEDATA_AGENT_SUPPORTING_RECORDS' AND status='VALID'"))[0].N,1);
 return {scopes,assignments};
}
(async()=>{const c=await connect();let originals;
 try{
  await c.execute('ALTER SESSION DISABLE PARALLEL DML');await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');const target=await guard(c),before=await integrity(c);
  originals={agent:await attrs(c,'user_ai_agent_attributes','agent_name',AGENT),task:await attrs(c,'user_ai_agent_task_attributes','task_name',TASK)};
  if(!fs.existsSync(OUT+'/before/agent-attributes.json'))fs.writeFileSync(OUT+'/before/agent-attributes.json',JSON.stringify(originals,null,2)+'\n',{mode:0o600,flag:'wx'});
  const ddl=fs.readFileSync(ROOT+'/db/migrations/20261015_agent_teaching_sources.sql','utf8').split(/\n\n(?=CREATE OR REPLACE)/);
  const exists=(await rows(c,"SELECT COUNT(*) n FROM user_tables WHERE table_name='AGENT_DEMO_SOURCES'"))[0].N;
  if(!exists)await c.execute(ddl[0].trim().replace(/;$/,''));
  for(const statement of ddl.slice(1))await c.execute(statement.trim().replace(/\n\/$/,'').replace(/;$/,(s)=>statement.includes('FUNCTION')?s:''));
  await guard(c);
  let added=0;
  for(const d of PACK.documents){
   const found=await rows(c,'SELECT source_sha256,source_text,anchor_incident_ref FROM agent_demo_sources WHERE profile_code=:p AND case_code=:k AND source_ref=:s',{p:PACK.profileCode,k:PACK.caseCode,s:d.sourceRef});
   if(found.length){assert.equal(found[0].SOURCE_SHA256,d.sha256);assert.equal(found[0].SOURCE_TEXT,d.text);assert.equal(found[0].ANCHOR_INCIDENT_REF,PACK.anchorIncidentRef);continue;}
   await c.execute(`INSERT INTO agent_demo_sources(profile_code,pattern_code,case_code,case_title,teaching_question,anchor_incident_ref,source_ref,source_order,document_role,title,source_text,source_sha256,source_basis,fixture_version)
    VALUES(:profile,:pattern,:code,:title,:question,:anchor,:source,:sequence,:role,:documentTitle,:body,:sha,:basis,:version)`,{profile:PACK.profileCode,pattern:PACK.patternCode,code:PACK.caseCode,title:PACK.caseTitle,question:PACK.question,anchor:PACK.anchorIncidentRef,source:d.sourceRef,sequence:d.order,role:d.role,documentTitle:d.title,body:{val:d.text,type:oracle.CLOB},sha:d.sha256,basis:PACK.sourceBasis,version:PACK.version});added++;
  }
  assert.deepEqual(await integrity(c),before,'Core datasets must remain unchanged');await c.commit();
  const tool=(await rows(c,'SELECT COUNT(*) n FROM user_ai_agent_tools WHERE tool_name=:n',{n:TOOL}))[0].N;
  if(!tool)await c.execute('BEGIN DBMS_CLOUD_AI_AGENT.CREATE_TOOL(tool_name=>:n,attributes=>:a,status=>\'ENABLED\',description=>:d); END;',{n:TOOL,a:JSON.stringify({instruction:toolInstruction,function:FN}),d:'Read-only supporting records for authored synthetic teaching cases'});
  await set(c,TOOL,'TOOL','instruction',toolInstruction);
  for(const [type,name,a] of [['AGENT',AGENT,originals.agent],['TASK',TASK,originals.task]]){
   const tools=JSON.parse(a.tools);if(!tools.includes(TOOL))tools.push(TOOL);await set(c,name,type,'tools',JSON.stringify(tools));
   const attribute=type==='AGENT'?'role':'instruction';
   await set(c,name,type,attribute,withContract(a[attribute]));
  }
  await c.commit();const validation=await validate(c);assert.deepEqual(await integrity(c),before);await guard(c);
  const receipt={applied:true,target,caseCode:PACK.caseCode,addedSources:added,totalSources:3,sourceConfirmationIncluded:false,newModelCalls:0,existingReportsAndCountsUnchanged:true,savedCityProfilesUnchanged:true,restores:'Teaching overlay is keyed by profile and stable incident reference; original Z_BASE snapshots are unchanged.',tool:TOOL,validation,before};fs.writeFileSync(OUT+'/installed.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({applied:true,addedSources:added,scopes:validation.scopes,newModelCalls:0}));
 }catch(e){await c.rollback();if(originals){for(const [type,name,a] of [['AGENT',AGENT,originals.agent],['TASK',TASK,originals.task]])for(const attribute of ['tools',type==='AGENT'?'role':'instruction'])try{await set(c,name,type,attribute,a[attribute]);}catch{}await c.commit();}throw e;}finally{await c.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={};
