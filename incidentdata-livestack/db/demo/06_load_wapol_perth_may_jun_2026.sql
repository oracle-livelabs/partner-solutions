/*
  Perth Metropolitan Area — WAPOL May/June 2026 synthetic teaching profile.
  Counts are calibrated only to the supplied WAPOL Metropolitan Region monthly
  aggregate table. No row, person, relationship or coordinate is real.
  Spatial contract: 60 synthetic coarse anchors; 0.004-degree teaching grid;
  at most approximately 23 records per anchor-grid cell; fixed seed = incident reference.
*/
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE v_count NUMBER; BEGIN
  SELECT COUNT(*) INTO v_count FROM crime_incidents;
  IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20011,'Clear the operational profile before loading Perth.'); END IF;
END;
/

DELETE FROM security_user_geo_entitlements;
DELETE FROM patrol_areas;
DELETE FROM incident_categories;

MERGE INTO security_users t USING (
  SELECT 'statewide_admin' user_name,'admin' role_name,'Statewide Administrator' display_name FROM dual UNION ALL
  SELECT 'central_analyst','analyst','Perth Central Analyst' FROM dual UNION ALL
  SELECT 'northern_analyst','analyst','Perth Northern Analyst' FROM dual UNION ALL
  SELECT 'southern_analyst','analyst','Perth Southern Analyst' FROM dual UNION ALL
  SELECT 'read_only_viewer','viewer','Limited Viewer' FROM dual
) s ON (t.user_name=s.user_name)
WHEN MATCHED THEN UPDATE SET t.role_name=s.role_name,t.display_name=s.display_name,t.is_active=1
WHEN NOT MATCHED THEN INSERT (user_name,role_name,display_name,is_active) VALUES (s.user_name,s.role_name,s.display_name,1);

INSERT INTO patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) VALUES ('PERTH_CENTRAL','Perth Central','central',-31.9523,115.8613);
INSERT INTO patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) VALUES ('PERTH_NORTH','Northern Perth Metro','north',-31.8200,115.8200);
INSERT INTO patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) VALUES ('PERTH_SOUTH','Southern Perth Metro','south',-32.0300,115.8400);
INSERT INTO security_user_geo_entitlements SELECT 'central_analyst',patrol_area_id FROM patrol_areas WHERE area_code='PERTH_CENTRAL';
INSERT INTO security_user_geo_entitlements SELECT 'northern_analyst',patrol_area_id FROM patrol_areas WHERE area_code='PERTH_NORTH';
INSERT INTO security_user_geo_entitlements SELECT 'southern_analyst',patrol_area_id FROM patrol_areas WHERE area_code='PERTH_SOUTH';
INSERT INTO security_user_geo_entitlements SELECT 'read_only_viewer',patrol_area_id FROM patrol_areas WHERE area_code='PERTH_CENTRAL';

INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('HOMICIDE','Homicide','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('RECENT_SEXUAL','Recent sexual offences','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('HISTORICAL_SEXUAL','Historical sexual offences','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('ASSAULT_FAMILY','Assault (family)','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('ASSAULT_NON_FAMILY','Assault (non-family)','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('THREAT_FAMILY','Threatening behaviour (family)','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('THREAT_NON_FAMILY','Threatening behaviour (non-family)','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('DEPRIVATION_LIBERTY','Deprivation of liberty','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('ROBBERY','Robbery','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('BURGLARY','Burglary','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('MOTOR_VEHICLE_STEALING','Stealing of motor vehicle','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('STEALING','Stealing','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('PROPERTY_DAMAGE','Property damage','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('ARSON','Arson','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('DRUG_OFFENCES','Drug offences','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('STOLEN_PROPERTY','Receiving and possession of stolen property','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('WEAPONS','Regulated weapons offences','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('GRAFFITI','Graffiti','low');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('FRAUD','Fraud and related offences','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('VRO_BREACH','Breach of violence restraint order','high');

INSERT INTO crime_incidents(incident_ref,category_id,patrol_area_id,incident_status,occurred_at,location_type,suburb,latitude,longitude,address_line_1,address_locality,address_region,address_country_code,address_precision,modus_operandi,property_category,vehicle_descriptor,incident_attributes)
WITH targets(category_code,may_count,jun_count,source_group) AS (
  SELECT 'HOMICIDE',4,2,'person' FROM dual UNION ALL SELECT 'RECENT_SEXUAL',342,274,'person' FROM dual UNION ALL SELECT 'HISTORICAL_SEXUAL',72,111,'person' FROM dual UNION ALL
  SELECT 'ASSAULT_FAMILY',1837,1707,'person' FROM dual UNION ALL SELECT 'ASSAULT_NON_FAMILY',1120,998,'person' FROM dual UNION ALL SELECT 'THREAT_FAMILY',527,601,'person' FROM dual UNION ALL SELECT 'THREAT_NON_FAMILY',471,414,'person' FROM dual UNION ALL SELECT 'DEPRIVATION_LIBERTY',39,19,'person' FROM dual UNION ALL SELECT 'ROBBERY',108,119,'person' FROM dual UNION ALL
  SELECT 'BURGLARY',557,619,'property' FROM dual UNION ALL SELECT 'MOTOR_VEHICLE_STEALING',198,244,'property' FROM dual UNION ALL SELECT 'STEALING',4994,4958,'property' FROM dual UNION ALL SELECT 'PROPERTY_DAMAGE',1703,1535,'property' FROM dual UNION ALL SELECT 'ARSON',44,26,'property' FROM dual UNION ALL
  SELECT 'DRUG_OFFENCES',2106,1952,'detected' FROM dual UNION ALL SELECT 'STOLEN_PROPERTY',250,244,'detected' FROM dual UNION ALL SELECT 'WEAPONS',396,393,'detected' FROM dual UNION ALL
  SELECT 'GRAFFITI',59,56,'miscellaneous' FROM dual UNION ALL SELECT 'FRAUD',1058,1332,'miscellaneous' FROM dual UNION ALL SELECT 'VRO_BREACH',1089,933,'miscellaneous' FROM dual
), periods(month_key,month_start,target_column) AS (SELECT 'May-26','2026-05-01',1 FROM dual UNION ALL SELECT 'Jun-26','2026-06-01',2 FROM dual), nums(n) AS (SELECT LEVEL FROM dual CONNECT BY LEVEL<=5000), expanded AS (
  SELECT t.category_code,t.source_group,p.month_key,p.month_start,n.n,CASE WHEN p.target_column=1 THEN t.may_count ELSE t.jun_count END target_count
  FROM targets t CROSS JOIN periods p CROSS JOIN nums n WHERE n.n<=CASE WHEN p.target_column=1 THEN t.may_count ELSE t.jun_count END
), ordered AS (SELECT e.*,ROW_NUMBER() OVER (ORDER BY month_start,category_code,n) record_number FROM expanded e), anchors(anchor_key,area_code,suburb,lat,lon) AS (
  SELECT 1,'PERTH_CENTRAL','Perth Metro Central 01',-31.92,115.78 FROM dual UNION ALL SELECT 2,'PERTH_CENTRAL','Perth Metro Central 02',-31.92,115.86 FROM dual UNION ALL SELECT 3,'PERTH_CENTRAL','Perth Metro Central 03',-31.92,115.94 FROM dual UNION ALL SELECT 4,'PERTH_CENTRAL','Perth Metro Central 04',-31.96,115.74 FROM dual UNION ALL SELECT 5,'PERTH_CENTRAL','Perth Metro Central 05',-31.96,115.82 FROM dual UNION ALL
  SELECT 6,'PERTH_CENTRAL','Perth Metro Central 06',-31.96,115.90 FROM dual UNION ALL SELECT 7,'PERTH_CENTRAL','Perth Metro Central 07',-31.96,115.98 FROM dual UNION ALL SELECT 8,'PERTH_CENTRAL','Perth Metro Central 08',-32.00,115.78 FROM dual UNION ALL SELECT 9,'PERTH_CENTRAL','Perth Metro Central 09',-32.00,115.86 FROM dual UNION ALL SELECT 10,'PERTH_CENTRAL','Perth Metro Central 10',-32.00,115.94 FROM dual UNION ALL
  SELECT 11,'PERTH_CENTRAL','Perth Metro Central 11',-32.04,115.82 FROM dual UNION ALL SELECT 12,'PERTH_CENTRAL','Perth Metro Central 12',-32.04,115.90 FROM dual UNION ALL SELECT 13,'PERTH_CENTRAL','Perth Metro Central 13',-31.88,115.82 FROM dual UNION ALL SELECT 14,'PERTH_CENTRAL','Perth Metro Central 14',-31.88,115.90 FROM dual UNION ALL SELECT 15,'PERTH_CENTRAL','Perth Metro Central 15',-31.92,116.02 FROM dual UNION ALL
  SELECT 16,'PERTH_CENTRAL','Perth Metro Central 16',-32.00,116.02 FROM dual UNION ALL SELECT 17,'PERTH_CENTRAL','Perth Metro Central 17',-32.08,115.86 FROM dual UNION ALL SELECT 18,'PERTH_CENTRAL','Perth Metro Central 18',-32.08,115.94 FROM dual UNION ALL SELECT 19,'PERTH_CENTRAL','Perth Metro Central 19',-31.84,115.90 FROM dual UNION ALL SELECT 20,'PERTH_CENTRAL','Perth Metro Central 20',-31.88,115.98 FROM dual UNION ALL
  SELECT 21,'PERTH_NORTH','Perth Metro North 01',-31.68,115.70 FROM dual UNION ALL SELECT 22,'PERTH_NORTH','Perth Metro North 02',-31.68,115.80 FROM dual UNION ALL SELECT 23,'PERTH_NORTH','Perth Metro North 03',-31.68,115.90 FROM dual UNION ALL SELECT 24,'PERTH_NORTH','Perth Metro North 04',-31.72,116.00 FROM dual UNION ALL SELECT 25,'PERTH_NORTH','Perth Metro North 05',-31.74,115.66 FROM dual UNION ALL
  SELECT 26,'PERTH_NORTH','Perth Metro North 06',-31.74,115.76 FROM dual UNION ALL SELECT 27,'PERTH_NORTH','Perth Metro North 07',-31.74,115.86 FROM dual UNION ALL SELECT 28,'PERTH_NORTH','Perth Metro North 08',-31.74,115.96 FROM dual UNION ALL SELECT 29,'PERTH_NORTH','Perth Metro North 09',-31.78,115.70 FROM dual UNION ALL SELECT 30,'PERTH_NORTH','Perth Metro North 10',-31.78,115.80 FROM dual UNION ALL
  SELECT 31,'PERTH_NORTH','Perth Metro North 11',-31.78,115.90 FROM dual UNION ALL SELECT 32,'PERTH_NORTH','Perth Metro North 12',-31.78,116.00 FROM dual UNION ALL SELECT 33,'PERTH_NORTH','Perth Metro North 13',-31.82,115.66 FROM dual UNION ALL SELECT 34,'PERTH_NORTH','Perth Metro North 14',-31.82,115.76 FROM dual UNION ALL SELECT 35,'PERTH_NORTH','Perth Metro North 15',-31.82,115.86 FROM dual UNION ALL
  SELECT 36,'PERTH_NORTH','Perth Metro North 16',-31.82,115.96 FROM dual UNION ALL SELECT 37,'PERTH_NORTH','Perth Metro North 17',-31.86,115.70 FROM dual UNION ALL SELECT 38,'PERTH_NORTH','Perth Metro North 18',-31.86,115.80 FROM dual UNION ALL SELECT 39,'PERTH_NORTH','Perth Metro North 19',-31.86,115.90 FROM dual UNION ALL SELECT 40,'PERTH_NORTH','Perth Metro North 20',-31.86,116.00 FROM dual UNION ALL
  SELECT 41,'PERTH_SOUTH','Perth Metro South 01',-32.10,115.70 FROM dual UNION ALL SELECT 42,'PERTH_SOUTH','Perth Metro South 02',-32.10,115.80 FROM dual UNION ALL SELECT 43,'PERTH_SOUTH','Perth Metro South 03',-32.10,115.90 FROM dual UNION ALL SELECT 44,'PERTH_SOUTH','Perth Metro South 04',-32.10,116.00 FROM dual UNION ALL SELECT 45,'PERTH_SOUTH','Perth Metro South 05',-32.16,115.66 FROM dual UNION ALL
  SELECT 46,'PERTH_SOUTH','Perth Metro South 06',-32.16,115.76 FROM dual UNION ALL SELECT 47,'PERTH_SOUTH','Perth Metro South 07',-32.16,115.86 FROM dual UNION ALL SELECT 48,'PERTH_SOUTH','Perth Metro South 08',-32.16,115.96 FROM dual UNION ALL SELECT 49,'PERTH_SOUTH','Perth Metro South 09',-32.22,115.70 FROM dual UNION ALL SELECT 50,'PERTH_SOUTH','Perth Metro South 10',-32.22,115.80 FROM dual UNION ALL
  SELECT 51,'PERTH_SOUTH','Perth Metro South 11',-32.22,115.90 FROM dual UNION ALL SELECT 52,'PERTH_SOUTH','Perth Metro South 12',-32.22,116.00 FROM dual UNION ALL SELECT 53,'PERTH_SOUTH','Perth Metro South 13',-32.28,115.66 FROM dual UNION ALL SELECT 54,'PERTH_SOUTH','Perth Metro South 14',-32.28,115.76 FROM dual UNION ALL SELECT 55,'PERTH_SOUTH','Perth Metro South 15',-32.28,115.86 FROM dual UNION ALL
  SELECT 56,'PERTH_SOUTH','Perth Metro South 16',-32.28,115.96 FROM dual UNION ALL SELECT 57,'PERTH_SOUTH','Perth Metro South 17',-32.34,115.70 FROM dual UNION ALL SELECT 58,'PERTH_SOUTH','Perth Metro South 18',-32.34,115.80 FROM dual UNION ALL SELECT 59,'PERTH_SOUTH','Perth Metro South 19',-32.34,115.90 FROM dual UNION ALL SELECT 60,'PERTH_SOUTH','Perth Metro South 20',-32.34,116.00 FROM dual
)
SELECT 'PCI-2026-'||LPAD(o.record_number,6,'0'),c.category_id,p.patrol_area_id,
  CASE MOD(o.record_number,10) WHEN 0 THEN 'reported' WHEN 1 THEN 'under_review' WHEN 2 THEN 'assigned' WHEN 3 THEN 'assigned' WHEN 4 THEN 'under_review' WHEN 5 THEN 'resolved' WHEN 6 THEN 'resolved' ELSE 'closed_no_further_action' END,
  TO_TIMESTAMP_TZ(o.month_start||' 00:00:00 +08:00','YYYY-MM-DD HH24:MI:SS TZH:TZM')+NUMTODSINTERVAL(MOD(o.record_number*43,CASE WHEN o.month_key='May-26' THEN 44640 ELSE 43200 END),'MINUTE'),
  CASE WHEN o.source_group='property' THEN 'approximate property context' WHEN o.source_group='detected' THEN 'reported community context' ELSE 'approximate metropolitan context' END,
  a.suburb,a.lat+((MOD(o.record_number*7919,1000003)/1000003)-.5)*.065,a.lon+((MOD(o.record_number*104729,1000003)/1000003)-.5)*.085,
  'Synthetic vicinity — '||a.suburb,a.suburb,'Greater Perth','AU','approximate_suburb',
  LOWER(REPLACE(o.category_code,'_','-'))||'-report','demonstration property or context',NULL,
  JSON_OBJECT('synthetic_record' VALUE true,'profile' VALUE 'wapol_perth_metro_may_jun_2026_demonstration','statistics_source' VALUE 'WAPOL Metropolitan Region monthly aggregate table supplied for May and June 2026','report_month' VALUE o.month_key,'wapol_category' VALUE c.category_name,'wapol_group' VALUE o.source_group,'spatial_precision' VALUE 'approximate suburb-level demonstration point')
FROM ordered o JOIN incident_categories c ON c.category_code=o.category_code JOIN anchors a ON a.anchor_key=MOD(o.record_number-1,60)+1 JOIN patrol_areas p ON p.area_code=a.area_code;

INSERT INTO incident_reports(incident_id,report_summary,report_text,embedding_text,enrichments)
SELECT i.incident_id,c.category_name||' report - '||i.suburb||' - '||TO_CHAR(i.occurred_at,'DD Mon YYYY HH24:MI'),
  'A generated report describes a '||LOWER(c.category_name)||' record in an approximate '||i.suburb||' metropolitan context. It contains non-identifying demonstration detail for relational, graph, vector and spatial exploration only.',
  c.category_name||' '||i.suburb||' '||i.modus_operandi,JSON_OBJECT('synthetic_record' VALUE true,'profile' VALUE 'wapol_perth_metro_may_jun_2026_demonstration','language' VALUE 'en-AU','record_style' VALUE 'generated city profile narrative')
FROM crime_incidents i JOIN incident_categories c ON c.category_id=i.category_id;

UPDATE crime_incidents SET modus_operandi='harbour-route-link',incident_status='under_review',property_category='demonstration commercial stock',incident_attributes=JSON_OBJECT('synthetic_record' VALUE true,'profile' VALUE 'wapol_perth_metro_may_jun_2026_demonstration','investigation_series' VALUE 'PERTH_SERIES_021','link_token' VALUE 'Swan-H19','spatial_precision' VALUE 'approximate suburb-level demonstration point') WHERE incident_ref IN ('PCI-2026-000421','PCI-2026-001164','PCI-2026-002851','PCI-2026-005106','PCI-2026-012002','PCI-2026-018842','PCI-2026-024710','PCI-2026-030144');
UPDATE incident_reports r SET report_summary='Harbour-route record - '||(SELECT suburb FROM crime_incidents i WHERE i.incident_id=r.incident_id),report_text='A generated report retains a fabricated Harbour-route notation and Swan-H19 marker for bounded demonstration graph exploration only.',embedding_text='harbour route Swan-H19 demonstration linkage' WHERE incident_id IN (SELECT incident_id FROM crime_incidents WHERE modus_operandi='harbour-route-link');

INSERT INTO persons_of_interest(person_ref,display_name,alias_name,person_status,portrait_variant,portrait_alt_text,narrative_summary)
SELECT 'PPOI-2026-'||LPAD(LEVEL,4,'0'),'Profile '||CASE MOD(LEVEL-1,6) WHEN 0 THEN 'Swan' WHEN 1 THEN 'Banksia' WHEN 2 THEN 'Wattle' WHEN 3 THEN 'Jarrah' WHEN 4 THEN 'Coral' ELSE 'Murray' END,
 CASE MOD(LEVEL-1,6) WHEN 0 THEN 'Swan' WHEN 1 THEN 'Banksia' WHEN 2 THEN 'Wattle' WHEN 3 THEN 'Jarrah' WHEN 4 THEN 'Coral' ELSE 'Murray' END,CASE MOD(LEVEL,3) WHEN 0 THEN 'suspect' WHEN 1 THEN 'person_of_interest' ELSE 'associate' END,'demonstration-avatar-'||(MOD(LEVEL-1,6)+1),'Generated profile for demonstration use only; not a photograph of a real person.','Profile used to demonstrate governed Perth Metro relationship, graph, and vector queries. It has no real-world referent.' FROM dual CONNECT BY LEVEL<=48;
INSERT INTO case_files(case_ref,case_status,pattern_label,patrol_area_id) SELECT 'PCASE-2026-0021','under_review','Cross-area harbour-route demonstration linkage',patrol_area_id FROM patrol_areas WHERE area_code='PERTH_CENTRAL';
INSERT INTO case_incident_links(case_id,incident_id) SELECT c.case_id,i.incident_id FROM case_files c CROSS JOIN crime_incidents i WHERE c.case_ref='PCASE-2026-0021' AND i.modus_operandi='harbour-route-link';
INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata) SELECT incident_id,CASE MOD(incident_id,3) WHEN 0 THEN 'route-note-observation' WHEN 1 THEN 'stock-list-notation' ELSE 'packaging-label-observation' END,JSON_OBJECT('synthetic_record' VALUE true,'series' VALUE 'PERTH_SERIES_021','shared_marker' VALUE 'Swan-H19','description' VALUE 'Non-identifying demonstration artefact') FROM crime_incidents WHERE modus_operandi='harbour-route-link';
INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary) SELECT p.person_id,i.incident_id,CASE MOD(i.incident_id,3) WHEN 0 THEN 'suspect' WHEN 1 THEN 'person_of_interest' ELSE 'associate' END,'Demonstration relationship with a fabricated profile marker.' FROM persons_of_interest p JOIN crime_incidents i ON p.person_ref='PPOI-2026-0001' WHERE i.modus_operandi='harbour-route-link';
INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata) SELECT incident_id,'recorded-observation',JSON_OBJECT('synthetic_record' VALUE true,'source' VALUE 'Perth Metro demonstration profile') FROM crime_incidents WHERE MOD(incident_id,101)=0;
INSERT INTO incident_report_embeddings(incident_id,embedding_model,embedding) SELECT incident_id,'perth_wapol_pattern_demo_v1',TO_VECTOR(CASE WHEN modus_operandi='harbour-route-link' THEN '[1,0,0,1,0,0,0,0]' WHEN category_id=(SELECT category_id FROM incident_categories WHERE category_code='FRAUD') THEN '[0,0,1,0,0,0,0,0]' WHEN category_id=(SELECT category_id FROM incident_categories WHERE category_code='PROPERTY_DAMAGE') THEN '[0,0,0,1,0,0,0,0]' ELSE '[0,0,0,0,1,0,0,0]' END) FROM crime_incidents;
INSERT INTO person_profile_embeddings(person_id,embedding_model,embedding) SELECT person_id,'perth_wapol_profile_demo_v1',TO_VECTOR(CASE MOD(person_id-1,6) WHEN 0 THEN '[1,0,0,0,1,0,0,0]' WHEN 1 THEN '[0,1,0,0,0,1,0,0]' WHEN 2 THEN '[0,0,1,0,0,0,1,0]' WHEN 3 THEN '[0,0,0,1,1,0,0,0]' WHEN 4 THEN '[1,0,0,0,0,1,0,0]' ELSE '[0,1,0,0,0,0,1,0]' END) FROM persons_of_interest;

DECLARE v_may NUMBER;v_jun NUMBER;v_total NUMBER; BEGIN
  SELECT COUNT(*) INTO v_may FROM crime_incidents WHERE occurred_at>=TO_TIMESTAMP_TZ('2026-05-01 00:00:00 +08:00','YYYY-MM-DD HH24:MI:SS TZH:TZM') AND occurred_at<TO_TIMESTAMP_TZ('2026-06-01 00:00:00 +08:00','YYYY-MM-DD HH24:MI:SS TZH:TZM');
  SELECT COUNT(*) INTO v_jun FROM crime_incidents WHERE occurred_at>=TO_TIMESTAMP_TZ('2026-06-01 00:00:00 +08:00','YYYY-MM-DD HH24:MI:SS TZH:TZM') AND occurred_at<TO_TIMESTAMP_TZ('2026-07-01 00:00:00 +08:00','YYYY-MM-DD HH24:MI:SS TZH:TZM');
  SELECT COUNT(*) INTO v_total FROM crime_incidents;
  IF v_may<>16974 OR v_jun<>16537 OR v_total<>33511 THEN RAISE_APPLICATION_ERROR(-20012,'Perth profile validation failed: expected 16974,16537,33511; received '||v_may||','||v_jun||','||v_total); END IF;
END;
/
COMMIT;
