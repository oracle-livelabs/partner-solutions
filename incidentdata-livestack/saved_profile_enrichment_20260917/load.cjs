'use strict';
const C=require('./common.cjs');
const {fs,path,ROOT,PROJECT,assert,o,TARGETS,MUTABLE,read,save,connect,rows,tableRows,audit,protectedState,identity,stable,hash}=C;
function expected(pkg,pre){
 const result=Object.fromEntries(MUTABLE.map(t=>[t,[]]));
 for(const target of TARGETS){
  const area=pre.areas.find(a=>a.DATASET_PROFILE_ID===target.id&&a.AREA_CODE===target.area);assert(area);
  pkg.profiles.forEach((p,i)=>{
   const personId=target.id*1000000+800001+i;
   const common={DATASET_PROFILE_ID:target.id,PERSON_ID:personId};
   const attributes={scenario:p.scenario,generated_fictional:true,portrait_policy:'generated_fictional_only',identity_basis:'explicit_user_assignment',narrative_basis:'retained_user_authored_fictional_scenario',association_is_not_evidence:true,portrait_sha256:p.imageSha,source_file_sha256:p.sourceSha,stored_narrative_sha256:p.narrativeSha,embedding_text_sha256:p.textSha,embedding_text_policy:'original_scenario_narrative_without_shared_notice_or_backstory_heading',source_file:p.source,source_filename:path.basename(p.uri),shared_cast_version:'SAVED_CITY_CAST_13_V1',dataset_profile_code:target.code,geographic_role:'synthetic_demo_access_scope_only',local_incident_association:false,original_setting_retained:true,synthetic_notice:pkg.notice};
   result.Z_BASE_PERSONS.push({...common,PERSON_REF:p.ref,DISPLAY_NAME:p.name,ALIAS_NAME:p.alias,PERSON_STATUS:p.status,PORTRAIT_VARIANT:'generated-photo',PORTRAIT_ASSET_URI:p.uri,PORTRAIT_ALT_TEXT:`Generated fictional reference portrait of ${p.name}; identity assigned by the scenario author.`,NARRATIVE_SUMMARY:p.summary,NARRATIVE_TEXT:p.narrative,PROFILE_ATTRIBUTES:attributes,OWNING_PATROL_AREA_ID:area.PATROL_AREA_ID,CREATED_AT:pkg.created_at});
   result.Z_BASE_PERSON_NARRATIVE_VEC.push({...common,EMBEDDING_MODEL:pkg.textModel,SOURCE_SHA256:p.textSha,EMBEDDING:Array.from(new Float32Array(p.textVector)),CREATED_AT:pkg.created_at});
   result.Z_BASE_PERSON_VISUAL_VEC.push({...common,ASSET_REF:p.assetRef,ASSET_KIND:'reference_portrait',ASSET_URI:p.uri,MIME_TYPE:p.mime,ASSET_SHA256:p.imageSha,ASSET_CAPTION:`Generated fictional reference portrait of ${p.name}.`,EMBEDDING_MODEL:pkg.imageModel,EMBEDDING:Array.from(new Float32Array(p.imageVector)),CREATED_AT:pkg.created_at});
  });
  for(const p of pkg.patterns)result.Z_BASE_WATCHED_CRIME_PATTERNS.push({DATASET_PROFILE_ID:target.id,...p});
 }
 return result;
}
function canonical(row){return Object.fromEntries(Object.entries(row).map(([k,v])=>[k,k==='CREATED_AT'&&v?new Date(v).toISOString():ArrayBuffer.isView(v)?Array.from(v):v]));}
function sameRows(a,b){assert.deepEqual(a.map(r=>stable(canonical(r))).sort(),b.map(r=>stable(canonical(r))).sort());}
async function readTargets(c){const result={};for(const t of MUTABLE)result[t]=await rows(c,`SELECT * FROM ${t} WHERE DATASET_PROFILE_ID IN (10,30,50)`);return result;}
async function verify(c,want,pkg){
 const actual=await readTargets(c);for(const t of MUTABLE)sameRows(actual[t],want[t]);
 const checks=[];
 for(const target of TARGETS){
  const id=target.id;
  for(const t of ['Z_BASE_PERSON_INCIDENT_LINKS','Z_BASE_WATCHED_PATTERN_INCIDENTS','Z_BASE_WATCHED_PATTERN_POSTS'])assert.equal((await rows(c,`SELECT COUNT(*) N FROM ${t} WHERE DATASET_PROFILE_ID=:id`,{id}))[0].N,0,`No transplanted links in ${t}`);
  const bad=(await rows(c,`SELECT COUNT(*) N FROM z_base_persons p LEFT JOIN z_base_patrol_areas a ON a.dataset_profile_id=p.dataset_profile_id AND a.patrol_area_id=p.owning_patrol_area_id WHERE p.dataset_profile_id=:id AND a.patrol_area_id IS NULL`,{id}))[0].N;assert.equal(bad,0);
  // Reproduce the existing access-scope predicates without changing live tables or entitlements.
  const access=await rows(c,`SELECT u.user_name,COUNT(p.person_id) N FROM z_base_security_users u LEFT JOIN z_base_persons p ON p.dataset_profile_id=u.dataset_profile_id AND (u.user_name='statewide_admin' OR EXISTS(SELECT 1 FROM z_base_security_entitlements e WHERE e.dataset_profile_id=u.dataset_profile_id AND e.user_name=u.user_name AND e.patrol_area_id=p.owning_patrol_area_id)) WHERE u.dataset_profile_id=:id GROUP BY u.user_name ORDER BY u.user_name`,{id});
  assert.equal(access.find(a=>a.USER_NAME==='statewide_admin')?.N,13);assert(access.filter(a=>a.USER_NAME!=='statewide_admin').every(a=>a.N===0));
  const retrieval=[];
  for(const p of pkg.profiles)for(const [table,vector]of [['Z_BASE_PERSON_NARRATIVE_VEC',p.textVector],['Z_BASE_PERSON_VISUAL_VEC',p.imageVector]]){
   const found=await rows(c,`SELECT p.person_ref,VECTOR_DISTANCE(v.embedding,TO_VECTOR(:vector),COSINE) DISTANCE FROM ${table} v JOIN z_base_persons p ON p.dataset_profile_id=v.dataset_profile_id AND p.person_id=v.person_id WHERE p.dataset_profile_id=:id ORDER BY VECTOR_DISTANCE(v.embedding,TO_VECTOR(:vector),COSINE) FETCH FIRST 1 ROW ONLY`,{id,vector:JSON.stringify(vector)});
   assert.equal(found[0]?.PERSON_REF,p.ref);assert(Math.abs(found[0].DISTANCE)<0.00001);retrieval.push({ref:p.ref,type:table.includes('NARRATIVE')?'narrative':'visual',rank:1,distance:found[0].DISTANCE});
  }
  const probes=[];for(const probe of pkg.probes){const matches=await rows(c,`SELECT p.person_ref,1-VECTOR_DISTANCE(v.embedding,TO_VECTOR(:vector),COSINE) SCORE FROM z_base_person_narrative_vec v JOIN z_base_persons p ON p.dataset_profile_id=v.dataset_profile_id AND p.person_id=v.person_id WHERE p.dataset_profile_id=:id ORDER BY VECTOR_DISTANCE(v.embedding,TO_VECTOR(:vector),COSINE) FETCH FIRST 3 ROWS ONLY`,{id,vector:JSON.stringify(probe.vector)});assert(matches.some(p=>p.PERSON_REF===probe.expected),`Narrative probe expected in top three: ${probe.expected}`);probes.push({query:probe.query,expected:probe.expected,matches});}
  checks.push({profile:target.code,people:13,narrative_vectors:13,visual_vectors:13,patterns:21,visible_patterns:6,local_links:0,access_scope:access,self_retrieval:retrieval,narrative_probes:probes});
 }
 return{checks,actual};
}
async function insert(c,table,data){
 assert(MUTABLE.includes(table));
 for(const row of data){const columns=Object.keys(row),binds={};const values=columns.map((name,index)=>{const key='b'+index,value=row[name];if(name==='PROFILE_ATTRIBUTES'){binds[key]=JSON.stringify(value);return`JSON(:${key})`;}if(name==='EMBEDDING'){binds[key]=JSON.stringify(value);return`TO_VECTOR(:${key})`;}if(name==='CREATED_AT'){binds[key]=value;return`TO_TIMESTAMP(:${key},'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"')`;}binds[key]=name==='NARRATIVE_TEXT'?{val:value,type:o.CLOB}:value;return':'+key;});await c.execute(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')})`,binds);}
}
async function main(){
 const mode=process.argv[2];assert(['--dry-run','--apply','--verify'].includes(mode),'Use --dry-run, --apply or --verify');
 const file={'--dry-run':'dry_run.json','--apply':'load_result.json','--verify':'verification.json'}[mode];assert(!fs.existsSync(path.join(ROOT,file)),`${file} already exists`);
 const pkg=read('package.json'),pre=read('preflight.json'),packageHash=hash(stable(pkg));assert.equal(packageHash,read('package.sha256.json').sha256);assert.equal(hash(stable(read('before_additions.json'))),pre.backup_sha256);
 for(const p of pkg.profiles){assert.equal(hash(fs.readFileSync(path.join(PROJECT,'frontend/public',p.uri))),p.imageSha);assert.equal(hash(p.embeddingText),p.textSha);assert.equal(hash(p.narrative),p.narrativeSha);}
 if(mode==='--apply'){const dry=read('dry_run.json');assert(dry.rolled_back&&dry.preservation_passed);assert.equal(dry.package_sha256,packageHash);}
 const wanted=expected(pkg,pre),c=await connect();let committed=false;
 try{
  await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  await c.execute(mode==='--verify'?'SET TRANSACTION READ ONLY':'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  if(mode!=='--verify'){await c.execute('SELECT dataset_profile_id FROM z_base_active_dataset_profile FOR UPDATE NOWAIT');await c.execute('SELECT dataset_profile_id FROM z_base_dataset_profiles WHERE dataset_profile_id IN (6,10,30,50) FOR UPDATE NOWAIT');}
  const state=await identity(c);assert.deepEqual(state.active,pre.active,'Active dataset changed since preflight');assert.deepEqual(state.profiles,pre.profiles,'Profile metadata changed since preflight');
  const source=await tableRows(c,'Z_BASE_WATCHED_CRIME_PATTERNS','WHERE DATASET_PROFILE_ID=6 ORDER BY DISPLAY_ORDER');assert.equal(hash(stable(source)),pkg.source_pattern_sha256,'Adelaide source patterns changed');
  const current=await readTargets(c),empty=MUTABLE.every(t=>current[t].length===0);
  if(empty){assert.notEqual(mode,'--verify','Targets not loaded');for(const t of MUTABLE)await insert(c,t,wanted[t]);}
  else for(const t of MUTABLE)sameRows(current[t],wanted[t]); // partial or differing registration always fails, never replaces
  const result=await verify(c,wanted,pkg);
  const after=await audit(c);assert.deepEqual(protectedState(after),protectedState(read('audit_before.json')),'Pre-existing protected data changed');
  save(mode==='--apply'?'audit_precommit.json':mode==='--verify'?'audit_after.json':'audit_dry_run.json',after);
  if(mode==='--apply'){await c.commit();committed=true;}else await c.rollback();
  if(mode==='--dry-run'){const rolledBack=await readTargets(c);for(const t of MUTABLE)sameRows(rolledBack[t],current[t]);}
  save(file,{mode,committed,rolled_back:mode==='--dry-run',idempotent_existing:!empty,package_sha256:packageHash,active_unchanged:state.active,preservation_passed:true,completed_at:new Date().toISOString(),profiles:result.checks});
  if(mode==='--apply')save('after_additions.json',Object.fromEntries(Object.entries(result.actual).map(([t,rs])=>[t,rs.map(canonical)])));
  console.log(JSON.stringify({mode,committed,idempotent_existing:!empty,profiles:result.checks.map(({profile,people,patterns,visible_patterns})=>({profile,people,patterns,visible_patterns}))},null,2));
 }catch(e){if(!committed)await c.rollback();throw e;}finally{await c.close();}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={expected,canonical,sameRows};
