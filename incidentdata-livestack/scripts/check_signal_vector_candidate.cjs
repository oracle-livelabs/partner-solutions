'use strict';
const {execFileSync}=require('node:child_process');
const [current]=JSON.parse(execFileSync('podman',['inspect','policeadelaide_app-fu40_1'],{encoding:'utf8'}));
const env=Object.fromEntries(current.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));
const code=String.raw`
const fs=require('node:fs');Object.assign(process.env,JSON.parse(fs.readFileSync(0,'utf8')));
const o=require('oracledb');o.outFormat=o.OUT_FORMAT_OBJECT;o.fetchAsString=[o.CLOB];
(async()=>{
 const db=async(user,fn)=>{const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});try{await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:user); END;',{user});return await fn(c);}finally{await c.rollback();await c.close();}};
 const {createProfileLibrary}=require('./backend/profile-library');
 const lib=createProfileLibrary(db);
 const results=[];
 for(const code of ['ADELAIDE_DATA_V2','ADELAIDE_DATA']){
  const started=performance.now();const r=await lib.status('statewide_admin',code);
  if(r.activeProfileCode!=='ADELAIDE_DATA_V2')throw Error('Active city changed');
  if(code==='ADELAIDE_DATA'&&!r.restorationNotice?.includes('0 of 21513'))throw Error('Missing snapshot coverage not explained');
  results.push({profile:code,elapsedMs:Math.round(performance.now()-started),vectorReadiness:r.vectorReadiness,restorationNotice:r.restorationNotice});
 }
 console.log(JSON.stringify({readOnly:true,results}));
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
const network=current.Pod?['--pod',current.Pod]:['--network','container:policeadelaide_app-fu40_1'];
process.stdout.write(execFileSync('podman',['run','--rm','-i',...network,'--volumes-from','policeadelaide_app-fu40_1','--entrypoint','node','localhost/incidentdata-livestack:signal-vector-readiness-20261013-r1','-e',code],{input:JSON.stringify(env),encoding:'utf8',timeout:120000}));
