'use strict';
// Versioned evaluation artifacts only: no writes to existing batch/description tables.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const oracledb=require('oracledb');
const ai=require('../backend/data-room-ai'),learning=require('../backend/data-room-learning-ai');
const batch='DR-20260913-e8c04a3b-ea5f-4fb2';
const out=path.resolve(__dirname,'../results/model-comparison-20260913');
const region='us-chicago-1';
async function save(name,value){await fs.writeFile(path.join(out,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});}
async function recorded(name,fn){try{return JSON.parse(await fs.readFile(path.join(out,name),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const started=Date.now();let result;
 try{result={status:'complete',result:await fn()};}catch(e){result={status:'failed',error:e.message,generation:e.generation || null};}
 result.elapsedMs=Date.now()-started;result.createdAt=new Date().toISOString();await save(name,result);console.log(name,result.status,result.error || `${result.elapsedMs}ms`);return result;}
async function main(){
 if(!process.argv.includes('--run-comparison'))throw Error('Explicit --run-comparison is required.');
 if(process.env.ORACLE_USER!=='CRIME_DATA')throw Error('Expected FU40 CRIME_DATA environment.');
 await fs.mkdir(out,{recursive:true,mode:0o700});
 const c=await oracledb.getConnection({user:process.env.ORACLE_USER,password:process.env.APP_SCHEMA_PASSWORD,connectString:process.env.ORACLE_CONNECTION_STRING,walletLocation:process.env.ORACLE_WALLET_LOCATION,walletPassword:process.env.ORACLE_WALLET_PASSWORD,configDir:process.env.ORACLE_WALLET_LOCATION});c.clientId='statewide_admin';
 let items,baseline;
 try{
  items=(await c.execute('SELECT item_id,original_path,content_type,sha256,content_blob FROM secure_cdr_items_v WHERE batch_id=:id ORDER BY original_path',{id:batch},{outFormat:oracledb.OUT_FORMAT_OBJECT,fetchInfo:{CONTENT_BLOB:{type:oracledb.BUFFER}}})).rows;
  if(items.length!==11)throw Error('Expected the selected 11-file batch.');
  baseline=(await c.execute('SELECT r.* FROM secure_cdr_ai_results_v r JOIN secure_cdr_items_v i ON i.item_id=r.item_id WHERE i.batch_id=:id ORDER BY r.created_at',{id:batch},{outFormat:oracledb.OUT_FORMAT_OBJECT,fetchInfo:{RESULT_JSON:{type:oracledb.STRING}}})).rows;
 }finally{await c.close();}
 for(const i of items)if(crypto.createHash('sha256').update(i.CONTENT_BLOB).digest('hex')!==i.SHA256)throw Error('Source checksum mismatch.');
 try{await save('manifest.json',{batch,region,items:items.map(({CONTENT_BLOB,...i})=>i),baseline});}catch(e){if(e.code!=='EEXIST')throw e;}
 const source=i=>({content:i.CONTENT_BLOB,type:i.CONTENT_TYPE,sha256:i.SHA256});
 const configs={llama:{textModel:'meta.llama-3.3-70b-instruct',imageModel:'meta.llama-4-maverick-17b-128e-instruct-fp8',region},gemini:{textModel:'google.gemini-2.5-flash',imageModel:'google.gemini-2.5-flash',region},grok:{textModel:'xai.grok-4.6',imageModel:'xai.grok-4.6',region}};
 if(process.argv.includes('--retest-meta-cap')){
  for(const i of items){
   const previous=JSON.parse(await fs.readFile(path.join(out,`description-llama-${i.ITEM_ID}.json`),'utf8'));
   if(previous.status==='failed')await recorded(`retest-llama-${i.ITEM_ID}.json`,()=>ai.describe(source(i),configs.llama));
  }
  const input=JSON.parse(await fs.readFile(path.join(out,'brief-input.json'),'utf8'));
  const brief=JSON.parse(await fs.readFile(path.join(out,'brief-llama.json'),'utf8'));
  if(brief.status==='failed')await recorded('retest-brief-llama.json',()=>learning.generate(input,{model:configs.llama.textModel,region}));
  return;
 }
 if(process.argv.includes('--probe')){
  const text=items.find(i=>!['png','jpg'].includes(i.CONTENT_TYPE)),image=items.find(i=>i.ORIGINAL_PATH.includes('scn-009'));
  if(!text || !image)throw Error('Probe sources missing.');
  for(const model of ['gemini','grok'])for(const i of [text,image])await recorded(`probe-${model}-${i.ITEM_ID}.json`,()=>ai.describe(source(i),configs[model]));
  return;
 }
 const all={};
 for(const [name,config] of Object.entries(configs)){
  all[name]=[];
  for(const i of items){
   const r=await recorded(`description-${name}-${i.ITEM_ID}.json`,()=>ai.describe(source(i),config));all[name].push({itemId:i.ITEM_ID,path:i.ORIGINAL_PATH,...r});
  }
 }
 // Identical description inputs for every brief contender, with explicit provenance.
 const records=items.map(i=>{
  const r=all.gemini.find(r=>r.itemId===i.ITEM_ID && r.status==='complete') || all.llama.find(r=>r.itemId===i.ITEM_ID && r.status==='complete');
  if(!r)throw Error('No valid description available for brief comparison: '+i.ORIGINAL_PATH);
  return {itemId:i.ITEM_ID,path:i.ORIGINAL_PATH,type:i.CONTENT_TYPE,sha256:i.SHA256,descriptionRunId:`evaluation-${r.result.model}-${i.ITEM_ID}`,model:r.result.model,promptVersion:r.result.promptVersion,createdAt:r.createdAt,resultJson:JSON.stringify(r.result)};
 });
 const input=learning.snapshot(records);
 try{await save('brief-input.json',input);}catch(e){if(e.code!=='EEXIST')throw e;}
 for(const [name,config] of Object.entries(configs))await recorded(`brief-${name}.json`,()=>learning.generate(input,{model:config.textModel,region}));
 const summary=Object.fromEntries(Object.entries(all).map(([name,r])=>[name,{requested:r.length,complete:r.filter(i=>i.status==='complete').length,failed:r.filter(i=>i.status==='failed').length,elapsedMs:r.reduce((n,i)=>n+i.elapsedMs,0)}]));
 try{await save('summary.json',summary);}catch(e){if(e.code!=='EEXIST')throw e;}
 console.log(JSON.stringify(summary));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
