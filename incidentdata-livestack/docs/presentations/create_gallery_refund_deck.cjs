'use strict';
const fs=require('node:fs'),path=require('node:path');
const PptxGenJS=require('/tmp/gallery-agent-deck/node_modules/pptxgenjs');
const pptx=new PptxGenJS();
pptx.layout='LAYOUT_WIDE';pptx.author='IncidentData LiveStack';pptx.subject='A proposed synthetic story for explaining native AI agents';pptx.title='The Gallery Refund Puzzle — Making the Agent Framework Visible';pptx.company='IncidentData LiveStack';pptx.lang='en-AU';
pptx.theme={headFontFace:'Arial',bodyFontFace:'Arial',lang:'en-AU'};
const S=pptx.ShapeType,W=13.333333,H=7.5,C={paper:'F5F3EE',white:'FFFFFF',ink:'203B45',muted:'587078',teal:'236E69',mint:'EAF4EF',line:'CAD7D2',red:'B44C3A',amber:'AB6B24',sand:'FAEEDB',pale:'EDF1F2'};
const slides=[];let slide,preview;
function box(x,y,w,h,fill=C.white,line=C.line,r=.12){slide.addShape(r?S.roundRect:S.rect,{x,y,w,h,rectRadius:r,fill:{color:fill},line:{color:line,width:1},radius:r});preview.push({kind:'box',x,y,w,h,fill,line,r});}
function text(value,x,y,w,h,size=20,color=C.ink,bold=false,opts={}){slide.addText(value,{x,y,w,h,fontFace:'Arial',fontSize:size,color,bold,margin:0,breakLine:false,valign:'top',fit:'shrink',...opts});preview.push({kind:'text',value,x,y,w,h,size,color,bold,...opts});}
function line(x,y,w,color=C.line){slide.addShape(S.line,{x,y,w,h:0,line:{color,width:1}});preview.push({kind:'line',x,y,w,color});}
function pill(value,x,y,w,fill=C.mint,color=C.teal){box(x,y,w,.32,fill,fill,.12);text(value,x+.1,y+.065,w-.2,.19,9,color,true,{align:'center'});}
function start(title,sub,kicker='THE GALLERY REFUND PUZZLE',status='PROPOSED STORY'){
 slide=pptx.addSlide();slide.background={color:C.paper};preview=[];slides.push({title,elements:preview});
 text('INCIDENTDATA LIVESTACK',.55,.3,5,.22,10,C.red,true);text(kicker,.55,.65,11,.22,10,C.teal,true);
 text(title,.55,1.03,12.15,.65,30,C.ink,true);if(sub)text(sub,.55,1.75,12.05,.55,16,C.muted);
 pill(status,10.65,.28,2.12,status==='PROPOSED STORY'?C.sand:C.mint,status==='PROPOSED STORY'?C.amber:C.teal);
 line(.55,6.99,12.2);text('Synthetic training story • Proposed scenario, not yet loaded into LiveStack',.55,7.1,11.2,.18,9,C.muted);text(String(slides.length).padStart(2,'0'),12.2,7.08,.55,.22,10,C.muted,true,{align:'right'});
}
function card(x,y,w,h,label,title,body,fill=C.white,accent=C.teal){box(x,y,w,h,fill);text(label.toUpperCase(),x+.2,y+.2,w-.4,.25,10,accent,true);text(title,x+.2,y+.62,w-.4,.72,21,C.ink,true);text(body,x+.2,y+1.45,w-.4,h-1.62,17,C.muted);}
function band(value,x,y,w,h= .75,fill=C.mint,color=C.teal,size=20){box(x,y,w,h,fill,fill,.08);text(value,x+.2,y+.17,w-.4,h-.22,size,color,true);}
function notes(value){slide.addNotes(value);}

// 1 — Title and audience promise.
start('Has the gallery paid twice?','A simple story for explaining tools, reflection and conversational memory.','MAKING THE AI AGENT FRAMEWORK VISIBLE');
text('One invoice reference.\nThree documents.\nOne unanswered question.',.65,2.6,6.7,2.2,34,C.ink,true);
box(8.45,2.4,3.65,3.6,C.white);pill('FICTIONAL CASE',8.75,2.73,2.98);text('INV-204',8.8,3.48,2.95,.62,34,C.teal,true);line(8.8,4.38,2.9);text('Invoice\nRefund request\nChanged bank instructions',8.8,4.68,2.9,1.15,17,C.muted);
text('A 10-minute colleague walkthrough\nIncludes presenter notes and two follow-up prompts.',.65,5.55,6.9,.7,17,C.muted);
notes('Purpose: explain why an agent framework can be compelling using a memorable case, rather than asking colleagues to track many counts. This is a proposed fictional scenario: the documents and supporting-records tool have not yet been added. The native Oracle agent framework already works in LiveStack. Use this deck as an illustrated explanation, not a claim that this particular scenario is live. Ask the audience to hold one question in mind: has the gallery paid twice? Suggested duration: 10 minutes, plus discussion.');

