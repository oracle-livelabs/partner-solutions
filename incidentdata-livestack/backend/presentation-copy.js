/* Keep source records/provenance verbatim; only legacy explanatory copy is styled. */
const protectedKey=/(?:^|_)(?:report_text|report_summary|incident_attributes|enrichments|evidence_metadata|profile_notes|source|provenance|notice|code|ref|time_zone|timezone|category_name|city_label|profile_name|area_name)$/i;
function presentationCopy(value,key='') {
  if(value instanceof Date)return value.toISOString();
  if(protectedKey.test(key))return value;
  if(typeof value==='string'){
    if(value==='Synthetic demonstration data. These are not actual police incidents.'||value.includes('"synthetic_record"'))return value;
    return value.replace(/synthetic fictional/gi,'generated profile').replace(/generated profile profile/gi,'profile')
      .replace(/synthetic evidence item/gi,'evidence item').replace(/fictional person/gi,'person').replace(/fictional profile/gi,'profile')
      .replace(/synthetic/gi,'demonstration').replace(/fictional/gi,'demonstration').replace(/teaching/gi,'demonstration');
  }
  if(Array.isArray(value))return value.map(x=>presentationCopy(x,key));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,presentationCopy(v,k)]));
  return value;
}
module.exports={presentationCopy};
