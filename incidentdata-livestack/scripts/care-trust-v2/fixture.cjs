'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {canonical,sha256}=require('../care-trust/common.cjs');
const ROOT=path.resolve(__dirname,'../..'),DIR=path.join(ROOT,'testdata/evidence-intelligence/care-trust-v2'),OUT=path.join(ROOT,'care_trust_v2_20260925');
const PACK='EI_AMSTERDAM_CARE_V2',PROFILE='AMSTERDAM_DATA_V1',PATTERN='RESIDENTIAL_OCCUPANCY_BURGLARY';
const read=(dir,name)=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const save=(dir,name,value)=>{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});};
function build(){
  assert(!fs.existsSync(path.join(DIR,'pack.json')),'Do not overwrite a versioned pack');
  const old=read(path.join(DIR,'../care-trust-v1'),'pack.json'),items=[];
  const A='SYN-AMS-2026-12200',B='SYN-AMS-2026-06302';
  const posts=[
    {ref:'SYN-AMS-CARE-POST-01',incidentRef:A,date:'2026-07-03T09:00:00Z',text:'[Fictional community post] Since things went missing, someone close to me is worried about who knows their routine. They rely on help and are afraid that asking questions will upset that help. Is there a way to raise a concern privately? Please do not post names or addresses.',basis:'A separately authored private follow-up supplies the exact report reference and permission to record the concern (EV-AMS-H17). The public wording alone does not identify the resident, care worker or event.'},
    {ref:'SYN-AMS-CARE-POST-02',incidentRef:B,date:'2026-07-03T14:00:00Z',text:'[Fictional community post] I asked a helper to arrange transport, and now people are reading too much into a missing delivery. Permission to make one enquiry is not permission to share everything. I want both points kept in the record.',basis:'A separately authored private clarification supplies the parcel-report reference (EV-AMS-H22). Compare the limited transport consent; neither post nor link verifies a shared visitor or message author.'},
    {ref:'SYN-AMS-CARE-POST-03',incidentRef:null,date:'2026-07-04T08:00:00Z',text:'[Fictional community post] Our discussion group is asking how to query a care invoice for a visit someone does not remember. Is there a confidential place to ask? A billing question is not proof of fraud, and we are not naming a provider.',basis:null}
  ];
  function add(n,incidentRef,title,description,sourceText,kind,attributes,markers=[]){
    const template=old.items.find(e=>e.incidentRef===incidentRef);assert(template);
    if(n===17)sourceText+='\nClient reference supplied in the private follow-up: CT-RES-A.';
    const evidenceRef='EV-AMS-H'+n,indexText=[title,description,sourceText].join('\n');
    const bytes=Buffer.from('SYNTHETIC TEACHING SOURCE — NOT OPERATIONAL EVIDENCE\n\n'+sourceText+'\n');
    const e={...template,evidenceRef,knowledgeSetVersion:'2.0',title,description,sourceText,kind,markers:markers.map(([namespace,value])=>({namespace,value,sourceQuote:value})),personLinks:[],
      attributes:{...attributes,sourceStatus:'authored_synthetic_teaching_source',incidentStatus:template.attributes.incidentStatus,financialHelperIdentity:'not_established'},
      simulatedRecordedAt:'2026-07-05T10:00:00.000Z',provenance:{...template.provenance,basis:'Additive Care-Trust v2 teaching supplement; original report and v1 sources are unchanged.'},
      asset:{path:'assets/'+evidenceRef+'.txt',mimeType:'text/plain',sha256:sha256(bytes),caption:description},indexText,indexTextSha256:sha256(indexText)};
    fs.mkdirSync(path.join(DIR,'assets'),{recursive:true});fs.writeFileSync(path.join(DIR,e.asset.path),bytes);items.push(e);
  }
  add(17,A,'A private follow-up turns a public concern into a review lead',
    'The public post does not identify anyone. A separately authored private follow-up supplies the tool-case report reference and permission to record a concern about dependency and information sharing.',
    'Document: synthetic triage note, recorded 4 July 2026\nPublic source: SYN-AMS-CARE-POST-01, posted 3 July.\nIn a separate private follow-up, the fictional contributor supplies report SYN-AMS-2026-12200 and asks for the concern to be recorded with that report. This is an authored teaching link, not an identity inferred from public text.\nThe original report concerns a small tool case and entrance damage. New concern: Resident A depends on assistance and worries that asking about privacy might jeopardise that assistance. No actual threat or withdrawal of care is reported.\nThis explains the comparison link; it does not corroborate the loss, identify a message author or show a common offender. The next source to inspect is the resident-support note, then the care-assignment and retained-message records.',
    'signal_triage_note',{sourcePostRef:posts[0].ref,linkBasis:'separate_attributed_private_followup',reviewStatus:'reviewed_comparison',originalIncidentUnchanged:true},[['care_client','CT-RES-A'],['public_post',posts[0].ref]]);
  add(18,A,'A resident wants help to continue while spending is clarified',
    'Resident A raises an attributed shopping-payment concern after the property report. Dependency explains hesitation in this fictional account; it does not identify the financial helper or connect spending to the burglary.',
    'Document: attributed financial-support follow-up, 4 July 2026\nClient reference: CT-RES-A\nResident A says: "I need the help to continue. I agreed to some shopping, but I do not understand every entry. I waited to ask because I did not want to cause trouble."\nThe resident asks for the shopping permission and receipts to be compared. This is a reported concern, not an assessment of memory or capacity. No threat, coercive demand or eyewitness account of card misuse is supplied.\nThe person who assisted with payments is not identified. A care assignment must not be substituted for proof of who spent money. This follow-up does not amend the tool-case incident into a fraud report.',
    'attributed_financial_concern',{hypothesis:'personal_financial_abuse_unresolved',statementStatus:'attributed_unverified'},[['care_client','CT-RES-A']]);
  add(19,A,'The permission is for shopping, not unrestricted spending',
    'A fictional permission extract sets a shopping limit and requires receipts. It is scoped to Resident A, names no financial helper and supplies no bank credential or account number.',
    'Document: limited shopping-support permission, displayed date 26 June 2026\nClient reference: CT-RES-A\nPermission reference: DEMO-SHOP-A\nPermitted purpose: groceries for the resident, up to EUR 35 per shopping occasion, with a receipt. The extract does not authorise personal purchases, general transfers or disclosure of private care details.\nThe financial helper is not named. No PIN, bank details, visit schedule or residence is provided. A displayed permission document is not independently authenticated and does not prove who used a payment instrument.',
    'financial_permission_extract',{permissionCurrency:'EUR',perOccasionLimit:35,permissionAuthenticity:'not_independently_established'},[['care_client','CT-RES-A'],['shopping_permission','DEMO-SHOP-A']]);
  add(20,A,'Three displayed entries raise two different questions',
    'A redacted, fictional entry list shows two EUR 24.60 entries and one EUR 62.40 entry. It is an incomplete extract, not a reconciled loss calculation or attribution to a named worker.',
    'Document: redacted shopping-entry extract supplied 4 July 2026\nClient reference: CT-RES-A\nPermission comparison: DEMO-SHOP-A\nDisplayed entries: DEMO-TXN-A1, 27 June, EUR 24.60; DEMO-TXN-A2, 27 June, EUR 24.60; DEMO-TXN-A3, 30 June, EUR 62.40.\nThe supplied extract omits settlement and reversal status, merchant detail and purchaser identity. No card, PIN or account number is retained. Do not add these entries together and call the total a loss.\nQuestions: are the two equal entries both settled, and what authority and receipt support the larger entry? Compare the later reconciliation before drawing a conclusion.',
    'redacted_financial_extract',{currency:'EUR',settlementStatus:'omitted_in_this_extract',identityAttribution:'none'},[['care_client','CT-RES-A'],['shopping_permission','DEMO-SHOP-A'],['payment_entry','DEMO-TXN-A3']]);
  add(21,A,'One apparent duplicate is explained; one question stays open',
    'A later fictional reconciliation identifies a voided duplicate and a matching grocery receipt. The larger entry has a refund request but no confirmed refund, receipt or extended permission in the supplied material.',
    'Document: synthetic reconciliation addendum, displayed date 5 July 2026\nClient reference: CT-RES-A\nDEMO-TXN-A1: settled EUR 24.60; supplied grocery receipt matches that amount. DEMO-TXN-A2: voided authorisation, not a second settled payment. The apparent duplicate is explained within these supplied records.\nDEMO-TXN-A3: displayed as settled EUR 62.40; refund requested, completion not confirmed. No receipt or permission beyond the EUR 35 shopping limit is supplied. This leaves a question, not a verified loss or finding of misuse.\nNo payment user is identified. No evidence connects this entry to the tool-case loss or outward message. No public-care funding claim, PGB payment or provider invoice is supplied, so care-funding fraud cannot be concluded.',
    'financial_reconciliation_note',{explainedEntry:'DEMO-TXN-A2',unresolvedEntry:'DEMO-TXN-A3',refundStatus:'requested_not_confirmed',careFundingClaim:'not_supplied'},[['care_client','CT-RES-A'],['payment_entry','DEMO-TXN-A3']]);
  add(22,B,'A second contributor asks for permission to be kept in context',
    'A private follow-up connects the second public post to the parcel report. Resident B wants the authorised transport enquiry recorded without treating it as unrestricted disclosure or an explanation of another resident’s concern.',
    'Document: synthetic triage clarification, recorded 4 July 2026\nPublic source: SYN-AMS-CARE-POST-02, posted 3 July.\nIn a separate private follow-up the fictional contributor supplies SYN-AMS-2026-06302, the existing sealed-parcel report, and asks for this comparison to be recorded. The public post alone does not identify the event.\nClient reference: CT-RES-B. A limited transport enquiry was permitted, as described in the separate consent extract. The contributor does not say that all information sharing was permitted, that the retained outward message served that enquiry, or that they witnessed its author.\nThis explanation concerns Resident B. It cannot resolve the use of Resident A\'s reference, identify a visitor or establish that the parcel loss and tool-case loss share a cause.',
    'signal_triage_note',{sourcePostRef:posts[1].ref,linkBasis:'separate_attributed_private_followup',reviewStatus:'reviewed_comparison',originalIncidentUnchanged:true},[['care_client','CT-RES-B'],['public_post',posts[1].ref]]);
  const pack={packageCode:PACK,profileCode:PROFILE,knowledgeSetId:'KS-CARE-TRUST-001',version:'2.0',authoredAt:'2026-09-25',items,posts};
  validate(pack);save(DIR,'pack.json',pack);
  save(DIR,'expected.json',{indexable:false,reviewOnly:true,assertions:['Public post alone cannot identify an incident or a person.','The private follow-up supplies the explicit comparison basis.','A2 is voided, not a second settled purchase.','A3 refund requested does not mean refunded.','Financial helper is unidentified; do not infer Lena Harper.','No care-funding claim or burglary-payment linkage is supplied.','Resident B consent does not cover Resident A.']});
  console.log('Authored six additive evidence sources and three public-post fixtures.');
}
function validate(pack){
  assert.equal(pack.items.length,6);assert.equal(pack.posts.length,3);
  for(const e of pack.items){assert.equal(e.syntheticRecord,true);assert.equal(e.personLinks.length,0);assert(!/\b(PIN:?\s*\d|[A-Z]{2}\d{2}[A-Z0-9]{10,})/.test(e.sourceText));assert.equal(e.indexText,[e.title,e.description,e.sourceText].join('\n'));assert.equal(e.indexTextSha256,sha256(e.indexText));for(const m of e.markers)assert(e.sourceText.includes(m.sourceQuote));assert.equal(sha256(fs.readFileSync(path.join(DIR,e.asset.path))),e.asset.sha256);}
  for(const p of pack.posts){assert(!/CT-RES|Lena|Morgan|DEMO-WORKER|SYN-AMS-2026|\d{2}:\d{2}/.test(p.text));assert(p.text.startsWith('[Fictional community post]'));}
  assert.match(pack.items.find(e=>e.evidenceRef==='EV-AMS-H21').sourceText,/voided authorisation/);
  return true;
}
if(require.main===module)build();
module.exports={ROOT,DIR,OUT,PACK,PROFILE,PATTERN,read,save,canonical,sha256,validate};
