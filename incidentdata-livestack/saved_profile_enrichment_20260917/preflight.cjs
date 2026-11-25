'use strict';
const {fs,path,ROOT,TARGETS,MUTABLE,save,connect,rows,tableRows,audit,identity,hash,stable,assert}=require('./common.cjs');
(async()=>{assert(!fs.existsSync(path.join(ROOT,'preflight.json')),'Preflight already exists');const c=await connect();try{
 await c.execute('SET TRANSACTION READ ONLY');const state=await identity(c);
 const patterns=await tableRows(c,'Z_BASE_WATCHED_CRIME_PATTERNS','WHERE DATASET_PROFILE_ID=6 ORDER BY DISPLAY_ORDER');assert.equal(patterns.length,21);assert.equal(patterns.filter(p=>p.ACTIVATE_UI==='Y').length,6);
 const areas=await rows(c,'select dataset_profile_id,patrol_area_id,area_code from z_base_patrol_areas where dataset_profile_id in (10,30,50)');
 for(const t of TARGETS)assert.equal(areas.filter(a=>a.DATASET_PROFILE_ID===t.id&&a.AREA_CODE===t.area).length,1);
 const backup={};for(const table of MUTABLE){backup[table]=await tableRows(c,table,'WHERE DATASET_PROFILE_ID IN (10,30,50)');assert.equal(backup[table].length,0,`Expected empty target additions: ${table}`);}
 save('before_additions.json',backup);save('source_patterns.json',patterns);save('preflight.json',{...state,areas,created_at:new Date().toISOString(),source_profile:'ADELAIDE_DATA_V2',targets:TARGETS,backup_sha256:hash(stable(backup))});
 save('audit_before.json',await audit(c));await c.rollback();console.log('Preflight complete: three inactive targets empty; 21 definitions and six display flags preserved as source.');
}finally{await c.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
