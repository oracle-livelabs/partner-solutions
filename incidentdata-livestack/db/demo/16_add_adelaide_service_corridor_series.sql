/*
  Adelaide service-corridor comparative-review series.

  Reuses 12 existing synthetic incidents, retaining the exact 21,513 total.
  Clues are deliberately partial. The graph expresses a teaching hypothesis,
  not identity, responsibility, risk, or an operational policing finding.
*/
DEFINE apply_mode = '&1'
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
  v_active VARCHAR2(40);
  v_total NUMBER;
  v_addresses NUMBER;
BEGIN
  SELECT p.profile_code INTO v_active
  FROM z_base_active_dataset_profile a
  JOIN z_base_dataset_profiles p
    ON p.dataset_profile_id=a.dataset_profile_id
  WHERE a.control_id=1;

  SELECT COUNT(*) INTO v_total FROM crime_incidents;
  SELECT COUNT(*) INTO v_addresses
  FROM crime_incidents
  WHERE address_line_1 IS NOT NULL
    AND address_postcode IS NOT NULL
    AND address_precision='masked_vicinity';

  IF v_active<>'ADELAIDE_DATA' OR v_total<>21513 OR v_addresses<>21513 THEN
    RAISE_APPLICATION_ERROR(-20051,
      'Adelaide address-enriched v5 profile is not active; series load cancelled.');
  END IF;
END;
/

/* Idempotent cleanup of graph-only artefacts owned by this teaching series. */
DELETE FROM semantic_matches
WHERE match_reason LIKE 'Service-corridor review:%';

DELETE FROM person_incident_links
WHERE person_id IN (
  SELECT person_id FROM persons_of_interest
  WHERE person_ref IN ('POI-2026-0317A','POI-2026-0317B')
);

DELETE FROM persons_of_interest
WHERE person_ref IN ('POI-2026-0317A','POI-2026-0317B');

DELETE FROM case_incident_links
WHERE case_id IN (
  SELECT case_id FROM case_files WHERE case_ref='CASE-2026-0317'
);

DELETE FROM case_files WHERE case_ref='CASE-2026-0317';

DELETE FROM evidence_items
WHERE JSON_VALUE(evidence_metadata,'$.teaching_series')=
      'ADL_SERVICE_CORRIDOR_0317';

/* Preserve each category while adding varied, comparison-friendly context. */
UPDATE crime_incidents SET
  modus_operandi='rear service access with narrow three-point latch impressions',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'contact-mark seed',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-07569';

UPDATE crime_incidents SET
  modus_operandi='damage concentrated beside an external service panel',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'material-transfer seed',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-17922';

UPDATE crime_incidents SET
  modus_operandi='small boxed stock removed after rear-aisle movement',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'notation seed',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-10561';

UPDATE crime_incidents SET
  modus_operandi='vehicle entered without visible glass breakage near a service lane',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'material-transfer bridge',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-09330';

UPDATE crime_incidents SET
  modus_operandi='side service door disturbed with repeated shallow impressions',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'contact-mark bridge',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-07468';

UPDATE crime_incidents SET
  modus_operandi='unattended property removed during a short interchange window',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'route-timing seed',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-15938';

UPDATE crime_incidents SET
  modus_operandi='fixtures damaged near a utility cabinet after closing time',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'alarm-timing seed',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-17199';

UPDATE crime_incidents SET
  modus_operandi='vehicle access reported near a loading-side parking edge',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'material-transfer comparator',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-09252';

UPDATE crime_incidents SET
  modus_operandi='rear retail entry during a brief alarm interruption',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'alarm-timing comparator',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-07772';

UPDATE crime_incidents SET
  modus_operandi='small boxed stock removed from a rear display aisle',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'notation comparator',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-10956';

UPDATE crime_incidents SET
  modus_operandi='property removed beside a pedestrian service-route connection',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'route-timing comparator',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-12708';

UPDATE crime_incidents SET
  modus_operandi='street fixture damaged with a narrow three-point contact pattern',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'series_role' VALUE 'contact-mark comparator',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-18675';

