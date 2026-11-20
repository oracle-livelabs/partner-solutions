/*
  Synthetic landward rebalance for the Perth teaching map.
  Uses a coarse land-only envelope and irregular anchor offsets; it is not a
  coastline model, a real-location dataset, or a crime-concentration model.
*/
MERGE INTO crime_incidents i
USING (
  WITH allocation AS (
    SELECT incident_id, TO_NUMBER(SUBSTR(incident_ref,-6)) record_number,
           MOD(TO_NUMBER(SUBSTR(incident_ref,-6))-1,60) anchor_slot,
           MOD(TO_NUMBER(SUBSTR(incident_ref,-6))-1,20)+1 local_anchor
    FROM crime_incidents WHERE incident_ref LIKE 'PCI-%'
  ), anchors AS (
    SELECT incident_id,record_number,local_anchor,
      CASE WHEN anchor_slot<20 THEN -31.82-TRUNC((local_anchor-1)/5)*.065
           WHEN anchor_slot<40 THEN -31.56-TRUNC((local_anchor-1)/5)*.070
           ELSE -32.08-TRUNC((local_anchor-1)/5)*.080 END base_lat,
      CASE WHEN anchor_slot<20 THEN 115.76+MOD(local_anchor-1,5)*.070
           ELSE 115.68+MOD(local_anchor-1,5)*.090 END base_lon
    FROM allocation
  )
  SELECT incident_id,
    base_lat+SIN(local_anchor*2.17)*.018+COS(local_anchor*.83)*.011
      +((MOD(record_number*7919,1000003)/1000003)-.5)*.075 latitude,
    115.84+(base_lon-115.66)*.72+SIN(local_anchor*1.41)*.014
      +((MOD(record_number*104729,1000003)/1000003)-.5)*.080 longitude
  FROM anchors
) s ON (i.incident_id=s.incident_id)
WHEN MATCHED THEN UPDATE SET i.latitude=s.latitude,i.longitude=s.longitude;
COMMIT;