// 2 — The source trail.
start('A story the audience can hold in mind','Keep the case small enough that everyone can follow the source trail.');
card(.55,2.45,3.93,3.15,'Source S01','Exhibition invoice','The gallery’s exhibition invoice is identified by INV-204.');
card(4.7,2.45,3.93,3.15,'Source S02','Refund request','A customer requests a refund against the same invoice: INV-204.');
card(8.85,2.45,3.93,3.15,'Source S03','Follow-up email','The email changes the requested refund bank details.');
band('Missing from the supplied set: payment confirmation',.55,5.93,12.23,.72,C.sand,C.amber,21);
notes('Introduce each document slowly. Source S01 is an invoice, S02 is a refund request, and S03 is a follow-up email changing the requested bank details. All carry or refer to the same invoice context. These are proposed synthetic records with no real bank account details or real people. The important missing item is a confirmation that a refund payment actually happened. Repeated requests and unusual instructions can be interesting, but they do not establish a duplicate payment.');

// 3 — The question and boundary.
start('What can we establish?','The central distinction is a request for payment versus evidence of payment.');
card(.55,2.45,5.97,3.32,'Recorded in the supplied documents','The records connect','A shared invoice reference.\nA request for a refund.\nA change to requested bank instructions.',C.mint);
card(6.8,2.45,5.97,3.32,'Not established by this document set','Did money move?','We have no supplied confirmation that a refund was paid.\n\nA duplicate payment is not established.',C.sand,C.amber);
text('A missing confirmation is a gap in this record set. It does not prove that no payment occurred.',.7,6.1,11.95,.65,18,C.muted);
notes('Ask the room: which statement can these records support? The records support a relationship between the invoice and refund request. They do not establish that the refund was paid, or that a duplicate payment occurred. A missing document in the supplied case is not proof that the event did not happen elsewhere. This is a useful educational moment: a plausible concern and an evidenced conclusion are different.');

// 4 — First interaction.
start('Interaction 1: explain the records','The agent retrieves supporting sources and writes a bounded answer.');
pill('QUESTION 1',.65,2.4,1.65);text('“What do these records tell us about the gallery refund?”',.7,3.0,5.75,1.65,27,C.ink,true);
box(6.85,2.4,5.92,3.72,C.white);text('ILLUSTRATIVE RESPONSE',7.1,2.67,5.35,.25,11,C.teal,true);text('The invoice, refund request and bank-change email refer to the same transaction.\n\nThe supplied records do not establish whether the refund was paid.',7.1,3.26,5.35,2.55,21,C.ink);
text('Presenter cue: ask the audience which sentence needs a source.',.7,6.35,11.95,.35,17,C.muted);
notes('This is an example of the kind of response the proposed scenario should produce; it is not a captured live model result. The new supporting-records tool would retrieve small, identifiable excerpts and explicit source references. The existing aggregate tools could still supply overall counts and coverage. The key question for colleagues is: which source supports each sentence, and which sentence explains a limitation? A useful answer must remain supported by the retrieved material.');

// 5 — Framework architecture.
start('What happens inside the framework?','One registered investigator agent uses permitted tools and receives their results.');
const nodes=[['1','Question + case','Selected identity and conversation reference'],['2','Oracle agent team','RUN_TEAM starts the\nregistered task'],['3','Permitted tools','Fixed PL/SQL reads return structured facts'],['4','Review brief','The model explains\nfacts and gaps']];
nodes.forEach((n,i)=>{const x=.55+i*3.12;box(x,2.68,2.87,2.48,i===2?C.mint:C.white);pill(n[0],x+.18,2.88,.48);text(n[1],x+.18,3.48,2.51,.7,19,C.ink,true);text(n[2],x+.18,4.25,2.5,.84,15,C.muted);if(i<3)text('→',x+2.88,3.58,.24,.5,21,C.teal,true,{align:'center'});});
band('Proposed addition: a supporting-records tool that returns excerpts and source references.',.55,5.57,12.23,.93,C.sand,C.amber,19);
notes('The current implementation is one investigator agent with one task and five registered read-only PL/SQL tools. Oracle DBMS_CLOUD_AI_AGENT.RUN_TEAM manages the native model and tool exchanges. The current five tools primarily provide definitions and aggregate coverage. The proposed addition is a source-reading tool to retrieve the document details needed for this story. Secured database views supply the facts; the model orchestrates retrieval and explains the result. This path does not currently perform vector similarity search. The stage ticks in the interface are capability labels; actual tool use is verified from Oracle execution history.');