/* Natural reports expose only the clue observed at that incident. */
UPDATE incident_reports SET
  report_summary='Rear service-door entry reported after closing at Unley Park premises',
  report_text='A commercial premises report recorded entry through a rear service door in Unley Park during the evening. Shallow three-point impressions were photographed around the latch, and a narrow service passage was noted as the likely approach. The incident remains assigned for comparison with other property reports.',
  embedding_text='after-hours commercial entry rear service door shallow three-point latch impressions narrow passage Unley Park',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'contact geometry','narrative_variant' VALUE 31701,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-07569');

UPDATE incident_reports SET
  report_summary='External service-panel damage found at Elizabeth East retail site',
  report_text='Retail staff reported damage beside an external service panel in Elizabeth East late in the evening. A short amber filament was retained from a rough edge near the damaged cover, while surrounding fixtures showed little disturbance. The report remains assigned and the material observation has not been attributed.',
  embedding_text='retail service panel damage amber polymer filament rough edge limited surrounding disturbance Elizabeth East',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'material transfer','narrative_variant' VALUE 31702,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-17922');

UPDATE incident_reports SET
  report_summary='Boxed stock missing after rear-aisle movement at Darlington retailer',
  report_text='A Darlington retailer reported several small boxed items missing following movement through a rear aisle during the evening. A torn stock label recovered near the aisle end carried the partial notation M4-17, but no complete product or consignment reference was available. The theft report was resolved on its recorded facts and retained for comparison.',
  embedding_text='retail theft small boxed stock rear aisle torn label partial notation M4-17 Darlington',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'stock notation','narrative_variant' VALUE 31703,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-10561');

UPDATE incident_reports SET
  report_summary='Vehicle reported missing beside West Hindmarsh service lane',
  report_text='A vehicle was reported missing from a shared parking edge beside a West Hindmarsh service lane during the evening. No broken glass was recorded, although a short amber filament was noted in the outer door seal and the available camera view showed only indistinct movement. The matter remains assigned without an identification finding.',
  embedding_text='vehicle missing shared parking service lane no broken glass amber filament outer door seal West Hindmarsh',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'material transfer','narrative_variant' VALUE 31704,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-09330');

UPDATE incident_reports SET
  report_summary='Side-door entry reported at Ridgehaven commercial premises',
  report_text='A Ridgehaven commercial premises reported entry through a side service door shortly after the evening closure period. Three shallow contact points were documented near the latch and shelving close to the doorway had been disturbed. The original incident was resolved, with the contact pattern retained as a comparative observation.',
  embedding_text='commercial entry side service door three shallow contact points latch disturbed shelving Ridgehaven',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'contact geometry','narrative_variant' VALUE 31705,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-07468');

UPDATE incident_reports SET
  report_summary='Equipment removed during brief Glengowrie interchange window',
  report_text='Unattended equipment was reported missing from a Glengowrie transport setting during the evening. A timing note placed the removal between two service movements twelve minutes apart, with a small utility vehicle observed leaving toward a connecting route. The description was incomplete and the report remains recorded without attribution.',
  embedding_text='unattended equipment transport interchange twelve minute service movement utility vehicle connecting route Glengowrie',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'service-route timing','narrative_variant' VALUE 31706,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-15938');

UPDATE incident_reports SET
  report_summary='Utility-cabinet damage recorded after closing near Adelaide open space',
  report_text='Damage to fixtures beside a utility cabinet was recorded near an Adelaide open-space setting during the evening. The local control log showed an eleven-minute interruption before normal service resumed, and a narrow access path remained unobstructed. The damage report was resolved independently and the timing record was retained.',
  embedding_text='fixture damage utility cabinet eleven minute control interruption access path Adelaide evening',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'alarm timing','narrative_variant' VALUE 31707,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-17199');

UPDATE incident_reports SET
  report_summary='Vehicle reported missing from Salisbury East loading-side parking edge',
  report_text='A vehicle was reported missing from a street-side parking edge near a Salisbury East loading area late in the evening. The available record noted no visible glass fragments and a short amber filament was recovered from the outer weather seal. The matter was closed on the available information without identifying a common source.',
  embedding_text='vehicle missing loading side parking no glass amber filament outer weather seal Salisbury East',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'material transfer','narrative_variant' VALUE 31708,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-09252');

