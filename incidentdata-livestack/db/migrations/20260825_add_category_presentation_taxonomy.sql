/*
  Add locality-owned presentation metadata to the detailed category lookup.
  The application can group, order, colour and filter categories without
  locality-specific code. Snapshot tables receive the same columns so profile
  capture and restore remain column-compatible.
*/
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
  PROCEDURE add_column_if_missing(p_table VARCHAR2, p_column VARCHAR2, p_definition VARCHAR2) IS
    v_table_count NUMBER;
    v_column_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_table_count FROM user_tables WHERE table_name=UPPER(p_table);
    IF v_table_count = 0 THEN RETURN; END IF;
    SELECT COUNT(*) INTO v_column_count FROM user_tab_columns
    WHERE table_name=UPPER(p_table) AND column_name=UPPER(p_column);
    IF v_column_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE '||p_table||' ADD ('||p_column||' '||p_definition||')';
    END IF;
  END;

  PROCEDURE extend_category_table(p_table VARCHAR2) IS
  BEGIN
    add_column_if_missing(p_table,'locality_code',q'[VARCHAR2(40) DEFAULT 'UNSPECIFIED' NOT NULL]');
    add_column_if_missing(p_table,'executive_group_code',q'[VARCHAR2(40) DEFAULT 'UNMAPPED' NOT NULL]');
    add_column_if_missing(p_table,'executive_group_label',q'[VARCHAR2(100) DEFAULT 'Unmapped' NOT NULL]');
    add_column_if_missing(p_table,'display_order','NUMBER DEFAULT 999 NOT NULL');
    add_column_if_missing(p_table,'display_color',q'[VARCHAR2(7) DEFAULT '#437C94' NOT NULL]');
    add_column_if_missing(p_table,'active','NUMBER(1) DEFAULT 1 NOT NULL');
  END;
BEGIN
  extend_category_table('INCIDENT_CATEGORIES');
  extend_category_table('Z_BASE_INCIDENT_CATEGORIES');
  extend_category_table('BASIC_BAK_INCIDENT_CATEGORIES');
  extend_category_table('PERTH_BAK_INCIDENT_CATEGORIES');
  extend_category_table('BRISBANE_BAK_INCIDENT_CATEGORIES');
END;
/

COMMENT ON COLUMN incident_categories.locality_code IS 'Dataset-owned locality taxonomy code; the application must not infer it.';
COMMENT ON COLUMN incident_categories.executive_group_code IS 'Stable executive presentation group supplied by the active locality profile.';
COMMENT ON COLUMN incident_categories.executive_group_label IS 'Executive-facing group label supplied by profile data.';
COMMENT ON COLUMN incident_categories.display_order IS 'Dataset-owned presentation order for grouped category views.';
COMMENT ON COLUMN incident_categories.display_color IS 'Dataset-owned hexadecimal presentation colour.';
COMMENT ON COLUMN incident_categories.active IS 'Whether the detailed category is available to application presentation.';

COMMIT;
EXIT SUCCESS;
