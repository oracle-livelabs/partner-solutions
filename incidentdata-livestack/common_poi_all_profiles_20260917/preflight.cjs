'use strict';
const {assert,fs,path,ROOT,TARGETS,BASE,LIVE,pkg,save,connect,rows,tableRows,audit,state,collections,hash,stable}=require('./common.cjs');
(async()=>{assert(!fs.existsSync(path.join(ROOT,'preflight.json')));const c=await connect();try{await c.execute('SET TRANSACTION READ ONLY');const identity=await state(c),before=await collections(c);
 for(const t of [...BASE.slice(1),...LIVE])assert.equal(before[t].length,0,`Unexpected existing live or vector rows: ${t}`);
 const areas=await rows(c,'select dataset_profile_id,patrol_area_id,area_code from z_base_patrol_areas where dataset_profile_id in (1,4,5,6)');
 for(const t of TARGETS)assert.equal(areas.filter(a=>a.DATASET_PROFILE_ID===t.id&&a.AREA_CODE===t.area).length,1);
 const liveAreas=await rows(c,'select patrol_area_id,area_code from patrol_areas');assert.equal(liveAreas.filter(a=>a.AREA_CODE==='CENTRAL').length,1);
 const existingCast=before.Z_BASE_PERSONS.filter(r=>pkg.profiles.some(p=>p.ref===r.PERSON_REF));assert.equal(existingCast.length,4);assert(existingCast.every(r=>r.DATASET_PROFILE_ID===6));
 for(const r of existingCast){const p=pkg.profiles.find(p=>p.ref===r.PERSON_REF);assert.equal(r.DISPLAY_NAME,p.name);assert.equal(r.ALIAS_NAME,p.alias);assert.equal(r.PERSON_STATUS,p.status);assert.equal(r.PORTRAIT_ASSET_URI,p.uri);assert.equal(r.PROFILE_ATTRIBUTES.generated_fictional,true);assert.equal(r.PROFILE_ATTRIBUTES.scenario,p.scenario);}
 const links=await rows(c,'select dataset_profile_id,person_id,count(*) N from z_base_person_incident_links where dataset_profile_id in (1,4,5,6) group by dataset_profile_id,person_id');
 const created=new Date().toISOString().replace(/Z$/,'000');
 save('before_people_and_vectors.json',before);save('preflight.json',{...identity,areas,liveAreas,links,created_at:created,package_sha256:hash(stable(pkg)),before_sha256:hash(stable(before)),targets:TARGETS,counts:TARGETS.map(t=>({profile:t.code,before:before.Z_BASE_PERSONS.filter(p=>p.DATASET_PROFILE_ID===t.id).length,matching_shared:existingCast.filter(p=>p.DATASET_PROFILE_ID===t.id).length}))});
 save('audit_before.json',await audit(c));await c.rollback();console.log('Preflight and recoverable POI backup complete; four matching Adelaide V2 identities will retain IDs, scopes and links.');
}finally{await c.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