UPDATE incident_reports SET
  report_summary='Rear-window entry reported during short alarm interruption at Lonsdale retailer',
  report_text='A Lonsdale retailer reported entry through a rear window during the early morning. The alarm history contained an eleven-minute interruption before signals resumed, while movement appeared confined to a rear stock area and service exit. The incident remains reported and the control-system timing requires comparative review.',
  embedding_text='retail rear window entry eleven minute alarm interruption stock area service exit Lonsdale',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'alarm timing','narrative_variant' VALUE 31709,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-07772');

UPDATE incident_reports SET
  report_summary='Small boxed stock missing from rear display aisle at Adelaide retailer',
  report_text='An Adelaide retailer reported small boxed items missing from a rear display aisle during the evening. A separated label fragment found near a service-side exit carried the partial notation M4-17, with no complete stock identifier available. The incident was resolved on its own facts and the fragment remained available for comparison.',
  embedding_text='retail theft small boxed stock rear display aisle service exit label fragment M4-17 Adelaide',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'stock notation','narrative_variant' VALUE 31710,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-10956');

UPDATE incident_reports SET
  report_summary='Property removed beside Golden Grove pedestrian service connection',
  report_text='Property was reported missing from a shared street-side area beside a Golden Grove pedestrian service connection in the evening. A route timing note placed a small utility vehicle between two nearby service movements twelve minutes apart. The original report was resolved without a vehicle or person identification.',
  embedding_text='property removed shared area pedestrian service connection twelve minute route timing utility vehicle Golden Grove',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'service-route timing','narrative_variant' VALUE 31711,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-12708');

UPDATE incident_reports SET
  report_summary='Three-point contact damage recorded on Glengowrie street fixture',
  report_text='Damage was recorded on a street fixture in Glengowrie during the evening. A comparison photograph showed three narrow contact points around a secured panel, with little damage to the surrounding surface and an open service path nearby. The report was closed independently and the contact geometry remained documented.',
  embedding_text='street fixture damage three narrow contact points secured panel service path Glengowrie',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
      'clue_family' VALUE 'contact geometry','narrative_variant' VALUE 31712,
      'synthetic_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-18675');

/* One partial evidence breadcrumb per incident. */
INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata)
SELECT i.incident_id,x.evidence_type,
       JSON_OBJECT('synthetic_record' VALUE true,
         'teaching_series' VALUE 'ADL_SERVICE_CORRIDOR_0317',
         'clue_family' VALUE x.clue_family,
         'shared_marker' VALUE x.shared_marker,
         'observed_detail' VALUE x.observed_detail,
         'review_status' VALUE 'class-level comparison only')
FROM (
  SELECT 'ACI-2026-07569' incident_ref,'latch-mark photograph' evidence_type,'contact geometry' clue_family,'three-point contact' shared_marker,'Three shallow contact points recorded beside a service-door latch' observed_detail FROM dual UNION ALL
  SELECT 'ACI-2026-17922','amber-fibre recovery','material transfer','amber polymer filament','Short amber filament retained from a damaged service-panel edge' FROM dual UNION ALL
  SELECT 'ACI-2026-10561','stock-label fragment','stock notation','M4-17','Partial M4-17 notation visible on a separated stock label' FROM dual UNION ALL
  SELECT 'ACI-2026-09330','door-seal fibre note','material transfer','amber polymer filament','Amber filament recorded at the outer vehicle door seal' FROM dual UNION ALL
  SELECT 'ACI-2026-07468','service-door impression image','contact geometry','three-point contact','Three shallow impressions recorded around a side-door latch' FROM dual UNION ALL
  SELECT 'ACI-2026-15938','service-route timing note','service-route timing','twelve-minute route window','Two service movements bracket the reported removal by twelve minutes' FROM dual UNION ALL
  SELECT 'ACI-2026-17199','control-system interruption log','alarm timing','eleven-minute interruption','Control log records an eleven-minute interruption before recovery' FROM dual UNION ALL
  SELECT 'ACI-2026-09252','weather-seal fibre recovery','material transfer','amber polymer filament','Short amber filament retained from an outer weather seal' FROM dual UNION ALL
  SELECT 'ACI-2026-07772','alarm-history extract','alarm timing','eleven-minute interruption','Alarm history records an eleven-minute signal interruption' FROM dual UNION ALL
  SELECT 'ACI-2026-10956','rear-aisle label fragment','stock notation','M4-17','Separated label fragment carries partial M4-17 notation' FROM dual UNION ALL
  SELECT 'ACI-2026-12708','connecting-route timing note','service-route timing','twelve-minute route window','Utility-vehicle observation sits within a twelve-minute service window' FROM dual UNION ALL
  SELECT 'ACI-2026-18675','panel-contact comparison image','contact geometry','three-point contact','Three narrow contact points recorded around a secured panel' FROM dual
) x
JOIN crime_incidents i ON i.incident_ref=x.incident_ref;

