/* Keep legacy Adelaide/Perth recoverable snapshots aligned with CRIME_INCIDENTS. */
DECLARE
  PROCEDURE add_column_if_missing(p_table_name VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM user_tab_columns
    WHERE table_name = UPPER(p_table_name)
      AND column_name = 'ADDRESS_ENRICHMENT_SOURCE';

    IF v_count = 0 THEN
      EXECUTE IMMEDIATE
        'ALTER TABLE ' || DBMS_ASSERT.SQL_OBJECT_NAME(p_table_name) ||
        ' ADD (address_enrichment_source VARCHAR2(40) DEFAULT NULL)';
    END IF;
  END;
BEGIN
  add_column_if_missing('BASIC_BAK_CRIME_INCIDENTS');
  add_column_if_missing('PERTH_BAK_CRIME_INCIDENTS');
END;
/

COMMENT ON COLUMN basic_bak_crime_incidents.address_enrichment_source IS
  'Address enrichment method preserved with the Adelaide recoverable profile.';

COMMENT ON COLUMN perth_bak_crime_incidents.address_enrichment_source IS
  'Address enrichment method preserved with the Perth recoverable profile.';

COMMIT;
EXIT SUCCESS;
