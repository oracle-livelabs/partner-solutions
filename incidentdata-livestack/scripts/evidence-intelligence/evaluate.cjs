'use strict';
const fs=require('node:fs'),path=require('node:path');
const {validate,sha256,canonical,rank,markerMatches,distanceKm,visibleItems}=require('./contract.cjs');
const ROOT=path.resolve(__dirname,'../../testdata/evidence-intelligence/v1');
const read=n=>JSON.parse(fs.readFileSync(path.join(ROOT,n)));
const pack=read('pack.json'),anchors=read('anchors.json'),expected=read('expected.json'),embeddings=read('embeddings.json');
const checks=[];
const check=(name,pass,detail)=>checks.push({name,pass,...(detail?{detail}:{})});
const integrity=validate(pack,anchors,p=>fs.readFileSync(path.join(ROOT,p)));
check('Data contract and source hashes',integrity.valid,integrity);
check('Embedding pack fingerprint',embeddings.packSha256===sha256(canonical(pack)));
for(const q of expected.textProbes) {
  const query=embeddings.queries.find(x=>x.id===q.id);
  const results=rank(pack.items,embeddings.vectors,query.values,{model:query.model,dimensions:query.dimensions,modality:'text',topK:q.topK});
  check(q.id,q.mustInclude.every(ref=>results.some(r=>r.evidenceRef===ref)),results.map(r=>({...r,score:Number(r.score.toFixed(4))})));
}
for(const q of expected.imageProbes) {
  const v=embeddings.vectors.find(v=>v.evidenceRef===q.queryRef&&v.modality==='image');
  const results=rank(pack.items,embeddings.vectors,v.values,{model:v.model,dimensions:v.dimensions,modality:'image',excludeRef:q.queryRef});
  check(q.id,results[0]?.evidenceRef===q.expectedFirstOther&&q.mustRankBelow.every(ref=>results.findIndex(r=>r.evidenceRef===ref)>0),results.map(r=>({...r,score:Number(r.score.toFixed(4))})));
}
for(const q of expected.markerProbes) {
  const refs=markerMatches(pack.items,q.namespace,q.value).map(e=>e.evidenceRef).sort();
  check('Exact marker '+q.namespace+':'+q.value,canonical(refs)===canonical([...q.expectedRefs].sort()),refs);
}
for(const v of embeddings.vectors) {
  const results=rank(pack.items,embeddings.vectors,v.values,{model:v.model,dimensions:v.dimensions,modality:v.modality});
  check('Self retrieval '+v.evidenceRef+' '+v.modality,results[0]?.evidenceRef===v.evidenceRef);
}
for(const s of anchors.scope) {
  const visible=visibleItems(pack,{profileCode:pack.profileCode,incidentRefs:s.incidents,personRefs:s.people});
  check('Captured live scope '+s.user,visible.length===(s.user==='statewide_admin'?32:0),{items:visible.length});
}
const q=expected.spatialProbe,centre=anchors.incidents.find(i=>i.INCIDENT_REF===q.centreIncidentRef);
const location=i=>({latitude:i.LATITUDE,longitude:i.LONGITUDE});
const near=anchors.incidents.filter(i=>i.INCIDENT_ATTRIBUTES.location_role==='physical_context'&&distanceKm(location(centre),location(i))<=q.radiusKm).map(i=>i.INCIDENT_REF);
check('Approximate incident context radius',q.mustInclude.every(r=>near.includes(r))&&q.mustExclude.every(r=>!near.includes(r)),near);
const date=new Intl.DateTimeFormat('en-CA',{timeZone:pack.timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
const onDate=anchors.incidents.filter(i=>date.format(new Date(i.OCCURRED_AT))===expected.timeProbe.localDate).map(i=>i.INCIDENT_REF).sort();
check('Amsterdam local midnight boundary',canonical(onDate)===canonical(expected.timeProbe.expectedIncidentRefs),onDate);
const g=expected.graphProbe,e=pack.items.find(e=>e.evidenceRef===g.evidenceRef);
check('Typed source-to-person and inherited paths',e.incidentRef===g.incidentRef&&e.caseRef===g.caseRef&&[g.directBasis,g.inheritedBasis].every(b=>e.personLinks.some(l=>l.personRef===g.personRef&&l.basis===b)));
const result={generatedAt:new Date().toISOString(),passed:checks.every(c=>c.pass),passedCount:checks.filter(c=>c.pass).length,total:checks.length,
  scope:'Offline fixture/embedding checks, anchored to live HTTP records. Not a native Oracle or agent execution test.',
  pending:['Native Oracle JSON/VECTOR/SDO/GRAPH_TABLE execution','Transactional loader and rollback against a test schema','Snapshot restore compatibility in database','Select AI/agent tool execution and source-instruction isolation','Evidence Intelligence UI'],checks};
fs.writeFileSync(path.join(ROOT,'validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,passedCount:result.passedCount,total:result.total,failures:checks.filter(c=>!c.pass)}));
if(!result.passed)process.exitCode=1;
