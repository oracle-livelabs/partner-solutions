'use strict';
// Recreate only the FU40 app with the versioned image. Reuse the running app's
// environment in memory; never write credentials into a file or command output.
const {execFileSync}=require('node:child_process');
const path=require('node:path');
let redactions=[];
try{
  const [current]=JSON.parse(execFileSync('podman',['inspect','policeadelaide_app-fu40_1'],{encoding:'utf8'}));
  const previous=Object.fromEntries(current.Config.Env.map(value=>{const i=value.indexOf('=');return [value.slice(0,i),value.slice(i+1)];}));
  redactions=Object.entries(previous).filter(([k])=>/password|secret|token|key/i.test(k)).map(([,v])=>v).filter(Boolean);
  if(previous.ORACLE_USER!=='CRIME_DATA'||!previous.APP_SCHEMA_PASSWORD||!previous.ORACLE_WALLET_PASSWORD)throw Error('Running FU40 application settings are incomplete.');
  const ports=current.HostConfig.PortBindings?.['3001/tcp'];
  if(!ports?.some(p=>p.HostPort==='8706'))throw Error('The target is not the expected port-8706 app.');
  const appSettings=Object.fromEntries(Object.entries(previous).filter(([key])=>/^(ORACLE_|OCI_|CDR_|APP_SCHEMA_|OLLAMA_|TRANSFORMERS_)/.test(key)));
  const env={...process.env,...appSettings,ADB_CONNECT_STRING:previous.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:previous.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:previous.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'};
  // Only explicitly supplied Data Room model overrides replace pinned values.
  // Unrelated app/OCI settings continue to come from the running container.
  for(const key of ['CDR_TEXT_MODEL','CDR_IMAGE_MODEL','CDR_LEARNING_MODEL','CDR_AUDIO_MODEL']){
    if(process.env[key]){
      if(!/^[a-z0-9][a-z0-9._-]+$/i.test(process.env[key]))throw Error('Invalid model identifier in '+key);
      env[key]=process.env[key];
    }
  }
  execFileSync('podman',['compose','-f','compose.fu40.yml','up','-d','--no-build','--no-deps','app-fu40'],{cwd:path.resolve(__dirname,'..'),env,stdio:'pipe'});
  console.log('FU40 Data Room recreated on port 8706 using the versioned workspace image.');
}catch(e){
  let message=e.status===undefined?e.message:String(e.stderr||'');
  for(const value of redactions)message=message.split(value).join('[redacted]');
  // Provider command lines can contain settings; only print the final diagnostic lines.
  console.error(message.split('\n').filter(line=>!line.includes('podman run')&&!line.includes('--env')&&!line.includes(' -e ')).slice(-12).join('\n'));
  process.exitCode=1;
}
