/* Generic READ-ONLY saved-profile paging and exact bounded map aggregation.
 * No city branches, source-coordinate edits, samples, DDL, or activation.
 */
const fail=message=>Object.assign(new Error(message),{status:400});
function policy(config={}) {
  const c=config.saved_review||{},configured=config.performance?.raw_map_marker_limit;
  const required=c.mode==='clustered'||Number.isInteger(configured)&&configured>0;
  const bounded=(v,d,min,max)=>Number.isInteger(v)&&v>=min?Math.min(v,max):d;
  return {supported:true,required,defaultMode:required?'clustered':'legacy',rawMarkerLimit:bounded(c.raw_marker_limit??configured,5000,1,5000),clusterLimit:bounded(c.cluster_limit,1000,16,1000),rawMinZoom:bounded(c.raw_min_zoom,15,2,19),pageSize:bounded(c.page_size,75,1,200)};
}
function mode(query={},p=policy()) {
  if(query.view!==undefined&&!['legacy','clustered'].includes(query.view))throw fail('Invalid saved review mode.');
  if(p.required&&query.view==='legacy')throw fail('This profile requires bounded clustered review.');
  return query.view||p.defaultMode;
}
function integer(v,fallback,min,max,label){
  if(v===undefined)return fallback;
  if(typeof v!=='string'&&typeof v!=='number'||String(v).trim()===''||!Number.isInteger(Number(v))||Number(v)<min||Number(v)>max)throw fail('Invalid '+label+'.');
  return Number(v);
}
function options(query={},p=policy()) {
  const offset=integer(query.offset,0,0,100000000,'record offset'),zoom=integer(query.zoom,10,2,19,'map zoom');
  let bbox=null;
  if(query.bbox!==undefined){
    if(typeof query.bbox!=='string'||query.bbox.length>160)throw fail('Invalid map bounds.');
    const parts=query.bbox.split(',');bbox=parts.map(Number);
    if(parts.length!==4||parts.some(x=>!x.trim())||!bbox.every(Number.isFinite)||bbox[0]<-180||bbox[0]>180||bbox[2]<-180||bbox[2]>180||bbox[1]<-90||bbox[3]>90||bbox[1]>=bbox[3]||bbox[0]===bbox[2])throw fail('Invalid map bounds.');
  }
  const limit=integer(query.limit,p.pageSize,1,200,'result limit');
  // A legacy-compatible query mapLimit can never bypass the new mode's cap.
  const rawLimit=Math.min(integer(query.mapLimit,p.rawMarkerLimit,1,25000,'map limit'),p.rawMarkerLimit);
  return {offset,zoom,bbox,limit,rawLimit};
}
function pagination(offset,limit,total,returned){
  return {offset,limit,total,returned,hasPrevious:offset>0,previousOffset:Math.max(0,offset-limit),hasNext:offset+returned<total,nextOffset:offset+limit,start:returned?offset+1:0,end:returned?offset+returned:0};
}
function viewportWhere(o,binds) {
  if(!o.bbox)return '';
  const [west,south,east,north]=o.bbox;Object.assign(binds,{west,south,east,north});
  return ` AND i.latitude BETWEEN :south AND :north AND (i.longitude>=:west ${west>east?'OR':'AND'} i.longitude<=:east)`;
}
const summarySelect=(physical,role,time)=>`COUNT(*) total_count,
  COALESCE(SUM(CASE WHEN ${physical} THEN 1 ELSE 0 END),0) physical_count,
  COALESCE(SUM(CASE WHEN ${role}='locality_reference' THEN 1 ELSE 0 END),0) reference_count,
  MIN(TO_CHAR(${time},'YYYY-MM-DD')) first_local_date,MAX(TO_CHAR(${time},'YYYY-MM-DD')) last_local_date,
  COUNT(DISTINCT TO_CHAR(${time},'YYYY-MM-DD')) local_dates,
  MIN(CASE WHEN ${physical} THEN i.latitude END) south,MAX(CASE WHEN ${physical} THEN i.latitude END) north,
  MIN(CASE WHEN ${physical} THEN i.longitude END) west,MAX(CASE WHEN ${physical} THEN i.longitude END) east`;