// 6 — Source-grounded reasoning.
start('Make the source behind a statement visible','A colleague should be able to inspect why the answer says what it says.');
const srcs=[['S01 · INVOICE','“Invoice INV-204 — Exhibition booking.”'],['S02 · REFUND REQUEST','“Please arrange a refund against invoice INV-204.”'],['S03 · FOLLOW-UP EMAIL','“For this refund, use the replacement bank instructions.”']];
srcs.forEach((n,i)=>{const y=2.4+i*1.12;box(.55,y,7.63,.96,C.white);text(n[0],.75,y+.14,7.2,.19,10,C.teal,true);text(n[1],.75,y+.44,7.2,.36,18,C.ink);});
box(8.45,2.4,4.33,3.44,C.mint);text('SUPPORTED STATEMENT',8.68,2.66,3.85,.23,11,C.teal,true);text('The documents refer to the same invoice.\n\nThey do not confirm payment.',8.68,3.23,3.85,2.25,21,C.ink,true);
text('All excerpts on this slide are illustrative synthetic content.',.7,6.15,11.95,.4,16,C.muted);
notes('These document excerpts are invented for the teaching design. Point to INV-204 in S01 and S02: the connection is explicit and easy to remember. S03 adds a change of requested bank instructions. None of these excerpts is a payment confirmation. The agent should cite sources when describing what they contain, and state the limit when the supplied sources cannot answer the payment question. The source excerpt tool and user-facing citations are proposed additions; the existing five tools return aggregate information.');

// 7 — Reflection.
start('Reflection gives the gap a clear meaning','A useful agent can identify the boundary of its answer.');
card(.55,2.45,3.93,3.48,'Known','A linked request','The invoice and refund request share INV-204.\n\nThe bank-change email adds context.',C.white);
card(4.7,2.45,3.93,3.48,'Missing','Payment confirmation','The supplied case does not show whether the refund was paid.',C.sand,C.amber);
card(8.85,2.45,3.93,3.48,'Conclusion','Duplicate payment unproven','Explain the uncertainty. Avoid turning a suspicious-looking sequence into an established finding.',C.mint);
text('Presenter cue: “What would we need before changing that conclusion?”',.7,6.3,11.95,.35,18,C.muted);
notes('Reflection in this framework is an instruction to the model to assess coverage and state gaps. It is not an independent adjudication or a separate verified reasoning engine. The demonstration should make the missing item tangible: payment confirmation. The correct teaching conclusion is that duplicate payment is not established from the supplied set. Ask colleagues what new information might change the conclusion. Keep the discussion on evidence coverage and source support rather than implying wrongdoing by a person.');

// 8 — First follow-up.
start('Interaction 2: remember the gap','A follow-up can use the case context without repeating the invoice or story.');
pill('SAME CASE · FOLLOW-UP 1',.65,2.4,3.03);text('“What is the most important thing we still don’t know, and which supplied records explain that gap?”',.7,3.05,6.05,2.3,24,C.ink,true);
box(7.08,2.4,5.7,3.7,C.white);text('ILLUSTRATIVE RESPONSE',7.33,2.68,5.15,.25,11,C.teal,true);text('Whether the refund was actually paid.\n\nThe supplied records contain a request and changed instructions, but no payment confirmation.',7.33,3.25,5.15,2.55,21,C.ink);
band('Keep the same conversation ID; tools can be rechecked while case context is retained.',.55,6.2,12.23,.62,C.mint,C.teal,16);
notes('This is the first of two additional prompts after the initial question. Do not repeat INV-204, the pattern name or the scenario description. Keep the same case and conversation ID, and do not press Start new case memory. The agent should understand what “we still don’t know” refers to. It may retrieve sources again: conversational continuity does not require avoiding tool calls. The displayed answer here is illustrative. A convincing demonstration checks the conversation reference and, where needed, recorded execution history rather than relying only on a memory tick.');

