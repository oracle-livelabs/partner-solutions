'use strict';
// Run inside the FU40 container. Reproduce deletion, always rolling back.
const o=require('oracledb'),fs=require('node:fs');
(async()=>{
 const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,configDir:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD});
 c.callTimeout=15000;
 try {
  await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");
  await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');
  await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  const id='DR-20260912-38be78f8-7a8c-448a';
  const source=fs.readFileSync('/app/backend/data-room.js','utf8');
  const section=source.slice(source.indexOf("router.delete('/batches/:id'"),source.indexOf("router.post('/batches'"));
  const sqls=[...section.matchAll(/c.execute\('(DELETE[^']+)'/g)].map(m=>m[1]);
  for(const original of sqls){const sql=process.env.CDR_SERIAL_TEST==='1'?original.replace(/^DELETE /,'DELETE /*+ DISABLE_PARALLEL_DML NO_PARALLEL */ '):original;console.log('Checking '+sql);const r=await c.execute(sql,{id});console.log('Rows: '+r.rowsAffected);}
 } finally {await c.rollback();console.log('Rolled back diagnostic transaction');await c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
