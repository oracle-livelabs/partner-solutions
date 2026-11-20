'use strict';
// Read-only vector coverage inventory. No embeddings, restores or dataset writes.
const {execFileSync}=require('node:child_process');
const code=String.raw`
const o=require('oracledb');o.outFormat=o.OUT_FORMAT_OBJECT;
(async()=>{
 const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
 try{
  c.callTimeout=30000;await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");await c.execute('SET TRANSACTION READ ONLY');
  const result={};
  result.saved=(await c.execute("SELECT p.profile_code,w.pattern_code,w.pattern_name,w.pattern_summary,w.pattern_kind,w.pattern_status,w.display_order FROM z_base_watched_crime_patterns w JOIN z_base_dataset_profiles p ON p.dataset_profile_id=w.dataset_profile_id WHERE w.active=1 AND w.activate_ui='Y' ORDER BY p.profile_code,w.display_order,w.pattern_code")).rows;
  console.log(JSON.stringify(result,null,2));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
process.stdout.write(execFileSync('podman',['exec',process.argv[2]||'policeadelaide_app-fu40_1','node','-e',code],{encoding:'utf8',timeout:180000}));
