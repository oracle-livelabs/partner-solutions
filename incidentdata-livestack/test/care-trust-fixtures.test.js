const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DIR,read,canonical}=require('../scripts/care-trust/common.cjs');
const {validate}=require('../scripts/care-trust/validate.cjs');
const pack=read(DIR,'pack.json'),anchors=read(DIR,'anchors.json'),source=r=>pack.items.find(e=>e.evidenceRef===r);
test('Care-Trust pack has traceable sources, unchanged anchors and supported person bindings',()=>{assert(validate(pack,anchors,p=>fs.readFileSync(path.join(DIR,p))).valid);});
test('care worker exact namespace isolates a form-code collision',()=>{const select=ns=>pack.items.filter(e=>e.markers.some(m=>m.namespace===ns&&m.value==='DEMO-WORKER-17')).map(e=>e.evidenceRef);assert.deepEqual(select('care_worker'),['EV-AMS-H03','EV-AMS-H04','EV-AMS-H06']);assert.deepEqual(select('care_form_catalogue'),['EV-AMS-H09']);});
test('consent, account attribution and source authenticity remain bounded',()=>{assert.equal(source('EV-AMS-H07').attributes.consentForResidentA,'not_supplied');assert.equal(source('EV-AMS-H06').attributes.messageAuthorship,'unverified');assert.equal(source('EV-AMS-H12').attributes.deviceAcquisition,false);});
for(const [label,change] of [
  ['altered incident status',p=>p.items[0].attributes.incidentStatus='resolved'],
  ['invented location',p=>p.items[0].incidentContext.latitude=0],
  ['invented capture timestamp',p=>p.items[0].capturedAt='2026-06-28'],
  ['broken literal quote',p=>p.items[2].personLinks.find(l=>l.basis==='literal_name_mention').startCharacter=0],
  ['unsupported person link',p=>p.items[0].personLinks[0].personRef='POI-NOT-IN-SCOPE'],
  ['untraceable marker',p=>p.items[0].markers[0].sourceQuote='not in source'],
  ['evaluation answer in indexed text',p=>p.items[0].indexText+=' groundTruth'],
  ['path traversal',p=>p.items[0].asset.path='../expected.json']
])test('Care-Trust contract rejects '+label,()=>{const copy=JSON.parse(canonical(pack));change(copy);assert.throws(()=>validate(copy,anchors));});
test('original payment fixture is a separate, retained pack',()=>{const original=read(path.resolve(DIR,'../v1'),'pack.json');assert.equal(original.items.length,32);assert(!original.items.some(e=>e.evidenceRef.startsWith('EV-AMS-H')));});