INSERT INTO case_files(case_ref,case_status,pattern_label,patrol_area_id)
SELECT 'CASE-2026-0317','under_review',
       'After-hours property reports under comparative review',patrol_area_id
FROM patrol_areas WHERE area_code='CENTRAL';

INSERT INTO case_incident_links(case_id,incident_id)
SELECT c.case_id,i.incident_id
FROM case_files c CROSS JOIN crime_incidents i
WHERE c.case_ref='CASE-2026-0317'
  AND JSON_VALUE(i.incident_attributes,'$.investigation_series')=
      'ADL_SERVICE_CORRIDOR_0317';

/* Context-only fictional profiles create additional graph paths. */
INSERT INTO persons_of_interest(
  person_ref,display_name,alias_name,person_status,portrait_variant,
  portrait_alt_text,narrative_summary)
VALUES ('POI-2026-0317A','Profile Alder','Alder','associate',
  'synthetic-avatar-4','Generated profile portrait for a fictional graph entity.',
  'Context-only profile assembled from recurring outerwear and vehicle-shape observations. The description is insufficient for identity or attribution.');

INSERT INTO persons_of_interest(
  person_ref,display_name,alias_name,person_status,portrait_variant,
  portrait_alt_text,narrative_summary)
VALUES ('POI-2026-0317B','Profile Meridian','Meridian','person_of_interest',
  'synthetic-avatar-5','Generated profile portrait for a fictional graph entity.',
  'Context-only profile assembled from recurring service-route timing notes. It does not establish identity, presence, or responsibility.');

INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary)
SELECT p.person_id,i.incident_id,'associate',
       'Observation-only association based on a broad outerwear or vehicle-shape note; insufficient for identification or attribution.'
FROM persons_of_interest p CROSS JOIN crime_incidents i
WHERE p.person_ref='POI-2026-0317A'
  AND i.incident_ref IN ('ACI-2026-07569','ACI-2026-09330','ACI-2026-09252');

INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary)
SELECT p.person_id,i.incident_id,'person_of_interest',
       'Context-only association based on overlapping service-route timing; no identity or responsibility finding is made.'
FROM persons_of_interest p CROSS JOIN crime_incidents i
WHERE p.person_ref='POI-2026-0317B'
  AND i.incident_ref IN ('ACI-2026-10561','ACI-2026-15938',
                         'ACI-2026-10956','ACI-2026-12708');

/* Moderate similarities form connected sub-clusters rather than a clique. */
INSERT INTO semantic_matches(
  source_incident_id,matched_incident_id,similarity_score,match_reason)
