'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync,spawn}=require('node:child_process');
const ROOT=path.dirname(__dirname),NAME='policeadelaide_app-fu40_1';
const write=(file,x)=>fs.writeFileSync(path.join(__dirname,file),JSON.stringify(x,null,2)+'\n',{mode:0o600});
async function withServer(live,fn){
  const base=live?'http://127.0.0.1:8706':'http://127.0.0.1:18720';let child;
  try{
    if(!live){
      // Refuse to attach to an unrelated process already occupying our port.
      try{await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)});throw Error('Preview port already occupied');}catch(e){if(e.message==='Preview port already occupied')throw e;}
      const app=JSON.parse(execFileSync('podman',['inspect',NAME],{encoding:'utf8'}))[0];
      const settings=Object.fromEntries(app.Config.Env.map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)];}));
      child=spawn(process.execPath,['backend/server.js'],{cwd:ROOT,stdio:'ignore',env:{...process.env,...settings,PORT:'18720',ORACLE_WALLET_LOCATION:'/home/opc/wallet',CRIMEDATA_READ_ONLY_REVIEW:'1',CRIMEDATA_BIND_HOST:'127.0.0.1',CRIMEDATA_FRONTEND_DIST:path.join(__dirname,'dist')}});
      child.on('error',()=>{});
    }
    let healthy=false;
    for(let n=0;n<40;n++){
      if(child?.exitCode!==null&&child?.exitCode!==undefined)throw Error('Read-only preview exited');
      try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1500)});if(r.ok&&(await r.json()).status==='healthy'){healthy=true;break;}}catch{}
      await new Promise(r=>setTimeout(r,500));
    }
    assert.ok(healthy,'App health timeout');return await fn(base);
  }finally{
    if(child&&child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>{const t=setTimeout(()=>{child.kill('SIGKILL');resolve();},5000);child.once('exit',()=>{clearTimeout(t);resolve();});});}
  }
}
module.exports={ROOT,write,withServer};
