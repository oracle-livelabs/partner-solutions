/*
  Reset address enrichment for rows that have coordinates.
  SUBURB, ADDRESS_COUNTRY_CODE, and ADDRESS_PRECISION are not nullable, so
  SUBURB receives a single space and the other required fields return to their
  defaults. Geopy will subsequently replace SUBURB with its resolved locality.
*/
UPDATE crime_incidents
SET address_line_1 = NULL,
    address_locality = NULL,
    address_region = NULL,
    address_postcode = NULL,
    address_country_code = 'AU',
    address_precision = 'approximate_suburb',
    address_enrichment_source = NULL,
    suburb = ' '
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL;

COMMIT;
EXIT SUCCESS;
