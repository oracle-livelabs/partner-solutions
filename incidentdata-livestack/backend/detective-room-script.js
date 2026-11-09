'use strict';
// Human-authored spoken structure + this batch's validated model analysis.
// No frozen case narrative, invented connective events or arbitrary word padding.
const count=s=>s.trim().split(/\s+/).length;
function spoken(n){
 const small=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
 if(n<20)return small[n];if(n<100)return ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'][Math.floor(n/10)]+(n%10?' '+small[n%10]:'');
 return small[Math.floor(n/100)]+' hundred'+(n%100?' and '+spoken(n%100):'');
}
function briefSentence(text,max=30){
 const first=String(text||'').match(/^[^.!?]+[.!?]/)?.[0];
 return first&&count(first)<=max?first:'';
}
function buildScript(normal,files,analysis){
 const names=normal.people.slice(0,5).map(p=>p.name);
 for(const p of analysis.people)if(names.length<5&&!names.includes(p.name))names.push(p.name);
 const list=names.length>1?names.slice(0,-1).join(', ')+', and '+names.at(-1):names[0]||'no individually named participants';
 const messageFact=analysis.facts.find(f=>normal.messages.some(m=>m.source.path===f.path));
 const messageLine=briefSentence(messageFact?.text,32);
 const question=analysis.questions.find(q=>count(q.text)<=25);
 const photoLine=briefSentence(analysis.images[0]?.observation,26);
 const sourceIds=analysis.facts.map(f=>f.id);
 const contextIds=analysis.overview[0]?.factIds||sourceIds.slice(0,1);
 const framingSource=normal.texts.find(t=>/(?:^|\/)narrative\.txt$/i.test(t.path));
 const framing=briefSentence(framingSource?.text,45);
 const scenes=[
  {id:'welcome',title:analysis.title,factIds:contextIds,narration:'Welcome. This is a synthetic training case. '+analysis.subtitle.replace(/[.!?]$/,'')+'. That is the case framing, not a finding of guilt. We will move through the source material, the recorded conversations, and the questions that still need answers. Keep three distinctions in mind: what a source actually says, what it might mean, and what has not been established.'},
  {id:'evidence',title:'Start with the sources',factIds:[],narration:'First, the evidence base. This batch contains '+spoken(files.length)+' original files. The archive and its registered contents have been checked against their stored checksums. Those checks establish file integrity, not the truth of every statement inside. You can open the originals from the room. Private detective conversations and analyst notes have not been added to this package.'},
  {id:'people',title:'Names and reference portraits',factIds:sourceIds.slice(0,3),narration:'The source names shown in this overview are '+list+'. Read each name in its original context. Conversation membership does not, by itself, establish a criminal relationship. Where catalogue portraits are available, they are reference images linked through explicit metadata. They are not the result of identifying a face in a scene photograph.'},
  {id:'scenes',title:normal.photos.length?'Look carefully at the scenes':'Scope and missing imagery',factIds:[],narration:normal.photos.length?
   'Now, the visual material. There are '+spoken(normal.photos.length)+' source photographs in the gallery. '+(photoLine?'One unverified visual description reads: '+photoLine+' ':'')+'Look at what is actually visible, and separate that from the narrative around it. A familiar setting, a shared table, or an ordinary interaction is not proof of wrongdoing. The original images remain available for closer review.':
   'No source photographs were supplied in this batch. The room therefore relies on its documents and records. We have not invented scene images to fill that gap. Where the source material leaves an identity, location, or sequence uncertain, keep that uncertainty visible. The source register is the place to check what was actually provided.'},
  {id:normal.money.length?'money':'timeline',title:normal.money.length?'Follow recorded movements':'Read the chronology carefully',factIds:[],narration:normal.money.length?
   'On the financial wall, the figures come from '+spoken(normal.transfers.length)+' parsed source records. Totals are calculated directly, with currencies kept separate. Follow the arrows back to the underlying rows. Gross transfer volume is not the same as unique funds: money can appear again as it moves onward. A missing currency is left unknown, and a pattern alone does not establish an offence.':
   'Turn next to chronology. The room preserves the times supplied with individual messages and distinguishes them from conversation block times. A suggestion to meet is not confirmation that a meeting happened. Nor should a photograph inherit a date from a nearby message. No financial records were recognised in this batch, so the room does not invent a money trail.'},
  {id:'messages',title:'What the messages record',factIds:messageFact?[messageFact.id]:[],narration:normal.messages.length?
   'The messaging wall contains '+spoken(normal.messages.length)+' source messages across '+spoken(normal.threads.length)+' conversations. '+(messageLine?'The source-linked analysis notes: '+messageLine+' ':'')+'Open the full exchange before interpreting a phrase. Check the sender, the surrounding discussion, and the stated time. Participation is not a read receipt, and a proposed arrangement is not evidence that it took place.':
   'No supported structured conversation extract was found in this batch. That is a coverage limit, not a conclusion that no communication occurred. Any unstructured text remains accessible with the original files. The room does not manufacture messages or relationships to complete a diagram. Follow up with the source provider if a fuller communication record is expected.'},
  {id:'questions',title:'Test the interpretation',factIds:question?.factIds||contextIds,narration:'What should the team test next? '+(question?question.text+' ':'')+'Treat that as a line of enquiry, not an established event. Look for independent support, and actively consider an ordinary explanation. If two sources seem to agree, check whether they are genuinely independent. Repeated copies of one account do not make it stronger evidence.'},
  {id:'close',title:'Return to the originals',factIds:[],narration:'Finally, use this room as a starting point for review. The briefing is an artificial intelligence draft, not a completed investigation. The most useful next step is to inspect the cited sources and identify what would confirm, weaken, or change the working explanation. Keep uncertainty visible. Any conclusion still needs careful analyst verification.'}
 ];
 if(framing){
  scenes[0].narration=scenes[0].narration.replace('That is the case framing,','The supplied narrative says: '+framing+' That is the case framing,');
  scenes[0].directSourceRefs=[{path:framingSource.path,start:framingSource.text.indexOf(framing),quote:framing}];
 }
 const total=()=>scenes.reduce((n,s)=>n+count(s.narration),0);
 for(const [i,excerpt] of [[5,messageLine?'The source-linked analysis notes: '+messageLine+' ':''],[3,photoLine?'One unverified visual description reads: '+photoLine+' ':''],[6,question?question.text+' ':'']]){
  if(total()>510&&excerpt)scenes[i].narration=scenes[i].narration.replace(excerpt,'');
 }
 const additions=[
  [0,'The purpose is to orient the team quickly, while keeping the distinction between suspicion and evidence clear.'],
  [1,'Source links and checksums are retained so another reviewer can follow the same trail without relying on this summary.'],
  [4,'Where timing is incomplete, preserve the gap rather than filling it with an assumption about sequence or intent.'],
  [6,'An unresolved contradiction can be more useful than a neat story, particularly when it points to a specific record worth checking.'],
  [7,'The full room contains the supporting material, so the next discussion can begin with the evidence in view.']
 ];
 for(const [index,text] of additions){if(total()>=450)break;if(total()+count(text)<=510)scenes[index].narration+=' '+text;}
 if(total()<450||total()>510)throw Error('Controlled briefing script outside its production word budget: '+total());
 return scenes;
}
module.exports={buildScript,spoken,briefSentence};
