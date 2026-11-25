'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const ROOT=__dirname,PROJECT=path.dirname(ROOT),NAME='policeadelaide_app-fu40_1',IMAGE='local/adelaide-crime-intelligence:adelaide-v2-tile-20260917';
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const inspect=()=>JSON.parse(execFileSync('podman',['inspect',NAME],{encoding:'utf8'}))[0];
const settings=a=>Object.fromEntries(a.Config.Env.map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)];}));
let stage='preflight',attempted=false,env,before;
function compose(rollback=false){const args=['compose','-f','compose.fu40.yml'];if(rollback)args.push('-f','adelaide_v2_tile_20260917/rollback_image.yml');args.push('up','-d','--no-build','--no-deps','app-fu40');execFileSync('podman',args,{cwd:PROJECT,env,stdio:'pipe',timeout:120000,maxBuffer:4*1024*1024});}
async function healthy(){const deadline=Date.now()+45000;while(Date.now()<deadline){try{const r=await fetch('http://127.0.0.1:8706/api/health',{signal:AbortSignal.timeout(2000)});if(r.ok&&(await r.json()).status==='healthy')return;}catch{}await new Promise(r=>setTimeout(r,800));}throw Error('Health deadline exceeded');}
function sameSettings(a,b){const prior=settings(a),next=settings(b);const changed=[...new Set([...Object.keys(prior),...Object.keys(next)])].filter(k=>k!=='HOSTNAME'&&prior[k]!==next[k]);assert.equal(changed.length,0,'Application environment changed: '+changed.join(','));assert.equal(prior.HOSTNAME,a.Config.Hostname);assert.equal(next.HOSTNAME,b.Config.Hostname);const mounts=x=>x.Mounts.map(m=>({type:m.Type,source:m.Source,destination:m.Destination,rw:m.RW})).sort((m,n)=>m.destination.localeCompare(n.destination));assert.deepEqual(mounts(a),mounts(b),'Mounts changed');assert.deepEqual(a.HostConfig.PortBindings,b.HostConfig.PortBindings,'Port bindings changed');}
const runtimeHash=file=>hash(execFileSync('podman',['exec',NAME,'node','-e','process.stdout.write(require("fs").readFileSync(process.argv[1]))',file]));
(async()=>{
 const pre=read('preflight.json');assert(!fs.existsSync(path.join(ROOT,'deployment.json')));assert.equal(read('preview_browser.json').status,'passed');assert.equal(read('database_before.json').identity.active[0].DATASET_PROFILE_ID,1);
 before=inspect();assert.equal(before.Image,pre.image_id_before);assert.equal(runtimeHash('/app/backend/server.js'),pre.runtime_server_sha256);const prior=settings(before);assert.equal(prior.ORACLE_USER,'CRIME_DATA');assert(prior.APP_SCHEMA_PASSWORD&&prior.ORACLE_WALLET_PASSWORD);
 const composeText=fs.readFileSync(path.join(PROJECT,'compose.fu40.yml'),'utf8');assert(composeText.includes('image: '+IMAGE));env={...process.env};for(const[,key]of composeText.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)){assert(!['HOME','PATH','CODEX_HOME'].includes(key));if(prior[key]!==undefined)env[key]=prior[key];}
 Object.assign(env,{ADB_CONNECT_STRING:prior.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:prior.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:prior.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'});
 const [newImage]=JSON.parse(execFileSync('podman',['image','inspect',IMAGE],{encoding:'utf8'}));assert.notEqual(newImage.Id,before.Image);
 stage='app recreation';attempted=true;compose();stage='health';await healthy();const after=inspect();assert.equal(after.Image,newImage.Id);
 stage='settings';sameSettings(before,after);
 stage='runtime hashes';assert.equal(runtimeHash('/app/backend/server.js'),pre.runtime_server_sha256);
 const files=['index.html',...fs.readdirSync(path.join(ROOT,'dist/assets')).map(n=>'assets/'+n)];
 for(const file of files)assert.equal(runtimeHash('/app/frontend/dist/'+file),hash(fs.readFileSync(path.join(ROOT,'dist',file))),file);
 const data=await(await fetch('http://127.0.0.1:8706/api/setup/profiles?profileCode=ADELAIDE_DATA_V2')).json();assert.equal(data.activeProfileCode,'ADELAIDE_DATA');assert.equal(data.backup.INCIDENTS,21532);
 fs.writeFileSync(path.join(ROOT,'deployment.json'),JSON.stringify({status:'deployed_healthy',completed_at:new Date().toISOString(),image_before:before.ImageName,image_after:after.ImageName,image_id_after:after.Image,container_after:after.Id,started_at:after.State.StartedAt,application_environment_unchanged:true,mounts_unchanged:true,ports_unchanged:true,backend_unchanged:true,runtime_server_sha256:pre.runtime_server_sha256,frontend_assets_verified:files.length,active_profile_unchanged:data.activeProfileCode,restore_invoked:false,rollback_image_retained:before.ImageName},null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('Tile-only deployment healthy; backend, settings, ports, mounts and active profile unchanged.');
})().catch(async()=>{if(attempted){try{compose(true);await healthy();assert.equal(inspect().Image,before.Image);console.error('Deployment verification failed at '+stage+'; previous app image restored.');}catch{console.error('Deployment failed at '+stage+'; automatic rollback did not verify. Operator review required.');}}else console.error('Deployment stopped before changes at '+stage+'.');process.exitCode=1;});
