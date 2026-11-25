'use strict';
const {execFileSync}=require('node:child_process');
const [current]=JSON.parse(execFileSync('podman',['inspect','detective-room-worker'],{encoding:'utf8'}));
const env=Object.fromEntries(current.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));
const code=String.raw`
Object.assign(process.env,JSON.parse(require('fs').readFileSync(0,'utf8')));
const o=require('oracledb');o.outFormat=o.OUT_FORMAT_OBJECT;o.fetchAsString=[o.CLOB];
(async()=>{const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
try{c.callTimeout=30000;await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");await c.execute('SET TRANSACTION READ ONLY');
const {snapshot,generationContext}=require('./backend/detective-room-source'),{normalize}=require('./backend/detective-room-normalize');
const results=[];
for(const id of ['DR-20261013-2f911298-c82f-4d50','DR-20261013-ac79901d-3cec-4220']){
 const data=await snapshot(c,id),context=await generationContext(c,data.batch),normal=normalize(data.analysisFiles);
 if(data.fingerprint!==context.fingerprint||data.files.length!==3||data.derivedFiles.length!==1||normal.coverage.filter(s=>s.mode==='machine-transcript').length!==1)throw Error('Candidate source preparation mismatch');
 results.push({batchId:id,originalFiles:data.files.length,derivedTranscripts:data.derivedFiles.length,archiveSHA256:data.batch.ARCHIVE_SHA256,originalHashesVerified:true,fingerprint:data.fingerprint,transcriptModel:data.derivedFiles[0].derivedFrom.model,transcriptVersion:data.derivedFiles[0].derivedFrom.promptVersion,parsedMessages:normal.messages.length,threads:normal.threads.length,derivedTranscriptHash:data.derivedFiles[0].sha256});
}
console.log(JSON.stringify({readOnly:true,newModelCalls:0,passed:true,results}));
}finally{await c.rollback();await c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});`;
process.stdout.write(execFileSync('podman',['run','--rm','-i','--volumes-from','detective-room-worker','--entrypoint','node','localhost/crimedata-detective-worker:audio-transcripts-20261013-r1','-e',code],{input:JSON.stringify(env),encoding:'utf8',timeout:120000}));
