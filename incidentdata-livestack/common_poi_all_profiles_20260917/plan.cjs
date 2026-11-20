'use strict';
const {assert,path,pkg,TARGETS,BASE,LIVE}=require('./common.cjs');
function person(t,p,index,pre,previous=null,liveId=null){
 const live=t.id===null;
 const area=live?pre.liveAreas.find(a=>a.AREA_CODE==='CENTRAL'):pre.areas.find(a=>a.DATASET_PROFILE_ID===t.id&&a.AREA_CODE===t.area);assert(area);
 const links=previous?(pre.links.find(l=>l.DATASET_PROFILE_ID===t.id&&l.PERSON_ID===previous.PERSON_ID)?.N||0):0;
 const attributes={...(previous?.PROFILE_ATTRIBUTES||{}),scenario:p.scenario,generated_fictional:true,portrait_policy:'generated_fictional_only',identity_basis:'explicit_user_assignment',narrative_basis:'retained_user_authored_fictional_scenario',association_is_not_evidence:true,portrait_sha256:p.imageSha,source_file_sha256:p.sourceSha,stored_narrative_sha256:p.narrativeSha,embedding_text_sha256:p.textSha,embedding_text_policy:'original_scenario_narrative_without_shared_notice_or_backstory_heading',source_file:p.source,source_filename:path.basename(p.uri),shared_cast_version:'SAVED_CITY_CAST_13_V1',dataset_profile_code:t.code,geographic_role:'synthetic_demo_access_scope_only',new_incident_links_created:0,existing_synthetic_incident_links_preserved:links,original_setting_retained:true,synthetic_notice:pkg.notice};
 return{...(!live?{DATASET_PROFILE_ID:t.id}:{}),PERSON_ID:previous?.PERSON_ID??(live?liveId:t.id*1000000+800001+index),PERSON_REF:p.ref,DISPLAY_NAME:p.name,ALIAS_NAME:p.alias,PERSON_STATUS:p.status,PORTRAIT_VARIANT:'generated-photo',PORTRAIT_ASSET_URI:p.uri,PORTRAIT_ALT_TEXT:`Generated fictional reference portrait of ${p.name}; identity assigned by the scenario author.`,NARRATIVE_SUMMARY:p.summary,NARRATIVE_TEXT:p.narrative,PROFILE_ATTRIBUTES:attributes,OWNING_PATROL_AREA_ID:previous?.OWNING_PATROL_AREA_ID??area.PATROL_AREA_ID,CREATED_AT:previous?.CREATED_AT??pre.created_at};
}
function vectors(person,p,pre){
 const k={...('DATASET_PROFILE_ID'in person?{DATASET_PROFILE_ID:person.DATASET_PROFILE_ID}:{}),PERSON_ID:person.PERSON_ID};
 return[{...k,EMBEDDING_MODEL:pkg.textModel,SOURCE_SHA256:p.textSha,EMBEDDING:Array.from(new Float32Array(p.textVector)),CREATED_AT:pre.created_at},{...k,ASSET_REF:p.assetRef,ASSET_KIND:'reference_portrait',ASSET_URI:p.uri,MIME_TYPE:p.mime,ASSET_SHA256:p.imageSha,ASSET_CAPTION:`Generated fictional reference portrait of ${p.name}.`,EMBEDDING_MODEL:pkg.imageModel,EMBEDDING:Array.from(new Float32Array(p.imageVector)),CREATED_AT:pre.created_at}];
}
function build(pre,before,liveIds={}){
 const out=Object.fromEntries([...BASE,...LIVE].map(t=>[t,structuredClone(before[t])]));
 for(const t of [...TARGETS,{id:null,code:'ADELAIDE_DATA',area:'CENTRAL'}]){
  const names=t.id===null?LIVE:BASE;
  pkg.profiles.forEach((p,i)=>{
   const old=before[names[0]].find(r=>(t.id===null||r.DATASET_PROFILE_ID===t.id)&&r.PERSON_REF===p.ref);
   const r=person(t,p,i,pre,old,liveIds[p.ref]??null);
   if(old){const index=out[names[0]].findIndex(x=>x.PERSON_ID===old.PERSON_ID&&(t.id===null||x.DATASET_PROFILE_ID===t.id));assert(index>=0);out[names[0]][index]=r;}else{assert(!out[names[0]].some(x=>x.PERSON_ID===r.PERSON_ID&&r.PERSON_ID!==null&&(t.id===null||x.DATASET_PROFILE_ID===t.id)),'New surrogate ID conflict');out[names[0]].push(r);}
   const[n,v]=vectors(r,p,pre);out[names[1]].push(n);out[names[2]].push(v);
  });
 }
 return out;
}
module.exports={build,person,vectors};
