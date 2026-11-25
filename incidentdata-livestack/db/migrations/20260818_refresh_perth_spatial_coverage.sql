/*
  Redistribute the Perth test profile across a broad, synthetic anchor catalogue.
  Contract: May-June 2026, AWST; 60 approximate anchors; 0.004-degree teaching
  cells; fixed seed = incident reference; no real address or incident location.
*/
MERGE INTO crime_incidents i
USING (
  WITH source_rows AS (
    SELECT incident_id, TO_NUMBER(SUBSTR(incident_ref,-6)) record_number
    FROM crime_incidents WHERE incident_ref LIKE 'PCI-%'
  ), allocation AS (
    SELECT incident_id,record_number,MOD(record_number-1,60) anchor_slot,
           MOD(record_number-1,20)+1 local_anchor,
           MOD(TRUNC((record_number-1)/60),25) grid_slot
    FROM source_rows
  )
  SELECT incident_id,
    CASE WHEN anchor_slot<20 THEN 'Perth Metro Central '||LPAD(local_anchor,2,'0')
         WHEN anchor_slot<40 THEN 'Perth Metro North '||LPAD(local_anchor,2,'0')
         ELSE 'Perth Metro South '||LPAD(local_anchor,2,'0') END suburb,
    CASE WHEN anchor_slot<20 THEN -31.84-TRUNC((local_anchor-1)/5)*.06
         WHEN anchor_slot<40 THEN -31.66-TRUNC((local_anchor-1)/5)*.06
         ELSE -32.10-TRUNC((local_anchor-1)/5)*.07 END
      +(TRUNC(grid_slot/5)-2)*.006+((MOD(record_number*7919,1000003)/1000003)-.5)*.002 latitude,
    CASE WHEN anchor_slot<20 THEN 115.76+MOD(local_anchor-1,5)*.07
         WHEN anchor_slot<40 THEN 115.66+MOD(local_anchor-1,5)*.09
         ELSE 115.66+MOD(local_anchor-1,5)*.09 END
      +(MOD(grid_slot,5)-2)*.006+((MOD(record_number*104729,1000003)/1000003)-.5)*.002 longitude
  FROM allocation
) s ON (i.incident_id=s.incident_id)
WHEN MATCHED THEN UPDATE SET
  i.suburb=s.suburb,
  i.latitude=s.latitude,
  i.longitude=s.longitude,
  i.address_line_1='Synthetic vicinity — '||s.suburb,
  i.address_locality=s.suburb,
  i.address_region='Greater Perth',
  i.address_country_code='AU',
  i.address_precision='approximate_suburb';

COMMIT;
