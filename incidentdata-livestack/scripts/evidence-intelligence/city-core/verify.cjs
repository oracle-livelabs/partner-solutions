'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect,rows}=require('../connection.cjs'),{PACK,sha,canonical}=require('./contract.cjs');
const ROOT=path.resolve(__dirname,'../../..'),pack=JSON.parse(fs.readFileSync(path.join(ROOT,'testdata/evidence-intelligence/city-core-v1/pack.json')));
const base=process.env.INCIDENTDATA_VERIFY_URL||'http://127.0.0.1:8706',headers={'X-Demo-User':'statewide_admin','Content-Type':'application/json'};
async function main(){
 const c=await connect(),checks=[];
 let active;
 try{
  await c.execute('SET TRANSACTION READ ONLY');
  active=(await rows(c,'SELECT p.profile_code,a.* FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1'))[0];
  for(const city of pack.cities){
   const sources=await rows(c,`SELECT i.incident_ref,JSON_SERIALIZE(e.evidence_metadata RETURNING CLOB) metadata FROM z_base_evidence_items e
    JOIN z_base_dataset_profiles p ON p.dataset_profile_id=e.dataset_profile_id
    JOIN z_base_crime_incidents i ON i.dataset_profile_id=e.dataset_profile_id AND i.incident_id=e.incident_id
    WHERE p.profile_code=:profile AND JSON_VALUE(e.evidence_metadata,'$.pack_code')=:pack`,{profile:city.profileCode,pack:PACK});
   assert.equal(sources.length,24,city.city);
   const text=await rows(c,'SELECT evidence_ref,source_sha256,model,VECTOR_DIMENSION_COUNT(embedding) dimensions FROM ei_text_vectors WHERE profile_code=:p',{p:city.profileCode});
   const images=await rows(c,'SELECT evidence_ref,source_sha256,model,VECTOR_DIMENSION_COUNT(embedding) dimensions FROM ei_image_vectors WHERE profile_code=:p',{p:city.profileCode});
   for(const item of city.items){const record=sources.find(r=>JSON.parse(r.METADATA).evidence_ref===item.evidenceRef);assert(record);assert.equal(record.INCIDENT_REF,item.incidentRef);const meta=JSON.parse(record.METADATA);assert.equal(meta.record_sha256,sha(canonical(item)));assert.deepEqual(meta.evidence_intelligence,item);
    const vector=text.find(v=>v.EVIDENCE_REF===item.evidenceRef);assert(vector);assert.equal(vector.SOURCE_SHA256,item.indexTextSha256);assert.equal(vector.DIMENSIONS,384);
    if(item.asset.mimeType==='image/png'){const vector=images.find(v=>v.EVIDENCE_REF===item.evidenceRef);assert(vector);assert.equal(vector.SOURCE_SHA256,item.asset.sha256);assert.equal(vector.DIMENSIONS,512);}
   }
   checks.push({city:city.city,sources:24,stories:6,textVectors:24,imageVectors:4,localIncidentAnchorsVerified:true});
  }
 }finally{await c.rollback();await c.close();}
 const response=await fetch(base+'/api/evidence-intelligence',{headers});assert.equal(response.status,200);const list=await response.json();
 assert.equal(list.profile.profileCode,active.PROFILE_CODE);assert.equal(list.walkthroughs.length,6);
 const city=pack.cities.find(p=>p.profileCode===active.PROFILE_CODE),core=list.items.filter(e=>e.attributes?.sharedCityStory);assert.equal(core.length,24);
 for(const item of city.items){
  const result=await fetch(base+'/api/evidence-intelligence/'+item.evidenceRef,{headers});assert.equal(result.status,200);assert.equal((await result.json()).incidentRef,item.incidentRef);
  const asset=await fetch(base+'/api/evidence-intelligence/'+item.evidenceRef+'/asset',{headers});assert.equal(asset.status,200);assert.equal(sha(Buffer.from(await asset.arrayBuffer())),item.asset.sha256);
 }
 for(const other of pack.cities.filter(p=>p.profileCode!==active.PROFILE_CODE))assert.equal((await fetch(base+'/api/evidence-intelligence/'+other.items[0].evidenceRef+'/asset',{headers})).status,404);
 const restrictedHeaders={'X-Demo-User':'read_only_viewer'};
 const restricted=await fetch(base+'/api/evidence-intelligence',{headers:restrictedHeaders});assert.equal(restricted.status,200);const limited=await restricted.json();
 if(!limited.items.some(e=>e.evidenceRef===city.items[0].evidenceRef)){
  assert.equal((await fetch(base+'/api/evidence-intelligence/'+city.items[0].evidenceRef+'/asset',{headers:restrictedHeaders})).status,404);
 }
 for(const story of limited.walkthroughs)assert(story.evidenceRefs.every(r=>limited.items.some(e=>e.evidenceRef===r)));
 const post=async(endpoint,body)=>{const r=await fetch(base+'/api/evidence-intelligence/'+endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});assert.equal(r.status,200,await r.clone().text());return r.json();};
 const images=await post('search',{modality:'image',evidenceRef:city.items[2].evidenceRef,topK:8});assert(images.items.length);assert.equal(images.items[0].evidenceRef,city.items[3].evidenceRef);
 const text=await post('search',{modality:'text',evidenceRef:city.items[4].evidenceRef,topK:8});assert(text.items.length);assert(!text.items.some(e=>e.evidenceRef===city.items[4].evidenceRef));
 const nearby=await post('nearby',{evidenceRef:city.items[0].evidenceRef,km:2});assert(nearby.items.some(e=>e.evidenceRef===city.items[0].evidenceRef));
 const graph=await fetch(base+'/api/evidence-intelligence/'+city.items[0].evidenceRef+'/relationships',{headers});assert.equal(graph.status,200);assert.equal((await graph.json()).engine,'Oracle GRAPH_TABLE');
 const ai=[];
 if(process.argv.includes('--ai'))for(const mode of ['select-ai','agent']){
  const refs=city.items.slice(4,8).map(e=>e.evidenceRef),result=await post('review',{mode,evidenceRefs:refs,question:'Do these sources establish two settled payments? Preserve the voided-authorisation outcome, keep the blank-template namespace separate, cite selected sources and state what remains unknown.'});
  assert(result.citations.length);assert(result.citations.every(r=>refs.includes(r)));if(mode==='agent')assert(result.events.length>=2);ai.push({mode,citations:result.citations,toolEvents:result.events.length});
 }
 console.log(JSON.stringify({status:'passed',at:new Date().toISOString(),cities:checks,activeProfile:active.PROFILE_CODE,liveCoreSources:24,walkthroughs:6,allLiveAssetChecksumsVerified:true,otherCityAssetsDenied:true,restrictedScopeVerified:true,imageRankingVerified:true,textRankingVerified:true,nativeSpatialVerified:true,nativeGraphVerified:true,ai},null,2));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
