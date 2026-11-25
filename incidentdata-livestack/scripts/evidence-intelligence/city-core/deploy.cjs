'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {connect,rows}=require('../connection.cjs'),{allowlist}=require('./schema.cjs');
const ROOT=path.resolve(__dirname,'../../..'),CONTAINER='policeadelaide_app-fu40_1';
const run=(args,options={})=>execFileSync('podman',args,{encoding:'utf8',...options});
const inspect=()=>JSON.parse(run(['inspect',CONTAINER]))[0];
const settings=c=>({env:c.Config.Env.filter(s=>!s.startsWith('HOSTNAME=')).sort(),mounts:c.Mounts.map(m=>({source:m.Source,destination:m.Destination,type:m.Type,rw:m.RW})).sort((a,b)=>a.destination.localeCompare(b.destination)),ports:c.HostConfig.PortBindings});
const backendHash=()=>run(['exec',CONTAINER,'node','-e',"const fs=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(JSON.stringify(fs.readdirSync('/app/backend').filter(f=>!['evidence-intelligence.js','city-evidence-stories.js'].includes(f)).sort().map(f=>[f,c.createHash('sha256').update(fs.readFileSync('/app/backend/'+f)).digest('hex')]))).digest('hex'));"]).trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const build=JSON.parse(fs.readFileSync(process.argv[2]||'/tmp/incidentdata-city-evidence-image.json'));
 const original=inspect();assert.equal(original.Id,build.containerId,'Runtime changed since image build');
 const originalHash=backendHash(),originalSettings=settings(original),c=await connect();
 const active=await rows(c,'SELECT * FROM z_base_active_dataset_profile');
 for(const table of ['cdr_batches','cdr_ai_runs','cdr_learn_runs','cdr_workspace_runs','cdr_money_ai_runs']){
  const states=table==='cdr_batches'?"'uploading','queued','processing'":"'queued','running'";
  assert.equal((await rows(c,`SELECT COUNT(*) n FROM ${table} WHERE status IN (${states})`))[0].N,0,'Data Room work is active: '+table);
 }
 const view=await allowlist(c,false);
 const previous=Object.fromEntries(original.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));
 const appSettings=Object.fromEntries(Object.entries(previous).filter(([k])=>/^(ORACLE_|OCI_|CDR_|APP_SCHEMA_|OLLAMA_|TRANSFORMERS_|WATCH_PATTERN_)/.test(k)));
 const env={...process.env,...appSettings,ADB_CONNECT_STRING:previous.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:previous.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:previous.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'};
 const compose=path.join(ROOT,'compose.fu40.yml'),before=fs.readFileSync(compose,'utf8');assert(before.includes('image: '+original.ImageName));
 const up=()=>run(['compose','-f','compose.fu40.yml','up','-d','--no-build','--no-deps','app-fu40'],{cwd:ROOT,env,timeout:120000});
 let changed=false,viewChanged=false;
 try{
  fs.writeFileSync(compose,before.replace('image: '+original.ImageName,'image: '+build.image));changed=true;up();
  assert.deepEqual(settings(inspect()),originalSettings,'Application runtime settings changed');assert.equal(backendHash(),originalHash,'Unrelated backend changed');
  let ready=false;for(let i=0;i<30;i++){try{const r=await fetch('http://127.0.0.1:8706/api/health',{signal:AbortSignal.timeout(5000)});if(r.ok){ready=true;break;}}catch{}await sleep(1000);}assert(ready,'New app health check failed');
  const schema=await allowlist(c,true);viewChanged=schema.changed;
  const response=await fetch('http://127.0.0.1:8706/api/evidence-intelligence',{headers:{'X-Demo-User':'statewide_admin'},signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.walkthroughs.length,6);assert.equal(result.items.filter(e=>e.attributes?.sharedCityStory).length,24);
  assert.deepEqual(await rows(c,'SELECT * FROM z_base_active_dataset_profile'),active,'Active dataset changed');
  console.log(JSON.stringify({deployed:true,image:build.image,previousImage:original.ImageName,activeUnchanged:active,unchangedRuntimeSettings:true,unrelatedBackendUnchanged:true,walkthroughs:result.walkthroughs.map(s=>s.title),visibleItems:result.items.length,coreItems:24,scopedView:{beforeSha256:schema.beforeSha256,afterSha256:schema.afterSha256},at:new Date().toISOString()},null,2));
 }catch(e){
  if(viewChanged)await c.execute('CREATE OR REPLACE VIEW secure_ei_items_v AS '+view.before);
  if(changed){fs.writeFileSync(compose,before);up();}
  throw Error('Evidence release failed; previous app and view restored. '+e.message);
 }finally{await c.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
