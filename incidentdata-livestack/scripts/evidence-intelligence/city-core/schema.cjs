'use strict';
const assert=require('node:assert/strict'),{connect,rows}=require('../connection.cjs'),{sha,PACK}=require('./contract.cjs');
async function allowlist(c,apply=false){
 const before=(await rows(c,"SELECT text FROM user_views WHERE view_name='SECURE_EI_ITEMS_V'"))[0].TEXT;
 for(const guard of ['secure_crime_incidents_v','a.control_id=1',"'$.profile_code')=p.profile_code"])assert(before.includes(guard),'Scoped view guard changed: '+guard);
 if(before.includes("'"+PACK+"'"))return {changed:false,beforeSha256:sha(before),afterSha256:sha(before)};
 const anchor="'EI_LAS_VEGAS_WATCH_V1'";assert.equal(before.split(anchor).length,2);
 const after=before.replace(anchor,anchor+",'"+PACK+"'");
 if(apply){await c.execute('CREATE OR REPLACE VIEW secure_ei_items_v AS '+after);assert.equal((await rows(c,"SELECT COUNT(*) n FROM user_errors WHERE name='SECURE_EI_ITEMS_V'"))[0].N,0);}
 return {changed:apply,planned:true,beforeSha256:sha(before),afterSha256:sha(after),before,after};
}
module.exports={allowlist};
if(require.main===module)(async()=>{const c=await connect();try{console.log(JSON.stringify(await allowlist(c,process.argv.includes('--apply')),null,2));}finally{await c.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
