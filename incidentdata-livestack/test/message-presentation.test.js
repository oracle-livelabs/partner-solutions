const test=require('node:test'),assert=require('node:assert/strict');
const presentation=import('../frontend/src/message-presentation.mjs');
const p={id:'A',name:'handle1',sourceLabels:[{name:'Example One',handle:'handle1'}]};
const profile={person_ref:'P1',display_name:'Example One',alias_name:'one',portrait_asset_uri:'/poi/example/one.png'};
test('messaging-space is a source-order presentation, with stable colours and recorded dates only',async()=>{
 const {messageOrder,senderHue,recordedDay}=await presentation;
 assert.equal(messageOrder('messaging-space'),'source');assert.equal(messageOrder('auto'),'auto');assert.equal(messageOrder('source'),'source');assert.equal(messageOrder('time'),'time');
 const people=[p,{id:'B'},{id:'C'},{id:'D'}];assert.equal(new Set(people.map(p=>senderHue(people,p.id))).size,4);assert.equal(senderHue(people,'A'),senderHue(people,'A'));
 assert.equal(recordedDay({time:{local:'2023-05-15T20:45',original:'May 15, 2023, 8:45 PM'}}),'2023-05-15');assert.equal(recordedDay({section:{time:{original:'2023-05-15T20:45'}}}),'2023-05-15');assert.equal(recordedDay({time:{original:'May 15, 2023, 8:45 PM'}}),'');
});
test('portraits use unique full names or registered aliases, including explicitly declared name(handle)',async()=>{
 const {cataloguePortrait}=await presentation;
 assert.equal(cataloguePortrait(p,[profile]).personRef,'P1');assert.match(cataloguePortrait(p,[profile]).basis,/unverified/);
 assert.equal(cataloguePortrait({name:'  EXAMPLE ONE  '},[profile]).personRef,'P1');assert.equal(cataloguePortrait({name:'one'},[profile]).personRef,'P1');
 for(const name of ['Example','handle1','Example Ones','mentioned Example One'])assert.equal(cataloguePortrait({name},[profile]),null);
 assert.equal(cataloguePortrait({name:'different',sourceLabels:p.sourceLabels},[profile]),null);
});
test('ambiguous, conflicting, unscoped, absent and unsafe portrait references use initials',async()=>{
 const {cataloguePortrait}=await presentation;
 assert.equal(cataloguePortrait(p,[]),null);assert.equal(cataloguePortrait(p,[profile,{...profile,person_ref:'P2',portrait_asset_uri:null}]),null);
 assert.equal(cataloguePortrait({...p,sourceLabels:[...p.sourceLabels,{name:'Different Name',handle:'handle1'}]},[profile]),null);
 assert.equal(cataloguePortrait(p,[profile,{...profile,person_ref:'P2',display_name:'handle1'}]),null);
 for(const uri of [null,'https://example.test/photo.png','//example.test/poi/one.png','/poi/../secret.png','/poi/%2e%2e/secret.png','/poi/a.svg','data:image/png;base64,a'])assert.equal(cataloguePortrait(p,[{...profile,portrait_asset_uri:uri}]),null);
});
