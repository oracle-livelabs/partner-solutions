'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {normalize,discover}=require('../backend/data-room-travel');
const source=(type,text,id='one')=>({ITEM_ID:id,ORIGINAL_PATH:`records.${type}`,CONTENT_TYPE:type,CONTENT_BLOB:Buffer.from(text),PREFIX:Buffer.from(text),BYTE_COUNT:Buffer.byteLength(text),SHA256:createHash('sha256').update(text).digest('hex')});
test('normalizes supported CSV journeys and reports exact-name shared places',()=>{
 const result=normalize([source('csv','TRAVEL_ID,PERSON,DEPARTURE,ARRIVAL,ORIGIN,DESTINATION,MODE\nA1,Ada,2026-09-01T09:00:00Z,2026-09-01T10:00:00Z,Home,Station,Train\nB1,Bo,2026-09-02T09:00:00Z,2026-09-02T10:00:00Z,Office,Station,Bus')]);
 assert.equal(result.records.length,2);assert.deepEqual(result.people,['Ada','Bo']);assert.equal(result.coLocations.length,1);assert.equal(result.coLocations[0].name,'Station');assert.deepEqual(result.coLocations[0].people,['Ada','Bo']);
});
test('accepts bounded JSON and explicitly marked synthetic TXT formats',()=>{
 const json=source('json','{"travels":[{"person":"Ada","departure":"2026-09-01T09:00:00Z","arrival":"2026-09-01T10:00:00Z","origin":"One","destination":"Two"}]}');
 const txt=source('txt','SYNTHETIC TRAVEL RECORDS\nBo|2026-09-02T09:00:00Z|2026-09-02T10:00:00Z|Two|Three|Bus');
 assert.equal(normalize([json]).records[0].person,'Ada');assert.equal(normalize([txt]).records[0].mode,'Bus');assert.equal(discover(txt),'recognised');
});
const journey=()=>source('csv','PERSON,DEPARTURE,ARRIVAL,ORIGIN,DESTINATION\nAda,2026-09-01T09:00:00Z,2026-09-01T10:00:00Z,Dublin - One area,Dublin - Two area');
const locations=features=>source('json',JSON.stringify({type:'FeatureCollection',synthetic:true,features}),'locations');
const anchor=(label,coordinates)=>({type:'Feature',id:label,geometry:{type:'Point',coordinates},properties:{label,synthetic:true,precision:'coarse neighbourhood teaching anchor'}});
test('exact-label synthetic GeoJSON anchors map travel endpoints with source provenance',()=>{
 const result=normalize([journey(),locations([anchor('Dublin - One area',[-6.27,53.35]),anchor('Dublin - Two area',[-6.31,53.34])])]);
 assert.equal(result.records.length,1);assert.deepEqual(result.locations.map(l=>[l.geo.latitude,l.geo.longitude]),[[53.35,-6.27],[53.34,-6.31]]);
 assert.equal(result.locations[0].geo.source.itemId,'locations');assert.equal(result.locations[0].geo.source.path,'records.json');
});
test('unmatched, unmarked, invalid and conflicting anchors never silently place a journey',()=>{
 const one=anchor('Dublin - One area',[-6.27,53.35]);
 for(const features of [[anchor('Dublin',[-6.27,53.35])],[{...one,properties:{...one.properties,synthetic:false}}],[anchor('Dublin - One area',[-6.27,153])],[one,anchor('Dublin - One area',[-6.28,53.35])]]){
  const result=normalize([journey(),locations(features)]);assert(result.locations.every(l=>!l.geo));assert.equal(result.records.length,1);
 }
});
