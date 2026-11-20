'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../db/migrations/20260920_shared_identity_restore.sql'),'utf8');
const body=sql.slice(sql.indexOf('CREATE OR REPLACE PACKAGE BODY'));
const restore=body.slice(body.indexOf('  PROCEDURE restore_profile('));
test('restore keeps shared identity rows and checks security/dependencies before deletes',()=>{
 assert.doesNotMatch(restore,/DELETE\s+FROM\s+security_users\b/i);
 assert.doesNotMatch(restore,/copy_base_to_active\(v_maps\(1\)/i);
 const firstDelete=restore.indexOf('DELETE FROM');
 for(const guard of ['SAVEPOINT restore_start','FOR UPDATE NOWAIT','p_expected_active_profile IS NOT NULL','assert_restore_security(v_profile_id)','assert_restore_dependencies'])assert.ok(restore.indexOf(guard)>=0&&restore.indexOf(guard)<firstDelete,guard);
});
test('NRT, counts and active marker are committed together with rollback on failure',()=>{
 assert.equal((restore.match(/\bCOMMIT;/g)||[]).length,1);
 assert.ok(restore.indexOf('IF v_live_count<>v_saved_count')<restore.indexOf('COMMIT;'));
 assert.ok(restore.indexOf('UPDATE crime_incidents SET occurred_at')<restore.indexOf('COMMIT;'));
 assert.ok(restore.indexOf('UPDATE z_base_active_dataset_profile')<restore.indexOf('COMMIT;'));
 assert.match(restore,/EXCEPTION WHEN OTHERS THEN\s+ROLLBACK TO restore_start;\s+RAISE;/);
});
test('versioned SQL migration matches the package installed and exercised in acceptance',()=>{
 const installed=fs.readFileSync(path.join(__dirname,'../restore_workflow_20260920/restore_body.sql'),'utf8').trim();
 assert.equal(body.slice('CREATE OR REPLACE '.length,body.indexOf('\n/\n')).trim(),installed);
});
