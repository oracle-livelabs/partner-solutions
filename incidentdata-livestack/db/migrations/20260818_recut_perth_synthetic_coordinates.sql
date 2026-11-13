/*
  Replace the visible lattice with a diffuse, deterministic synthetic scatter.
  Points remain coarse, approximate training locations—not real incident locations
  and not a representation of actual crime concentration.
*/
MERGE INTO crime_incidents i
USING (
  WITH allocation AS (
    SELECT incident_id, TO_NUMBER(SUBSTR(incident_ref,-6)) record_number,
           MOD(TO_NUMBER(SUBSTR(incident_ref,-6))-1,60) anchor_slot,
           MOD(TO_NUMBER(SUBSTR(incident_ref,-6))-1,20)+1 local_anchor
    FROM crime_incidents WHERE incident_ref LIKE 'PCI-%'
  )
  SELECT incident_id,
    CASE WHEN anchor_slot<20 THEN -31.84-TRUNC((local_anchor-1)/5)*.06
         WHEN anchor_slot<40 THEN -31.66-TRUNC((local_anchor-1)/5)*.06
         ELSE -32.10-TRUNC((local_anchor-1)/5)*.07 END
      +((MOD(record_number*7919,1000003)/1000003)-.5)*.065 latitude,
    CASE WHEN anchor_slot<20 THEN 115.76+MOD(local_anchor-1,5)*.07
         ELSE 115.66+MOD(local_anchor-1,5)*.09 END
      +((MOD(record_number*104729,1000003)/1000003)-.5)*.085 longitude
  FROM allocation
) s ON (i.incident_id=s.incident_id)
WHEN MATCHED THEN UPDATE SET i.latitude=s.latitude,i.longitude=s.longitude;
COMMIT;
