/*
  Bounded, entirely synthetic linked-series teaching scenario.
  It reuses 12 existing Brisbane records so the profile remains exactly 42,317
  incidents. The relationship is a teaching hypothesis only: it neither proves
  a common actor nor represents a real event, location, or person.
*/
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

/* Choose one controlled record from each category/area combination. */
UPDATE crime_incidents
SET modus_operandi='after-hours-market-circuit',
    incident_status='under_review',
    incident_attributes=JSON_OBJECT('synthetic_record' VALUE true,
      'city_profile' VALUE 'brisbane_metro_may_jun_2026_demonstration',
      'teaching_series' VALUE 'BRIS_NMC_026',
      'series_note' VALUE 'Fictional cross-area context marker; not a finding or attribution.',
      'spatial_precision' VALUE 'approximate suburb-level training point')
WHERE incident_id IN (
  SELECT incident_id FROM (
    SELECT i.incident_id,ROW_NUMBER() OVER (PARTITION BY c.category_code,p.area_code ORDER BY i.occurred_at,i.incident_id) rn
    FROM crime_incidents i JOIN incident_categories c ON c.category_id=i.category_id JOIN patrol_areas p ON p.patrol_area_id=i.patrol_area_id
    WHERE (c.category_code,p.area_code) IN (
      ('UNLAWFUL_ENTRY_SHOP','BRIS_CENTRAL'),('UNLAWFUL_ENTRY_SHOP','BRIS_NORTH'),
      ('OTHER_THEFT','BRIS_SOUTH'),('OTHER_THEFT','BRIS_WEST'),
      ('FRAUD','BRIS_CENTRAL'),('FRAUD','BRIS_OUTER'),
      ('UNLAWFUL_USE_MOTOR_VEHICLE','BRIS_NORTH'),('UNLAWFUL_USE_MOTOR_VEHICLE','BRIS_SOUTH'),
      ('HANDLING_STOLEN_GOODS','BRIS_WEST'),('HANDLING_STOLEN_GOODS','BRIS_OUTER'),
      ('DRUG_SELL_SUPPLY','BRIS_CENTRAL'),('DRUG_SELL_SUPPLY','BRIS_SOUTH')
    )
      AND i.modus_operandi <> 'after-hours-market-circuit'
  ) WHERE rn=1
);

/* Keep hints partial: all records get only the teaching-series label, while
   individual reports carry different, non-identifying fictional artefacts. */
UPDATE incident_reports r
SET report_summary='Cross-area context review - '||(SELECT incident_ref FROM crime_incidents i WHERE i.incident_id=r.incident_id),
    report_text=CASE MOD(r.incident_id,4)
      WHEN 0 THEN 'A generated cross-area context review was retained for an approximate metropolitan setting. The record notes a fictional after-hours handling sequence and a non-identifying docket suffix Q7; this is a teaching clue only, not a finding of responsibility. No real address, person, or event is represented.'
      WHEN 1 THEN 'A synthetic report was retained for later relationship exploration in an approximate Brisbane setting. A fictional stock-list notation uses the phrase midnight changeover; the notation is deliberately incomplete and does not establish a connection. This record has no real-world referent.'
      WHEN 2 THEN 'A generated report records a broad after-hours context in a suburb-level training point. It notes a fictional folded-blue-token observation in a controlled demonstration scenario; the observation is not evidence about any real person or event. No identifying detail is included.'
      ELSE 'A non-identifying demonstration record notes an approximate commercial or public setting. The report retains a fictional dispatch shorthand R-26 for graph and vector exploration only; it is not an investigative conclusion and has no real-world referent.'
    END,
    embedding_text='after-hours market circuit fictional Q7 midnight changeover folded blue token dispatch R-26 controlled demonstration',
    enrichments=JSON_OBJECT('synthetic_record' VALUE true,'city_profile' VALUE 'brisbane_metro_may_jun_2026_demonstration','teaching_series' VALUE 'BRIS_NMC_026','narrative_variant' VALUE MOD(r.incident_id,4),'relationship_status' VALUE 'fictional context under review')
WHERE r.incident_id IN (SELECT incident_id FROM crime_incidents WHERE modus_operandi='after-hours-market-circuit');

MERGE INTO case_files c USING (
  SELECT 'BRIS-CASE-026' case_ref,'under_review' case_status,'Cross-area commercial-context review' pattern_label,patrol_area_id
  FROM patrol_areas WHERE area_code='BRIS_CENTRAL'
) s ON (c.case_ref=s.case_ref)
WHEN MATCHED THEN UPDATE SET c.case_status=s.case_status,c.pattern_label=s.pattern_label,c.patrol_area_id=s.patrol_area_id
WHEN NOT MATCHED THEN INSERT(case_ref,case_status,pattern_label,patrol_area_id) VALUES(s.case_ref,s.case_status,s.pattern_label,s.patrol_area_id);

INSERT INTO case_incident_links(case_id,incident_id)
SELECT c.case_id,i.incident_id FROM case_files c CROSS JOIN crime_incidents i
WHERE c.case_ref='BRIS-CASE-026' AND i.modus_operandi='after-hours-market-circuit'
  AND NOT EXISTS (SELECT 1 FROM case_incident_links l WHERE l.case_id=c.case_id AND l.incident_id=i.incident_id);

