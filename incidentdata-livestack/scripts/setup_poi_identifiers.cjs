'use strict';
const fs=require('node:fs'),path=require('node:path');
const {prepare}=require('../backend/poi-identifiers');
async function setup(c){
 const sql=fs.readFileSync(path.join(__dirname,'../db/migrations/20261020_add_poi_identifiers.sql'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 // DDL commits independently. This migration contains no PL/SQL or data writes.
 for(const statement of sql.split(/;\s*(?:\n|$)/).map(x=>x.trim()).filter(Boolean)){
  try{await c.execute(statement);}catch(e){if(e.errorNum!==955||!/^CREATE (TABLE|INDEX) /i.test(statement))throw e;}
 }
 const errors=(await c.execute("SELECT name,line,text FROM user_errors WHERE name='SECURE_POI_IDENTIFIERS_V'")).rows;
 if(errors.length)throw Error('Identifier view did not compile');
}
async function insert(c,record){
 const row=prepare(record,record.profileId);
 const found=(await c.execute(`SELECT 1 FROM z_base_persons WHERE dataset_profile_id=:pid AND person_ref=:ref`,{pid:row.profileId,ref:row.personRef})).rows;
 if(!found.length)throw Error(`POI missing from saved profile: ${row.personRef}`);
 const result=await c.execute(`INSERT INTO poi_identifiers(identifier_id,dataset_profile_id,person_ref,identifier_type,namespace,
 identifier_value,normalized_value,review_status,source_ref,source_note,recorded_by,reviewed_by,reviewed_at,valid_from,valid_to)
 SELECT :id,:profileId,:personRef,:type,:namespace,:value,:normalized,:status,:sourceRef,:sourceNote,:recordedBy,:reviewedBy,:reviewedAt,:validFrom,:validTo FROM dual
 WHERE NOT EXISTS(SELECT 1 FROM poi_identifiers WHERE identifier_id=:id)`,row);
 await verifyAssertion(c,row);
 return result.rowsAffected;
}
async function verifyAssertion(c,row){
 // An idempotent re-run must never silently accept changed review or attribution.
 const o=require('oracledb');
 const stored=(await c.execute('SELECT * FROM poi_identifiers WHERE identifier_id=:id',{id:row.id},{outFormat:o.OUT_FORMAT_OBJECT})).rows[0];
 return assertStored(row,stored);
}
function assertStored(row,stored){
 if(!stored)throw Error('Missing identifier assertion');
 for(const [column,key] of Object.entries({IDENTIFIER_ID:'id',DATASET_PROFILE_ID:'profileId',PERSON_REF:'personRef',IDENTIFIER_TYPE:'type',NAMESPACE:'namespace',NORMALIZED_VALUE:'normalized',SOURCE_REF:'sourceRef',IDENTIFIER_VALUE:'value',REVIEW_STATUS:'status',SOURCE_NOTE:'sourceNote',RECORDED_BY:'recordedBy',REVIEWED_BY:'reviewedBy',REVIEWED_AT:'reviewedAt',VALID_FROM:'validFrom',VALID_TO:'validTo'})){
  const expected=row[key],actual=stored[column];
  if((expected instanceof Date?expected.getTime():expected)!==(actual instanceof Date?actual.getTime():actual))throw Error(`Existing assertion differs: ${column}; review explicitly before changing it`);
 }
}
async function main(){
 const args=process.argv.slice(2),allowed=['--apply','--dry-run','--check'];
 if(args.length>2||args.filter(x=>allowed.includes(x)).length!==1)throw Error('Usage: node scripts/setup_poi_identifiers.cjs --check|--dry-run|--apply [seed.json]');
 const mode=args.find(x=>allowed.includes(x));
 const input=args.find(x=>!x.startsWith('--'))||path.join(__dirname,'../testdata/poi-identifiers/fictional-scenario.json');
 const {connect,rows}=require('./evidence-intelligence/connection.cjs');const c=await connect();
 try{
  if(mode==='--apply')await setup(c);
  else if(!(await rows(c,"SELECT table_name FROM user_tables WHERE table_name='POI_IDENTIFIERS'")).length)throw Error('Schema is not installed. --apply installs the additive schema and seed; --dry-run never runs DDL.');
  await c.execute('ALTER SESSION DISABLE PARALLEL DML');
  // Guard the saved person keys and profile marker while verifying/inserting.
  if(mode!=='--check')await c.execute('LOCK TABLE z_base_persons IN SHARE MODE NOWAIT');
  const before=await rows(c,'SELECT dataset_profile_id FROM z_base_active_dataset_profile WHERE control_id=1 FOR UPDATE');
  const {FOUNDATION_PROFILES}=await import('../frontend/src/foundation-profiles.mjs');
  const catalogue=await rows(c,'SELECT dataset_profile_id,profile_code FROM z_base_dataset_profiles');
  const seed=JSON.parse(fs.readFileSync(input,'utf8'));
  if(seed.version!==1||!Array.isArray(seed.identifiers))throw Error('Invalid identifier seed');
  let added=0,expected=0;
  for(const profile of FOUNDATION_PROFILES){
   const saved=catalogue.find(p=>p.PROFILE_CODE===profile.code);if(!saved)throw Error(`Missing profile ${profile.code}`);
   for(const identifier of seed.identifiers){
    const row=prepare(identifier,saved.DATASET_PROFILE_ID);expected++;
    if(mode==='--check'){
     await verifyAssertion(c,row);
    }else added+=await insert(c,{...identifier,profileId:saved.DATASET_PROFILE_ID});
   }
  }
  const after=await rows(c,'SELECT dataset_profile_id FROM z_base_active_dataset_profile WHERE control_id=1');
  if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Active profile changed');
  const distribution=await rows(c,`SELECT p.profile_code,x.review_status,COUNT(*) identifier_count FROM poi_identifiers x JOIN z_base_dataset_profiles p ON p.dataset_profile_id=x.dataset_profile_id GROUP BY p.profile_code,x.review_status ORDER BY p.profile_code,x.review_status`);
  if(mode==='--apply')await c.commit();else await c.rollback();
  console.log(JSON.stringify({mode,profiles:FOUNDATION_PROFILES.length,expectedAssertions:expected,added,committed:mode==='--apply',activeProfileUnchanged:true,distribution},null,2));
 }catch(e){await c.rollback();throw e;}finally{await c.close();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup,insert,assertStored};
