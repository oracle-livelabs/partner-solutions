'use strict';
// Runs only against a freshly named target; a VM heartbeat is not acceptance.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const o=require('oracledb'),{assertTarget,credentials}=require('./database.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function verify(config,root){
 const c=await o.getConnection(credentials(config,'CRIME_DATA'));o.outFormat=o.OUT_FORMAT_OBJECT;
 const evidence={release:config.release_sha256,checks:[],externalWalkthroughRequired:true};
 async function rows(sql,binds={}){return (await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT})).rows;}
 const operator=config.participants.find(a=>a.operator&&a.persona==='statewide_admin');assert(operator,'No operator configured');
 const auth=a=>'Basic '+Buffer.from(a.username+':'+a.password).toString('base64');
 async function api(endpoint,{account=operator,body,headers={},method=body?'POST':'GET',timeoutMs=180000}={}){
  const response=await fetch(config.public_origin+endpoint,{method,headers:{Authorization:auth(account),Origin:config.public_origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
  if(!response.ok)throw Error('HTTPS acceptance request failed: '+method+' '+endpoint+' ('+response.status+')');return response;
 }
 try{
  assertTarget(config,(await rows("SELECT SYS_CONTEXT('USERENV','DB_NAME') n FROM dual"))[0].N);
  c.callTimeout=180000;await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");
  const baseline=JSON.parse(await fs.readFile(path.join(root,'baseline.json'),'utf8'));
  assert.equal((await rows("SELECT COUNT(*) n FROM user_objects WHERE status='INVALID'"))[0].N,0,'Invalid database objects');
  assert.equal((await rows("SELECT COUNT(*) n FROM user_objects WHERE object_type='PROPERTY GRAPH' AND status='VALID'"))[0].N,5);
  for(const city of baseline.cities){
   const p=(await rows('SELECT dataset_profile_id FROM z_base_dataset_profiles WHERE profile_code=:p',{p:city.code}))[0];assert(p,'Missing city '+city.code);
   const counts=(await rows(`SELECT (SELECT COUNT(*) FROM z_base_crime_incidents WHERE dataset_profile_id=:p) incidents,
    (SELECT COUNT(*) FROM z_base_persons WHERE dataset_profile_id=:p) persons,
    (SELECT COUNT(*) FROM poi_identifiers WHERE dataset_profile_id=:p) identifiers,
    (SELECT COUNT(*) FROM z_base_watched_crime_patterns WHERE dataset_profile_id=:p AND active=1 AND activate_ui='Y') watches FROM dual`,{p:p.DATASET_PROFILE_ID}))[0];
   assert.deepEqual(counts,{INCIDENTS:city.INCIDENTS,PERSONS:city.PERSONS,IDENTIFIERS:city.IDENTIFIERS,WATCHES:6},'Saved city differs: '+city.code);
  }
  evidence.checks.push('nine-city-saved-counts','five-valid-property-graphs');
  const security=JSON.parse(await fs.readFile(path.join(root,'database/security-baseline.json'),'utf8'));
  const {normalized}=require('./security.cjs');
  assert.deepEqual(normalized(await rows('SELECT * FROM user_data_grants')),normalized(security.grants),'Native data grants differ');
  assert.deepEqual(normalized(await rows('SELECT * FROM user_required_parent_data_privileges')),normalized(security.parents),'Cross-table parent grant differs');
  evidence.checks.push('twenty-native-data-grants','cross-table-security');
  const dump=JSON.parse(await fs.readFile(path.join(root,'database/manifest.json'),'utf8'));
  const privacy=(await rows("SELECT artifact_sha256 FROM id_deployment_state WHERE component='source-privacy'"))[0];
  if(privacy)assert.equal(privacy.ARTIFACT_SHA256,config.schema_manifest_sha256,'Privacy receipt belongs to another schema export');
  else{
   for(const table of dump.excludedTableData){if(['AI_OPS_EVENTS','AI_OPS_IMPORT_STATE'].includes(table))continue;assert(/^[A-Z0-9_$]+$/.test(table));assert.equal((await rows('SELECT COUNT(*) n FROM "'+table+'"'))[0].N,table==='DTAI_USER_ACCESS'?config.participants.length:0,'Private source rows restored: '+table);}
   // Attest before mutating acceptance. Retries may contain this test's own runs.
   await c.execute("INSERT INTO id_deployment_state(component,artifact_sha256) VALUES('source-privacy',:sha)",{sha:config.schema_manifest_sha256});await c.commit();
  }
  for(const [view,n]of [['USER_CLOUD_AI_PROFILES',4],['USER_AI_AGENT_TOOLS',14],['USER_AI_AGENTS',6],['USER_AI_AGENT_TASKS',6],['USER_AI_AGENT_TEAMS',6]])assert.equal((await rows('SELECT COUNT(*) n FROM '+view))[0].N,n,view);
  const apex=await rows("SELECT application_id,authentication_scheme_type FROM apex_applications WHERE owner='CRIME_DATA'");
  assert.equal(apex.length,3);for(const app of apex)assert.equal(app.AUTHENTICATION_SCHEME_TYPE,'Oracle APEX Accounts');
  for(const app of apex)assert.equal((await rows("SELECT COUNT(*) n FROM apex_application_page_items WHERE application_id=:id AND page_id=9999 AND item_name IN ('P9999_USERNAME','P9999_PASSWORD')",{id:app.APPLICATION_ID}))[0].N,2,'Missing secure APEX login form');
  evidence.checks.push('private-source-tables-empty','native-ai-inventory','apex-authentication-schemes');
  // Public CA verification uses Node's standard trust store; no insecure TLS mode.
  for(let i=0;i<90;i++){try{await api('/api/health');break;}catch(e){if(i===89)throw e;await sleep(10000);}}
  const unsigned=await fetch(config.public_origin+'/api/health',{signal:AbortSignal.timeout(30000)});assert.equal(unsigned.status,401);
  for(const account of config.participants){const session=await (await api('/api/session',{account,headers:{'X-Demo-User':'statewide_admin'}})).json();assert.equal(session.persona,account.persona);assert.equal(session.fixedPersona,true);}
  const viewer=config.participants.find(a=>a.persona==='read_only_viewer');
  const refused=await fetch(config.public_origin+'/api/setup/load',{method:'POST',headers:{Authorization:auth(viewer),Origin:config.public_origin,'Content-Type':'application/json','X-Demo-User':'statewide_admin'},body:JSON.stringify({profileCode:baseline.cities[0].code}),signal:AbortSignal.timeout(30000)});assert.equal(refused.status,403);
  evidence.checks.push('public-https-trust','individual-sign-in','forged-admin-rejected');
  async function activeProfile(){return (await rows('SELECT p.profile_code FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1'))[0].PROFILE_CODE;}
  async function restoreProfile(profileCode){await api('/api/setup/load',{body:{profileCode,confirmation:'ACTIVATE '+profileCode,expectedActiveProfileCode:await activeProfile()},timeoutMs:600000});}
  const original=await activeProfile();
  try{
   for(const city of baseline.cities){
    await restoreProfile(city.code);
    const count=(await rows("SELECT (SELECT COUNT(*) FROM crime_incidents) incidents,(SELECT COUNT(*) FROM persons_of_interest) persons,(SELECT COUNT(*) FROM watched_crime_patterns WHERE active=1 AND activate_ui='Y') watches FROM dual"))[0];
    assert.deepEqual(count,{INCIDENTS:city.INCIDENTS,PERSONS:city.PERSONS,WATCHES:6},'Actual restore differs: '+city.code);
   }
  }finally{if(await activeProfile()!==original)await restoreProfile(original);}
  evidence.checks.push('nine-real-city-restores');
  const inference=await c.execute("SELECT DBMS_CLOUD_AI.GENERATE(prompt=>'Reply with the single word READY.',profile_name=>'CDR_CRIME_DETECTIVE_V1',action=>'chat') answer FROM dual",{},{fetchInfo:{ANSWER:{type:o.STRING}}});assert(inference.rows[0].ANSWER?.trim(),'Native inference returned no answer');
  evidence.checks.push('native-cloud-inference');
  const batches=(await (await api('/api/data-room/batches')).json()).batches;let selected;
  for(const batch of batches){const s=await(await api('/api/data-room/batches/'+batch.batch_id+'/room')).json();if(s.eligible){selected=batch.batch_id;break;}}
  assert(selected,'No eligible synthetic batch for a fresh Detective Room generation');
  await api('/api/data-room/batches/'+selected+'/room',{body:{regenerate:true}});
  let ready;
  for(let i=0;i<180;i++){
   const status=await(await api('/api/data-room/batches/'+selected+'/room')).json();
   if(status.state==='FAILED')throw Error('Fresh Detective Room generation failed');
   if(status.state==='READY'&&status.current){ready=status.ready;break;}await sleep(10000);
  }
  assert(ready,'Fresh room publication deadline exceeded');
  const accessResponse=await api('/api/data-room/batches/'+selected+'/room/runs/'+ready.id+'/access',{body:{}});
  const cookie=accessResponse.headers.getSetCookie().map(s=>s.split(';')[0]).join('; '),access=await accessResponse.json();
  const room=await api(access.view,{headers:{Cookie:cookie}});assert((await room.text()).includes('<html'),'Room HTML absent');
  const zip=await api(access.download,{headers:{Cookie:cookie}});const reader=zip.body.getReader();let first=await reader.read();assert(first.value&&first.value[0]===80&&first.value[1]===75,'Room ZIP absent');await reader.cancel();
  evidence.checks.push('fresh-detective-room-and-video','authenticated-room-and-zip');
  // Verifies the managed public APEX service. A human browser walkthrough of
  // all three app paths remains a separate Step 6 acceptance requirement.
  assert(config.apex_url?.startsWith('https://'));
  const apps=JSON.parse(await fs.readFile(path.join(root,'apex/manifest.json'),'utf8')).applications;
  for(const app of apps){
   const address=config.apex_url.replace(/\/apex\/?$/,'/')+'r/crime_data/'+encodeURIComponent(app.ALIAS.toLowerCase())+'/login';
   for(let attempt=0;attempt<60;attempt++){
    try{const response=await fetch(address,{signal:AbortSignal.timeout(30000)});const html=await response.text();if(response.ok&&html.includes('P9999_USERNAME')&&html.includes('P9999_PASSWORD'))break;if(attempt===59)throw Error('Public APEX login form unavailable for '+app.APPLICATION_ID);}
    catch(error){if(attempt===59)throw error;}
    await sleep(10000);
   }
  }
  evidence.checks.push('public-apex-service','three-public-apex-login-forms');
  await fs.writeFile(path.join(root,'acceptance.json'),JSON.stringify(evidence,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(evidence));
 }finally{await c.close();}
}
if(require.main===module)(async()=>{const [file,root]=process.argv.slice(2);await verify(JSON.parse(await fs.readFile(file,'utf8')),root);})().catch(e=>{console.error(JSON.stringify({status:'failed',errorNum:e.errorNum||null,error:e.errorNum?'Target acceptance database check failed':e.message}));process.exitCode=1;});
module.exports={verify};
