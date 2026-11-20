const test=require('node:test'),assert=require('node:assert/strict');
const {explicitMentions,coverage}=require('../backend/poi-catalogue');
const profiles=[{person_ref:'G',display_name:'George Kaplan',alias_name:'Kaplan',narrative_ready:1,visual_ready:1},{person_ref:'C',display_name:'Clara Thornhill',alias_name:'Thornhill',narrative_ready:0,visual_ready:0}];
test('literal names and aliases retain exact source offsets without duplicate nested surname',()=>{
 const text='GEORGE KAPLAN spoke to Thornhill. Not Kaplanville.';
 const r=explicitMentions(text,profiles);assert.equal(r.length,2);assert.equal(r[0].quotes.length,1);assert.equal(r[0].quotes[0].quote,'GEORGE KAPLAN');assert.equal(r[1].quotes[0].matchType,'registered_alias');
 for(const p of r)for(const q of p.quotes)assert.equal(text.slice(q.startCharacter,q.endCharacter),q.quote);
});
test('missing vectors do not suppress literal mentions; incomplete catalogue is explicit',()=>{
 assert.equal(explicitMentions('Clara Thornhill',profiles)[0].person_ref,'C');assert.equal(coverage(profiles).narrativeReady,1);assert.equal(coverage(profiles).registered,2);
});
test('aliases are escaped, case-insensitive, bounded and flagged when ambiguous',()=>{
 const p=[{person_ref:'1',display_name:'Person One',alias_name:'A+B'},{person_ref:'2',display_name:'Person Two',alias_name:'A+B'}];
 assert.equal(explicitMentions('AAAB A+BB',p).length,0);const r=explicitMentions('a+b',p);assert.equal(r.length,2);assert(r.every(p=>p.quotes[0].ambiguous));
});