// 9 — Second follow-up.
start('Interaction 3: turn the discussion into a handover','Carry the supported findings into a useful, concise form.');
pill('SAME CASE · FOLLOW-UP 2',.65,2.4,3.03);text('“Using the same case and the gap we just discussed, write a three-sentence handover for the gallery manager. Separate recorded facts from what remains unknown.”',.7,3.02,5.93,2.85,23,C.ink,true);
box(6.95,2.4,5.83,3.9,C.mint);text('ILLUSTRATIVE HANDOVER',7.2,2.68,5.3,.25,11,C.teal,true);text('The supplied documents link invoice INV-204 to a refund request and changed bank instructions.\n\nThey do not confirm whether a refund payment occurred.\n\nA duplicate payment is therefore not established from this record set.',7.2,3.2,5.3,2.95,20,C.ink);
notes('This is the second additional prompt. Again, the prompt does not repeat the invoice number or source details. The agent must carry forward the subject and the identified gap, then change the form of its response for a colleague. Read the three-sentence handover aloud. Notice that it names the case context, states what the records establish, and states what remains unknown. This is a proposed example response, not an actual saved model output. The current application replaces the previous visible answer, so a retained conversation timeline would make the sequence easier for an audience to follow.');

// 10 — New evidence extension.
start('A new source can change the answer','Optional extension: show an answer developing with the supplied evidence.','FOLLOW-ON DEMONSTRATION','FUTURE EXTENSION');
card(.55,2.45,4.45,3.52,'New synthetic source S04','Payment confirmation','A confirmation records one refund payment against INV-204.',C.white);
text('→',5.2,3.65,.55,.65,34,C.teal,true,{align:'center'});
box(6.02,2.45,6.75,3.52,C.mint);text('UPDATED SUPPORTED CONCLUSION',6.27,2.73,6.2,.25,11,C.teal,true);text('One refund payment is now supported by a supplied confirmation.\n\nA duplicate payment is still not established.',6.27,3.38,6.2,2.35,24,C.ink,true);
text('Prompt: “What does this new document change, and what does it leave unresolved?”',.7,6.3,12,.4,18,C.muted);
notes('This is a future extension requiring a way to add and retrieve a new source in the teaching case. Do not imply that the feature or this record is already loaded. Add a single clearly labelled synthetic payment confirmation. That supports the existence of one payment; it does not prove a duplicate, nor prove no other payment exists. Ask the agent to state exactly what changed in its conclusion and what is still unresolved. This is a useful demonstration of updating an answer based on new information, rather than merely repeating a previous response.');

// 11 — Readiness.
start('What works today, and what we would add','The native framework is running. This particular story is a proposed teaching extension.','DELIVERY STATUS','CURRENT + PROPOSED');
card(.55,2.45,5.97,3.92,'Working in LiveStack','Native agent foundation','One investigator agent and five tools.\nCity-aware watched-pattern tiles.\nCase conversation and follow-ups.\nOracle execution history and AI Ops.\nStructured, readable answers.',C.mint);
card(6.8,2.45,5.97,3.92,'Proposed additions','Make the story demonstrable','Small synthetic document set.\nSupporting-records excerpt tool.\nVisible source references in answers.\nRetained conversation timeline.\nLater: add a new source and revisit.',C.sand,C.amber);
notes('Be precise about readiness. The native Oracle agent framework, five aggregate tools, dynamic watch tiles, case conversations, audit history, AI Ops instrumentation and formatted answers are working. The Gallery Refund Puzzle records have not been created. The existing tools do not expose the document-level excerpts needed to tell this story. We propose a small source-reading tool and source references in the answer. A conversation timeline is a presentation improvement to make the memory demonstration legible; it is not required for the existing conversation mechanism to operate. No claim is made here that this story has been deployed.');

// 12 — Close and discussion.
start('A demo colleagues can explain back','The story makes the framework visible through a sequence of understandable questions.');
const steps=[['Ask','Has the gallery paid twice?'],['Inspect','Which source\nsupports that?'],['Reflect','What can’t\nwe establish?'],['Continue','What do we\nstill not know?'],['Share','Explain it to a colleague.']];
steps.forEach((n,i)=>{const x=.55+i*2.49;box(x,2.65,2.28,2.1,i===2?C.sand:C.white);text(n[0],x+.18,2.92,1.92,.4,22,i===2?C.amber:C.teal,true);text(n[1],x+.18,3.66,1.92,1,18,C.ink);});
band('The answer is useful when colleagues can follow its sources, its limits and its continuity.',.55,5.25,12.23,1.04,C.mint,C.teal,23);
notes('Close by asking colleagues to explain the story back in their own words. They should be able to identify the central question, the missing payment confirmation, and the purpose of the two follow-ups. The demonstration is compelling because it gives each capability an observable job: tools retrieve sources, reasoning connects explicit references, reflection identifies limits, and memory carries case context into later requests. Discuss whether this would be a useful small teaching scenario to build next. There is no need to request approval through the presentation itself; this is an explanatory design deck.');

