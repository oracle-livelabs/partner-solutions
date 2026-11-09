/*
  Brisbane Metro synthetic pattern vectors.
  Eight interpretable, non-predictive dimensions: unlawful entry, vehicle,
  fraud, property damage, person offences, drug offences, public-order/traffic,
  and other property. These are demonstration vectors, not risk or identity
  embeddings and must not be used for operational decisions.
*/
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DELETE FROM incident_report_embeddings;

INSERT INTO incident_report_embeddings(incident_id,embedding_model,embedding)
SELECT i.incident_id,'brisbane_qgso_pattern_demo_v1',
  TO_VECTOR(CASE
    WHEN c.category_code LIKE 'UNLAWFUL_ENTRY%' THEN '[1,0,0,0,0,0,0,0]'
    WHEN c.category_code='UNLAWFUL_USE_MOTOR_VEHICLE' THEN '[0,1,0,0,0,0,0,0]'
    WHEN c.category_code='FRAUD' THEN '[0,0,1,0,0,0,0,0]'
    WHEN c.category_code IN ('OTHER_PROPERTY_DAMAGE','ARSON') THEN '[0,0,0,1,0,0,0,0]'
    WHEN c.category_code IN ('MURDER','OTHER_HOMICIDE','GRIEVOUS_ASSAULT','SERIOUS_ASSAULT','SERIOUS_ASSAULT_NO_INJURY','COMMON_ASSAULT','RAPE_ATTEMPTED_RAPE','OTHER_SEXUAL_OFFENCES','ARMED_ROBBERY','UNARMED_ROBBERY','KIDNAPPING_ABDUCTION','EXTORTION','STALKING','LIFE_ENDANGERING_ACTS','COERCIVE_CONTROL','BREACH_DVO') THEN '[0,0,0,0,1,0,0,0]'
    WHEN c.category_code LIKE 'DRUG_%' OR c.category_code='OTHER_DRUG_OFFENCES' THEN '[0,0,0,0,0,1,0,0]'
    WHEN c.category_code IN ('GOOD_ORDER','TRAFFIC_RELATED','LIQUOR_OFFENCES','TRESPASSING_VAGRANCY','WEAPONS_ACT','MISCELLANEOUS') THEN '[0,0,0,0,0,0,1,0]'
    ELSE '[0,0,0,0,0,0,0,1]'
  END)
FROM crime_incidents i JOIN incident_categories c ON c.category_id=i.category_id;

DECLARE v_incidents NUMBER; v_vectors NUMBER; BEGIN
  SELECT COUNT(*) INTO v_incidents FROM crime_incidents;
  SELECT COUNT(*) INTO v_vectors FROM incident_report_embeddings;
  IF v_incidents<>42317 OR v_vectors<>v_incidents THEN
    RAISE_APPLICATION_ERROR(-20031,'Brisbane vector validation failed: incidents='||v_incidents||', vectors='||v_vectors);
  END IF;
END;
/
COMMIT;
