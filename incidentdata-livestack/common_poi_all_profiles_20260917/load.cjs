'use strict';
const C=require('./common.cjs');
const {fs,path,ROOT,PROJECT,assert,o,TARGETS,BASE,LIVE,pkg,read,save,connect,rows,tableRows,collections,audit,protectedState,state,same,normalize,hash,stable}=C;
const{build}=require('./plan.cjs');
function bindValue(name,value,key,binds){
 if(name==='PROFILE_ATTRIBUTES'){binds[key]=JSON.stringify(value);return`JSON(:${key})`;}
 if(name==='EMBEDDING'){binds[key]=JSON.stringify(value);return`TO_VECTOR(:${key})`;}
 if(name==='CREATED_AT'){binds[key]=value;return`TO_TIMESTAMP(:${key},'YYYY-MM-DD"T"HH24:MI:SS.FF6')`;}
 binds[key]=name==='NARRATIVE_TEXT'?{val:value,type:o.CLOB}:value;return':'+key;
}
async function insert(c,table,row,identity=false){assert([...BASE,...LIVE].includes(table));const data={...row};if(identity)delete data.PERSON_ID;const columns=Object.keys(data),binds={};const values=columns.map((k,i)=>bindValue(k,data[k],'b'+i,binds));await c.execute(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')})`,binds);}
async function updateExisting(c,table,row,previous){
 assert.equal(table,'Z_BASE_PERSONS');assert.equal(row.DATASET_PROFILE_ID,6);assert(row.PERSON_REF.startsWith('POI-NBNW-'));
 for(const k of ['DATASET_PROFILE_ID','PERSON_ID','PERSON_REF','DISPLAY_NAME','ALIAS_NAME','PERSON_STATUS','PORTRAIT_VARIANT','PORTRAIT_ASSET_URI','OWNING_PATROL_AREA_ID','CREATED_AT'])assert.deepEqual(row[k],previous[k],`Protected existing POI field: ${k}`);
 const cols=['PORTRAIT_ALT_TEXT','NARRATIVE_SUMMARY','NARRATIVE_TEXT','PROFILE_ATTRIBUTES'],binds={pid:row.DATASET_PROFILE_ID,id:row.PERSON_ID,ref:row.PERSON_REF};
 const assignments=cols.map((k,i)=>`${k}=${bindValue(k,row[k],'b'+i,binds)}`);
 const result=await c.execute(`UPDATE Z_BASE_PERSONS SET ${assignments.join(',')} WHERE DATASET_PROFILE_ID=:pid AND PERSON_ID=:id AND PERSON_REF=:ref`,binds);assert.equal(result.rowsAffected,1);
}
function liveIdMap(current){const ids={};for(const p of pkg.profiles){const matches=current.PERSONS_OF_INTEREST.filter(r=>r.PERSON_REF===p.ref);assert.equal(matches.length,1);assert(Number.isInteger(matches[0].PERSON_ID)&&matches[0].PERSON_ID>0);ids[p.ref]=matches[0].PERSON_ID;}assert.equal(new Set(Object.values(ids)).size,13);return ids;}
async function verify(c,pre,before){
 const got=await collections(c),ids=liveIdMap(got),want=build(pre,before,ids);for(const t of [...BASE,...LIVE])same(got[t],want[t]);
 const checks=[];
 for(const t of [...TARGETS,{id:null,code:'ACTIVE_ADELAIDE_DATA'}]){
  const live=t.id===null,pt=live?LIVE[0]:BASE[0],nt=live?LIVE[1]:BASE[1],vt=live?LIVE[2]:BASE[2];
  const scope=live?'':' AND p.dataset_profile_id=:id',join=live?'':' AND p.dataset_profile_id=v.dataset_profile_id',scopeBinds=live?{}:{id:t.id};
  const people=got[pt].filter(p=>live||p.DATASET_PROFILE_ID===t.id);assert.equal(people.filter(p=>pkg.profiles.some(k=>k.ref===p.PERSON_REF)).length,13);
  const retrieval=[];for(const p of pkg.profiles)for(const[table,vector]of [[nt,p.textVector],[vt,p.imageVector]]){const r=await rows(c,`SELECT p.person_ref,VECTOR_DISTANCE(v.embedding,TO_VECTOR(:vector),COSINE) DISTANCE FROM ${table} v JOIN ${pt} p ON p.person_id=v.person_id${join} WHERE 1=1${scope} ORDER BY VECTOR_DISTANCE(v.embedding,TO_VECTOR(:vector),COSINE) FETCH FIRST 1 ROW ONLY`,{...scopeBinds,vector:JSON.stringify(vector)});assert.equal(r[0]?.PERSON_REF,p.ref);assert(Math.abs(r[0].DISTANCE)<0.00001);retrieval.push({ref:p.ref,kind:table.includes('NARRATIVE')?'narrative':'portrait',rank:1});}
  const probes=[];for(const probe of pkg.probes){const matches=await rows(c,`SELECT p.person_ref,1-VECTOR_DISTANCE(v.embedding,TO_VECTOR(:vector),COSINE) SCORE FROM ${nt} v JOIN ${pt} p ON p.person_id=v.person_id${join} WHERE 1=1${scope} ORDER BY VECTOR_DISTANCE(v.embedding,TO_VECTOR(:vector),COSINE) FETCH FIRST 3 ROWS ONLY`,{...scopeBinds,vector:JSON.stringify(probe.vector)});assert(matches.some(r=>r.PERSON_REF===probe.expected));probes.push({query:probe.query,expected:probe.expected,matches});}
  checks.push({profile:t.code,total_people:people.length,common_people:13,narrative_vectors:13,portrait_vectors:13,self_retrieval:retrieval,narrative_probes:probes});
 }
 // Existing link rows, incidents, watch definitions and all security rows are covered by the protected audit.
 const secure=[];for(const user of ['statewide_admin','adelaide_central_analyst','northern_analyst','southern_analyst','read_only_viewer']){c.clientId=user;const r=(await rows(c,'SELECT COUNT(*) N FROM secure_persons_of_interest_v'))[0].N;secure.push({user,visible:r});assert.equal(r,['statewide_admin','adelaide_central_analyst','read_only_viewer'].includes(user)?13:0);}c.clientId='statewide_admin';
 return{checks,secure,got,ids};
}
async function main(){
 const mode=process.argv[2];assert(['--dry-run','--apply','--verify'].includes(mode));const filename={'--dry-run':'dry_run.json','--apply':'load_result.json','--verify':'verification.json'}[mode];assert(!fs.existsSync(path.join(ROOT,filename)),'Receipt exists; do not overwrite');
 const pre=read('preflight.json'),before=read('before_people_and_vectors.json');assert.equal(hash(stable(before)),pre.before_sha256);assert.equal(hash(stable(pkg)),pre.package_sha256);
 for(const p of pkg.profiles){assert.equal(hash(fs.readFileSync(path.join(PROJECT,'frontend/public',p.uri))),p.imageSha);assert.equal(hash(p.narrative),p.narrativeSha);assert.equal(hash(p.embeddingText),p.textSha);}
 if(mode==='--apply'){const dry=read('dry_run.json');assert(dry.rolled_back&&dry.preservation_passed);assert.equal(dry.package_sha256,pre.package_sha256);}
 const c=await connect();let committed=false;try{
  await c.execute('ALTER SESSION DISABLE PARALLEL QUERY');await c.execute('ALTER SESSION DISABLE PARALLEL DML');await c.execute(mode==='--verify'?'SET TRANSACTION READ ONLY':'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  if(mode!=='--verify'){await c.execute('SELECT dataset_profile_id FROM z_base_active_dataset_profile FOR UPDATE NOWAIT');await c.execute('SELECT dataset_profile_id FROM z_base_dataset_profiles WHERE dataset_profile_id IN (1,4,5,6) FOR UPDATE NOWAIT');}
  const currentState=await state(c);assert.deepEqual(currentState.active,pre.active);assert.deepEqual(currentState.profiles,pre.profiles);
  const current=await collections(c);let original=true;try{for(const t of [...BASE,...LIVE])same(current[t],before[t]);}catch{original=false;}
  if(original){
   assert.notEqual(mode,'--verify','Expected prior committed load');const planned=build(pre,before);
   for(const r of planned.Z_BASE_PERSONS){const old=before.Z_BASE_PERSONS.find(x=>x.DATASET_PROFILE_ID===r.DATASET_PROFILE_ID&&x.PERSON_ID===r.PERSON_ID);if(!old)await insert(c,BASE[0],r);else if(pkg.profiles.some(p=>p.ref===r.PERSON_REF))await updateExisting(c,BASE[0],r,old);else same([r],[old]);}
   for(const t of BASE.slice(1))for(const r of planned[t])await insert(c,t,r);
   for(const r of planned.PERSONS_OF_INTEREST)await insert(c,LIVE[0],r,true);
   const ids=liveIdMap(await collections(c)),complete=build(pre,before,ids);
   for(const t of LIVE.slice(1))for(const r of complete[t])await insert(c,t,r);
  }
  const result=await verify(c,pre,before);const after=await audit(c);assert.deepEqual(protectedState(after),protectedState(read('audit_before.json')),'An unrelated table, row or snapshot changed');
  save(mode==='--dry-run'?'audit_dry_run.json':mode==='--apply'?'audit_precommit.json':'audit_after.json',after);
  if(mode==='--apply'){await c.commit();committed=true;}else await c.rollback();
  if(mode==='--dry-run'){const rolled=await collections(c);for(const t of [...BASE,...LIVE])same(rolled[t],current[t]);}
  save(filename,{mode,committed,rolled_back:mode==='--dry-run',idempotent_existing:!original,package_sha256:pre.package_sha256,preservation_passed:true,active_unchanged:pre.active,completed_at:new Date().toISOString(),profiles:result.checks,live_security:result.secure,live_id_mapping:result.ids});
  if(mode==='--apply')save('after_people_and_vectors.json',result.got);
  console.log(JSON.stringify({mode,committed,idempotent_existing:!original,profiles:result.checks.map(({profile,total_people,common_people})=>({profile,total_people,common_people})),live_security:result.secure},null,2));
 }catch(e){if(!committed)await c.rollback();throw e;}finally{await c.close();}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={build,verify};
