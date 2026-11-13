'use strict';
const crypto=require('node:crypto');
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);
const PACKAGE_CODE='EI_AMSTERDAM_V1';
const PROFILE_CODE='AMSTERDAM_DATA_V1';
function cosine(a,b) {
  if(!a.length||a.length!==b.length||![...a,...b].every(Number.isFinite))throw Error('Incompatible vectors');
  const norm=x=>Math.sqrt(x.reduce((s,v)=>s+v*v,0));
  const denom=norm(a)*norm(b);if(!denom)throw Error('Zero vector');
  return a.reduce((s,v,i)=>s+v*b[i],0)/denom;
}
function distanceKm(a,b) {
  const rad=d=>d*Math.PI/180;
  const dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);
  const h=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;
  return 6371.0088*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
// Offline contract reference, not an alternative to server-side DDS enforcement.
function visibleItems(pack,{profileCode,incidentRefs,personRefs}) {
  if(profileCode!==pack.profileCode)return [];
  const incidents=new Set(incidentRefs),people=new Set(personRefs);
  return pack.items.filter(e=>incidents.has(e.incidentRef)).map(e=>({...e,
    personLinks:e.personLinks.filter(l=>people.has(l.personRef))}));
}
function markerMatches(items,namespace,value) {
  return items.filter(e=>e.markers.some(m=>m.namespace===namespace&&m.value===value));
}
function rank(items,vectors,query,{model,dimensions,modality,topK=6,minimum=-1,excludeRef=null}) {
  if(query.length!==dimensions)throw Error('Query dimensions differ');
  return items.filter(e=>e.evidenceRef!==excludeRef).flatMap(e=>{
    const v=vectors.find(v=>v.evidenceRef===e.evidenceRef&&v.modality===modality&&v.model===model&&v.dimensions===dimensions);
    if(!v)return [];
    if(v.sourceSha256!==(modality==='text'?e.indexTextSha256:e.asset.sha256))throw Error('Stale embedding '+e.evidenceRef);
    const score=cosine(query,v.values);return score>=minimum?[{evidenceRef:e.evidenceRef,score}]:[];
  }).sort((a,b)=>b.score-a.score||a.evidenceRef.localeCompare(b.evidenceRef)).slice(0,topK);
}
function validate(pack,anchors,readAsset) {
  const errors=[],check=(ok,msg)=>{if(!ok)errors.push(msg);};
  check(pack.packageCode===PACKAGE_CODE&&pack.profileCode===PROFILE_CODE,'Incorrect package or profile');
  check(pack.items.length===32,'Expected 32 items');
  const refs=new Set(),incidents=new Map(anchors.incidents.map(i=>[i.INCIDENT_REF,i]));
  for(const e of pack.items) {
    const i=incidents.get(e.incidentRef);
    check(!refs.has(e.evidenceRef),'Duplicate reference '+e.evidenceRef);refs.add(e.evidenceRef);
    check(!!i,'Unknown incident '+e.evidenceRef);if(!i)continue;
    check(e.caseRef===i.CASE_REF,'Case mismatch '+e.evidenceRef);
    check(e.syntheticRecord===true&&e.provenance.origin==='authored_synthetic_fixture','Missing synthetic provenance '+e.evidenceRef);
    check(e.title.length>=25&&e.title.length<=140,'Title length '+e.evidenceRef);
    check(e.description.length>=160&&e.description.length<=700,'Description length '+e.evidenceRef);
    check(!e.captureLocation&&!e.capturedAt,'Invented capture place/time '+e.evidenceRef);
    check(e.incidentContext.occurredAt===i.OCCURRED_AT,'Occurrence changed '+e.evidenceRef);
    check(e.incidentContext.latitude===i.LATITUDE&&e.incidentContext.longitude===i.LONGITUDE,'Coordinate changed '+e.evidenceRef);
    check(e.incidentContext.locationRole===i.INCIDENT_ATTRIBUTES.location_role,'Location role changed '+e.evidenceRef);
    check(Date.parse(e.simulatedRecordedAt)>=Date.parse(i.INCIDENT_ATTRIBUTES.reported_timestamp),'Recorded before report '+e.evidenceRef);
    check(e.indexTextSha256===sha256(e.indexText),'Index hash mismatch '+e.evidenceRef);
    check(!/(groundTruth|expectedRank|negativeControl)/i.test(e.indexText),'Evaluation answer leaked into index '+e.evidenceRef);
    check(e.asset.path.startsWith('assets/')&&!e.asset.path.includes('..'),'Unsafe asset path '+e.evidenceRef);
    if(readAsset) {
      try{check(sha256(readAsset(e.asset.path))===e.asset.sha256,'Asset hash mismatch '+e.evidenceRef);}catch{check(false,'Missing asset '+e.evidenceRef);}
    }
    for(const l of e.personLinks) {
      check(anchors.links.some(p=>p.INCIDENT_REF===e.incidentRef&&p.PERSON_REF===l.personRef),'Invented baseline POI link '+e.evidenceRef);
      check(['existing_incident_context','literal_name_mention'].includes(l.basis),'Unsupported person basis '+e.evidenceRef);
      if(l.basis==='literal_name_mention')check(e.sourceText.slice(l.startCharacter,l.endCharacter)===l.quote&&l.quote.length>0,'Invalid quote offsets '+e.evidenceRef);
    }
    for(const m of e.markers)check(!!m.namespace&&!!m.value&&!!m.sourceQuote&&e.sourceText.includes(m.sourceQuote),'Untraceable marker '+e.evidenceRef);
  }
  check(new Set(pack.items.map(e=>e.incidentRef)).size===12,'Expected 12 distinct incidents');
  check(new Set(pack.items.map(e=>e.title)).size===32,'Repeated titles');
  check(new Set(pack.items.map(e=>e.description)).size===32,'Repeated descriptions');
  return {valid:errors.length===0,errors,items:pack.items.length,incidents:new Set(pack.items.map(e=>e.incidentRef)).size,
    people:new Set(pack.items.flatMap(e=>e.personLinks.map(l=>l.personRef))).size};
}
module.exports={PACKAGE_CODE,PROFILE_CODE,sha256,canonical,cosine,distanceKm,visibleItems,markerMatches,rank,validate};
