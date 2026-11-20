'use strict';
const path=require('node:path'),fs=require('node:fs/promises');
const oracle=require('oracledb');
const {sha}=require('./detective-room-store');
const {short,sourceLabel}=require('./detective-room-normalize');
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(key,id,text)=>'<button type="button" data-'+key+'="'+E(id)+'">'+E(text)+'</button>';
async function portraits(c,people,publicRoot,stageDir){
 await fs.mkdir(stageDir,{recursive:true,mode:0o700});
 const provenance=[];
 for(const p of people){
  // Catalogue portraits follow exact source names or explicitly declared scenario references.
  const rows=(await c.execute(`SELECT person_id,person_ref,display_name,portrait_asset_uri,portrait_alt_text
    FROM secure_persons_of_interest_v WHERE display_name=:name OR alias_name=:name OR person_ref=:ref`,{name:p.catalogueName||p.name,ref:p.personRef||p.name},{outFormat:oracle.OUT_FORMAT_OBJECT})).rows;
  if(rows.length!==1){provenance.push({name:p.name,status:rows.length?'ambiguous catalogue match':'no exact catalogue match'});continue;}
  const row=rows[0],uri=row.PORTRAIT_ASSET_URI;
  p.personRef=row.PERSON_REF;p.catalogueName=row.DISPLAY_NAME;
  if(!uri||!/^\/[a-zA-Z0-9/_ .-]+\.(?:png|jpe?g|webp)$/i.test(uri)||uri.split('/').includes('..')){provenance.push({name:p.name,status:'no supported local portrait URI'});continue;}
  const resolved=path.resolve(publicRoot,'.'+uri),real=await fs.realpath(resolved).catch(()=>null);
  if(!real||!real.startsWith(path.resolve(publicRoot)+path.sep)){provenance.push({name:p.name,status:'catalogue portrait file unavailable'});continue;}
  const stat=await fs.stat(real);if(stat.size>8*1048576)throw Error('Catalogue portrait exceeds size limit');
  const bytes=await fs.readFile(real),target=path.join(stageDir,p.id+path.extname(real));
  if(p.portraitExpectedSha256&&sha(bytes)!==p.portraitExpectedSha256)throw Error('Declared catalogue portrait changed; refresh the scenario links.');
  await fs.writeFile(target,bytes,{flag:'wx',mode:0o600});
  p.portrait={path:target,sha256:sha(bytes)};
  p.detail+=' Supplemental catalogue portrait matched by exact source name/handle, not by face recognition.';
  p.sourceRefs.push('Catalogue '+row.PERSON_REF+' ('+row.PERSON_ID+'); '+uri+'; SHA-256 '+sha(bytes));
  provenance.push({name:p.name,personRef:row.PERSON_REF,uri,sha256:sha(bytes),basis:p.scenarioLinks?.length?'user-declared fictional handle → scoped catalogue reference':'exact source name → explicit catalogue metadata'});
 }
 require('./detective-room-associations').mergeCataloguePeople(people);
 return provenance;
}
function compose({job,snapshot,normal,authored,directory,briefingDir}){
 const byFact=id=>authored.facts.find(f=>f.id===id);
 const refs=ids=>[...new Set(ids.flatMap(id=>{const f=byFact(id);return (f.anchors||[f]).map(a=>f.path+' · chars '+a.start+'–'+(a.start+a.quote.length));}))];
 const common={batch_id:job.batchId,title:authored.title,subtitle:authored.subtitle,focus:authored.focus,synthetic:true,
  disclaimer:'SYNTHETIC TRAINING · AI draft; analyst review required. Allegations, interpretations and visual observations are not established findings.',
  snapshot:new Date().toISOString(),version:job.id,files:[...snapshot.files,...(snapshot.derivedFiles||[])].map(f=>({path:f.path,sha256:f.sha256,bytes:f.bytes,derivedFrom:f.derivedFrom}))};
 const notes=[
  'Original archive and every registered source file were checked against the CRIME_DATA inventory. No original evidence was modified.',
  'Narrative: OCI Chicago Maverick. Source quotes and locators are checked mechanically; interpretations still require human review.',
  ...(snapshot.derivedFiles?.length?['Audio is retained unchanged. Machine transcript files are derived, unreviewed output from Identify/Describe; text offsets refer to those transcripts, not recording times. Neutral speaker labels do not identify voices.']:[]),
  'Photographs are unverified visual observations; no facial identification or proof of wrongdoing is inferred.',
  'Message membership is not an inferred recipient, read receipt or personal relationship. Source names are not verified identities.',
  'Counts are source-record counts. Overlapping exports or representations are retained and are not assumed to be distinct real-world communications or transactions.',
  'Financial totals use integer decimal arithmetic and are separated by currency. Gross transfer volume is not unique money; unknown currency remains UNKNOWN.',
  'Private Ask Detective conversations, theories and notes are excluded. No database credentials or wallet are packaged.',
  'Board is a selected overview (up to five people, four photos and three threads). Complete parsed messages, CSV records and original evidence remain accessible.',
  'This is a versioned snapshot. Newly supplied evidence requires another run. Generated content is untrusted until analyst review.'
 ];
 const people=normal.people;
 const threads=normal.threads.map((t,i)=>({id:'thread-'+(i+1),originalId:t.id,title:t.title,summary:normal.messages.filter(m=>m.threadId===t.id).length+' source messages. Membership only; not proof of contact beyond the supplied transcript.',participants:t.participants,sourceRefs:[sourceLabel(t.source)]}));
 const roomMessages=normal.messages.map(m=>{
  const block=m.section?.time;
  return {id:m.id,conversation:threads.find(t=>t.originalId===m.threadId).id,sender:m.sender,text:m.text,
   timeLabel:m.time.original||block?.original||'Not recorded',
   timeBasis:m.time.original?'Source message timestamp; '+m.time.zone:block?'Conversation-section timestamp only; individual send time is not recorded.':'No individual message timestamp supplied.',
   source:sourceLabel(m.source)};
 });
 const photos=authored.images.map(p=>({path:p.path,title:p.title,note:'AI visual observation: '+p.observation+' Limitation: '+p.limitation+' No person identity established.'}));
 const overview=authored.overview.map(o=>'<article class="source-note"><p>'+E(o.text)+'</p><small>'+E(refs(o.factIds).join(' · '))+'</small></article>').join('');
 const questions=authored.questions.map(o=>'<article class="source-note"><h3>'+E(o.text)+'</h3><small>'+E(refs(o.factIds).join(' · '))+'</small></article>').join('');
 const allPeople=people.map(p=>'<article class="source-note">'+button('person',p.id,p.name)+'</article>').join('');
 const flows=normal.money.map(m=>'<article class="source-note"><h3>'+E(m.currency)+' · '+E(m.grossVolume)+' gross volume</h3><p>'+m.transferCount+' transfers; '+m.accountCount+' accounts. Not unique funds.</p>'+
  m.pairs.map(p=>'<p>'+E(p.from)+' → '+E(p.to)+' · '+E(p.amount)+' '+E(m.currency)+' ('+p.transferIds.length+' source rows)</p>').join('')+'</article>').join('');
 const records=normal.records.map(r=>button('record',r.id,r.title)).join(' ');
 const panels=[{id:'case-overview',label:'Case overview',title:'Case context & investigative questions',intro:'Source-linked AI draft. Read the original before relying on a conclusion.',html:overview+questions},
  {id:'people-register',label:'People register',title:'Names recorded in the evidence',intro:'All extracted explicit source names; catalogue portraits, where available, are reference metadata.',html:allPeople||'<p>No supported source names extracted.</p>'},
  {id:'analysis',label:normal.money.length?'Financial flows':'Evidence patterns',title:normal.money.length?'Recorded financial movements':'Evidence coverage & follow-up',intro:normal.money.length?'Exact decimal totals by source currency. Repeated movement can count the same funds more than once.':'No supported financial records were supplied. This wall shows evidence coverage, not invented transactions.',html:flows||overview},
  ...(normal.records.length?[{id:'record-index',label:'Source records',title:'Complete CSV record index',intro:'Every parsed row is included. Original files are available in Sources.',html:'<div class="all-records">'+records+'</div>'}]:[])];
 const comparisons=snapshot.associations?.photoComparisons||[];
 const preferredPeople=new Set(comparisons.flatMap(s=>s.candidates.filter(c=>c.rank===1||c.decision==='accepted_demo').map(c=>c.personRef)));
 const selectedPeople=[...people].sort((a,b)=>(Number(!!b.scenarioLinks?.length)*4+Number(preferredPeople.has(b.personRef))*2+Number(!!b.portrait))-(Number(!!a.scenarioLinks?.length)*4+Number(preferredPeople.has(a.personRef))*2+Number(!!a.portrait))).slice(0,5);
 const selectedPhotos=[...photos].sort((a,b)=>Number(comparisons.some(s=>s.path===b.path))-Number(comparisons.some(s=>s.path===a.path))).slice(0,4);
 const board={people:selectedPeople.map(p=>p.id),photos:selectedPhotos.map(p=>p.path),conversations:threads.slice(0,3).map(t=>t.id),links:[]};
 for(const t of threads.slice(0,3))for(const p of selectedPeople)if([p.name,p.catalogueName,...(p.handles||[]),...(p.sourceNames||[])].some(name=>t.participants.includes(name)))board.links.push({from:'person:'+p.id,to:'conversation:'+t.id,color:'blue',label:(p.handles?.some(h=>t.participants.includes(h))?'Declared fictional handle plus original conversation membership in ':'Explicit conversation membership in ')+t.sourceRefs.join(', ')});
 for(const p of selectedPhotos)board.links.push({from:'photo:'+p.path,to:'source:images',color:'gold',label:'Original archive image · '+p.path+'; not a person-identification link'});
 for(const comparison of comparisons){
  if(!board.photos.includes(comparison.path))continue;
  for(const candidate of comparison.candidates.filter(c=>c.rank===1||c.decision==='accepted_demo')){
   const person=selectedPeople.find(p=>p.personRef===candidate.personRef);if(!person)continue;
   board.links.push({from:'person:'+person.id,to:'photo:'+comparison.path,color:candidate.decision==='accepted_demo'?'blue':'red',label:(candidate.decision==='accepted_demo'?'Accepted fictional-demo comparison':'Pending visual similarity candidate')+'; '+candidate.displayName+'; cosine '+Number(candidate.score).toFixed(4)+'; search '+comparison.searchId+'; no verified identity claim'});
  }
 }
 const links=snapshot.associations?.links||[];
 if(links.length||comparisons.length){
  const rows=links.map(link=>{const person=people.find(p=>p.personRef===link.personRef);return '<article class="source-note"><h3>'+E(link.handle)+' → '+E(link.displayName)+'</h3><p>Declared fictional scenario link. '+E(link.reason)+'</p>'+(person?button('person',person.id,'Open '+link.displayName):'')+'</article>';}).join('');
  const comparisonRows=comparisons.map(search=>'<article class="source-note"><h3>'+E(search.path)+'</h3><p>Saved source region: '+E(JSON.stringify(search.region))+'. Search '+E(search.searchId)+'.</p>'+button('photo',search.path,'Open source photograph')+search.candidates.map(candidate=>'<p>'+E(candidate.displayName)+' · cosine '+Number(candidate.score).toFixed(4)+' · '+E(candidate.decision==='accepted_demo'?'accepted for fictional demo':candidate.decision||'pending')+(candidate.reason?' · '+E(candidate.reason):'')+'</p>').join('')+'</article>').join('');
  panels.push({id:'person-links',label:'Person links',title:'Handles, portraits and photo comparisons',intro:'Declared fictional handle links and saved visual candidates have separate source bases. Review candidates in People & Photos before treating them as accepted demo links.',html:rows+comparisonRows});
  notes.push('Handle links are explicit fictional scenario annotations. Saved photo comparisons retain scores and review decisions; pending candidates are not accepted identities.');
 }
 const room={...common,notes,people,photos,conversations:threads.map(({originalId,...t})=>t),messages:roomMessages,records:normal.records,panels,board,evidence_dir:path.join(directory,'evidence'),header_file:path.join(directory,'header.json'),
  leftWall:{view:'analysis',title:normal.money.length?'Financial patterns':'Evidence patterns',subtitle:normal.money.length?'SOURCE-RECORDED MOVEMENTS':'COMPLETE BATCH SNAPSHOT',
   html:normal.money.length?normal.money.map(m=>'<p>'+E(m.currency)+' '+E(m.grossVolume)+'<br>'+m.transferCount+' transfers</p>').join(''):'<p>'+snapshot.files.length+' source files<br>'+roomMessages.length+' messages<br>'+photos.length+' photographs</p>',
   footnote:normal.money.length?'Gross volume, not unique money':'No financial flows inferred'},
  briefing:{directory:briefingDir,batch_id:job.batchId,durationLabel:'2–4 minute case briefing'}};
 const localImage=p=>'file://'+path.join(directory,'evidence/source',p).split('/').map(encodeURIComponent).join('/');
 const pic=(p)=>'<div class="paper"><img style="height:360px;object-fit:contain;background:#25302b" src="'+E(localImage(p.path))+'"><p>'+E(p.title)+'</p></div>';
 const cards=items=>'<div class="columns">'+items.map(text=>'<div class="card"><p>'+E(text)+'</p></div>').join('')+'</div>';
 const sceneHTML={
  welcome:'<div class="columns"><div><div class="kicker">Case context</div><h1>'+E(common.title)+'</h1><p class="muted">'+E(common.focus)+'</p></div>'+(photos[0]?pic(photos[0]):'<div class="card"><h3>Evidence-led briefing</h3><p>Source-linked case review · synthetic training</p></div>')+'</div>',
  evidence:'<div class="metrics">'+[['SOURCE FILES',snapshot.files.length],['MESSAGES',roomMessages.length],['PHOTOGRAPHS',photos.length],['CSV RECORDS',normal.records.length]].map(([label,value])=>'<div class="card"><div class="number">'+value+'</div><p>'+label+'</p></div>').join('')+'</div><p class="footnote">Original archive and complete inventory verified by SHA-256. Interpretations still require analyst review.</p>',
  people:'<div class="four">'+selectedPeople.slice(0,4).map(p=>'<div class="paper">'+(p.portrait?'<img style="height:285px" src="'+E('file://'+p.portrait.path.split('/').map(encodeURIComponent).join('/'))+'">':'<div style="height:180px;padding:35px;font-size:45px">SOURCE NAME</div>')+'<h3>'+E(p.name)+'</h3><p>Source name / catalogue reference. Not facial identification.</p></div>').join('')+'</div><p class="footnote">'+people.length+' source names in the full room. Selected overview shown.</p>',
  scenes:photos.length?'<div class="columns">'+photos.slice(0,2).map(pic).join('')+'</div><p class="footnote">Visible scenes are not proof of identity or criminal activity.</p>':cards(['No photographic evidence supplied.','Original source register remains available.']),
  money:normal.money.length?cards(normal.money.slice(0,2).map(m=>m.currency+' '+m.grossVolume+' · gross transfer volume across '+m.transferCount+' records. Not unique funds.')):cards(['No supported financial records supplied.','No money flow, amount or currency has been invented.']),
  timeline:cards(['Source message times are preserved, including explicitly recorded timezone offsets.','A proposed meeting is not a confirmed meeting. Photograph filenames do not establish capture time.']),
  messages:cards(threads.slice(0,2).map(t=>t.title+' — '+normal.messages.filter(m=>m.threadId===t.originalId).length+' source messages. Membership does not establish individual recipients.')),
  questions:cards(authored.questions.slice(0,2).map(q=>q.text)),
  close:cards(['Return to the original sources. Test alternative explanations.','AI draft — review all claims, associations and unresolved questions.'])
 };
 const video={...common,evidenceNotes:notes,scenes:authored.scenes.map((s,i)=>({...s,hero:s.id==='welcome',chapter:String(i+1).padStart(2,'0'),source:[...refs(s.factIds),...(s.directSourceRefs||[]).map(a=>a.path+' · chars '+a.start+'–'+(a.start+a.quote.length))].join(' · ')||(s.id==='scenes'?photos.map(p=>p.path).join(' · '):'Verified batch inventory / analytical limits'),displaySource:[...new Set([...(s.directSourceRefs||[]).map(a=>a.path),...s.factIds.map(id=>byFact(id).path)])].slice(0,2).join(' · ')+' · Detailed source locators in transcript',html:sceneHTML[s.id]}))};
 return {room,video};
}
function addNamedPeople(normal,authored){
 for(const p of authored.people){
  let existing=normal.people.find(n=>n.name===p.name);
  const ref=p.source+' · chars '+p.start+'–'+(p.start+p.quote.length);
  if(existing){if(!existing.sourceRefs.includes(ref))existing.sourceRefs.push(ref);}
  else normal.people.push({id:short(p.name),name:p.name,detail:'Explicit name in the supplied case text. Role is unverified; read the source context.',sourceRefs:[ref]});
 }
 if(normal.people.length>40)throw Error('More than 40 explicit names; split the batch.');
}
module.exports={compose,portraits,addNamedPeople,E};