SELECT a.incident_id,b.incident_id,x.score,x.reason
FROM (
  SELECT 'ACI-2026-07569' a_ref,'ACI-2026-07468' b_ref,0.8420 score,'Service-corridor review: comparable three-point contact geometry; examiner review required' reason FROM dual UNION ALL
  SELECT 'ACI-2026-07468','ACI-2026-18675',0.8640,'Service-corridor review: repeated narrow contact geometry at class level only' FROM dual UNION ALL
  SELECT 'ACI-2026-17922','ACI-2026-09330',0.7810,'Service-corridor review: amber polymer filament characteristics align at class level only' FROM dual UNION ALL
  SELECT 'ACI-2026-09330','ACI-2026-09252',0.8030,'Service-corridor review: outer-seal fibre and access context show moderate similarity' FROM dual UNION ALL
  SELECT 'ACI-2026-10561','ACI-2026-10956',0.8360,'Service-corridor review: matching partial M4-17 stock notation on separate fragments' FROM dual UNION ALL
  SELECT 'ACI-2026-17199','ACI-2026-07772',0.8280,'Service-corridor review: comparable eleven-minute control-system interruption' FROM dual UNION ALL
  SELECT 'ACI-2026-15938','ACI-2026-12708',0.7920,'Service-corridor review: overlapping twelve-minute service-route window' FROM dual UNION ALL
  SELECT 'ACI-2026-07569','ACI-2026-17922',0.7160,'Service-corridor review: timing and service-access context support comparison only' FROM dual UNION ALL
  SELECT 'ACI-2026-09330','ACI-2026-15938',0.7340,'Service-corridor review: service-lane movement and route timing overlap' FROM dual UNION ALL
  SELECT 'ACI-2026-09252','ACI-2026-07772',0.7270,'Service-corridor review: loading-side access and alarm timing overlap' FROM dual UNION ALL
  SELECT 'ACI-2026-10956','ACI-2026-12708',0.7210,'Service-corridor review: stock movement and connecting-route timing overlap' FROM dual
) x
JOIN crime_incidents a ON a.incident_ref=x.a_ref
JOIN crime_incidents b ON b.incident_ref=x.b_ref;

DECLARE
  v_total NUMBER;
  v_series NUMBER;
  v_case_links NUMBER;
  v_evidence NUMBER;
  v_people NUMBER;
  v_person_links NUMBER;
  v_semantic NUMBER;
  v_bad NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM crime_incidents;
  SELECT COUNT(*) INTO v_series FROM crime_incidents
  WHERE JSON_VALUE(incident_attributes,'$.investigation_series')=
        'ADL_SERVICE_CORRIDOR_0317';
  SELECT COUNT(*) INTO v_case_links
  FROM case_incident_links l JOIN case_files c ON c.case_id=l.case_id
  WHERE c.case_ref='CASE-2026-0317';
  SELECT COUNT(*) INTO v_evidence FROM evidence_items
  WHERE JSON_VALUE(evidence_metadata,'$.teaching_series')=
        'ADL_SERVICE_CORRIDOR_0317';
  SELECT COUNT(*) INTO v_people FROM persons_of_interest
  WHERE person_ref IN ('POI-2026-0317A','POI-2026-0317B');
  SELECT COUNT(*) INTO v_person_links
  FROM person_incident_links l JOIN persons_of_interest p ON p.person_id=l.person_id
  WHERE p.person_ref IN ('POI-2026-0317A','POI-2026-0317B');
  SELECT COUNT(*) INTO v_semantic FROM semantic_matches
  WHERE match_reason LIKE 'Service-corridor review:%';
  SELECT COUNT(*) INTO v_bad
  FROM crime_incidents i JOIN incident_reports r ON r.incident_id=i.incident_id
  WHERE JSON_VALUE(i.incident_attributes,'$.investigation_series')=
        'ADL_SERVICE_CORRIDOR_0317'
    AND (i.address_line_1 IS NULL OR i.address_postcode IS NULL
      OR i.address_precision<>'masked_vicinity'
      OR LENGTH(r.report_summary) NOT BETWEEN 25 AND 140
      OR LENGTH(r.report_text) NOT BETWEEN 160 AND 700
      OR REGEXP_LIKE(r.report_summary||' '||DBMS_LOB.SUBSTR(r.report_text,4000,1),
           'synthetic|demonstration|non-identifying','i'));

  IF v_total<>21513 OR v_series<>12 OR v_case_links<>12 OR v_evidence<>12
     OR v_people<>2 OR v_person_links<>7 OR v_semantic<>11 OR v_bad<>0 THEN
    RAISE_APPLICATION_ERROR(-20052,
      'Adelaide service-corridor series validation failed.');
  END IF;
END;
/

SET DEFINE ON
PROMPT Series apply mode: &&apply_mode
BEGIN
  IF UPPER('&&apply_mode')='APPLY' THEN
    COMMIT;
  ELSE
    ROLLBACK;
  END IF;
END;
/
EXIT SUCCESS;
