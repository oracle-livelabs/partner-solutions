'use strict';
// Isolated integration preview: existing application APIs are GET/HEAD-only.
// Only the new filesystem-backed room routes accept writes. Never starts legacy
// ingestion/learning workers, and never writes Oracle tables.
const express=require('express'),oracle=require('oracledb'),path=require('node:path');
const {registerRoomPublication}=require('./detective-room-api');
async function main(){
 const e=process.env;
 const pool=await oracle.createPool({user:e.ORACLE_USER,password:e.APP_SCHEMA_PASSWORD,connectString:e.ORACLE_CONNECTION_STRING,
  configDir:e.ORACLE_WALLET_LOCATION,walletLocation:e.ORACLE_WALLET_LOCATION,walletPassword:e.ORACLE_WALLET_PASSWORD,poolMin:0,poolMax:3});
 const db=async(user,fn)=>{const c=await pool.getConnection();c.callTimeout=20000;try{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});await c.execute('SET TRANSACTION READ ONLY');return await fn(c);}finally{await c.rollback();await c.close();}};
 const app=express(),router=express.Router();
 app.disable('x-powered-by');app.use(express.json({limit:'16kb'}));
 app.use((req,res,next)=>{res.set('Cache-Control','no-store');req.demoUser=req.header('x-demo-user')||'read_only_viewer';next();});
 const route=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
 registerRoomPublication(router,db,route);app.use('/api/data-room',router);
 const upstream=process.env.CDR_ROOM_PREVIEW_UPSTREAM||'http://host.containers.internal:8706';
 app.use('/api',route(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method))return res.status(405).json({error:'This isolated preview cannot mutate the existing app. Only room generation is enabled.'});
  if(!req.originalUrl.startsWith('/api/'))return res.sendStatus(404);
  const response=await fetch(upstream+req.originalUrl,{method:req.method,headers:{'X-Demo-User':req.demoUser},signal:AbortSignal.timeout(30000),redirect:'error'});
  res.status(response.status);res.type(response.headers.get('content-type')||'application/octet-stream');
  res.send(Buffer.from(await response.arrayBuffer()));
 }));
 const dist=process.env.CDR_ROOM_PREVIEW_DIST||path.resolve(__dirname,'../frontend/dist');
 app.use(express.static(dist));app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
 app.use((error,req,res,next)=>{if(res.headersSent)return next(error);res.status(error.status||500).json({error:error.status?error.message:'Preview request failed; see operator diagnostics.'});});
 const server=app.listen(3001,'0.0.0.0',()=>console.log('Detective Room isolated preview listening'));
 process.on('SIGTERM',()=>server.close(()=>pool.close(5).finally(()=>process.exit(0))));
}
main().catch(e=>{console.error('Preview startup failed:',e.code||e.message);process.exitCode=1;});
