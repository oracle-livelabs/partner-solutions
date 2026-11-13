'use strict';
// Insert missing embeddings only. Never seed/overwrite POI profiles or batch data.
const fs=require('node:fs/promises'),path=require('node:path'),o=require('oracledb');
const embed=require('../backend/embeddings'),{hash}=require('../backend/data-room-archive');
const targets={CLARA:'clara-thornhill.png',GEORGE:'george-kaplan.png',EVE:'eve-kendall.png',PHILIP:'philip-vandamm.png'};
const columns='person_id,person_ref,display_name,alias_name,narrative_summary,narrative_text,portrait_asset_uri,JSON_SERIALIZE(profile_attributes RETURNING VARCHAR2) attrs';
const options={outFormat:o.OUT_FORMAT_OBJECT,fetchInfo:{NARRATIVE_TEXT:{type:o.STRING}}};
async function main(){
 if(!process.argv.includes('--apply-missing-vectors'))throw Error('Explicit --apply-missing-vectors required.');
 if(process.env.ORACLE_USER!=='CRIME_DATA')throw Error('Expected CRIME_DATA schema.');
 const c=await o.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});
 try{
  const pending=[],report=[];
  for(const [key,file] of Object.entries(targets)){
   const ref='POI-NBNW-'+key,p=(await c.execute(`SELECT ${columns} FROM persons_of_interest WHERE person_ref=:ref`,{ref},options)).rows[0];
   if(!p||JSON.parse(p.ATTRS).generated_fictional!==true||!p.NARRATIVE_TEXT?.trim()||p.PORTRAIT_ASSET_URI!=='/poi/nbynw/'+file)throw Error('Stored fictional source not ready: '+ref);
   const assetPath=path.join(__dirname,'../frontend/dist',p.PORTRAIT_ASSET_URI),bytes=await fs.readFile(assetPath);
   const n=(await c.execute('SELECT person_id FROM person_narrative_embeddings WHERE person_id=:id',{id:p.PERSON_ID})).rows.length;
   const v=(await c.execute("SELECT person_id FROM person_visual_embeddings WHERE person_id=:id AND asset_kind='reference_portrait'",{id:p.PERSON_ID})).rows.length;
   const narrative=n?null:await embed.embedNarrative(p.NARRATIVE_TEXT);
   const visual=v?null:await embed.embedImage(new Blob([bytes],{type:'image/png'}));
   pending.push({p,key,assetPath,imageHash:hash(bytes),narrative,visual});
   report.push({ref,narrative:n?'already present':'insert missing',visual:v?'already present':'insert missing',sourceNarrativeSha256:hash(Buffer.from(p.NARRATIVE_TEXT)),portraitSha256:hash(bytes)});
  }
  for(const entry of pending){
   const {p,key,assetPath,imageHash,narrative,visual}=entry;
   const current=(await c.execute(`SELECT ${columns} FROM persons_of_interest WHERE person_id=:id FOR UPDATE`,{id:p.PERSON_ID},options)).rows[0];
   if(JSON.stringify(current)!==JSON.stringify(p)||hash(await fs.readFile(assetPath))!==imageHash)throw Error('Source changed during embedding: '+p.PERSON_REF);
   if(narrative)await c.execute(`INSERT INTO person_narrative_embeddings(person_id,embedding_model,source_sha256,embedding)
    SELECT :id,:model,:sha,TO_VECTOR(:vector) FROM dual WHERE NOT EXISTS(SELECT 1 FROM person_narrative_embeddings WHERE person_id=:id)`,{id:p.PERSON_ID,model:embed.NARRATIVE_MODEL,sha:hash(Buffer.from(p.NARRATIVE_TEXT)),vector:embed.vectorLiteral(narrative)});
   if(visual)await c.execute(`INSERT INTO person_visual_embeddings(person_id,asset_ref,asset_kind,asset_uri,mime_type,asset_sha256,asset_caption,embedding_model,embedding)
    SELECT :id,:assetRef,'reference_portrait',:uri,'image/png',:sha,:caption,:model,TO_VECTOR(:vector) FROM dual
    WHERE NOT EXISTS(SELECT 1 FROM person_visual_embeddings WHERE person_id=:id AND asset_kind='reference_portrait')`,{id:p.PERSON_ID,assetRef:`NBNW-${key}-REFERENCE`,uri:p.PORTRAIT_ASSET_URI,sha:imageHash,caption:'Registered generated fictional portrait of '+p.DISPLAY_NAME,model:embed.IMAGE_MODEL,vector:embed.vectorLiteral(visual)});
  }
  await c.commit();console.log(JSON.stringify({profilesUnchanged:true,batchesUnchanged:true,report},null,2));
 }catch(e){await c.rollback();throw e;}finally{await c.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
