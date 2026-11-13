/*
  Adelaide art-market payment comparative-review series.

  Reuses eight existing synthetic fraud incidents, so the active profile stays
  at exactly 21,513 incidents. Person, image, document, and similarity links
  are fictional teaching leads. They do not establish identity, presence,
  responsibility, or a common offence.
*/
DEFINE apply_mode = '&1'
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
  v_active VARCHAR2(40);
  v_total NUMBER;
  v_addresses NUMBER;
  v_poi NUMBER;
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
  SELECT COUNT(*) INTO v_poi
  FROM persons_of_interest
  WHERE person_ref IN ('POI-NBNW-GEORGE','POI-NBNW-CLARA',
                       'POI-NBNW-EVE','POI-NBNW-PHILIP');

  IF v_active<>'ADELAIDE_DATA' OR v_total<>21513
     OR v_addresses<>21513 OR v_poi<>4 THEN
    RAISE_APPLICATION_ERROR(-20061,
      'Adelaide v5 profile and four fictional NByNW POIs are required.');
  END IF;
END;
/

/* Idempotent cleanup of graph artefacts owned by this teaching series. */
DELETE FROM semantic_matches
WHERE match_reason LIKE 'Art-market review:%';

DELETE FROM person_incident_links
WHERE link_summary LIKE 'Art-market review:%';

DELETE FROM case_incident_links
WHERE case_id IN (
  SELECT case_id FROM case_files WHERE case_ref='CASE-2026-0421'
);

DELETE FROM case_files WHERE case_ref='CASE-2026-0421';

DELETE FROM evidence_items
WHERE JSON_VALUE(evidence_metadata,'$.teaching_series')=
      'NBNW_ART_MARKET_0421';

/*
  Each incident retains its original date, category, coordinate, masked street
  address, and postcode. Only narrative and comparative-review attributes are
  recut for this fictional investigation exercise.
*/
UPDATE crime_incidents SET
  modus_operandi='advisory invoice payment recorded against an art inventory reference',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'NBNW_ART_MARKET_0421',
      'series_role' VALUE 'invoice-notation seed',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-16312';

UPDATE crime_incidents SET
  modus_operandi='refund documents recorded against a foundation-linked retail account',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'NBNW_ART_MARKET_0421',
      'series_role' VALUE 'ledger-code seed',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-16321';

UPDATE crime_incidents SET
  modus_operandi='duplicate provenance reference recorded across separate sale documents',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'NBNW_ART_MARKET_0421',
      'series_role' VALUE 'provenance-reference seed',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-16310';

UPDATE crime_incidents SET
  modus_operandi='multiple smaller payments recorded against one catalogue entry',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'NBNW_ART_MARKET_0421',
      'series_role' VALUE 'catalogue-payment bridge',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-16325';

UPDATE crime_incidents SET
  modus_operandi='grant payment redirected to an unrelated vendor account',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'NBNW_ART_MARKET_0421',
      'series_role' VALUE 'ledger-code comparator',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-16316';

UPDATE crime_incidents SET
  modus_operandi='repeated consultancy invoices used matching reference notation',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'NBNW_ART_MARKET_0421',
      'series_role' VALUE 'invoice-notation comparator',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-16323';

UPDATE crime_incidents SET
  modus_operandi='shipment insurance values differed across consignment records',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'NBNW_ART_MARKET_0421',
      'series_role' VALUE 'consignment-reference seed',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-16313';

UPDATE crime_incidents SET
  modus_operandi='sponsorship payments moved through accounts linked to exhibition records',
  incident_attributes=JSON_MERGEPATCH(incident_attributes,
    JSON_OBJECT('investigation_series' VALUE 'NBNW_ART_MARKET_0421',
      'series_role' VALUE 'document-reference bridge',
      'relationship_status' VALUE 'comparative review',
      'synthetic_record' VALUE true))
WHERE incident_ref='ACI-2026-16343';

