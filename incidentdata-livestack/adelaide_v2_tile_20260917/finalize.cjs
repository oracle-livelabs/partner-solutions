'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=__dirname,PROJECT=path.dirname(ROOT),read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const preview=read('preview_browser.json'),live=read('live_browser.json'),deploy=read('deployment.json');
for(const result of [preview,live]){assert.equal(result.status,'passed');assert.equal(result.selected_profile,'ADELAIDE_DATA_V2');assert.equal(result.active_profile,'ADELAIDE_DATA');assert.equal(result.selected_incidents,21532);assert.equal(result.intercepted_restore_requests.length,6);assert(result.intercepted_restore_requests.every(r=>r.sent_to_server===false));assert.deepEqual(result.page_errors,[]);assert.deepEqual(result.unexpected_write_requests,[]);}
assert.equal(deploy.status,'deployed_healthy');assert.equal(deploy.restore_invoked,false);assert(deploy.backend_unchanged&&deploy.application_environment_unchanged&&deploy.mounts_unchanged&&deploy.ports_unchanged);
assert.deepEqual(read('database_before.json'),read('database_after.json'));
const files=['README.md','prepare.cjs','build.cjs','check_browser.cjs','audit.cjs','deploy.cjs','finalize.cjs','Containerfile','.containerignore','rollback_image.yml','preflight.json','deployment.json','preview_browser.json','live_browser.json','database_before.json','database_after.json','main_before.jsx','frontend/src/main.jsx','frontend/src/app-use-notice.css','runtime_index_before.html','compose_before.yml','baseline_build.log','build.log','preview_tile.png','live_tile.png','dist/index.html',...fs.readdirSync(path.join(ROOT,'dist/assets')).map(n=>'dist/assets/'+n)];
const manifest={status:'completed_verified',completed_at:new Date().toISOString(),tile_profile:'ADELAIDE_DATA_V2',active_profile:'ADELAIDE_DATA',restore_performed:false,changed_source_lines:[533,534,595],backend_unchanged:true,database_preservation_passed:true,deployment:deploy,files:Object.fromEntries(files.map(n=>[n,{sha256:hash(path.join(ROOT,n)),bytes:fs.statSync(path.join(ROOT,n)).size}])),compose_sha256:hash(path.join(PROJECT,'compose.fu40.yml'))};
fs.writeFileSync(path.join(ROOT,'delivery_manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
for(const [file,info]of Object.entries(read('delivery_manifest.json').files))assert.equal(hash(path.join(ROOT,file)),info.sha256);
console.log(`Tile linked to V2; ${files.length} evidence hashes verified. No dataset restored.`);
