'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {connect,rows}=require('../evidence-intelligence/connection.cjs');
const {DIR,OUT,PROFILE,PACK,read,save,sha256,canonical}=require('./common.cjs');
const {cosine,distanceKm}=require('../evidence-intelligence/contract.cjs');
const api=require('../../backend/evidence-intelligence');
async function verify(c){const checks=[],check=(label,value=true)=>{assert(value,label);checks.push(label);};
  const all=await api.list(c),pack=read(DIR,'pack.json'),v=read(DIR,'embeddings.json'),expected=read(DIR,'expected.json');
  check('48 scoped items with 16 Care-Trust sources',all.items.length===48&&all.items.filter(e=>e.knowledgeSetId==='KS-CARE-TRUST-001').length===16);
  check('17 incident contexts and 3 cases',new Set(all.items.map(e=>e.incidentRef)).size===17&&new Set(all.items.map(e=>e.caseRef)).size===3);
  check('11 visible fictional POIs across evidence packs',new Set(all.items.flatMap(e=>e.personLinks.map(l=>l.personRef))).size===11);
  check('Source JSON retains consent boundaries',all.items.find(e=>e.evidenceRef==='EV-AMS-H07').attributes.consentForResidentA==='not_supplied');
  for(const [ns,want]of [['care_worker',expected.exactWorker],['care_form_catalogue',expected.formCollision]])check('Exact namespace '+ns,canonical((await api.list(c,{namespace:ns,marker:'DEMO-WORKER-17'})).items.map(e=>e.evidenceRef).sort())===canonical(want.slice().sort()));
  check('Care case filter excludes payment evidence',(await api.list(c,{caseRef:'CASE-AMS-2026-03'})).items.length===16);
  const graph=await api.graph(c,'EV-AMS-H06');check('Native graph has both new documentary contacts',pack.people.every(p=>graph.paths.some(g=>g.personRef===p.personRef)));
  check('Native graph carries the no-attendance source boundary',graph.paths.find(p=>p.personRef==='POI-AMS-CARE-X01').linkSummary.includes('no physical presence'));
  check('Two exact source names remain separate from three incident-context paths',graph.mentions.length===2&&graph.paths.length===3);
  const reference=read(path.resolve(DIR,'../v1'),'embeddings.json').vectors.filter(v=>v.modality==='text');
  const probes=[];
  for(const q of v.queries){
    const result=await rows(c,`SELECT e.evidence_ref,1-VECTOR_DISTANCE(t.embedding,TO_VECTOR(:v),COSINE) score FROM secure_ei_items_v e JOIN ei_text_vectors t ON t.profile_code=e.profile_code AND t.evidence_ref=e.evidence_ref WHERE t.model=:m AND t.source_sha256=e.text_sha256 ORDER BY score DESC FETCH FIRST 6 ROWS ONLY`,{v:JSON.stringify(q.values),m:v.model});
    const first=result.slice(0,q.topK);check('Native vector probe '+q.id,q.required.every(r=>first.some(x=>x.EVIDENCE_REF===r)));
    for(const r of result){const stored=[...v.vectors,...reference].find(x=>x.evidenceRef===r.EVIDENCE_REF);assert(Math.abs(r.SCORE-cosine(q.values,stored.values))<0.00001);}
    probes.push({id:q.id,ranked:result});
  }
  check('Oracle and offline cosine agree for all probes');
  check('Selected-source vector comparison retrieves related assignment',(await api.search(c,{evidenceRef:'EV-AMS-H03'})).items.some(e=>e.evidenceRef==='EV-AMS-H04'));
  const nearby=await api.nearby(c,{evidenceRef:'EV-AMS-H01',km:2}),origin=all.items.find(e=>e.evidenceRef==='EV-AMS-H01');
  check('Native spatial includes its centre incident',nearby.items.some(e=>e.evidenceRef==='EV-AMS-H01'));
  check('Native distances agree with independent approximate calculation',nearby.items.every(e=>Math.abs(e.distanceKm-distanceKm(origin.incidentContext,e.incidentContext))<0.02));
  check('Spatial excludes a distant original Weesp incident',!nearby.items.some(e=>e.incidentRef==='SYN-AMS-2026-11631'));
  check('Original payment marker still returns P01/P02',(await api.list(c,{namespace:'payment_comparison',marker:'AMS-2-1'})).items.map(e=>e.evidenceRef).join(',')==='EV-AMS-P01,EV-AMS-P02');
  check('Original image comparison still ranks V02 first',(await api.search(c,{evidenceRef:'EV-AMS-V01',modality:'image'})).items[0].evidenceRef==='EV-AMS-V02');
  const parity=await rows(c,`SELECT e.evidence_ref,e.document,JSON_SERIALIZE(s.evidence_metadata RETURNING CLOB) saved_metadata FROM secure_ei_items_v e JOIN z_base_dataset_profiles p ON p.profile_code=e.profile_code JOIN z_base_evidence_items s ON s.dataset_profile_id=p.dataset_profile_id AND JSON_VALUE(s.evidence_metadata,'$.evidence_ref')=e.evidence_ref WHERE e.pack_code=:pack`,{pack:PACK});
  check('Saved Amsterdam retains all 16 identical evidence documents',parity.length===16&&parity.every(r=>canonical(JSON.parse(r.DOCUMENT))===canonical(JSON.parse(r.SAVED_METADATA).evidence_intelligence)));
  const people=await rows(c,`SELECT p.person_ref,p.narrative_text,n.source_sha256,n.embedding_model,s.source_sha256 saved_hash FROM persons_of_interest p JOIN person_narrative_embeddings n ON n.person_id=p.person_id JOIN z_base_persons sp ON sp.person_ref=p.person_ref AND sp.dataset_profile_id=30 JOIN z_base_person_narrative_vec s ON s.person_id=sp.person_id AND s.dataset_profile_id=sp.dataset_profile_id WHERE p.person_ref LIKE 'POI-AMS-CARE-%'`);
  check('Both new person narratives have saved and live current vectors',people.length===2&&people.every(p=>p.SOURCE_SHA256===sha256(p.NARRATIVE_TEXT)&&p.SAVED_HASH===p.SOURCE_SHA256&&p.EMBEDDING_MODEL===v.model));
  for(const user of ['central_analyst','northern_analyst','southern_analyst','read_only_viewer']){
    await c.execute('BEGIN DBMS_SESSION.SET_IDENTIFIER(:u); END;',{u:user});
    check(user+' sees no evidence',(await api.list(c)).items.length===0);
    check(user+' sees no new people',(await rows(c,"SELECT person_ref FROM secure_persons_of_interest_v WHERE person_ref LIKE 'POI-AMS-CARE-%'")).length===0);
    for(const [label,fn] of [['graph',()=>api.graph(c,'EV-AMS-H06')],['vector',()=>api.search(c,{evidenceRef:'EV-AMS-H05'})],['spatial',()=>api.nearby(c,{evidenceRef:'EV-AMS-H01'})],['review',()=>api.review(c,user,{evidenceRefs:['EV-AMS-H05']})]]){let status;try{await fn();}catch(e){status=e.status;}check(user+' denied '+label,status===404);}
  }
  await c.execute("BEGIN DBMS_SESSION.SET_IDENTIFIER('statewide_admin'); END;");
  check('Unbound native source tool remains denied',String((await rows(c,"SELECT ei_sources_v1('not-a-request') value FROM dual"))[0].VALUE).includes('Outside selected request'));
  return {status:'passed',at:new Date().toISOString(),checks,probes,graph,spatial:nearby.items.map(e=>({ref:e.evidenceRef,km:e.distanceKm}))};
}
async function main(){const c=await connect();try{if(process.argv.includes('--staged')){const {load}=require('./load.cjs');const receipt=await load(c,false,verify);save(OUT,'staged-native.json',receipt,true);console.log(JSON.stringify({mode:receipt.mode,checks:receipt.verification.checks}));}else{const result=await verify(c);save(OUT,'native-verification.json',result);console.log(JSON.stringify(result));}}finally{await c.rollback();await c.close();}}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={verify};
