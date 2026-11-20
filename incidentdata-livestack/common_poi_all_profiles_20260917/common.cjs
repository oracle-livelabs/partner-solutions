'use strict';
const old=require('../saved_profile_enrichment_20260917/common.cjs');
const {fs,path,assert,hash,stable,rows,tableRows}=old;
const ROOT=__dirname,PROJECT=path.dirname(ROOT),SOURCE=path.join(PROJECT,'saved_profile_enrichment_20260917');
const TARGETS=[{id:1,code:'ADELAIDE_DATA',area:'CENTRAL'},{id:4,code:'BRISBANE_DATA',area:'BRIS_CENTRAL'},{id:5,code:'PERTH_DATA',area:'PERTH_CENTRAL'},{id:6,code:'ADELAIDE_DATA_V2',area:'CENTRAL'}];
const BASE=['Z_BASE_PERSONS','Z_BASE_PERSON_NARRATIVE_VEC','Z_BASE_PERSON_VISUAL_VEC'];
const LIVE=['PERSONS_OF_INTEREST','PERSON_NARRATIVE_EMBEDDINGS','PERSON_VISUAL_EMBEDDINGS'];
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
const save=(n,v)=>fs.writeFileSync(path.join(ROOT,n),JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
const pkg=JSON.parse(fs.readFileSync(path.join(SOURCE,'package.json'),'utf8'));
assert.equal(hash(stable(pkg)),JSON.parse(fs.readFileSync(path.join(SOURCE,'package.sha256.json'))).sha256);
assert.equal(pkg.profiles.length,13);
function normalize(r){return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,ArrayBuffer.isView(v)?Array.from(v):v]));}
function same(a,b){assert.deepEqual(a.map(r=>stable(normalize(r))).sort(),b.map(r=>stable(normalize(r))).sort());}
function protectedState(a){const c=JSON.parse(JSON.stringify(a));for(const t of BASE){for(const p of TARGETS)delete c.tables[t][String(p.id)];delete c.tables[t].empty;}for(const t of LIVE)delete c.tables[t];return c;}
async function state(c){const db=(await rows(c,"select user username,sys_context('USERENV','DB_NAME') db_name from dual"))[0];assert.equal(db.USERNAME,'CRIME_DATA');assert.equal(db.DB_NAME,'GE1C42BF10AE843_FU40');const active=await tableRows(c,'Z_BASE_ACTIVE_DATASET_PROFILE');assert.equal(active.length,1);assert.equal(active[0].DATASET_PROFILE_ID,1,'Active dataset must remain Adelaide V1');const profiles=await rows(c,'select dataset_profile_id,profile_code,profile_status from z_base_dataset_profiles order by dataset_profile_id');for(const t of TARGETS)assert.equal(profiles.find(p=>p.DATASET_PROFILE_ID===t.id)?.PROFILE_CODE,t.code);return{db,active,profiles};}
async function collections(c){const r={};for(const t of BASE)r[t]=(await tableRows(c,t,'WHERE DATASET_PROFILE_ID IN (1,4,5,6)')).map(normalize);for(const t of LIVE)r[t]=(await tableRows(c,t)).map(normalize);return r;}
module.exports={...old,ROOT,PROJECT,SOURCE,TARGETS,BASE,LIVE,read,save,pkg,normalize,same,protectedState,state,collections};
