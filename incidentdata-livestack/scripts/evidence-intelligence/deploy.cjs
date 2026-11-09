'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {runtime,environment,CONTAINER}=require('./connection.cjs'),{sha256}=require('./contract.cjs');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'evidence_intelligence_20260924');
const read=n=>JSON.parse(fs.readFileSync(path.join(OUT,n))),build=read('image-build.json'),pre=read('preflight.json');
let before,env,attempted=false,stage='preflight';
function compose(rollback=false){const args=['compose','-f','compose.fu40.yml'];if(rollback)args.push('-f','evidence_intelligence_20260924/rollback-image.yml');args.push('up','-d','--no-build','--no-deps','app-fu40');execFileSync('podman',args,{cwd:ROOT,env,stdio:'pipe',timeout:120000});}
async function health(){for(let i=0;i<45;i++){try{const r=await fetch('http://127.0.0.1:8706/api/health',{signal:AbortSignal.timeout(2000)});if(r.ok&&(await r.json()).status==='healthy')return;}catch{}await new Promise(r=>setTimeout(r,700));}throw Error('Health timeout');}
function settingsEqual(a,b){const x=environment(a),y=environment(b);assert.deepEqual(Object.keys(x).filter(k=>k!=='HOSTNAME'&&x[k]!==y[k]),[],'Environment changed');const mounts=a=>a.Mounts.map(m=>({type:m.Type,source:m.Source,destination:m.Destination,rw:m.RW})).sort((a,b)=>a.destination.localeCompare(b.destination));assert.deepEqual(mounts(a),mounts(b));assert.deepEqual(a.HostConfig.PortBindings,b.HostConfig.PortBindings);}
async function main(){
  assert(!fs.existsSync(path.join(OUT,'deployment.json')));for(const r of ['native-verification.json','preview-browser.json'])assert.equal(read(r).status,'passed');
  before=runtime();assert.equal(before.Id,pre.runtime.containerId);assert.equal(before.Image,pre.runtime.imageId);
  const current=fs.readFileSync(path.join(ROOT,'compose.fu40.yml'),'utf8');assert(current.includes('image: '+build.image));
  const prior=environment(before);env={...process.env};for(const[,key]of current.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)){assert(!['HOME','PATH','CODEX_HOME'].includes(key));if(prior[key]!==undefined)env[key]=prior[key];}
  Object.assign(env,{ADB_CONNECT_STRING:prior.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:prior.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:prior.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'});
  const image=JSON.parse(execFileSync('podman',['image','inspect',build.image],{encoding:'utf8'}))[0];assert.equal(image.Id,build.imageId);
  for(const [file,digest] of Object.entries(build.manifest)){const src=file.startsWith('backend/')?file:file.startsWith('frontend/')?'frontend/dist/'+file.slice(9):'testdata/evidence-intelligence/v1/'+file;assert.equal(sha256(fs.readFileSync(path.join(ROOT,src))),digest,'Built source changed '+file);}
  stage='recreate FU40 app';attempted=true;compose();await health();const after=runtime();assert.equal(after.Image,build.imageId);settingsEqual(before,after);
  stage='runtime integrity';const manifestScript=`const fs=require('fs'),crypto=require('crypto'),paths=${JSON.stringify([...new Set([...Object.keys(pre.runtime.hashes),...Object.keys(build.manifest).map(p=>p.startsWith('backend/')?p:p.startsWith('frontend/')?'frontend/dist/'+p.slice(9):'testdata/evidence-intelligence/v1/'+p)])])},r={};for(const p of paths)r[p]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');console.log(JSON.stringify(r));`;
  const actual=JSON.parse(execFileSync('podman',['exec',CONTAINER,'node','-e',manifestScript],{encoding:'utf8',maxBuffer:4*1024*1024}));
  for(const [file,digest] of Object.entries(build.manifest)){const target=file.startsWith('backend/')?file:file.startsWith('frontend/')?'frontend/dist/'+file.slice(9):'testdata/evidence-intelligence/v1/'+file;assert.equal(actual[target],digest,target);}
  for(const[file,digest]of Object.entries(pre.runtime.hashes))if(file.startsWith('backend/')&&!build.changedBackend.includes(file))assert.equal(actual[file],digest);
  stage='live browser and scoped API';execFileSync(process.execPath,[path.join(ROOT,'scripts/evidence-intelligence/verify-browser.cjs'),'--live'],{cwd:ROOT,env:{...process.env,NODE_PATH:'/tmp/crimedata-graph-browser.Sdn124/node_modules'},stdio:'inherit',timeout:300000});
  const response=await fetch('http://127.0.0.1:8706/api/evidence-intelligence'),data=await response.json();assert.equal(data.profile.profileCode,'AMSTERDAM_DATA_V1');assert.equal(data.items.length,32);
  fs.writeFileSync(path.join(OUT,'deployment.json'),JSON.stringify({status:'deployed_healthy',at:new Date().toISOString(),beforeImage:before.ImageName,image:after.ImageName,imageId:after.Image,containerId:after.Id,settingsUnchanged:true,mountsUnchanged:true,portsUnchanged:true,unrelatedBackendUnchanged:true,profile:data.profile.profileCode,items:data.items.length,rollbackImageRetained:before.ImageName},null,2)+'\n',{flag:'wx'});
  console.log('Evidence Intelligence deployed and verified on FU40 port 8706.');
}
main().catch(async e=>{const result={status:'failed',stage,attempted,rollbackVerified:false};if(attempted)try{compose(true);await health();assert.equal(runtime().Image,before.Image);settingsEqual(before,runtime());result.rollbackVerified=true;}catch{}if(e.code==='ERR_ASSERTION')result.assertion=e.message;console.error(JSON.stringify(result));fs.writeFileSync(path.join(OUT,'deployment-failure.json'),JSON.stringify(result,null,2));process.exitCode=1;});
