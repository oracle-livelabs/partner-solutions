/*
  Add privacy-preserving address fields to synthetic incident records.
  These fields must never contain a real street, dwelling, workplace, or incident address.
  Run as the application schema user. Safe to re-run.
*/
DECLARE
  PROCEDURE add_column_if_missing(p_column_name VARCHAR2, p_definition VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM user_tab_columns
    WHERE table_name = 'CRIME_INCIDENTS' AND column_name = UPPER(p_column_name);

    IF v_count = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE crime_incidents ADD (' || p_definition || ')';
    END IF;
  END;
BEGIN
  add_column_if_missing('ADDRESS_LINE_1', 'address_line_1 VARCHAR2(160)');
  add_column_if_missing('ADDRESS_LOCALITY', 'address_locality VARCHAR2(100)');
  add_column_if_missing('ADDRESS_REGION', 'address_region VARCHAR2(100)');
  add_column_if_missing('ADDRESS_POSTCODE', 'address_postcode VARCHAR2(12)');
  add_column_if_missing('ADDRESS_COUNTRY_CODE', 'address_country_code CHAR(2) DEFAULT ''AU'' NOT NULL');
  add_column_if_missing('ADDRESS_PRECISION', 'address_precision VARCHAR2(40) DEFAULT ''approximate_suburb'' NOT NULL');
END;
/

UPDATE crime_incidents
SET address_line_1 = COALESCE(address_line_1, 'Synthetic vicinity — ' || suburb),
    address_locality = COALESCE(address_locality, suburb),
    address_region = CASE WHEN incident_ref LIKE 'PCI-%' THEN 'Greater Perth' ELSE 'Greater Adelaide' END,
    address_country_code = COALESCE(address_country_code, 'AU'),
    address_precision = COALESCE(address_precision, 'approximate_suburb');

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_constraints
  WHERE table_name = 'CRIME_INCIDENTS' AND constraint_name = 'CK_INCIDENT_ADDRESS_PRECISION';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE q'[ALTER TABLE crime_incidents ADD CONSTRAINT ck_incident_address_precision CHECK (address_precision IN ('approximate_suburb','locality_only','masked_vicinity'))]';
  END IF;
END;
/

/* Refresh the scoped view so its expanded column list includes the new fields. */
CREATE OR REPLACE VIEW secure_crime_incidents_v AS
SELECT i.* FROM crime_incidents i
WHERE SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER') = 'statewide_admin'
   OR EXISTS (SELECT 1 FROM security_user_geo_entitlements e
              WHERE e.user_name = SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')
                AND e.patrol_area_id = i.patrol_area_id);

COMMENT ON COLUMN crime_incidents.address_line_1 IS 'Synthetic or masked locality label only; never a real street, dwelling, workplace, or incident address.';
COMMENT ON COLUMN crime_incidents.address_locality IS 'Synthetic locality component; for the seeded profile it mirrors the approximate suburb anchor.';
COMMENT ON COLUMN crime_incidents.address_region IS 'Broad synthetic city region; not an operational boundary or deployment indicator.';
COMMENT ON COLUMN crime_incidents.address_postcode IS 'Optional synthetic postcode component. Do not populate with a real address-derived value.';
COMMENT ON COLUMN crime_incidents.address_country_code IS 'ISO 3166-1 alpha-2 country code for the synthetic address representation.';
COMMENT ON COLUMN crime_incidents.address_precision IS 'Precision of the synthetic address representation. Coordinates remain approximate training points.';

COMMIT;
