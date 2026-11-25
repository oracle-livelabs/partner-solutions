/* Keep recoverable profile snapshots compatible with CRIME_INCIDENTS address fields. */
DECLARE
  PROCEDURE add_column_if_missing(p_table_name VARCHAR2, p_definition VARCHAR2, p_column_name VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_tab_columns WHERE table_name=UPPER(p_table_name) AND column_name=UPPER(p_column_name);
    IF v_count=0 THEN EXECUTE IMMEDIATE 'ALTER TABLE '||p_table_name||' ADD ('||p_definition||')'; END IF;
  END;
BEGIN
  FOR t IN (SELECT table_name FROM user_tables WHERE table_name IN ('BASIC_BAK_CRIME_INCIDENTS','PERTH_BAK_CRIME_INCIDENTS')) LOOP
    add_column_if_missing(t.table_name,'address_line_1 VARCHAR2(160)','address_line_1');
    add_column_if_missing(t.table_name,'address_locality VARCHAR2(100)','address_locality');
    add_column_if_missing(t.table_name,'address_region VARCHAR2(100)','address_region');
    add_column_if_missing(t.table_name,'address_postcode VARCHAR2(12)','address_postcode');
    add_column_if_missing(t.table_name,'address_country_code CHAR(2)','address_country_code');
    add_column_if_missing(t.table_name,'address_precision VARCHAR2(40)','address_precision');
  END LOOP;
END;
/
COMMIT;