/* Report language follows the incident-description quality contract. */
UPDATE incident_reports SET
  report_summary='Advisory invoice payment discrepancy reported in West Croydon',
  report_text='An online payment report was recorded in West Croydon during a May afternoon after an advisory invoice was paid against an art inventory entry. The invoice carried the suffix AR-17, while the account description did not match the supplier name held in the source record. Transaction and invoice metadata were retained for comparison, with the payee details still being verified.',
  embedding_text='West Croydon advisory invoice art inventory AR-17 supplier account mismatch online payment',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'NBNW_ART_MARKET_0421',
      'clue_family' VALUE 'invoice notation','narrative_variant' VALUE 42101,
      'source_type' VALUE 'payment report','fictional_teaching_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-16312');

UPDATE incident_reports SET
  report_summary='Foundation-linked retail refund documents referred for review',
  report_text='A North Adelaide retailer reported a late-evening refund recorded against a foundation-linked account in May. The refund form and donor ledger both carried the code OE-24, although the listed purchaser and receiving account differed between the documents. Copies were retained for account verification and no common source had been established at the time of reporting.',
  embedding_text='North Adelaide retail refund foundation donor ledger OE-24 purchaser receiving account discrepancy',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'NBNW_ART_MARKET_0421',
      'clue_family' VALUE 'ledger code','narrative_variant' VALUE 42102,
      'source_type' VALUE 'retail refund documents','fictional_teaching_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-16321');

UPDATE incident_reports SET
  report_summary='Duplicate provenance certificate number noted in Ovingham sale',
  report_text='An Ovingham retail report recorded two sale documents carrying the same provenance certificate number during May. The item descriptions and sale values were different, while both records referred to certificate P-441. The documents were referred for provenance checks, and the duplicated reference was treated as a comparison point rather than proof of a connected transaction.',
  embedding_text='Ovingham retail sale duplicate provenance certificate P-441 different items values',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'NBNW_ART_MARKET_0421',
      'clue_family' VALUE 'provenance reference','narrative_variant' VALUE 42103,
      'source_type' VALUE 'sale documents','fictional_teaching_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-16310');

UPDATE incident_reports SET
  report_summary='Split art-sale payments recorded against one Adelaide catalogue entry',
  report_text='An Adelaide retail report recorded several smaller payments against one catalogue entry during a May afternoon. The payment sequence was followed by an amended purchaser record and a later resale notation, but the available documents did not explain the changes. The catalogue extract and account sequence were retained for source verification.',
  embedding_text='Adelaide art sale split payments catalogue entry amended purchaser resale notation',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'NBNW_ART_MARKET_0421',
      'clue_family' VALUE 'catalogue payments','narrative_variant' VALUE 42104,
      'source_type' VALUE 'gallery payment records','fictional_teaching_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-16325');

UPDATE incident_reports SET
  report_summary='Charitable grant payment redirected to an unrelated vendor account',
  report_text='An online report in North Adelaide recorded an overnight grant payment redirected to a vendor account not listed on the original approval. A ledger note beside the amended instruction carried the code OE-24, matching the format used in the foundation record. The payment path and authorisation history were retained for review, without attributing the change to a person.',
  embedding_text='North Adelaide charitable grant redirected vendor account OE-24 authorisation history',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'NBNW_ART_MARKET_0421',
      'clue_family' VALUE 'ledger code','narrative_variant' VALUE 42105,
      'source_type' VALUE 'grant payment report','fictional_teaching_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-16316');

UPDATE incident_reports SET
  report_summary='Repeated consultancy invoices identified during Prospect account review',
  report_text='A Prospect account review identified several consultancy invoices submitted online during a June afternoon. The service descriptions varied, but two records used the suffix AR-17 and directed payment to accounts with closely matching descriptors. Invoice metadata and approval times were retained for comparison while the underlying services remained subject to verification.',
  embedding_text='Prospect consultancy invoices AR-17 matching account descriptors approval times',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'NBNW_ART_MARKET_0421',
      'clue_family' VALUE 'invoice notation','narrative_variant' VALUE 42106,
      'source_type' VALUE 'account review','fictional_teaching_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-16323');

