/*
  Prepare a 50-record Perth address-context pilot from existing synthetic
  coordinates. This does not change CRIME_INCIDENTS.

  The nearest anchor is calculated from the 60 existing synthetic suburb
  clusters. It is not a reverse-geocoded street, dwelling, premise, or real
  incident location.
*/
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_tables
  WHERE table_name = 'PERTH_ADDRESS_COORDINATE_PILOT';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE perth_address_coordinate_pilot (
        incident_id NUMBER PRIMARY KEY,
        incident_ref VARCHAR2(24) NOT NULL,
        latitude NUMBER(9,6) NOT NULL,
        longitude NUMBER(9,6) NOT NULL,
        current_suburb VARCHAR2(100),
        proposed_suburb VARCHAR2(100) NOT NULL,
        proposed_address_line_1 VARCHAR2(160) NOT NULL,
        proposed_address_locality VARCHAR2(100) NOT NULL,
        proposed_address_region VARCHAR2(100) NOT NULL,
        proposed_address_postcode VARCHAR2(12),
        proposed_address_country_code CHAR(2) NOT NULL,
        proposed_address_precision VARCHAR2(40) NOT NULL,
        nearest_anchor_distance_km NUMBER(8,3) NOT NULL,
        review_status VARCHAR2(20) DEFAULT 'proposed' NOT NULL
          CHECK (review_status IN ('proposed','approved','rejected','applied')),
        prepared_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
        applied_at TIMESTAMP
      )
    ]';
  END IF;
END;
/

MERGE INTO perth_address_coordinate_pilot pilot
USING (
  WITH anchors AS (
    SELECT suburb AS anchor_suburb,
           AVG(latitude) AS anchor_latitude,
           AVG(longitude) AS anchor_longitude
    FROM crime_incidents
    WHERE incident_ref LIKE 'PCI-%'
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    GROUP BY suburb
  ), sampled AS (
    SELECT incident_id, incident_ref, latitude, longitude, suburb
    FROM (
      SELECT i.incident_id, i.incident_ref, i.latitude, i.longitude, i.suburb,
             ROW_NUMBER() OVER (
               ORDER BY ORA_HASH(i.incident_ref, 4294967295, 20260818)
             ) AS sample_rank
      FROM crime_incidents i
      WHERE i.incident_ref LIKE 'PCI-%'
        AND i.latitude IS NOT NULL
        AND i.longitude IS NOT NULL
    )
    WHERE sample_rank <= 50
  ), ranked AS (
    SELECT s.incident_id, s.incident_ref, s.latitude, s.longitude,
           s.suburb AS current_suburb, a.anchor_suburb,
           SQRT(
             POWER((s.latitude - a.anchor_latitude) * 111.32, 2)
             + POWER(
                 (s.longitude - a.anchor_longitude) * 111.32
                 * COS((s.latitude + a.anchor_latitude) * ACOS(-1) / 360),
                 2
               )
           ) AS distance_km,
           ROW_NUMBER() OVER (
             PARTITION BY s.incident_id
             ORDER BY POWER(s.latitude - a.anchor_latitude, 2)
                    + POWER(s.longitude - a.anchor_longitude, 2),
                      a.anchor_suburb
           ) AS anchor_rank
    FROM sampled s
    CROSS JOIN anchors a
  )
  SELECT incident_id, incident_ref, latitude, longitude, current_suburb,
         anchor_suburb AS proposed_suburb,
         'Synthetic vicinity — ' || anchor_suburb AS proposed_address_line_1,
         anchor_suburb AS proposed_address_locality,
         'Greater Perth' AS proposed_address_region,
         CAST(NULL AS VARCHAR2(12)) AS proposed_address_postcode,
         'AU' AS proposed_address_country_code,
         'approximate_suburb' AS proposed_address_precision,
         ROUND(distance_km, 3) AS nearest_anchor_distance_km
  FROM ranked
  WHERE anchor_rank = 1
) proposal
ON (pilot.incident_id = proposal.incident_id)
WHEN MATCHED THEN UPDATE SET
  pilot.incident_ref = proposal.incident_ref,
  pilot.latitude = proposal.latitude,
  pilot.longitude = proposal.longitude,
  pilot.current_suburb = proposal.current_suburb,
  pilot.proposed_suburb = proposal.proposed_suburb,
  pilot.proposed_address_line_1 = proposal.proposed_address_line_1,
  pilot.proposed_address_locality = proposal.proposed_address_locality,
  pilot.proposed_address_region = proposal.proposed_address_region,
  pilot.proposed_address_postcode = proposal.proposed_address_postcode,
  pilot.proposed_address_country_code = proposal.proposed_address_country_code,
  pilot.proposed_address_precision = proposal.proposed_address_precision,
  pilot.nearest_anchor_distance_km = proposal.nearest_anchor_distance_km,
  pilot.review_status = CASE WHEN pilot.review_status = 'applied' THEN 'applied' ELSE 'proposed' END,
  pilot.prepared_at = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
  incident_id, incident_ref, latitude, longitude, current_suburb,
  proposed_suburb, proposed_address_line_1, proposed_address_locality,
  proposed_address_region, proposed_address_postcode, proposed_address_country_code,
  proposed_address_precision, nearest_anchor_distance_km
) VALUES (
  proposal.incident_id, proposal.incident_ref, proposal.latitude, proposal.longitude,
  proposal.current_suburb, proposal.proposed_suburb, proposal.proposed_address_line_1,
  proposal.proposed_address_locality, proposal.proposed_address_region,
  proposal.proposed_address_postcode, proposal.proposed_address_country_code,
  proposal.proposed_address_precision, proposal.nearest_anchor_distance_km
);

COMMIT;

SELECT incident_ref,
       current_suburb,
       proposed_suburb,
       proposed_address_line_1,
       nearest_anchor_distance_km,
       review_status
FROM perth_address_coordinate_pilot
ORDER BY nearest_anchor_distance_km DESC, incident_ref;
