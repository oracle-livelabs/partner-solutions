'use strict';
const {fs,path,ROOT,PROJECT,assert,read,save,hash,protectedState,same,TABLES}=require('./common.cjs');
const load=read('load_result.json'),verify=read('verification.json'),app=read('app_verification.json');
const deploy=read('deployment_result.json'),sql=read('summary_sql_tests.json');
assert(load.committed && load.preservation_passed);
assert.equal(load.inserted,42);assert.equal(load.updated,12);
assert(verify.idempotent_existing && verify.preservation_passed);
assert.equal(verify.inserted,0);assert.equal(verify.updated,0);
assert.deepEqual(protectedState(read('audit_before.json')),protectedState(read('audit_after.json')));
for(const table of TABLES)same(read('after_patterns.json')[table],read('planned_patterns.json')[table]);
assert.equal(app.status,'passed_live_browser_and_api');
assert.equal(app.active[0].PROFILE_CODE,'ADELAIDE_DATA');
assert.equal(app.browser.pattern_cards,6);assert.equal(app.browser.dashboard_watches,6);
assert.equal(app.browser.poi_cards,13);assert(app.browser.poi_portraits_loaded);
assert.deepEqual(app.browser.page_errors,[]);assert.deepEqual(app.browser.write_requests,[]);
assert.equal(app.saved_profiles.length,7);assert(app.saved_profiles.every(p=>p.DISPLAYED===6));
assert.equal(deploy.status,'deployed_healthy');
assert(deploy.application_environment_unchanged && deploy.mounts_unchanged && deploy.ports_unchanged);
assert.equal(sql.status,'passed_read_only');assert.equal(sql.fixtures.length,2);assert.equal(sql.live_scopes.length,5);
const tests=fs.readFileSync(path.join(ROOT,'application_tests.log'),'utf8');
assert.match(tests,/# tests 148\n/);assert.match(tests,/# pass 148\n/);assert.match(tests,/# fail 0\n/);
const digest=file=>hash(fs.readFileSync(file));
assert.equal(digest(path.join(ROOT,'runtime_server_after.js')),deploy.runtime_server_sha256);
assert.equal(digest(path.join(PROJECT,'backend/community-signals-summary.js')),deploy.helper_sha256);
assert.equal(digest(path.join(ROOT,'community-signals-summary.js')),deploy.helper_sha256);
const files=fs.readdirSync(ROOT).filter(n=>fs.statSync(path.join(ROOT,n)).isFile()&&n!=='delivery_manifest.json').sort();
const projectFiles=['backend/server.js','backend/community-signals-summary.js','test/community-signals-summary.test.js','compose.fu40.yml'];
save('delivery_manifest.json',{
 status:'completed_verified',created_at:new Date().toISOString(),active_profile:'ADELAIDE_DATA',
 database_changes:{saved_definitions_inserted:42,saved_display_flags_updated:6,live_display_flags_updated:6},
 saved_profiles:load.profiles.filter(p=>p.profile!=='ACTIVE_ADELAIDE_DATA'),
 verification:{protected_data_unchanged:true,application_tests_passed:148,oracle_fixtures_passed:2,live_user_scopes_checked:5,browser:app.browser},
 deployment:deploy,
 limitations:['No new local incident/post relationships or cases','Pattern embeddings not generated; semantic search not invoked','Two pre-existing unresolved Adelaide case-reference placeholders preserved'],
 files:Object.fromEntries(files.map(n=>[n,{sha256:digest(path.join(ROOT,n)),bytes:fs.statSync(path.join(ROOT,n)).size}])),
 workspace_files:Object.fromEntries(projectFiles.map(n=>[n,{sha256:digest(path.join(PROJECT,n))}]))
});
const manifest=read('delivery_manifest.json');
for(const [file,info]of Object.entries(manifest.files))assert.equal(digest(path.join(ROOT,file)),info.sha256,file);
for(const [file,info]of Object.entries(manifest.workspace_files))assert.equal(digest(path.join(PROJECT,file)),info.sha256,file);
console.log(`Delivery complete: ${files.length} artifact hashes and ${projectFiles.length} workspace hashes verified.`);
