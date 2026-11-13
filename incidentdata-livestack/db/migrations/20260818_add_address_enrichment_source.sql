/* Track the process that populated a CRIME_INCIDENTS address representation. */
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_tab_columns
  WHERE table_name = 'CRIME_INCIDENTS'
    AND column_name = 'ADDRESS_ENRICHMENT_SOURCE';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE crime_incidents ADD (address_enrichment_source VARCHAR2(40) DEFAULT NULL)';
  END IF;
END;
/

COMMENT ON COLUMN crime_incidents.address_enrichment_source IS
  'Address enrichment method, for example GEOPY_NOMINATIM or SYNTHETIC_FALLBACK. Null means not processed by the address enrichment script.';

COMMIT;
EXIT SUCCESS;
