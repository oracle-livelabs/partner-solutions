/*
  Synthetic coastal-transition treatment for the Perth teaching map.
  The varying landward envelope is illustrative only: it is not a coastline,
  address source, real incident location, or real crime-area representation.
*/
MERGE INTO crime_incidents i
USING (
  WITH allocation AS (
    SELECT incident_id, TO_NUMBER(SUBSTR(incident_ref,-6)) record_number,
           MOD(TO_NUMBER(SUBSTR(incident_ref,-6))-1,60) anchor_slot,
           MOD(TO_NUMBER(SUBSTR(incident_ref,-6))-1,20)+1 local_anchor
    FROM crime_incidents WHERE incident_ref LIKE 'PCI-%'
  ), raw_points AS (
    SELECT incident_id,local_anchor,
      CASE WHEN anchor_slot<20 THEN -31.82-TRUNC((local_anchor-1)/5)*.065
           WHEN anchor_slot<40 THEN -31.56-TRUNC((local_anchor-1)/5)*.070
           ELSE -32.08-TRUNC((local_anchor-1)/5)*.080 END
        +SIN(local_anchor*2.17)*.018+COS(local_anchor*.83)*.011
        +((MOD(record_number*7919,1000003)/1000003)-.5)*.075 latitude,
      115.78+(CASE WHEN anchor_slot<20 THEN 115.76+MOD(local_anchor-1,5)*.070 ELSE 115.68+MOD(local_anchor-1,5)*.090 END-115.66)*.83
        +SIN(local_anchor*1.41)*.015+((MOD(record_number*104729,1000003)/1000003)-.5)*.110 candidate_longitude
    FROM allocation
  ), landward AS (
    SELECT incident_id,latitude,candidate_longitude,
      115.705+SIN((latitude+32.1)*13)*.014+COS((latitude+32.1)*31)*.007 coast_envelope
    FROM raw_points
  )
  SELECT incident_id,latitude,
    CASE WHEN candidate_longitude<coast_envelope THEN coast_envelope+(coast_envelope-candidate_longitude)*.30 ELSE candidate_longitude END longitude
  FROM landward
) s ON (i.incident_id=s.incident_id)
WHEN MATCHED THEN UPDATE SET i.latitude=s.latitude,i.longitude=s.longitude;
COMMIT;