UPDATE incident_reports SET
  report_summary='Art shipment insurance values differ across submitted records',
  report_text='An online report from Dudley Park recorded different insurance values for the same art shipment during a June evening. The carrier notice and coverage schedule both used consignment reference DS-8, while the stated contents and declared values did not align. Copies were retained for comparison with the shipping instruction and no deliberate cause had been determined.',
  embedding_text='Dudley Park art shipment insurance values consignment DS-8 carrier coverage mismatch',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'NBNW_ART_MARKET_0421',
      'clue_family' VALUE 'consignment reference','narrative_variant' VALUE 42107,
      'source_type' VALUE 'shipment insurance records','fictional_teaching_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-16313');

UPDATE incident_reports SET
  report_summary='Exhibition sponsorship payment sequence referred for comparison',
  report_text='A Norwood online report recorded a June sponsorship payment sequence linked to an exhibition account. One transfer referred to provenance certificate P-441 and a later account note used consignment reference DS-8, but neither reference was complete in the payment record. The sequence was retained for document comparison and the relationship between the references remained unconfirmed.',
  embedding_text='Norwood exhibition sponsorship payments provenance P-441 consignment DS-8 account sequence',
  enrichments=JSON_MERGEPATCH(enrichments,
    JSON_OBJECT('teaching_series' VALUE 'NBNW_ART_MARKET_0421',
      'clue_family' VALUE 'document references','narrative_variant' VALUE 42108,
      'source_type' VALUE 'sponsorship payment report','fictional_teaching_record' VALUE true))
WHERE incident_id=(SELECT incident_id FROM crime_incidents WHERE incident_ref='ACI-2026-16343');

MERGE INTO incident_report_embeddings e
USING (
  SELECT incident_id FROM crime_incidents
  WHERE JSON_VALUE(incident_attributes,'$.investigation_series')=
        'NBNW_ART_MARKET_0421'
) s
ON (e.incident_id=s.incident_id)
WHEN MATCHED THEN UPDATE SET
  e.embedding_model='adelaide_art_market_case_v1',
  e.embedding=TO_VECTOR('[0,0,1,0,0,0,0,0]'),
  e.created_at=SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT(incident_id,embedding_model,embedding)
VALUES(s.incident_id,'adelaide_art_market_case_v1',
       TO_VECTOR('[0,0,1,0,0,0,0,0]'));

/* One document clue per report. Matching references form four discoverable pairs. */
INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata)
SELECT i.incident_id,x.evidence_type,
       JSON_OBJECT('synthetic_record' VALUE true,
         'teaching_series' VALUE 'NBNW_ART_MARKET_0421',
         'clue_family' VALUE x.clue_family,
         'shared_marker' VALUE x.shared_marker,
         'observed_detail' VALUE x.observed_detail,
         'review_status' VALUE 'comparison lead only')
FROM (
  SELECT 'ACI-2026-16312' incident_ref,'invoice metadata extract' evidence_type,'invoice notation' clue_family,'AR-17' shared_marker,'Advisory invoice carries the suffix AR-17 beside an art inventory entry' observed_detail FROM dual UNION ALL
  SELECT 'ACI-2026-16321','refund and donor-ledger copies','ledger code','OE-24','Refund form and donor ledger both display the code OE-24' FROM dual UNION ALL
  SELECT 'ACI-2026-16310','provenance certificate copies','provenance reference','P-441','Different sale records carry provenance certificate number P-441' FROM dual UNION ALL
  SELECT 'ACI-2026-16325','catalogue and payment extract','catalogue payments','split-payment sequence','Several payments and an amended purchaser record refer to one catalogue entry' FROM dual UNION ALL
  SELECT 'ACI-2026-16316','grant authorisation history','ledger code','OE-24','Amended grant instruction contains ledger notation OE-24' FROM dual UNION ALL
  SELECT 'ACI-2026-16323','consultancy invoice metadata','invoice notation','AR-17','Two consultancy invoices use the suffix AR-17 with similar account descriptors' FROM dual UNION ALL
  SELECT 'ACI-2026-16313','shipment insurance documents','consignment reference','DS-8','Carrier notice and coverage schedule use consignment reference DS-8' FROM dual UNION ALL
  SELECT 'ACI-2026-16343','sponsorship payment extract','document references','P-441 / DS-8','Payment notes contain partial references to P-441 and DS-8' FROM dual
) x
JOIN crime_incidents i ON i.incident_ref=x.incident_ref;

