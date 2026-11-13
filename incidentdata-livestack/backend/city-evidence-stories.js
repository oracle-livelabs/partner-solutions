'use strict';
const PACK='EI_CITY_CORE_V1';
const THEMES=Object.freeze([
 ['SERVICE_ACCESS','After-hours access'],['ART_MARKET_PAYMENTS','Payment-document trail'],
 ['NIGHT_PRECINCT_ACTIVITY','Precinct timing and context'],['RESIDENTIAL_OCCUPANCY_BURGLARY','Doorstep visits and alternatives'],
 ['VEHICLE_PARTS_HARVESTING','Parts descriptions and provenance'],['CONSTRUCTION_SITE_MATERIAL_THEFT','Worksite inventory and controls'],
]);
function cityEvidenceStories(records){
 const core=records.filter(r=>r.PACK_CODE===PACK).map(r=>JSON.parse(r.DOCUMENT));
 return THEMES.flatMap(([code,title])=>{
  const sources=core.filter(e=>e.watchPatternCode===code).sort((a,b)=>a.evidenceRef.localeCompare(b.evidenceRef));
  if(sources.length!==4)return [];
  return [{id:'city-core-'+code,patternCode:code,title,question:title,
   evidenceRefs:sources.map(e=>e.evidenceRef),
   reviewQuestion:`Compare these four sources for ${title.toLowerCase()}. Cite each source. Separate the authored observations, shared-reference namespaces, legitimate alternatives and unresolved gaps. An illustration or incident association does not establish identity, ownership, authorship or responsibility.`}];
 });
}
module.exports={PACK,THEMES,cityEvidenceStories};