async function summary(c,sql) {
  return (await c.execute(`SELECT /*+ LEADING(i) USE_HASH(cat r) */ ${summarySelect(sql.physicalSql,sql.roleSql,sql.time)} ${sql.joins} WHERE ${sql.where}`,sql.binds)).rows[0];
}
function gridPlan(o,p,extent) {
  // A 64-pixel longitudinal cell leaves room for a count badge at city zoom.
  let gridDegrees=360/2**(o.zoom+2),skippedSteps=0;
  const values=['WEST','SOUTH','EAST','NORTH'].map(k=>extent[k]);
  if(values.every(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v)))){
    const [west,south,east,north]=values.map(Number);
    const cells=d=>(Math.floor((east+180)/d)-Math.floor((west+180)/d)+1)*(Math.floor((north+90)/d)-Math.floor((south+90)/d)+1);
    // Skip predictably tiny cells using the exact selection extent. Try one
    // level finer than the guaranteed bound to retain detail in sparse areas;
    // at most two aggregation scans are then needed, even at forged zoom 19.
    while(cells(gridDegrees)>p.clusterLimit&&skippedSteps<23){gridDegrees*=2;skippedSteps++;}
    if(skippedSteps){gridDegrees/=2;skippedSteps--;}
  }
  return {gridDegrees,skippedSteps};
}
async function mapData(c,sql,o,p,totals) {
  const binds={...sql.binds},viewport=viewportWhere(o,binds),where=sql.where+' AND '+sql.physicalSql+viewport;
  const extent=o.bbox?(await c.execute(`SELECT /*+ LEADING(i) USE_HASH(cat r) */ COUNT(*) physical_count,
    MIN(i.latitude) south,MAX(i.latitude) north,MIN(i.longitude) west,MAX(i.longitude) east ${sql.joins} WHERE ${where}`,binds)).rows[0]:totals;
  const inView=Number(extent.PHYSICAL_COUNT||0);
  const base={matchedPhysical:Number(totals.PHYSICAL_COUNT||0),viewportPhysical:inView,referenceOnly:Number(totals.REFERENCE_COUNT||0),bbox:o.bbox,zoom:o.zoom,rawMarkerLimit:o.rawLimit,clusterLimit:p.clusterLimit,rawMinZoom:p.rawMinZoom,sampled:false,truncated:false,approximate:true,readOnly:true,positionMeaning:'Aggregate positions summarize a group, not an incident site. Individual points retain their original approximate synthetic coordinates.'};
  if(!inView)return {...base,mode:'clusters',clusters:[],markers:[],representedCount:0,gridDegrees:null};
  if(o.zoom>=p.rawMinZoom&&inView<=o.rawLimit){
    const markers=(await c.execute(`SELECT /*+ LEADING(i) USE_HASH(cat r) */ i.incident_ref,i.latitude,i.longitude,cat.display_color,cat.executive_group_code,${sql.areaSql} district_area ${sql.joins} WHERE ${where} ORDER BY i.incident_ref,i.incident_id FETCH FIRST :rawLimit ROWS ONLY`,{...binds,rawLimit:o.rawLimit})).rows;
    if(markers.length!==inView)throw Error('Exact viewport marker count did not reconcile.');
    return {...base,mode:'markers',clusters:[],markers,representedCount:markers.length,gridDegrees:null};
  }
  // Coarsen presentation cells, never dataset validation cells or coordinates.
  // At 90 degrees there are <= 8 cells worldwide. The finite fallback is
  // provably bounded even for forged zoom/viewport combinations or duplicates.
  const plan=gridPlan(o,p,extent);let gridDegrees=plan.gridDegrees;
  for(let attempt=0;attempt<24;attempt++,gridDegrees*=2){
    const clusters=(await c.execute(`SELECT grid_x,grid_y,COUNT(*) record_count,AVG(latitude) latitude,AVG(longitude) longitude,
      MIN(latitude) south,MAX(latitude) north,MIN(longitude) west,MAX(longitude) east
      FROM (SELECT /*+ LEADING(i) USE_HASH(cat r) */ i.latitude,i.longitude,
        FLOOR((i.longitude+180)/:cellDegrees) grid_x,FLOOR((i.latitude+90)/:cellDegrees) grid_y
        ${sql.joins} WHERE ${where}) GROUP BY grid_x,grid_y ORDER BY grid_x,grid_y FETCH FIRST :clusterFetch ROWS ONLY`,{...binds,cellDegrees:gridDegrees,clusterFetch:p.clusterLimit+1})).rows;
    if(clusters.length>p.clusterLimit)continue;
    const representedCount=clusters.reduce((n,r)=>n+Number(r.RECORD_COUNT),0);
    if(representedCount!==inView)throw Error('Exact cluster counts did not reconcile.');
    return {...base,mode:'clusters',clusters,markers:[],representedCount,gridDegrees,coarseningSteps:plan.skippedSteps+attempt,detailHint:inView>o.rawLimit?'Zoom or filter further for individual markers.':'Zoom for individual markers.'};
  }
  throw Error('Bounded map aggregation failed.');
}
module.exports={policy,mode,options,pagination,viewportWhere,summarySelect,summary,gridPlan,mapData};
