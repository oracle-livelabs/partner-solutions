'use strict';
// Exports application definitions locally; does not modify the source apps.
const fs=require('node:fs/promises'),path=require('node:path'),{pipeline}=require('node:stream/promises'),{createWriteStream}=require('node:fs');
const {connect,rows,oracle:o}=require('../../../scripts/evidence-intelligence/connection.cjs');
(async()=>{
 const output=path.resolve(process.argv[2]||path.join(__dirname,'../artifacts/apex'));
 await fs.mkdir(output,{recursive:true,mode:0o700});const c=await connect(),exports=[];
 try{
  await c.execute('SET TRANSACTION READ ONLY');
  const applications=await rows(c,`SELECT application_id,application_name,alias,authentication_scheme_type,authentication_scheme FROM apex_applications WHERE owner='CRIME_DATA' ORDER BY application_id`);
  for(const app of applications){
   const result=await c.execute(`DECLARE files apex_t_export_files; BEGIN
    files:=apex_export.get_application(p_application_id=>:id,p_with_date=>false,p_split=>false);
    IF files.COUNT<>1 THEN raise_application_error(-20001,'Expected single-file APEX export'); END IF;
    :content:=files(1).contents;
   END;`,{id:app.APPLICATION_ID,content:{dir:o.BIND_OUT,type:o.CLOB}});
   const filename='f'+app.APPLICATION_ID+'.sql',target=path.join(output,filename);
   const content=result.outBinds.content;
   if(typeof content==='string')await fs.writeFile(target,content,{mode:0o600});
   else await pipeline(content,createWriteStream(target,{mode:0o600,flags:'wx'}));
   const data=await fs.readFile(target);exports.push({...app,file:filename,bytes:data.length,sha256:require('node:crypto').createHash('sha256').update(data).digest('hex')});
  }
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({source:'FU40 / CRIME_DATA',applications:exports},null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({sourceUnchanged:true,applications:exports.map(x=>({id:x.APPLICATION_ID,name:x.APPLICATION_NAME,bytes:x.bytes,currentAuth:x.AUTHENTICATION_SCHEME_TYPE})),output}));
 }finally{await c.rollback();await c.close();}
})().catch(e=>{console.error('APEX export failed:',e.errorNum||e.code||e.message);process.exitCode=1;});
