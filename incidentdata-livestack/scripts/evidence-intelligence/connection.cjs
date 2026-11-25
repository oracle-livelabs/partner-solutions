'use strict';
// Explicitly authorised by the user for FU40 CRIME_DATA on 24 September 2026.
// Connection secrets are read in memory and never written to receipts or logs.
const {execFileSync}=require('node:child_process');
const oracle=require('oracledb');
oracle.outFormat=oracle.OUT_FORMAT_OBJECT;oracle.fetchAsString=[oracle.CLOB];
const CONTAINER='policeadelaide_app-fu40_1';
function runtime(){return JSON.parse(execFileSync('podman',['inspect',CONTAINER],{encoding:'utf8'}))[0];}
function environment(app=runtime()){return Object.fromEntries(app.Config.Env.map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)];}));}
async function connect(){
  const e=environment();if(e.ORACLE_USER!=='CRIME_DATA')throw Error('Expected CRIME_DATA');
  const c=await oracle.getConnection({user:e.ORACLE_USER,password:e.APP_SCHEMA_PASSWORD,connectString:e.ORACLE_CONNECTION_STRING,
    configDir:'/home/opc/wallet',walletLocation:'/home/opc/wallet',walletPassword:e.ORACLE_WALLET_PASSWORD});
  c.callTimeout=30000;
  const r=(await c.execute("SELECT USER schema_name,SYS_CONTEXT('USERENV','DB_NAME') database_name FROM dual")).rows[0];
  if(r.SCHEMA_NAME!=='CRIME_DATA'||!r.DATABASE_NAME.endsWith('_FU40')){await c.close();throw Error('Unexpected target database');}
  await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");return c;
}
const rows=async(c,sql,binds={})=>(await c.execute(sql,binds)).rows;
module.exports={oracle,connect,rows,runtime,environment,CONTAINER};
