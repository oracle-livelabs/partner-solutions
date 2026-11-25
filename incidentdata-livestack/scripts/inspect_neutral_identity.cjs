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
  result.columns=(await c.execute("SELECT c.table_name,c.column_name,c.data_type FROM user_tab_columns c JOIN user_tables t ON t.table_name=c.table_name WHERE c.data_type IN ('VARCHAR2','NVARCHAR2','CHAR') AND (c.column_name LIKE '%USER%' OR c.column_name LIKE '%OWNER%' OR c.column_name IN ('ACTOR','LOADED_BY','CREATED_BY','UPDATED_BY')) ORDER BY c.table_name,c.column_id")).rows;
  result.fks=(await c.execute("SELECT c.table_name,c.constraint_name,c.status,c.deferrable,c.deferred,cc.column_name FROM user_constraints c JOIN user_constraints p ON p.constraint_name=c.r_constraint_name JOIN user_cons_columns cc ON cc.constraint_name=c.constraint_name WHERE c.constraint_type='R' AND p.table_name='SECURITY_USERS' ORDER BY c.table_name")).rows;
  result.users=(await c.execute('SELECT * FROM security_users')).rows;
  result.profiles=(await c.execute('SELECT dataset_profile_id,profile_code FROM z_base_dataset_profiles ORDER BY profile_code')).rows;
  result.counts=[];
  for(const col of result.columns){const {TABLE_NAME:t,COLUMN_NAME:n}=col;const r=(await c.execute('SELECT COUNT(*) n FROM '+t+' WHERE '+n+'=:u',{u:'adelaide_central_analyst'})).rows[0];if(r.N)result.counts.push({...col,count:r.N});}
  console.log(JSON.stringify(result,null,2));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
process.stdout.write(execFileSync('podman',['exec',process.argv[2]||'policeadelaide_app-fu40_1','node','-e',code],{encoding:'utf8',timeout:180000}));