/* Four generated, identity-consistent public-setting images. */
INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata)
SELECT i.incident_id,x.evidence_type,
       JSON_OBJECT('synthetic_record' VALUE true,
         'generated_fictional' VALUE true,
         'teaching_series' VALUE 'NBNW_ART_MARKET_0421',
         'clue_family' VALUE 'public-setting image',
         'shared_marker' VALUE x.shared_marker,
         'observed_detail' VALUE x.observed_detail,
         'asset_uri' VALUE x.asset_uri,
         'asset_caption' VALUE x.asset_caption,
         'review_status' VALUE 'context image; no attribution')
FROM (
  SELECT 'ACI-2026-16312' incident_ref,'cafe meeting image' evidence_type,'George / Eve' shared_marker,'Generated image shows George Kaplan and Eve Kendall speaking at a city cafe' observed_detail,'/poi/nbynw/case-images/george-eve-coffee.png' asset_uri,'George Kaplan and Eve Kendall at an Adelaide cafe' asset_caption FROM dual UNION ALL
  SELECT 'ACI-2026-16321','shopping-precinct meeting image','Clara / Philip','Generated image shows Clara Thornhill and Philip Vandamm speaking in a shopping precinct','/poi/nbynw/case-images/clara-philip-shopping.png','Clara Thornhill and Philip Vandamm in an Adelaide shopping precinct' FROM dual UNION ALL
  SELECT 'ACI-2026-16325','gallery meeting image','Eve / Philip','Generated image shows Eve Kendall and Philip Vandamm speaking in an art gallery','/poi/nbynw/case-images/eve-philip-gallery.png','Eve Kendall and Philip Vandamm at an Adelaide art gallery' FROM dual UNION ALL
  SELECT 'ACI-2026-16323','theatre-entrance meeting image','George / Clara','Generated image shows George Kaplan and Clara Thornhill speaking near a theatre entrance','/poi/nbynw/case-images/george-clara-theatre.png','George Kaplan and Clara Thornhill at an Adelaide theatre entrance' FROM dual
) x
JOIN crime_incidents i ON i.incident_ref=x.incident_ref;

INSERT INTO case_files(case_ref,case_status,pattern_label,patrol_area_id)
SELECT 'CASE-2026-0421','under_review',
       'Art-market payment reports under comparative review',patrol_area_id
FROM patrol_areas WHERE area_code='CENTRAL';

INSERT INTO case_incident_links(case_id,incident_id)
SELECT c.case_id,i.incident_id
FROM case_files c CROSS JOIN crime_incidents i
WHERE c.case_ref='CASE-2026-0421'
  AND JSON_VALUE(i.incident_attributes,'$.investigation_series')=
      'NBNW_ART_MARKET_0421';

