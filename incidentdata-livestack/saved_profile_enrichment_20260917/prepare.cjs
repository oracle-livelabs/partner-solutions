'use strict';
const {fs,path,ROOT,PROJECT,assert,read,save,hash,stable}=require('./common.cjs');
const fnet=require('../scripts/load_fictional_network_pois.js').profiles;
const v2=require('../scripts/load_v2_fictional_pois.js');
const NOTICE='Synthetic demonstration profile. This is a generated fictional person, not a real person. Retained source scenario backstory is not a report of activity in this dataset city; inclusion creates no incident, case, social-post or person-to-person link.';
const nb=[['george','George Kaplan','Kaplan','person_of_interest','Gallery director under review in a fictional art-market payment comparison.'],['clara','Clara Thornhill','Thornhill','associate','Foundation director in a fictional payment and governance comparison.'],['eve','Eve Kendall','Kendall','person_of_interest','Art consultant in a fictional provenance and transaction comparison.'],['philip','Philip Vandamm','Vandamm','person_of_interest','Financier in a fictional art-market transaction comparison.']];
function catalogue(){
 const profiles=[];
 for(const[key,name,alias,status,summary]of nb){const source=`case_nbynw/poi_${key}.txt`;const body=fs.readFileSync(path.join(PROJECT,source),'utf8').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim();profiles.push({ref:`POI-NBNW-${key.toUpperCase()}`,name,alias,status,summary,narrative:`${NOTICE}\n\nOriginal fictional scenario backstory (original geographic references retained):\n${body}`,uri:`/poi/nbynw/${name.toLowerCase().replaceAll(' ','-')}.png`,scenario:'NBNW_FINANCIAL_REVIEW',source,assetRef:`NBNW-${key.toUpperCase()}-REFERENCE`});}
 for(const[key,name,slug,description]of fnet)profiles.push({ref:`POI-FNET-${key}`,name,alias:name.split(' ')[0],status:'associate',summary:`Fictional scenario: ${description}`,narrative:`${NOTICE}\n\nFictional scenario profile. ${description}\nUser-authored scenario hypothesis; associations and imagery alone do not establish criminal conduct, intent, or parcel contents.`,uri:`/poi/fnet/${slug}-portrait-sheet.jpeg`,scenario:'FICTIONAL_NETWORK_20260912',source:'scripts/load_fictional_network_pois.js',assetRef:`FNET-${key}-REFERENCE`});
 for(const p of v2.profiles)profiles.push({ref:p.ref,name:p.name,alias:p.alias,status:p.status,summary:`Fictional scenario: ${p.description}`,narrative:`${NOTICE}\n\n${v2.narrativeFor(p)}`,uri:`/poi/v2/${p.file}`,scenario:'FICTIONAL_NETWORK_V2_20260914',source:'scripts/load_v2_fictional_pois.js',assetRef:`V2-${p.key}-REFERENCE`});
 assert.equal(profiles.length,13);assert.equal(new Set(profiles.map(p=>p.ref)).size,13);
 for(const p of profiles){p.imagePath=path.join(PROJECT,'frontend/public',p.uri);const bytes=fs.readFileSync(p.imagePath);assert(bytes.length>8&&bytes.length<8*1024*1024);p.mime=p.uri.endsWith('.png')?'image/png':'image/jpeg';assert(p.mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')):bytes[0]===255&&bytes[1]===216);p.imageSha=hash(bytes);p.embeddingText=p.narrative.slice((NOTICE+'\n\n').length).replace(/^Original fictional scenario backstory \(original geographic references retained\):\n/,'');p.textSha=hash(p.embeddingText);p.narrativeSha=hash(p.narrative);p.sourceSha=hash(fs.readFileSync(path.join(PROJECT,p.source)));}
 assert.equal(new Set(profiles.map(p=>p.imageSha)).size,13);return profiles;
}
function validateVector(v,n){assert.equal(v.length,n);assert(v.every(Number.isFinite));assert(Math.abs(Math.hypot(...v)-1)<0.001);}
async function main(){
 assert(!fs.existsSync(path.join(ROOT,'package.json')),'Prepared package already exists; never overwrite');
 const {pipeline,env}=await import('@huggingface/transformers');env.cacheDir='/home/opc/.local/share/containers/storage/volumes/policeadelaide_police-transformers-cache/_data';env.allowLocalModels=true;env.allowRemoteModels=false;
 // Direct local inference deliberately avoids the application's DB telemetry writer.
 const textModel='Xenova/all-MiniLM-L6-v2',imageModel='Xenova/clip-vit-base-patch32';
 const text=await pipeline('feature-extraction',textModel,{dtype:'q8'}),image=await pipeline('image-feature-extraction',imageModel,{dtype:'q8'});
 const profiles=catalogue();for(const p of profiles){p.textVector=Array.from((await text(p.embeddingText,{pooling:'mean',normalize:true})).data);const raw=Array.from((await image(p.imagePath)).data);const norm=Math.hypot(...raw);p.imageVector=raw.map(v=>v/norm);validateVector(p.textVector,384);validateVector(p.imageVector,512);delete p.imagePath;console.log(`Prepared ${p.name}: 384 text / 512 image dimensions`);}
 const source=read('source_patterns.json');const patterns=source.map(({DATASET_PROFILE_ID,...p})=>({...p,CASE_REF:null,PATTERN_STATUS:'monitoring'}));
 const probes=[];for(const[query,expected]of [['financial records cash flow informal payments resource allocation','POI-FNET-ELIAS'],['Amsterdam technology consultancy executive counterfeit goods','POI-V2-JULIAN'],['former mathematician logistics broker film vehicle maintenance','POI-V2-TONY']])probes.push({query,expected,vector:Array.from((await text(query,{pooling:'mean',normalize:true})).data)});
 const data={version:1,created_at:new Date().toISOString(),notice:NOTICE,textModel,imageModel,source_pattern_sha256:hash(stable(source)),profiles,patterns,probes};save('package.json',data);save('package.sha256.json',{sha256:hash(stable(data))});await text.dispose();await image.dispose();console.log('Prepared immutable offline enrichment package.');
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={catalogue,validateVector};
