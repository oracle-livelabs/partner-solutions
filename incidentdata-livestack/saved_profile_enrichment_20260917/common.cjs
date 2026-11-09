'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const o=require('oracledb');
const {stable,hash,fingerprint}=require('../synthetic_amsterdam_may_jun_2026_v1/database_fingerprint.cjs');
o.outFormat=o.OUT_FORMAT_OBJECT;o.fetchAsString=[o.CLOB];
const ROOT=__dirname,PROJECT=path.dirname(ROOT);
const TARGETS=[{id:10,code:'BRUSSELS_DATA_V1',area:'BRU_SYNTHETIC'},{id:30,code:'AMSTERDAM_DATA_V1',area:'AMS_SYNTHETIC'},{id:50,code:'DUBLIN_CITY_DATA_V1',area:'DUBLIN_SYN_COVERAGE'}];
const MUTABLE=['Z_BASE_PERSONS','Z_BASE_PERSON_NARRATIVE_VEC','Z_BASE_PERSON_VISUAL_VEC','Z_BASE_WATCHED_CRIME_PATTERNS'];
const EXTRA=['Z_BASE_PROFILE_CONFIG','PERSON_PROFILE_EMBEDDINGS','PERSON_NARRATIVE_EMBEDDINGS','PERSON_VISUAL_EMBEDDINGS','WATCHED_CRIME_PATTERNS','WATCHED_PATTERN_EMBEDDINGS','WATCHED_PATTERN_INCIDENTS','WATCHED_PATTERN_POSTS','SOCIAL_MEDIA_SOURCES','SOCIAL_MEDIA_POSTS','SOCIAL_POST_INCIDENT_LINKS'];
function read(name){return JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));}
function save(name,value){fs.writeFileSync(path.join(ROOT,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
async function connect(){
 const [app]=JSON.parse(execFileSync('podman',['inspect','policeadelaide_app-fu40_1'],{encoding:'utf8'}));
 const e=Object.fromEntries(app.Config.Env.map(s=>{const n=s.indexOf('=');return[s.slice(0,n),s.slice(n+1)];}));
 assert.equal(e.ORACLE_USER,'CRIME_DATA');assert(e.APP_SCHEMA_PASSWORD&&e.ORACLE_WALLET_PASSWORD);
 return o.getConnection({user:e.ORACLE_USER,password:e.APP_SCHEMA_PASSWORD,connectString:'fu40_medium',walletLocation:'/home/opc/wallet',walletPassword:e.ORACLE_WALLET_PASSWORD,configDir:'/home/opc/wallet'});
}
async function rows(c,sql,binds={}){return(await c.execute(sql,binds)).rows;}
async function tableRows(c,table,where='',binds={}){
 assert(/^[A-Z_]+$/.test(table));
 const cols=await rows(c,'select column_name,data_type from user_tab_columns where table_name=:t order by column_id',{t:table});assert(cols.length);
 const select=cols.map(x=>x.DATA_TYPE.startsWith('TIMESTAMP')?`to_char("${x.COLUMN_NAME}",'YYYY-MM-DD"T"HH24:MI:SS.FF6${x.DATA_TYPE.includes('TIME ZONE')?'TZH:TZM':''}') "${x.COLUMN_NAME}"`:`"${x.COLUMN_NAME}"`).join(',');
 return rows(c,`SELECT ${select} FROM ${table} ${where}`,binds);
}
async function audit(c){
 const ids=(await rows(c,'select dataset_profile_id from z_base_dataset_profiles order by dataset_profile_id')).map(p=>p.DATASET_PROFILE_ID);
 const tables=await fingerprint(c,{profileIds:ids});
 for(const t of EXTRA){const r=await tableRows(c,t);tables[t]={all:{count:r.length,sha256:hash(r.map(x=>hash(stable(x))).sort().join('\n'))}};}
 return{profileIds:ids,tables};
}
function protectedState(a){
 const result=JSON.parse(JSON.stringify(a));
 for(const t of MUTABLE){for(const id of TARGETS.map(p=>p.id))delete result.tables[t][String(id)];delete result.tables[t].empty;}
 return result;
}
async function identity(c){
 const db=(await rows(c,"select user username,sys_context('USERENV','DB_NAME') db_name from dual"))[0];assert.equal(db.USERNAME,'CRIME_DATA');assert.equal(db.DB_NAME,'GE1C42BF10AE843_FU40');
 const profiles=await rows(c,'select dataset_profile_id,profile_code,profile_status from z_base_dataset_profiles order by dataset_profile_id');
 const active=await tableRows(c,'Z_BASE_ACTIVE_DATASET_PROFILE');assert.equal(active.length,1);
 for(const t of TARGETS){const p=profiles.find(p=>p.DATASET_PROFILE_ID===t.id);assert.equal(p?.PROFILE_CODE,t.code);assert.notEqual(active[0].DATASET_PROFILE_ID,t.id,'Never enrich the active profile');}
 return{db,profiles,active};
}
module.exports={fs,path,assert,o,ROOT,PROJECT,TARGETS,MUTABLE,read,save,connect,rows,tableRows,audit,protectedState,identity,stable,hash};
