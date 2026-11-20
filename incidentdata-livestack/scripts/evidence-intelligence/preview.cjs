'use strict';
// Isolated local UI preview: only new Evidence Intelligence endpoints can POST.
// Other API reads proxy to the unchanged live app. No background workers run.
const express=require('express'),path=require('node:path');
const {oracle,environment}=require('./connection.cjs');
const {withDatabaseConnection}=require('../../backend/database-connection');
const {registerEvidenceIntelligence}=require('../../backend/evidence-intelligence');
process.env.TRANSFORMERS_CACHE='/home/opc/.cache/policeAdelaide-transformers';process.env.TRANSFORMERS_OFFLINE='true';
async function main(){
  const e=environment(),pool=await oracle.createPool({user:e.ORACLE_USER,password:e.APP_SCHEMA_PASSWORD,connectString:e.ORACLE_CONNECTION_STRING,walletLocation:'/home/opc/wallet',configDir:'/home/opc/wallet',walletPassword:e.ORACLE_WALLET_PASSWORD,poolMin:1,poolMax:4});
  const app=express(),users=new Set(['statewide_admin','central_analyst','northern_analyst','southern_analyst','read_only_viewer']);
  app.use(express.json({limit:'1mb'}));app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');const u=req.header('X-Demo-User')||'statewide_admin';req.demoUser=users.has(u)?u:'read_only_viewer';next();});
  registerEvidenceIntelligence(app,(u,fn)=>withDatabaseConnection(pool,u,fn));
  require('../../backend/investigation-trail').registerInvestigationTrail(app,(u,fn)=>withDatabaseConnection(pool,u,fn));
  app.use('/api',async(req,res)=>{if(req.method!=='GET')return res.status(405).json({error:'Only evidence review actions are allowed in this isolated preview.'});try{const r=await fetch('http://127.0.0.1:8706'+req.originalUrl,{headers:{'X-Demo-User':req.demoUser}});res.status(r.status).type(r.headers.get('content-type')||'application/json').send(Buffer.from(await r.arrayBuffer()));}catch{res.status(503).json({error:'Live read proxy unavailable'});}});
  const dist=path.resolve(__dirname,'../../frontend/dist');app.use(express.static(dist));app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
  const server=app.listen(18706,'127.0.0.1',()=>console.log('Evidence preview ready on 127.0.0.1:18706'));
  async function stop(){server.close();await pool.close(3);process.exit(0);}process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