/* Neutral, explainable associations. They are leads, not findings. */
INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary)
SELECT p.person_id,i.incident_id,'associate',x.link_summary
FROM (
  SELECT 'POI-NBNW-GEORGE' person_ref,'ACI-2026-16312' incident_ref,'Art-market review: generated cafe image provides public-setting context only; it does not establish involvement in the reported payment.' link_summary FROM dual UNION ALL
  SELECT 'POI-NBNW-GEORGE','ACI-2026-16325','Art-market review: the fictional contact record contains a name variant retained for comparison only.' FROM dual UNION ALL
  SELECT 'POI-NBNW-GEORGE','ACI-2026-16316','Art-market review: a name variant appears in the supplied fictional authorisation history; attribution remains unconfirmed.' FROM dual UNION ALL
  SELECT 'POI-NBNW-GEORGE','ACI-2026-16323','Art-market review: generated theatre image provides public-setting context only; it does not establish involvement in the invoice report.' FROM dual UNION ALL
  SELECT 'POI-NBNW-EVE','ACI-2026-16312','Art-market review: generated cafe image provides public-setting context only; it does not establish involvement in the reported payment.' FROM dual UNION ALL
  SELECT 'POI-NBNW-EVE','ACI-2026-16310','Art-market review: a name variant appears in a fictional provenance contact note and is retained for comparison only.' FROM dual UNION ALL
  SELECT 'POI-NBNW-EVE','ACI-2026-16325','Art-market review: generated gallery image provides public-setting context only; it does not establish involvement in the payment sequence.' FROM dual UNION ALL
  SELECT 'POI-NBNW-EVE','ACI-2026-16343','Art-market review: a name variant appears in the supplied fictional sponsorship record; attribution remains unconfirmed.' FROM dual UNION ALL
  SELECT 'POI-NBNW-CLARA','ACI-2026-16321','Art-market review: generated shopping-precinct image provides public-setting context only; it does not establish involvement in the refund.' FROM dual UNION ALL
  SELECT 'POI-NBNW-CLARA','ACI-2026-16316','Art-market review: a fictional contact entry is retained for comparison with the grant authorisation history only.' FROM dual UNION ALL
  SELECT 'POI-NBNW-CLARA','ACI-2026-16323','Art-market review: generated theatre image provides public-setting context only; it does not establish involvement in the invoice report.' FROM dual UNION ALL
  SELECT 'POI-NBNW-PHILIP','ACI-2026-16321','Art-market review: generated shopping-precinct image provides public-setting context only; it does not establish involvement in the refund.' FROM dual UNION ALL
  SELECT 'POI-NBNW-PHILIP','ACI-2026-16325','Art-market review: generated gallery image provides public-setting context only; it does not establish involvement in the payment sequence.' FROM dual UNION ALL
  SELECT 'POI-NBNW-PHILIP','ACI-2026-16313','Art-market review: a name variant appears in a fictional consignment contact note and is retained for comparison only.' FROM dual UNION ALL
  SELECT 'POI-NBNW-PHILIP','ACI-2026-16343','Art-market review: a fictional exhibition contact entry is retained for document comparison only.' FROM dual
) x
JOIN persons_of_interest p ON p.person_ref=x.person_ref
JOIN crime_incidents i ON i.incident_ref=x.incident_ref;

/* Sparse similarities make the relationship discoverable at three hops. */
INSERT INTO semantic_matches(
  source_incident_id,matched_incident_id,similarity_score,match_reason)
SELECT a.incident_id,b.incident_id,x.score,x.reason
FROM (
  SELECT 'ACI-2026-16312' a_ref,'ACI-2026-16323' b_ref,0.8460 score,'Art-market review: matching AR-17 invoice notation; source-document review required' reason FROM dual UNION ALL
  SELECT 'ACI-2026-16321','ACI-2026-16316',0.8320,'Art-market review: shared OE-24 ledger code across refund and grant records' FROM dual UNION ALL
  SELECT 'ACI-2026-16310','ACI-2026-16343',0.8140,'Art-market review: provenance reference P-441 appears in separate document sets' FROM dual UNION ALL
  SELECT 'ACI-2026-16313','ACI-2026-16343',0.8210,'Art-market review: consignment reference DS-8 appears in shipment and sponsorship records' FROM dual UNION ALL
  SELECT 'ACI-2026-16312','ACI-2026-16325',0.7480,'Art-market review: art inventory and catalogue payment context support comparison only' FROM dual UNION ALL
  SELECT 'ACI-2026-16321','ACI-2026-16325',0.7310,'Art-market review: retail payment timing and amended-account context overlap' FROM dual UNION ALL
  SELECT 'ACI-2026-16325','ACI-2026-16323',0.7620,'Art-market review: catalogue and consultancy payment descriptors show moderate similarity' FROM dual UNION ALL
  SELECT 'ACI-2026-16316','ACI-2026-16313',0.7140,'Art-market review: account redirection and shipment coverage records share a vendor descriptor' FROM dual UNION ALL
  SELECT 'ACI-2026-16323','ACI-2026-16343',0.7390,'Art-market review: invoice approval and sponsorship sequence contain overlapping exhibition context' FROM dual
) x
JOIN crime_incidents a ON a.incident_ref=x.a_ref
JOIN crime_incidents b ON b.incident_ref=x.b_ref;

