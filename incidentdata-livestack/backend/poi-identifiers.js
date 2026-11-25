'use strict';
const {createHash}=require('node:crypto');
const {canonicalSourceRef,sourceIdentity}=require('./poi-identifier-sources');
const TYPES=new Set(['alias','username','email','phone']);
const STATUSES=new Set(['proposed','declared','confirmed','rejected']);
const CASELESS_PLATFORMS=new Set(['instagram','telegram','x','facebook']);
function required(value,name,max){
 if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>max||/[\x00-\x1f\x7f]/.test(value))throw Error(`Invalid ${name}`);
 return value;
}
function normalize(type,value,namespace){
 if(!TYPES.has(type))throw Error('Invalid identifier type');
 required(value,'identifier value',320);
 if(type==='alias')return value.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ');
 if(type==='username')return CASELESS_PLATFORMS.has(namespace)?value.toLowerCase():value;
 if(type==='email'){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value))throw Error('Invalid email');
  const at=value.lastIndexOf('@');return value.slice(0,at)+'@'+value.slice(at+1).toLowerCase();
 }
 const phone=value.replace(/[ ()-]/g,'');
 if(!/^\+[1-9]\d{6,14}(?:;ext=\d{1,10})?$/.test(phone))throw Error('Phone requires explicit international +country code; optional ;ext=digits');
 return phone;
}
function prepare(input,profileId){
 if(!Number.isSafeInteger(profileId)||profileId<1)throw Error('Invalid profile ID');
 const personRef=required(input.personRef,'person reference',24);
 const type=input.type;
 if(!TYPES.has(type))throw Error('Invalid identifier type');
 const namespace=required(input.namespace||({alias:'general',username:'unspecified',email:'email',phone:'e164'}[type]),'namespace',80);
 if(namespace!==namespace.toLowerCase()||!/^[a-z0-9_.-]+$/.test(namespace))throw Error('Invalid namespace');
 if(type==='email'&&namespace!=='email'||type==='phone'&&namespace!=='e164'||type==='alias'&&namespace!=='general')throw Error('Invalid namespace for identifier type');
 const value=required(input.value,'identifier value',320),normalized=normalize(type,value,namespace);
 const status=input.status||'proposed';if(!STATUSES.has(status))throw Error('Invalid review status');
 const sourceRef=canonicalSourceRef(required(input.sourceRef,'source reference',300)),sourceNote=required(input.sourceNote,'source note',1000),recordedBy=required(input.recordedBy,'recorded by',120);
 const reviewedBy=input.reviewedBy?required(input.reviewedBy,'reviewed by',120):null;
 function date(value){if(value==null)return null;if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Invalid UTC date');return new Date(value);}
 const reviewedAt=date(input.reviewedAt),validFrom=date(input.validFrom),validTo=date(input.validTo);
 if(status==='confirmed'&&(!reviewedBy||!reviewedAt))throw Error('Confirmed identifier requires reviewer and review time');
 if(validFrom&&validTo&&validFrom>validTo)throw Error('Invalid validity interval');
 const id=createHash('sha256').update(JSON.stringify([profileId,personRef,type,namespace,normalized,sourceIdentity(sourceRef)])).digest('hex');
 return {id,profileId,personRef,type,namespace,value,normalized,status,sourceRef,sourceNote,recordedBy,reviewedBy,reviewedAt,validFrom,validTo};
}
async function list(c){
 const o=require('oracledb');
 return (await c.execute(`SELECT * FROM secure_poi_identifiers_v ORDER BY person_ref,identifier_type,namespace,normalized_value,identifier_id`,{}, {outFormat:o.OUT_FORMAT_OBJECT})).rows;
}
async function match(c,{type,value,namespace,at=new Date()}){
 // Same validation/normalisation for ingestion and search. Unknown platforms remain case sensitive.
 const prepared=prepare({personRef:'lookup',type,value,namespace,sourceRef:'lookup',sourceNote:'lookup',recordedBy:'lookup'},1);
 if(!(at instanceof Date)||!Number.isFinite(at.getTime()))throw Error('Invalid match date');
 const o=require('oracledb');
 const rows=(await c.execute(`SELECT * FROM secure_poi_identifiers_v
 WHERE identifier_type=:type AND namespace=:namespace AND normalized_value=:normalized
 AND review_status IN ('declared','confirmed')
 AND (valid_from IS NULL OR valid_from<=:at) AND (valid_to IS NULL OR valid_to>:at)
 ORDER BY person_ref,identifier_id`,{type,namespace:prepared.namespace,normalized:prepared.normalized,at},{outFormat:o.OUT_FORMAT_OBJECT})).rows;
 const ambiguous=new Set(rows.map(r=>r.PERSON_REF)).size>1;
 return rows.map(r=>({...r,ambiguous,basis:'registered_identifier_assertion_not_identity_verification'}));
}
module.exports={prepare,normalize,list,match};
