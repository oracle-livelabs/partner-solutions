/*
  Apply only reviewed, approved rows from the coordinate pilot.
  Run 20260818_prepare_perth_address_coordinate_pilot.sql first, then mark
  selected rows APPROVED in PERTH_ADDRESS_COORDINATE_PILOT.
*/
MERGE INTO crime_incidents incident
USING (
  SELECT incident_id,
         proposed_suburb,
         proposed_address_line_1,
         proposed_address_locality,
         proposed_address_region,
         proposed_address_postcode,
         proposed_address_country_code,
         proposed_address_precision
  FROM perth_address_coordinate_pilot
  WHERE review_status = 'approved'
) pilot
ON (incident.incident_id = pilot.incident_id)
WHEN MATCHED THEN UPDATE SET
  incident.suburb = pilot.proposed_suburb,
  incident.address_line_1 = pilot.proposed_address_line_1,
  incident.address_locality = pilot.proposed_address_locality,
  incident.address_region = pilot.proposed_address_region,
  incident.address_postcode = pilot.proposed_address_postcode,
  incident.address_country_code = pilot.proposed_address_country_code,
  incident.address_precision = pilot.proposed_address_precision;

UPDATE perth_address_coordinate_pilot
SET review_status = 'applied', applied_at = SYSTIMESTAMP
WHERE review_status = 'approved';

COMMIT;
