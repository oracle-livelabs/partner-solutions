'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {connect,rows,runtime,CONTAINER}=require('./connection.cjs');
const {sha256}=require('./contract.cjs');
const ROOT=path.resolve(__dirname,'../../evidence_intelligence_20260924');
async function main(){
  fs.mkdirSync(ROOT,{recursive:true});const app=runtime(),c=await connect();
  try{
    await c.execute('SET TRANSACTION READ ONLY');
    const identity=(await rows(c,"SELECT USER schema_name,SYS_CONTEXT('USERENV','DB_NAME') database_name FROM dual"))[0];
    const version=await rows(c,'SELECT banner_full FROM v$version');
    const active=await rows(c,`SELECT p.*,a.activated_at FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1`);
    const columns=await rows(c,`SELECT table_name,column_name,data_type,identity_column FROM user_tab_columns WHERE table_name IN ('EVIDENCE_ITEMS','Z_BASE_EVIDENCE_ITEMS','CRIME_INCIDENTS','Z_BASE_CRIME_INCIDENTS') ORDER BY table_name,column_id`);
    const objects=await rows(c,`SELECT owner,object_name,object_type,status FROM all_objects WHERE object_name IN ('CRIME_CASE_NETWORK','DBMS_CLOUD_AI','DBMS_CLOUD_AI_AGENT','SDO_GEOM') AND object_type IN ('PROPERTY GRAPH','PACKAGE')`);
    const counts=await rows(c,`SELECT 'ACTIVE' scope,COUNT(*) evidence_count FROM evidence_items UNION ALL SELECT p.profile_code,COUNT(*) FROM z_base_evidence_items e JOIN z_base_dataset_profiles p ON p.dataset_profile_id=e.dataset_profile_id GROUP BY p.profile_code`);
    const restoreSource=await rows(c,"SELECT text FROM user_source WHERE name='Z_BASE_DATASET_ADMIN' AND type='PACKAGE BODY' ORDER BY line");
    let aiProfiles;try{aiProfiles=await rows(c,'SELECT profile_name,status FROM user_cloud_ai_profiles');}catch(e){aiProfiles={error:e.message};}
    const secureViews=await rows(c,"SELECT view_name,text FROM user_views WHERE view_name IN ('SECURE_CRIME_INCIDENTS_V','SECURE_PERSONS_OF_INTEREST_V')");
    const fileScript='const fs=require("fs"),crypto=require("crypto"),r={};for(const n of fs.readdirSync("backend")){const p="backend/"+n;if(fs.statSync(p).isFile())r[p]=crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");}r["frontend/dist/index.html"]=crypto.createHash("sha256").update(fs.readFileSync("frontend/dist/index.html")).digest("hex");console.log(JSON.stringify(r));';
    const hashes=JSON.parse(execFileSync('podman',['exec',CONTAINER,'node','-e',fileScript],{encoding:'utf8'}));
    const differences=Object.entries(hashes).filter(([p,h])=>p.startsWith('backend/')&&(!fs.existsSync(p)||sha256(fs.readFileSync(p))!==h)).map(([p])=>p);
    const result={at:new Date().toISOString(),identity,version,active,columns,objects,counts,aiProfiles,secureViews,
      runtime:{containerId:app.Id,image:app.ImageName,imageId:app.Image,started:app.State.StartedAt,hashes,localBackendDifferences:differences},
      restorePackageSource:restoreSource.map(r=>r.TEXT).join('')};
    fs.writeFileSync(path.join(ROOT,'preflight.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({identity,version,active:active.map(p=>({code:p.PROFILE_CODE,id:p.DATASET_PROFILE_ID})),objects,aiProfiles,localBackendDifferences:differences,image:app.ImageName}));
  }finally{await c.rollback();await c.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
