'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {prepare}=require('../backend/poi-identifiers');
const SOURCE='synthetic:city-poi-identifiers:v1:2026-10-20';
function build(catalogue){
 if(catalogue.version!==1||!Array.isArray(catalogue.profiles))throw Error('Invalid POI catalogue');
 const people=new Map();
 for(const profile of catalogue.profiles){
  if(new Set(profile.people.map(p=>p.personRef)).size!==profile.people.length)throw Error('Duplicate POI in city');
  for(const person of profile.people){
   const existing=people.get(person.personRef);
   if(existing&&existing.displayName!==person.displayName)throw Error('Shared POI names differ across cities');
   if(!existing)people.set(person.personRef,{...person,profileCodes:[]});
   people.get(person.personRef).profileCodes.push(profile.code);
  }
 }
 const adjectives=['Amber','Copper','Quiet','Silver','Harbour','Cedar','Evening','Northern','Indigo','Willow','Autumn','Golden','River','Velvet','Winter','Meadow','Crimson','Slate','Orchard'];
 const nouns=['Finch','Kestrel','Wren','Fox','Heron','Lark','Owl','Robin','Otter','Swift','Lynx','Falcon','Marten','Plover','Ibis','Sparrow','Raven','Pipit','Tern'];
 if(people.size>adjectives.length)throw Error('Extend the explicit fictional alias/phone allocation before adding new people');
 const generated=[...people.values()].sort((a,b)=>a.personRef.localeCompare(b.personRef,'en')).map((person,index)=>{
  const digest=createHash('sha256').update(person.personRef).digest(),count=5+digest[0]%3;
  const parts=person.displayName.toLowerCase().replace(/[^a-z0-9 ]/g,'').split(/ +/),first=parts[0],last=parts.at(-1),code=String(index+1).padStart(2,'0');
  const add=(type,value,namespace)=>({personRef:person.personRef,type,value,...(namespace?{namespace}:{}),status:'declared',sourceRef:SOURCE,
   sourceNote:'Generated fictional teaching identifier at scenario owner request. Not extracted from original evidence and not a real account or subscriber. '+(type==='phone'?'UK drama-reserved phone range, used consistently across city profiles; does not imply a UK residence.':type==='email'?'Reserved .test email domain.':type==='username'?'Synthetic handle; no live platform account was searched or created.':'Fictional nickname for demonstrations.'),recordedBy:'Synthetic POI identifier generator v1; scenario-owner authorised'});
  const identifiers=[
   add('alias',adjectives[index]+' '+nouns[index]),
   add('username',`demo_${first}_${adjectives[index].toLowerCase()}${code}`,'telegram'),
   add('username',`demo_${last}.${nouns[index].toLowerCase()}${code}`,'instagram'),
   add('email',`${first}.${last}.${code}@example.test`),
   add('phone','+447700900'+String(100+index*2).padStart(3,'0')),
  ];
  if(count>=6)identifiers.push(add('email',`${last}.${code}@mail.example.test`));
  if(count>=7)identifiers.push(add('phone','+447700900'+String(101+index*2).padStart(3,'0')));
  identifiers.forEach(row=>prepare(row,1));
  return {...person,identifiers};
 });
 return {version:1,sourceRef:SOURCE,phoneRangeSource:'https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbers-for-drama',emailDomainSource:'https://www.iana.org/assignments/special-use-domain-names/special-use-domain-names.xhtml',people:generated};
}
if(require.main===module){
 const root=path.join(__dirname,'../testdata/poi-identifiers'),pack=build(JSON.parse(fs.readFileSync(path.join(root,'city-catalogue.json'),'utf8')));
 fs.writeFileSync(path.join(root,'city-standard-v1.json'),JSON.stringify(pack,null,2)+'\n');
 console.log(JSON.stringify({distinctPeople:pack.people.length,counts:pack.people.map(p=>({person:p.displayName,additional:p.identifiers.length,cities:p.profileCodes.length})),totalCityIdentifiers:pack.people.reduce((n,p)=>n+p.identifiers.length*p.profileCodes.length,0)},null,2));
}
module.exports={build,SOURCE};
