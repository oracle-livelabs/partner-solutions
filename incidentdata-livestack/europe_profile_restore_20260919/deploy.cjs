'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const PROJECT=path.dirname(__dirname),NAME='policeadelaide_app-fu40_1',IMAGE='local/adelaide-crime-intelligence:six-city-restore-20260919';
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const inspect=()=>JSON.parse(execFileSync('podman',['inspect',NAME],{encoding:'utf8'}))[0];
const settings=app=>Object.fromEntries(app.Config.Env.map(value=>{const i=value.indexOf('=');return[value.slice(0,i),value.slice(i+1)];}));
const runtimeHash=file=>hash(execFileSync('podman',['exec',NAME,'node','-e','process.stdout.write(require("fs").readFileSync(process.argv[1]))',file]));
let stage='preflight',attempted=false,env,before;
function compose(rollback=false){const args=['compose','-f','compose.fu40.yml'];if(rollback)args.push('-f','europe_profile_restore_20260919/rollback_image.yml');args.push('up','-d','--no-build','--no-deps','app-fu40');execFileSync('podman',args,{cwd:PROJECT,env,stdio:'pipe',timeout:120000,maxBuffer:4*1024*1024});}
async function healthy(){const deadline=Date.now()+45000;while(Date.now()<deadline){try{const response=await fetch('http://127.0.0.1:8706/api/health',{signal:AbortSignal.timeout(2000)});if(response.ok&&(await response.json()).status==='healthy')return;}catch{}await new Promise(resolve=>setTimeout(resolve,800));}throw Error('Application health deadline exceeded');}
function sameSettings(prior,current){
  const a=settings(prior),b=settings(current),changed=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(key=>key!=='HOSTNAME'&&a[key]!==b[key]);
  assert.equal(changed.length,0,'Application setting names changed: '+changed.join(','));
  const mounts=app=>app.Mounts.map(m=>({type:m.Type,source:m.Source,destination:m.Destination,rw:m.RW})).sort((m,n)=>m.destination.localeCompare(n.destination));
  assert.deepEqual(mounts(prior),mounts(current));assert.deepEqual(prior.HostConfig.PortBindings,current.HostConfig.PortBindings);
}
(async()=>{
  const pre=read('preflight.json');assert.equal(read('preview_browser.json').status,'passed');assert.equal(read('database_before.json').identity.active[0].DATASET_PROFILE_ID,50);
  assert.match(fs.readFileSync(path.join(__dirname,'unit_tests.log'),'utf8'),/# fail 0/);
  assert(!fs.existsSync(path.join(__dirname,'deployment.json')));
  before=inspect();assert.equal(before.Image,pre.image_id_before);assert.equal(before.Id,pre.container_before);
  for(const file of pre.changed_backend_files)assert.equal(runtimeHash('/app/'+file),pre.runtime_manifest[file]);
  const prior=settings(before),composeText=fs.readFileSync(path.join(PROJECT,'compose.fu40.yml'),'utf8');assert(composeText.includes('image: '+IMAGE));
  env={...process.env};for(const[,key]of composeText.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)){assert(!['HOME','PATH','CODEX_HOME'].includes(key));if(prior[key]!==undefined)env[key]=prior[key];}
  Object.assign(env,{ADB_CONNECT_STRING:prior.ORACLE_CONNECTION_STRING,ADB_WALLET_PASSWORD:prior.ORACLE_WALLET_PASSWORD,FU40_CRIME_FRONTEND_URL:prior.FRONTEND_URL,FU40_CRIME_APP_PORT:'8706'});
  const [newImage]=JSON.parse(execFileSync('podman',['image','inspect',IMAGE],{encoding:'utf8'}));assert.notEqual(newImage.Id,before.Image);
  stage='application recreation';attempted=true;compose();stage='health';await healthy();const after=inspect();assert.equal(after.Image,newImage.Id);
  stage='settings verification';sameSettings(before,after);
  stage='backend preservation';
  for(const[file,digest]of Object.entries(pre.runtime_manifest).filter(([file])=>file.startsWith('backend/'))){
    const expected=pre.changed_backend_files.includes(file)?hash(fs.readFileSync(path.join(PROJECT,file))):digest;
    assert.equal(runtimeHash('/app/'+file),expected,file);
  }
  stage='frontend verification';const frontendFiles=['index.html',...fs.readdirSync(path.join(__dirname,'dist/assets')).map(name=>'assets/'+name)];
  for(const file of frontendFiles)assert.equal(runtimeHash('/app/frontend/dist/'+file),hash(fs.readFileSync(path.join(__dirname,'dist',file))),file);
  stage='profile capabilities';const mappings=[];
  for(const[code,count,nrt]of [['ADELAIDE_DATA_V2',21532,true],['PERTH_DATA',33511,true],['BRISBANE_DATA',42317,true],['AMSTERDAM_DATA_V1',14467,false],['BRUSSELS_DATA_V1',25691,false],['DUBLIN_CITY_DATA_V1',17817,false]]){
    const response=await fetch('http://127.0.0.1:8706/api/setup/profiles?profileCode='+code);assert.equal(response.status,200);const data=await response.json();
    assert.equal(data.profile.PROFILE_CODE,code);assert.equal(data.backup.INCIDENTS,count);assert.equal(data.activeProfileCode,'DUBLIN_CITY_DATA_V1');
    assert.equal(data.live.INCIDENTS,17817);assert.equal(data.live.PERSONS,13);assert.equal(data.live.CASES,5);
    assert.equal(data.capabilities.restore,true);assert.equal(data.capabilities.nrtRestore,nrt);mappings.push({code,count,nrt});
  }
  fs.writeFileSync(path.join(__dirname,'deployment.json'),JSON.stringify({status:'deployed_healthy',at:new Date().toISOString(),image_before:before.ImageName,image_after:after.ImageName,image_id_after:after.Image,container_after:after.Id,started_at:after.State.StartedAt,application_settings_unchanged:true,mounts_unchanged:true,ports_unchanged:true,unrelated_backend_files_unchanged:true,frontend_assets_verified:frontendFiles.length,profile_mappings:mappings,active_profile_unchanged:'DUBLIN_CITY_DATA_V1',restore_invoked:false,rollback_image_retained:before.ImageName},null,2)+'\n',{flag:'wx'});
  console.log('Six-city restore deployment healthy. Dublin stays active; unrelated backend files unchanged.');
})().catch(async()=>{
  if(attempted){try{compose(true);await healthy();assert.equal(inspect().Image,before.Image);console.error('Verification failed at '+stage+'; prior application image restored.');}catch{console.error('Deployment failed at '+stage+'; automatic rollback not verified. Operator review required.');}}
  else console.error('Deployment stopped before changes at '+stage+'.');process.exitCode=1;
});