// 13 — Technical appendix.
start('Appendix: map the story to CRIME_DATA','The supporting-records function is the proposed extension; its final name and contract remain to be designed.','TECHNICAL REFERENCE','TECHNICAL APPENDIX');
const rows=[['Oracle-supplied runtime','DBMS_CLOUD_AI_AGENT.RUN_TEAM'],['Registered team','CRIMEDATA_PATTERN_INVESTIGATION_TEAM'],['Investigator','CRIMEDATA_PATTERN_INVESTIGATOR'],['Task','CRIMEDATA_PATTERN_INVESTIGATION_TASK'],['Model profile','CRIMEDATA_SELECT_AI_V2']];
rows.forEach((r,i)=>{const y=2.4+i*.52;box(.55,y,12.23,.45,i%2?C.paper:C.white,C.paper,0);text(r[0],.74,y+.1,3.02,.26,13,C.muted,true);text(r[1],3.93,y+.1,8.55,.27,14,C.ink,true);});
box(.55,5.3,12.23,1.25,C.mint);text('Existing tool roles',.76,5.47,2.18,.3,15,C.teal,true);text('Pattern brief · Pattern links · Area/time · Evidence/report coverage · Readiness',3.13,5.47,9.35,.38,16,C.ink);text('Inspect actual activity in USER_AI_AGENT_TEAM_HISTORY, USER_AI_AGENT_TASK_HISTORY and USER_AI_AGENT_TOOL_HISTORY.',.76,6.01,11.8,.28,12,C.muted);
notes('Current schema map verified from the implemented LiveStack foundation. The team contains one registered investigator and one task. Five tools map to standalone CRIME_DATA.CRIMEDATA_AGENT_* read-only functions over secured views. The model profile currently references OCI Llama 4 Maverick in us-chicago-1. DBMS_CLOUD_AI creates case conversations; DBMS_SESSION.SET_IDENTIFIER supplies the demonstration identity. Oracle history views expose schema-level execution records; application conversation ownership is enforced separately. The application also saves exchanges in ANALYST_ACTIONS and telemetry in AI_OPS_EVENTS. No vector search is performed by these five native tools. The new supporting-records function is a proposal; no new object has been created. Implementation references: scripts/setup_select_ai_agent_v2.js, backend/agent-console-routes.js, frontend/src/agent-framework-internals.mjs.');

const out=path.join(__dirname,'Gallery_Refund_Puzzle_Agent_Framework.pptx');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const px=n=>(n*96).toFixed(2)+'px';
let html='<!doctype html><html><head><meta charset="utf-8"><title>Gallery Refund Puzzle — slide preview</title><style>*{box-sizing:border-box}body{margin:0;background:#253840;font-family:Arial,sans-serif}.slide{position:relative;width:1280px;height:720px;margin:24px auto;background:#'+C.paper+';overflow:hidden}.t{position:absolute;white-space:pre-wrap;line-height:1.16;overflow:visible}.b,.l{position:absolute}.l{height:1px}.t[data-align=center]{text-align:center}.t[data-align=right]{text-align:right}@media print{body{background:white}.slide{margin:0;break-after:page}}</style></head><body>';
slides.forEach((sl,i)=>{html+='<section class="slide" id="slide-'+(i+1)+'" aria-label="'+esc(sl.title)+'">';sl.elements.forEach((e,n)=>{const base='left:'+px(e.x)+';top:'+px(e.y)+';width:'+px(e.w)+';';if(e.kind==='box')html+='<div class="b" style="'+base+'height:'+px(e.h)+';background:#'+e.fill+';border:1px solid #'+e.line+';border-radius:'+px(e.r||0)+'"></div>';else if(e.kind==='line')html+='<div class="l" style="'+base+'background:#'+e.color+'"></div>';else html+='<div class="t" data-slide="'+(i+1)+'" data-id="'+n+'" data-align="'+(e.align||'left')+'" style="'+base+'height:'+px(e.h)+';font-size:'+(e.size*96/72)+'px;color:#'+e.color+';font-weight:'+(e.bold?'700':'400')+'">'+esc(e.value)+'</div>';});html+='</section>';});html+='</body></html>';
fs.writeFileSync(path.join(__dirname,'gallery-refund-preview/index.html'),html);fs.writeFileSync(path.join(__dirname,'gallery-refund-preview/slides.json'),JSON.stringify(slides,null,2));
pptx.writeFile({fileName:out}).then(()=>console.log(JSON.stringify({file:out,slides:slides.length,speakerNotes:true,proposedScenario:true}))).catch(e=>{console.error(e.stack);process.exitCode=1});
