'use strict';
// Explicit fictional scenario annotations and saved, scoped photo comparisons.
const fs=require('node:fs/promises'),path=require('node:path'),o=require('oracledb');
const {sha,batchId}=require('./detective-room-store');
const {catalogueFingerprint,staleReason}=require('./photo-comparison-state');
function declarations(document,id,profiles){
 if(!document)return [];
 if(document.version!==1||document.batchId!==id||typeof document.declaredBy!=='string'||!Array.isArray(document.links)||document.links.length>40)throw Error('Invalid fictional scenario link document');
 const handles=new Set();
 return document.links.flatMap(link=>{
  if(typeof link.handle!=='string'||!/^[A-Za-z0-9_.-]{1,120}$/.test(link.handle)||handles.has(link.handle))throw Error('Invalid or conflicting declared handle');handles.add(link.handle);
  if(typeof link.reason!=='string'||link.reason.trim().length<5)throw Error('Declared scenario link requires its source reason');
  const profile=profiles.find(p=>p.PERSON_REF===link.personRef);if(!profile)return [];
  return [{handle:link.handle,personRef:profile.PERSON_REF,displayName:profile.DISPLAY_NAME,registeredAlias:profile.ALIAS_NAME,portraitAssetUri:profile.PORTRAIT_ASSET_URI,portraitSha256:profile.PORTRAIT_SHA256,declaredBy:document.declaredBy,declaredAt:document.declaredAt,reason:link.reason,basis:'user_declared_fictional_scenario'}];
 });
}
async function associationContext(c,batch){
 batchId(batch.BATCH_ID);
 const root=process.env.CDR_ROOM_ROOT;let document;
 if(root){if(!path.isAbsolute(root))throw Error('CDR_ROOM_ROOT must be absolute');try{document=JSON.parse(await fs.readFile(path.join(root,'associations',batch.BATCH_ID+'.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}
 const read=async(sql,binds={},options={})=>(await c.execute(sql,binds,{outFormat:o.OUT_FORMAT_OBJECT,...options})).rows;
 const searches=await read('SELECT search_id,item_id,version,source_sha256,catalogue_fingerprint,result_json FROM secure_cdr_photo_searches_v WHERE batch_id=:id ORDER BY search_id',{id:batch.BATCH_ID},{fetchInfo:{RESULT_JSON:{type:o.STRING}}});
 if(!document&&!searches.length)return {links:[],photoComparisons:[],fingerprint:null};
 const profiles=await read(`SELECT p.person_ref,p.display_name,p.alias_name,p.portrait_asset_uri,(SELECT MIN(v.asset_sha256) FROM person_visual_embeddings v WHERE v.person_id=p.person_id AND v.asset_kind='reference_portrait') portrait_sha256 FROM secure_persons_of_interest_v p ORDER BY p.person_ref`);
 const links=declarations(document,batch.BATCH_ID,profiles);
 const comparisons=[];
 if(searches.length){
  const fp=await catalogueFingerprint(c),items=await read('SELECT item_id,original_path,sha256 FROM secure_cdr_items_v WHERE batch_id=:id',{id:batch.BATCH_ID});
  const candidates=await read('SELECT * FROM secure_cdr_photo_candidates_v WHERE batch_id=:id ORDER BY search_id,candidate_rank',{id:batch.BATCH_ID});
  for(const search of searches){const item=items.find(i=>i.ITEM_ID===search.ITEM_ID);if(!item||staleReason(search,item.SHA256,fp))continue;
   const result=JSON.parse(search.RESULT_JSON);
   comparisons.push({searchId:search.SEARCH_ID,itemId:item.ITEM_ID,path:item.ORIGINAL_PATH,sourceSha256:item.SHA256,region:result.query.region,
    candidates:candidates.filter(p=>p.SEARCH_ID===search.SEARCH_ID&&p.DECISION!=='rejected').map(p=>({personRef:p.PERSON_REF,displayName:p.DISPLAY_NAME,rank:p.CANDIDATE_RANK,score:p.SCORE,decision:p.DECISION,revision:p.REVISION,reviewer:p.REVIEWER,reason:p.REASON,candidateId:p.CANDIDATE_ID,referenceSha256:p.REFERENCE_SHA256}))});
  }
 }
 const value={links,photoComparisons:comparisons};return {...value,fingerprint:links.length||comparisons.length?sha(JSON.stringify(value)):null};
}
function applyPersonLinks(normal,associations){
 for(const link of associations?.links||[]){
  const handle=normal.people.find(p=>p.name===link.handle);if(!handle)continue;
  const named=normal.people.find(p=>p.name===link.displayName);
  const target=named||handle;
  target.sourceNames=[...new Set([...(target.sourceNames||[]),target.name,handle.name])];
  target.name=link.displayName;target.catalogueName=link.displayName;target.personRef=link.personRef;target.portraitExpectedSha256=link.portraitSha256;target.handles=[...new Set([...(target.handles||[]),link.handle])];target.scenarioLinks=[...(target.scenarioLinks||[]),link];
  target.sourceRefs=[...new Set([...target.sourceRefs,...handle.sourceRefs,`Declared fictional scenario link: ${link.handle} → ${link.displayName}; ${link.reason}`])];
  target.detail+=' User-declared fictional scenario handle: '+link.handle+'. '+link.reason+' This declaration is separate from photo similarity or an identity finding.';
  if(named&&named!==handle)normal.people=normal.people.filter(p=>p!==handle);
 }
 for(const p of normal.people)if(p.handles?.length)p.name=p.catalogueName+' ('+p.handles.join(', ')+')';
 // Bound character cards with portraits should lead the selected board overview.
 normal.people.sort((a,b)=>Number(!!b.scenarioLinks?.length)-Number(!!a.scenarioLinks?.length));
}
function mergeCataloguePeople(people){
 const merged=[],known=new Map();
 for(const person of people){
  const previous=person.personRef&&known.get(person.personRef);
  if(!previous){merged.push(person);if(person.personRef)known.set(person.personRef,person);continue;}
  previous.sourceNames=[...new Set([...(previous.sourceNames||[]),...(person.sourceNames||[]),person.name])];
  previous.sourceRefs=[...new Set([...previous.sourceRefs,...person.sourceRefs])];
  previous.detail+=' Additional exact catalogue source label: '+person.name+'.';
 }
 people.splice(0,people.length,...merged);return people;
}
module.exports={declarations,associationContext,applyPersonLinks,mergeCataloguePeople};