DECLARE
  v_total NUMBER;
  v_series NUMBER;
  v_case_links NUMBER;
  v_evidence NUMBER;
  v_images NUMBER;
  v_person_links NUMBER;
  v_people NUMBER;
  v_semantic NUMBER;
  v_report_vectors NUMBER;
  v_bad NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM crime_incidents;
  SELECT COUNT(*) INTO v_series FROM crime_incidents
  WHERE JSON_VALUE(incident_attributes,'$.investigation_series')=
        'NBNW_ART_MARKET_0421';
  SELECT COUNT(*) INTO v_case_links
  FROM case_incident_links l JOIN case_files c ON c.case_id=l.case_id
  WHERE c.case_ref='CASE-2026-0421';
  SELECT COUNT(*) INTO v_evidence FROM evidence_items
  WHERE JSON_VALUE(evidence_metadata,'$.teaching_series')=
        'NBNW_ART_MARKET_0421';
  SELECT COUNT(*) INTO v_images FROM evidence_items
  WHERE JSON_VALUE(evidence_metadata,'$.teaching_series')=
        'NBNW_ART_MARKET_0421'
    AND JSON_VALUE(evidence_metadata,'$.asset_uri') IS NOT NULL;
  SELECT COUNT(*) INTO v_person_links
  FROM person_incident_links WHERE link_summary LIKE 'Art-market review:%';
  SELECT COUNT(DISTINCT person_id) INTO v_people
  FROM person_incident_links WHERE link_summary LIKE 'Art-market review:%';
  SELECT COUNT(*) INTO v_semantic FROM semantic_matches
  WHERE match_reason LIKE 'Art-market review:%';
  SELECT COUNT(*) INTO v_report_vectors
  FROM incident_report_embeddings e
  JOIN crime_incidents i ON i.incident_id=e.incident_id
  WHERE JSON_VALUE(i.incident_attributes,'$.investigation_series')=
        'NBNW_ART_MARKET_0421'
    AND e.embedding_model='adelaide_art_market_case_v1';
  SELECT COUNT(*) INTO v_bad
  FROM crime_incidents i JOIN incident_reports r ON r.incident_id=i.incident_id
  WHERE JSON_VALUE(i.incident_attributes,'$.investigation_series')=
        'NBNW_ART_MARKET_0421'
    AND (i.address_line_1 IS NULL OR i.address_postcode IS NULL
      OR i.address_precision<>'masked_vicinity'
      OR LENGTH(r.report_summary) NOT BETWEEN 25 AND 140
      OR LENGTH(r.report_text) NOT BETWEEN 160 AND 700
      OR REGEXP_LIKE(r.report_summary||' '||DBMS_LOB.SUBSTR(r.report_text,4000,1),
           'synthetic|demonstration|non-identifying','i'));

  IF v_total<>21513 OR v_series<>8 OR v_case_links<>8
     OR v_evidence<>12 OR v_images<>4 OR v_person_links<>15
     OR v_people<>4 OR v_semantic<>9 OR v_report_vectors<>8 OR v_bad<>0 THEN
    RAISE_APPLICATION_ERROR(-20062,
      'Adelaide art-market graph series validation failed.');
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
