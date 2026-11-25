'use strict';
const old=require('../saved_profile_enrichment_20260917/common.cjs');
const{fs,path,assert,rows,tableRows,stable}=old;
const ROOT=__dirname,PROJECT=path.dirname(ROOT);
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n),'utf8'));
const save=(n,v)=>fs.writeFileSync(path.join(ROOT,n),JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
const TABLES=['Z_BASE_WATCHED_CRIME_PATTERNS','WATCHED_CRIME_PATTERNS'];
const SHARED=['PATTERN_CODE','PATTERN_NAME','PATTERN_SUMMARY','WHY_WATCH','SEARCH_QUERY'];
const EXPECTED={1:'ADELAIDE_DATA',4:'BRISBANE_DATA',5:'PERTH_DATA',6:'ADELAIDE_DATA_V2',10:'BRUSSELS_DATA_V1',30:'AMSTERDAM_DATA_V1',50:'DUBLIN_CITY_DATA_V1'};
function same(a,b){assert.deepEqual(a.map(stable).sort(),b.map(stable).sort());}
function protectedState(a){const p=JSON.parse(JSON.stringify(a));for(const id of [1,4,5])delete p.tables.Z_BASE_WATCHED_CRIME_PATTERNS[String(id)];delete p.tables.WATCHED_CRIME_PATTERNS;return p;}
async function collections(c){return{Z_BASE_WATCHED_CRIME_PATTERNS:await tableRows(c,TABLES[0]),WATCHED_CRIME_PATTERNS:await tableRows(c,TABLES[1])};}
async function state(c){const db=(await rows(c,"select user username,sys_context('USERENV','DB_NAME') db_name from dual"))[0];assert.equal(db.USERNAME,'CRIME_DATA');assert.equal(db.DB_NAME,'GE1C42BF10AE843_FU40');const active=await tableRows(c,'Z_BASE_ACTIVE_DATASET_PROFILE');assert.equal(active.length,1);assert.equal(active[0].DATASET_PROFILE_ID,1);const profiles=await rows(c,'select dataset_profile_id,profile_code,profile_status from z_base_dataset_profiles order by dataset_profile_id');assert.equal(profiles.length,7);for(const p of profiles)assert.equal(p.PROFILE_CODE,EXPECTED[p.DATASET_PROFILE_ID]);return{db,active,profiles};}
function build(before,source){
 assert.equal(source.length,21);assert.equal(new Set(source.map(p=>p.PATTERN_CODE)).size,21);assert.equal(source.filter(p=>p.ACTIVE===1&&p.ACTIVATE_UI==='Y').length,6);
 const plan=structuredClone(before);for(const id of [1,4,5,6,10,30,50,null]){
  const table=id===null?TABLES[1]:TABLES[0];
  for(const s of source){const found=plan[table].filter(p=>p.PATTERN_CODE===s.PATTERN_CODE&&(id===null||p.DATASET_PROFILE_ID===id));assert(found.length<=1);
   if(found.length){const p=found[0];for(const k of SHARED)assert.equal(p[k],s[k],`Conflicting definition ${id}/${s.PATTERN_CODE}/${k}`);assert.equal(p.ACTIVE,1);p.ACTIVATE_UI=s.ACTIVATE_UI;}
   else{assert([4,5].includes(id),'Only Perth/Brisbane should need catalogue rows');const{DATASET_PROFILE_ID,...p}=s;plan[table].push({DATASET_PROFILE_ID:id,...p,CASE_REF:null,PATTERN_STATUS:'monitoring'});}
  }
 }
 return plan;
}
module.exports={...old,ROOT,PROJECT,TABLES,SHARED,EXPECTED,read,save,same,protectedState,collections,state,build};