MERGE INTO persons_of_interest p USING (
  SELECT 'BPOI-2026-0261' person_ref,'Profile Lantern' display_name,'Lantern' alias_name,'associate' person_status,'demonstration-avatar-1' portrait_variant FROM dual UNION ALL
  SELECT 'BPOI-2026-0262','Profile Quay','Quay','person_of_interest','demonstration-avatar-2' FROM dual UNION ALL
  SELECT 'BPOI-2026-0263','Profile Cedar','Cedar','associate','demonstration-avatar-3' FROM dual
) s ON (p.person_ref=s.person_ref)
WHEN MATCHED THEN UPDATE SET p.display_name=s.display_name,p.alias_name=s.alias_name,p.person_status=s.person_status,p.portrait_variant=s.portrait_variant
WHEN NOT MATCHED THEN INSERT(person_ref,display_name,alias_name,person_status,portrait_variant,portrait_alt_text,narrative_summary)
  VALUES(s.person_ref,s.display_name,s.alias_name,s.person_status,s.portrait_variant,'Generated fictional profile for controlled graph teaching; not a real person.','Fictional teaching entity connected to a bounded relationship scenario; not an identity or culpability claim.');

INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary)
SELECT p.person_id,i.incident_id,CASE MOD(i.incident_id,3) WHEN 0 THEN 'associate' WHEN 1 THEN 'person_of_interest' ELSE 'associate' END,
  'Fictional graph-teaching relationship only; it does not identify or attribute conduct to a real person.'
FROM persons_of_interest p JOIN crime_incidents i ON MOD(i.incident_id,3)=MOD(p.person_id,3)
WHERE p.person_ref IN ('BPOI-2026-0261','BPOI-2026-0262','BPOI-2026-0263') AND i.modus_operandi='after-hours-market-circuit'
  AND NOT EXISTS (SELECT 1 FROM person_incident_links l WHERE l.person_id=p.person_id AND l.incident_id=i.incident_id);

INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata)
SELECT i.incident_id,
  CASE MOD(i.incident_id,4) WHEN 0 THEN 'docket-fragment-observation' WHEN 1 THEN 'stock-list-notation' WHEN 2 THEN 'token-colour-observation' ELSE 'dispatch-shorthand-observation' END,
  JSON_OBJECT('synthetic_record' VALUE true,'teaching_series' VALUE 'BRIS_NMC_026','shared_marker' VALUE CASE MOD(i.incident_id,4) WHEN 0 THEN 'Q7' WHEN 1 THEN 'midnight changeover' WHEN 2 THEN 'folded blue token' ELSE 'R-26' END,'description' VALUE 'Fictional, non-identifying teaching artefact; not real evidence.')
FROM crime_incidents i WHERE i.modus_operandi='after-hours-market-circuit'
  AND NOT EXISTS (SELECT 1 FROM evidence_items e WHERE e.incident_id=i.incident_id AND JSON_VALUE(e.evidence_metadata,'$.teaching_series')='BRIS_NMC_026');

INSERT INTO semantic_matches(source_incident_id,matched_incident_id,similarity_score,match_reason)
SELECT a.incident_id,b.incident_id,0.7800 + MOD(a.incident_id+b.incident_id,17)/1000,
  'Fictional teaching-series context: BRIS_NMC_026; not a finding of a real-world link.'
FROM crime_incidents a JOIN crime_incidents b ON a.incident_id<b.incident_id
WHERE a.modus_operandi='after-hours-market-circuit' AND b.modus_operandi='after-hours-market-circuit'
  AND NOT EXISTS (SELECT 1 FROM semantic_matches s WHERE s.source_incident_id=a.incident_id AND s.matched_incident_id=b.incident_id);

/* Give the selected series a blended vector so Vector Search is a discovery
   aid, while the case graph remains the authoritative teaching pathway. */
UPDATE incident_report_embeddings
SET embedding_model='brisbane_night_market_circuit_demo_v1',embedding=TO_VECTOR('[0.72,0.08,0.18,0.12,0.10,0.08,0.05,0.62]')
WHERE incident_id IN (SELECT incident_id FROM crime_incidents WHERE modus_operandi='after-hours-market-circuit');

DECLARE v_series NUMBER; v_links NUMBER; v_evidence NUMBER; v_total NUMBER; BEGIN
  SELECT COUNT(*) INTO v_series FROM crime_incidents WHERE modus_operandi='after-hours-market-circuit';
  SELECT COUNT(*) INTO v_links FROM case_incident_links l JOIN case_files c ON c.case_id=l.case_id WHERE c.case_ref='BRIS-CASE-026';
  SELECT COUNT(*) INTO v_evidence FROM evidence_items WHERE JSON_VALUE(evidence_metadata,'$.teaching_series')='BRIS_NMC_026';
  SELECT COUNT(*) INTO v_total FROM crime_incidents;
  IF v_series<>12 OR v_links<>12 OR v_evidence<>12 OR v_total<>42317 THEN RAISE_APPLICATION_ERROR(-20041,'Brisbane teaching-series validation failed.'); END IF;
END;
/
COMMIT;
