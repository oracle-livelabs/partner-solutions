/* Add reusable profile-owned category metadata used by every locality. */
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
  PROCEDURE add_column_if_missing(p_table VARCHAR2, p_column VARCHAR2, p_definition VARCHAR2) IS
    v_table_count NUMBER;
    v_column_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_table_count FROM user_tables WHERE table_name=UPPER(p_table);
    IF v_table_count=0 THEN RETURN; END IF;
    SELECT COUNT(*) INTO v_column_count FROM user_tab_columns
    WHERE table_name=UPPER(p_table) AND column_name=UPPER(p_column);
    IF v_column_count=0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE '||p_table||' ADD ('||p_column||' '||p_definition||')';
    END IF;
  END;

  PROCEDURE extend_category_table(p_table VARCHAR2) IS
  BEGIN
    add_column_if_missing(p_table,'category_description','VARCHAR2(300)');
    add_column_if_missing(p_table,'person_property_class',q'[VARCHAR2(20) DEFAULT 'OTHER' NOT NULL]');
    add_column_if_missing(p_table,'synthetic_profile_code','VARCHAR2(60)');
  END;
BEGIN
  extend_category_table('INCIDENT_CATEGORIES');
  extend_category_table('Z_BASE_INCIDENT_CATEGORIES');
  extend_category_table('BASIC_BAK_INCIDENT_CATEGORIES');
  extend_category_table('PERTH_BAK_INCIDENT_CATEGORIES');
  extend_category_table('BRISBANE_BAK_INCIDENT_CATEGORIES');
END;
/

COMMENT ON COLUMN incident_categories.category_description IS 'Profile-owned detailed taxonomy description.';
COMMENT ON COLUMN incident_categories.person_property_class IS 'Profile-owned broad classification such as PERSON, PROPERTY or OTHER.';
COMMENT ON COLUMN incident_categories.synthetic_profile_code IS 'Synthetic city-profile version that supplied the category mapping.';

COMMIT;
EXIT SUCCESS;
