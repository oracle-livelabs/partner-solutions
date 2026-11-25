'use strict';
const assert=require('node:assert/strict');
const {connect,rows}=require('../evidence-intelligence/connection.cjs');
const {OUT,DIR,PACK,PROFILE,read,save,sha256,canonical}=require('./fixture.cjs');
const {originalState}=require('./database.cjs');
const base='http://127.0.0.1:8706';
(async()=>{const c=await connect();try{await c.execute('SET TRANSACTION READ ONLY');const pre=read(OUT,'preflight.json');assert.deepEqual(await originalState(c),pre.protected);
  const snapshot={at:new Date().toISOString(),profileCode:PROFILE,packCode:PACK,tables:{}};
  for(const saved of [false,true]){
    const prefix=saved?'z_base_':'',guard=saved?'AND dataset_profile_id=30':'';
    for(const[name,table,where,order]of [
      ['evidence','evidence_items',"JSON_VALUE(evidence_metadata,'$.pack_code')='"+PACK+"'",'evidence_id'],
      ['posts','social_media_posts',"post_ref LIKE 'SYN-AMS-CARE-POST-%'",'post_ref'],
      ['links','social_post_incident_links',"post_ref LIKE 'SYN-AMS-CARE-POST-%'",'post_ref,incident_ref'],
      ['watchPosts','watched_pattern_posts',"post_ref LIKE 'SYN-AMS-CARE-POST-%'",'post_ref,pattern_code']
    ])snapshot.tables[(saved?'saved':'live')+name]=await rows(c,`SELECT * FROM ${prefix}${table} WHERE ${where} ${guard} ORDER BY ${order}`);
  }
  snapshot.tables.vectors=await rows(c,"SELECT profile_code,evidence_ref,source_sha256,model,VECTOR_SERIALIZE(embedding RETURNING CLOB) embedding FROM ei_text_vectors WHERE profile_code=:p AND evidence_ref BETWEEN 'EV-AMS-H17' AND 'EV-AMS-H22' ORDER BY evidence_ref",{p:PROFILE});
  const strip=r=>{const {CREATED_AT,DATASET_PROFILE_ID,...rest}=r;return rest;};
  for(const name of ['posts','links','watchPosts'])assert.equal(canonical(snapshot.tables['live'+name].map(strip)),canonical(snapshot.tables['saved'+name].map(strip)));
  save(OUT,'postload-backup.json',snapshot);save(OUT,'postload-backup-manifest.json',{at:snapshot.at,sha256:sha256(canonical(snapshot)),counts:Object.fromEntries(Object.entries(snapshot.tables).map(([k,v])=>[k,v.length])),protectedHashesMatch:true});
  const request=async(suffix,body,user='statewide_admin')=>{const r=await fetch(base+'/api/evidence-intelligence'+suffix,{method:body?'POST':'GET',headers:{'X-Demo-User':user,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});assert.equal(r.status,200);return r;};
  const checks=[];
  for(const e of read(DIR,'pack.json').items)assert.equal(sha256(Buffer.from(await(await request('/'+e.evidenceRef+'/asset')).arrayBuffer())),e.asset.sha256);checks.push('All six new source assets match SHA-256');
  const graph=await(await request('/EV-AMS-H21/relationships')).json();assert.equal(graph.engine,'Oracle GRAPH_TABLE');assert.equal(graph.mentions.length,0);assert(graph.paths.some(p=>p.personRef==='POI-AMS-CARE-W01'&&p.linkSummary.includes('care-assignment')));checks.push('Native graph returns contextual worker path but no literal financial-source name mention');
  const nearby=await(await request('/nearby',{evidenceRef:'EV-AMS-H21',km:2})).json();assert(nearby.engine.includes('SDO_GEOM'));assert(nearby.items.some(e=>e.evidenceRef==='EV-AMS-H17'&&e.distanceKm===0));checks.push('Native Spatial preserves approximate incident context');
  const exact=await(await request('?namespace=payment_entry&marker=DEMO-TXN-A3')).json();assert.deepEqual(exact.items.map(e=>e.evidenceRef),['EV-AMS-H20','EV-AMS-H21']);checks.push('Native JSON marker finds entry and reconciliation');
  const image=await(await request('/search',{modality:'image',evidenceRef:'EV-AMS-V01',topK:3})).json();assert.equal(image.items[0].evidenceRef,'EV-AMS-V02');checks.push('Original generated-object image ranking retained');
  const financial=await(await request('/search',{modality:'text',evidenceRef:'EV-AMS-H20',topK:6})).json();assert.equal(financial.items[0].evidenceRef,'EV-AMS-H21');checks.push('Native vector returns qualifying reconciliation first');
  const all=await(await request('')).json();assert.equal(all.items.length,54);assert.equal(all.profile.profileCode,PROFILE);checks.push('54 total sources, Amsterdam remains active');
  save(OUT,'native-http-audit.json',{at:new Date().toISOString(),status:'passed',checks,graph,nearbyEngine:nearby.engine,vectorTop:financial.items.map(e=>({ref:e.evidenceRef,score:e.score})),aiNotAffectingSources:true});console.log(JSON.stringify({status:'passed',checks}));
}finally{await c.rollback();await c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
