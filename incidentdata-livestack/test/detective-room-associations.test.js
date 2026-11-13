'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {declarations,associationContext,applyPersonLinks,mergeCataloguePeople}=require('../backend/detective-room-associations');
const B='DR-20261020-68ed95d9-8383-401c',profiles=[{PERSON_REF:'POI-G',DISPLAY_NAME:'George Kaplan'}];
const document=()=>({version:1,batchId:B,declaredBy:'scenario author',declaredAt:'2026-10-20',links:[{handle:'kappa66',personRef:'POI-G',reason:'Explicit fictional scenario instruction'}]});
test('declared handles require a single scoped reference and keep attribution',()=>{
 assert.equal(declarations(document(),B,profiles)[0].displayName,'George Kaplan');assert.deepEqual(declarations(document(),B,[]),[]);
 const conflict=document();conflict.links.push({...conflict.links[0],personRef:'OTHER'});assert.throws(()=>declarations(conflict,B,profiles));
 assert.throws(()=>declarations({...document(),batchId:'different'},B,profiles));
});
test('handle and full-name cards merge while original message senders and source references remain intact',()=>{
 const normal={people:[{id:'handle',name:'kappa66',sourceRefs:['message.txt'],detail:'Source handle.'},{id:'person',name:'George Kaplan',sourceRefs:['narrative.txt'],detail:'Source name.'}],messages:[{sender:'kappa66',text:'Original words'}]};
 applyPersonLinks(normal,{links:declarations(document(),B,profiles)});assert.equal(normal.people.length,1);assert.equal(normal.people[0].name,'George Kaplan (kappa66)');assert.deepEqual(normal.people[0].handles,['kappa66']);assert(normal.people[0].sourceRefs.includes('message.txt'));assert(normal.people[0].sourceRefs.includes('narrative.txt'));assert.equal(normal.messages[0].sender,'kappa66');
});
test('undeclared lookalike handles are not inferred or merged',()=>{const n={people:[{name:'kappa67',sourceRefs:[],detail:'Unmapped'}]};applyPersonLinks(n,{links:declarations(document(),B,profiles)});assert.equal(n.people[0].name,'kappa67');assert(!n.people[0].personRef);});
test('association fingerprints change on declared links and omit hidden profiles',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'detective-association-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const old=process.env.CDR_ROOM_ROOT;process.env.CDR_ROOM_ROOT=root;
 const c=visible=>({execute:async sql=>({rows:sql.includes('secure_persons_of_interest_v')?visible:[]})});
 try{
  const empty=await associationContext(c(profiles),{BATCH_ID:B});assert.equal(empty.fingerprint,null);
  await fs.mkdir(path.join(root,'associations'));await fs.writeFile(path.join(root,'associations',B+'.json'),JSON.stringify(document()));
  const bound=await associationContext(c(profiles),{BATCH_ID:B});assert(bound.fingerprint);assert.equal(bound.links.length,1);
  const hidden=await associationContext(c([]),{BATCH_ID:B});assert.deepEqual(hidden.links,[]);assert.equal(hidden.fingerprint,null);
 }finally{if(old===undefined)delete process.env.CDR_ROOM_ROOT;else process.env.CDR_ROOM_ROOT=old;}
});

test('source labels sharing an explicit catalogue reference collapse into one character card',()=>{
 const people=[{name:'Philip Vandamm (pipp68)',personRef:'POI-P',sourceRefs:['declared'],sourceNames:['pipp68','Philip Vandamm'],detail:'Declared link.'},{name:'Vandamm',personRef:'POI-P',sourceRefs:['narrative'],detail:'Exact registered alias.'},{name:'Unresolved',sourceRefs:[],detail:'Unresolved'}];
 mergeCataloguePeople(people);assert.equal(people.length,2);assert(people[0].sourceNames.includes('Vandamm'));assert(people[0].sourceRefs.includes('narrative'));assert.equal(people[1].name,'Unresolved');
});
