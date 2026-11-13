'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {connect,rows}=require('../connection.cjs');
const {PACK,THEMES,sha,canonical,validate}=require('./contract.cjs');
const DIR=path.resolve(__dirname,'../../../testdata/evidence-intelligence/city-core-v1');
const SHORT={Adelaide:'ADL',Perth:'PER',Brisbane:'BNE',Amsterdam:'AMS',Brussels:'BRU',Dublin:'DUB',Boston:'BOS',Chicago:'CHI','Las Vegas':'LV'};
async function main(){
 assert(!fs.existsSync(path.join(DIR,'pack.json')),'Pack exists; create a new version to refresh anchors');
 const {FOUNDATION_PROFILES}=await import('../../../frontend/src/foundation-profiles.mjs');
 const c=await connect(),anchors={capturedAt:new Date().toISOString(),cities:[]};
 try{
  await c.execute('SET TRANSACTION READ ONLY');
  anchors.active=(await rows(c,'SELECT * FROM z_base_active_dataset_profile'));
  for(const profile of FOUNDATION_PROFILES){
   const p=(await rows(c,'SELECT dataset_profile_id FROM z_base_dataset_profiles WHERE profile_code=:code',{code:profile.code}))[0];assert(p);
   const candidates=await rows(c,`SELECT w.pattern_code,i.incident_id,i.incident_ref,i.suburb,i.occurred_at,i.latitude,i.longitude,
    JSON_VALUE(i.incident_attributes,'$.location_role') location_role,
    r.report_summary,
    (SELECT MIN(cf.case_ref) FROM z_base_case_incident_links cl JOIN z_base_case_files cf ON cf.dataset_profile_id=cl.dataset_profile_id AND cf.case_id=cl.case_id WHERE cl.dataset_profile_id=i.dataset_profile_id AND cl.incident_id=i.incident_id) case_ref,
    (SELECT COUNT(*) FROM z_base_person_incident_links pl WHERE pl.dataset_profile_id=i.dataset_profile_id AND pl.incident_id=i.incident_id) person_count
    FROM z_base_watched_pattern_incidents w JOIN z_base_crime_incidents i ON i.dataset_profile_id=w.dataset_profile_id AND i.incident_ref=w.incident_ref
    JOIN z_base_incident_reports r ON r.dataset_profile_id=i.dataset_profile_id AND r.incident_id=i.incident_id
    WHERE i.dataset_profile_id=:pid ORDER BY w.pattern_code,person_count DESC,i.incident_ref`,{pid:p.DATASET_PROFILE_ID});
   const used=new Set(),selected=[];
   for(const theme of THEMES){
    const choices=[];
    for(const row of candidates.filter(r=>r.PATTERN_CODE===theme.code)){
     if(used.has(row.INCIDENT_REF))continue;choices.push(row);used.add(row.INCIDENT_REF);if(choices.length===2)break;
    }
    assert.equal(choices.length,2,profile.code+'/'+theme.code);
    for(const row of choices){
     row.people=await rows(c,`SELECT DISTINCT p.person_ref,p.display_name FROM z_base_person_incident_links l
      JOIN z_base_persons p ON p.dataset_profile_id=l.dataset_profile_id AND p.person_id=l.person_id
      WHERE l.dataset_profile_id=:pid AND l.incident_id=:id ORDER BY p.person_ref`,{pid:p.DATASET_PROFILE_ID,id:row.INCIDENT_ID});
     selected.push(row);
    }
   }
   anchors.cities.push({city:profile.city,profileCode:profile.code,id:p.DATASET_PROFILE_ID,short:SHORT[profile.city],anchors:selected});
  }
 }finally{await c.rollback();await c.close();}
 fs.mkdirSync(path.join(DIR,'assets/documents'),{recursive:true});fs.mkdirSync(path.join(DIR,'assets/images'),{recursive:true});
 for(const filename of ['tray-a.png','tray-b.png','organiser-control.png','latch-detail.png'])
  fs.copyFileSync(path.join(DIR,'../v1/assets/images',filename),path.join(DIR,'assets/images',filename));
 const pack={formatVersion:1,packageCode:PACK,createdOn:'2026-10-20',anchorSnapshotSha256:sha(canonical(anchors)),cities:[]};
 for(const city of anchors.cities){
  const items=[];
  for(const [ti,theme] of THEMES.entries()){
   const pair=city.anchors.filter(a=>a.PATTERN_CODE===theme.code),marker=`${city.short}-CORE-${String(ti+1).padStart(2,'0')}`;
   for(const [si,[heading,body]] of theme.sources.entries()){
    const a=pair[si%2],evidenceRef=`EV-${city.short}-Q${String(ti*4+si+1).padStart(2,'0')}`,image=theme.images[si];
    const title=`${heading} — ${a.SUBURB}`;
    const sourceText=`Authored fictional teaching supplement for ${city.city}; linked incident ${a.INCIDENT_REF}, ${a.SUBURB}.\n${body.replaceAll('{marker}',marker)}\nThese newly authored details are a synthetic comparison exercise, not quotations from the original incident report.`;
    const description=`${heading} in the ${city.city} ${theme.title.toLowerCase()} walkthrough, attached to ${a.INCIDENT_REF} in ${a.SUBURB}. Compare the source wording, reference namespace and missing verification before drawing any connection. The supplement is wholly fictional.`;
    const assetPath=image?'assets/images/'+image:`assets/documents/${evidenceRef}.txt`;
    if(!image)fs.writeFileSync(path.join(DIR,assetPath),title+'\n\n'+sourceText+'\n');
    const namespace=si===3&&!image&&theme.code!=='VEHICLE_PARTS_HARVESTING'?'blank_template':`${city.short.toLowerCase()}_${theme.code.toLowerCase()}`;
    const item={evidenceRef,profileCode:city.profileCode,version:1,syntheticRecord:true,incidentRef:a.INCIDENT_REF,caseRef:a.CASE_REF||null,
     title,kind:image?'generated_object_image':(si===2?'comparison_resolution_note':si===3?'comparison_control':'document_extract'),description,sourceText,
     indexText:title+'\n'+sourceText,markers:image?[]:[{namespace,value:marker,sourceQuote:marker}],
     watchPatternCode:theme.code,personLinks:image?[]:a.people.map(p=>({personRef:p.PERSON_REF,displayName:p.DISPLAY_NAME,basis:'existing_incident_context',reviewStatus:'authored_synthetic_context',explanation:'Existing saved incident association only; this source does not identify its author, visitor, handler or owner.'})),
     incidentContext:{occurredAt:a.OCCURRED_AT,suburb:a.SUBURB,latitude:a.LATITUDE,longitude:a.LONGITUDE,locationRole:a.LOCATION_ROLE||'unspecified'},
     capturedAt:null,captureLocation:null,simulatedRecordedAt:null,
     provenance:{origin:'authored_synthetic_fixture',authoredAt:'2026-10-20',custodyStatus:'synthetic_authoring_only',notice:'New fictional teaching supplement. Incident context comes from the saved city profile; the authored scenario details are not original report assertions. Images are reused generated comparison illustrations and have no local capture or recovery provenance.'},
     attributes:{sharedCityStory:true,storyTitle:theme.title,reviewQuestion:theme.question,currency:null},
     asset:{path:assetPath,mimeType:image?'image/png':'text/plain',sha256:sha(fs.readFileSync(path.join(DIR,assetPath))),caption:image?body:description}};
    item.indexTextSha256=sha(item.indexText);items.push(item);
   }
  }
  pack.cities.push({city:city.city,profileCode:city.profileCode,items});
 }
 const checked=validate(pack,p=>fs.readFileSync(path.join(DIR,p)));
 fs.writeFileSync(path.join(DIR,'anchors.json'),JSON.stringify(anchors,null,2)+'\n');
 fs.writeFileSync(path.join(DIR,'pack.json'),JSON.stringify(pack,null,2)+'\n');
 console.log(JSON.stringify(checked));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
