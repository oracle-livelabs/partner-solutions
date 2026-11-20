const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),cp=require('child_process');
(async()=>{
 const get=async(port,url)=>{const r=await fetch('http://127.0.0.1:'+port+url,{headers:{'X-Demo-User':'statewide_admin'}});assert.equal(r.status,200);return r.json();};
 const health=await get(8706,'/api/health'),dashboard=await get(8706,'/api/dashboard'),active=await get(18706,'/api/profile-context'),saved=await get(18706,'/api/setup/profiles?profileCode=AMSTERDAM_DATA_V1');
 assert.equal(health.status,'healthy');assert.equal(active.profileCode,'BRUSSELS_DATA_V1');assert.equal(saved.profile.PROFILE_CODE,'AMSTERDAM_DATA_V1');assert.equal(saved.backup.INCIDENTS,14467);assert.equal(saved.live.INCIDENTS,25691);
 const container=cp.spawnSync('podman',['inspect','--format','{{.State.Status}} {{.RestartCount}} {{.State.StartedAt}}','policeadelaide_app-fu40_1'],{encoding:'utf8'});
 assert.equal(container.status,0,container.stderr);assert.match(container.stdout,/^running 0 /);
 const result={checked_at:new Date().toISOString(),status:'passed',production_health:health,production_dashboard:dashboard,active_profile:active.profileCode,amsterdam_saved_incidents:saved.backup.INCIDENTS,live_incidents:saved.live.INCIDENTS,production_container:container.stdout.trim(),production_deployed:false,amsterdam_activated:false};
 fs.writeFileSync(path.join(__dirname,'final_health.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
