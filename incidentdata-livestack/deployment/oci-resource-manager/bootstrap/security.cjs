'use strict';
// Recreate portable Deep Sec SQL instead of generated XS/RAS implementation IDs.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const o=require('oracledb'),{assertTarget,credentials,canonical}=require('./database.cjs'),{sqlcl}=require('./apex.cjs');
const scriptNames=[
 'demos/DDS_Basic_CrimeData_ADB/create/02_create_products_roles_grants.sql',
 'demos/DDS_Advanced_CrimeData_ADB/create/03_create_roles_and_grants.sql',
 'demos/DDS_CTG_CrimeData_ADB/create/02_create_products_roles_and_grants.sql'];
function normalized(rows){return rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,key==='PREDICATE'&&value?value.trim().replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+/g,token=>/^[\s]/.test(token)?' ':token):value]))).map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));}
async function restoreSecurity(config,root){
 const baseline=JSON.parse(await fs.readFile(path.join(root,'database/security-baseline.json'),'utf8'));
 assert.deepEqual(baseline.scripts.map(s=>s.path),scriptNames,'Unexpected native security input');
 const source=config.application_dir||path.resolve(root,'../app');
 if(!/^\/[A-Za-z0-9_./-]+$/.test(source))throw Error('Unsafe application source path');
 for(const script of baseline.scripts){const bytes=await fs.readFile(path.join(source,script.path));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),script.sha256,'Native security script checksum mismatch');}
 const c=await o.getConnection(credentials(config,'CRIME_DATA'));o.outFormat=o.OUT_FORMAT_OBJECT;
 try{
  assertTarget(config,(await c.execute("SELECT SYS_CONTEXT('USERENV','DB_NAME') n FROM dual")).rows[0].N);
  const schema=(await c.execute("SELECT artifact_sha256 FROM id_deployment_state WHERE component='schema'")).rows[0];
  assert.equal(schema?.ARTIFACT_SHA256,config.schema_manifest_sha256,'Native security requires the completed owned schema');
  const current=(await c.execute('SELECT * FROM user_data_grants ORDER BY grant_name,privilege,column_name,grantee')).rows;
  const currentParents=(await c.execute('SELECT * FROM user_required_parent_data_privileges ORDER BY grant_name,column_name')).rows;
  const matches=JSON.stringify(normalized(current))===JSON.stringify(normalized(baseline.grants))&&JSON.stringify(normalized(currentParents))===JSON.stringify(normalized(baseline.parents));
  if(!matches){
   const known=new Set(baseline.grants.map(g=>g.GRANT_NAME));
   if(current.some(g=>!known.has(g.GRANT_NAME)))throw Error('Unowned native data grants require operator review');
   await sqlcl(config,scriptNames.map(name=>'@'+path.join(source,name)).join('\n'),path.join(root,'database/security-restore.log'));
  }
  const grants=(await c.execute('SELECT * FROM user_data_grants ORDER BY grant_name,privilege,column_name,grantee')).rows;
  const parents=(await c.execute('SELECT * FROM user_required_parent_data_privileges ORDER BY grant_name,column_name')).rows;
  assert.deepEqual(normalized(grants),normalized(baseline.grants),'Native data grants differ from source');
  assert.deepEqual(normalized(parents),normalized(baseline.parents),'Cross-table parent permissions differ from source');
  await c.execute("MERGE INTO id_deployment_state d USING(SELECT 'security' component,:sha artifact_sha256 FROM dual) s ON(d.component=s.component) WHEN MATCHED THEN UPDATE SET d.artifact_sha256=s.artifact_sha256,d.completed_at=SYSTIMESTAMP WHEN NOT MATCHED THEN INSERT(component,artifact_sha256) VALUES(s.component,s.artifact_sha256)",{sha:config.release_sha256});await c.commit();
  console.log(JSON.stringify({phase:'security',status:'complete',dataGrants:new Set(grants.map(g=>g.GRANT_NAME)).size,parentRequirements:parents.length}));
 }finally{await c.close();}
}
module.exports={restoreSecurity,normalized};
