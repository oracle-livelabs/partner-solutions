'use strict';
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),oracle=require('oracledb');
// Independent streamed comparison against stored coordinates, not the map
// helper's own SQL. Does not load the full profile into a browser or mutate it.
module.exports=async function verify(full,dense,close,bbox){
  const app=JSON.parse(execFileSync('podman',['inspect','policeadelaide_app-fu40_1'],{encoding:'utf8'}))[0];
  const env=Object.fromEntries(app.Config.Env.map(v=>{const i=v.indexOf('=');return[v.slice(0,i),v.slice(i+1)];}));
  assert.equal(env.ORACLE_USER,'CRIME_DATA');
  const c=await oracle.getConnection({user:env.ORACLE_USER,password:env.APP_SCHEMA_PASSWORD,connectString:env.ORACLE_CONNECTION_STRING,walletLocation:'/home/opc/wallet',walletPassword:env.ORACLE_WALLET_PASSWORD,configDir:'/home/opc/wallet'});
  let rs;try{
    await c.execute('SET TRANSACTION READ ONLY');
    rs=(await c.execute(`SELECT incident_ref,latitude,longitude FROM z_base_crime_incidents
      WHERE dataset_profile_id=4 AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
      AND COALESCE(JSON_VALUE(incident_attributes,'$.location_role'),'physical_context')<>'locality_reference'`,{}, {outFormat:oracle.OUT_FORMAT_OBJECT,resultSet:true,fetchArraySize:1000})).resultSet;
    const grids=[full.map,dense.map].map(m=>({map:m,counts:new Map()})),inside=new Set();let total=0,batches=0;
    for(;;){const rows=await rs.getRows(1000);if(!rows.length)break;batches++;
      for(const r of rows){total++;const x=r.LONGITUDE,y=r.LATITUDE;
        for(const g of grids){const key=Math.floor((x+180)/g.map.gridDegrees)+','+Math.floor((y+90)/g.map.gridDegrees);g.counts.set(key,(g.counts.get(key)||0)+1);}
        if(x>=bbox[0]&&x<=bbox[2]&&y>=bbox[1]&&y<=bbox[3])inside.add(r.INCIDENT_REF);
      }
    }
    assert.equal(total,42317);
    for(const g of grids){assert.equal(g.counts.size,g.map.clusters.length);for(const row of g.map.clusters)assert.equal(g.counts.get(row.GRID_X+','+row.GRID_Y),row.RECORD_COUNT);}
    assert.equal(inside.size,close.map.representedCount);
    if(close.map.mode==='markers')assert.deepEqual(new Set(close.map.markers.map(m=>m.INCIDENT_REF)),inside);
    return {stored_physical_rows:total,stream_batches:batches,cluster_grids_independently_reconciled:grids.length,viewport_rows:inside.size,all_returned_marker_references_verified:close.map.mode==='markers',writes:0};
  }finally{if(rs)await rs.close();await c.close();}
};
