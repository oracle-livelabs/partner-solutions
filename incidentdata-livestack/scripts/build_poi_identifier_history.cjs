'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const spec=require('../testdata/poi-identifier-history/20261030-spec.json');
const {sourceIdentity}=require('../backend/poi-identifier-sources');
const DAY=86400000,HOUR=3600000,START=Date.parse(spec.windowStart),END=Date.parse(spec.windowEndExclusive);
const FIELDS=['RECORDED_BY','REVIEWED_BY','REVIEWED_AT','VALID_FROM','VALID_TO','CREATED_AT'];
const baseline=new Map(spec.baseline.map(p=>[p.identifierId,p]));
const digest=s=>createHash('sha256').update(s).digest();
function logical(row){return JSON.stringify([row.PERSON_REF,row.IDENTIFIER_TYPE,row.NAMESPACE,row.NORMALIZED_VALUE,sourceIdentity(row.SOURCE_REF)]);}
const iso=n=>new Date(n).toISOString();
function initial(row){
 const b=digest(logical(row)),person=digest(row.PERSON_REF);
 const curated=row.SOURCE_REF.includes('poi-profile-quality');
 const proposed=row.REVIEW_STATUS==='proposed';
 // Person-centred capture waves, then shorter follow-up collections. Offset
 // dates remain deterministic across every saved copy of the same assertion.
 let capture;
 if(curated)capture=END-(9+b[0]%65)*DAY;
 else if(proposed)capture=END-(22+b[0]%45)*DAY;
 else capture=START+(7+(person[0]%8)*34+b[1]%20)*DAY;
 capture+=((b[2]%9)*HOUR)+(b[3]%60)*60000+(b[4]%60)*1000;
 assert(capture<END-4*DAY);
 const validFrom=Math.max(START,capture-(b[5]%22)*DAY-(b[6]%12)*HOUR);
 // Apps have their own provenance codes; administrative review is performed
 // by a separate reviewer code. Pending proposals have no completed review.
 const recorder=spec.recorderCodes[b[7]%spec.recorderCodes.length];
 const reviewed=!proposed&&b[8]%5!==0;
 const reviewedAt=reviewed?Math.min(capture+(2+b[9]%360)*HOUR+(b[10]%60)*60000,END-2*HOUR):null;
 return {RECORDED_BY:recorder,REVIEWED_BY:reviewed?spec.reviewerCodes[b[11]%spec.reviewerCodes.length]:null,REVIEWED_AT:reviewedAt===null?null:iso(reviewedAt),VALID_FROM:iso(validFrom),VALID_TO:null,CREATED_AT:iso(capture)};
}
function build(rows){
 assert.equal(rows.length,spec.baseline.length,'Identifier count changed');
 const generated=new Map(rows.map(row=>{assert(baseline.has(row.IDENTIFIER_ID));assert.equal(row.REVIEW_STATUS,baseline.get(row.IDENTIFIER_ID).reviewStatus);return[row.IDENTIFIER_ID,initial(row)];}));
 const replacements=new Map();
 for(const row of rows){
  if(!row.SOURCE_REF.includes('poi-profile-quality'))continue;
  const time=Date.parse(generated.get(row.IDENTIFIER_ID).VALID_FROM);
  replacements.set(row.PERSON_REF,Math.min(replacements.get(row.PERSON_REF)??Infinity,time));
 }
 for(const row of rows){
  const value=generated.get(row.IDENTIFIER_ID);
  if(baseline.get(row.IDENTIFIER_ID).wasExpired){
   const fallback=END-(2+digest(row.PERSON_REF)[0]%50)*DAY;
   const expires=replacements.get(row.PERSON_REF)??fallback;
   assert(expires>Date.parse(value.CREATED_AT),'Replacement must follow capture');
   value.VALID_TO=iso(expires);
   if(value.REVIEWED_AT&&Date.parse(value.REVIEWED_AT)>=expires)value.REVIEWED_AT=iso(Date.parse(value.CREATED_AT)+HOUR);
  }
  validateRow(row,value);
 }
 // Saved city duplicates carry the same history and should be de-duplicated
 // by logical assertion when combining city catalogues for a global chart.
 const unique=new Map();
 for(const row of rows){const key=logical(row),value=generated.get(row.IDENTIFIER_ID);if(unique.has(key))assert.deepEqual(value,unique.get(key));else unique.set(key,value);}
 return rows.map(row=>({identifierId:row.IDENTIFIER_ID,personRef:row.PERSON_REF,profileId:row.DATASET_PROFILE_ID,logicalAssertion:logical(row),...generated.get(row.IDENTIFIER_ID)}));
}
function validateRow(row,h){
 assert(spec.recorderCodes.includes(h.RECORDED_BY));assert(h.REVIEWED_BY===null||spec.reviewerCodes.includes(h.REVIEWED_BY));
 for(const key of ['CREATED_AT','REVIEWED_AT','VALID_FROM','VALID_TO'])if(h[key]!==null)assert(Date.parse(h[key])>=START&&Date.parse(h[key])<END,key+' outside requested window');
 assert(Date.parse(h.VALID_FROM)<=Date.parse(h.CREATED_AT));
 assert.equal(h.REVIEWED_BY===null,h.REVIEWED_AT===null);
 if(h.REVIEWED_AT)assert(Date.parse(h.REVIEWED_AT)>=Date.parse(h.CREATED_AT));
 if(h.VALID_TO){assert(Date.parse(h.VALID_TO)>Date.parse(h.VALID_FROM));assert(Date.parse(h.VALID_TO)>Date.parse(h.CREATED_AT));if(h.REVIEWED_AT)assert(Date.parse(h.REVIEWED_AT)<Date.parse(h.VALID_TO));}
 if(row.REVIEW_STATUS==='proposed'){assert.equal(h.REVIEWED_BY,null);assert.equal(h.REVIEWED_AT,null);}
}
if(require.main===module){const root='/home/opc/scratch/poi-identifier-history-20261030';const captured=JSON.parse(fs.readFileSync(path.join(root,'inspection.json'),'utf8'));const result=build(captured.identifiers);fs.writeFileSync(path.join(root,'prepared-history.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({records:result.length,distinctAssertions:new Set(result.map(r=>r.logicalAssertion)).size,recorders:new Set(result.map(r=>r.RECORDED_BY)).size,reviewers:new Set(result.map(r=>r.REVIEWED_BY).filter(Boolean)).size,windowStart:spec.windowStart,windowEndExclusive:spec.windowEndExclusive}));}
module.exports={build,validateRow,logical,FIELDS,START,END};
