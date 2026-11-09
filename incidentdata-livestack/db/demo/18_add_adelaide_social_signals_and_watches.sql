/*
  Adelaide simulated public social-media signals and watched patterns.

  Twenty-four posts are attached to four data-driven watched patterns. Only
  fifteen posts have an analyst-reviewed comparison link, each to one existing
  incident: 15 of 21,513 incidents (0.07%). No incidents are inserted.
*/
DEFINE apply_mode = '&1'
SET DEFINE OFF
SET SQLBLANKLINES ON
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
  v_active VARCHAR2(40);
  v_total NUMBER;
BEGIN
  SELECT p.profile_code INTO v_active
  FROM z_base_active_dataset_profile a
  JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id
  WHERE a.control_id=1;
  SELECT COUNT(*) INTO v_total FROM crime_incidents;
  IF v_active<>'ADELAIDE_DATA' OR v_total<>21513 THEN
    RAISE_APPLICATION_ERROR(-20071,'Adelaide 21,513-row profile must be active.');
  END IF;
END;
/

DELETE FROM watched_pattern_posts;
DELETE FROM watched_pattern_incidents;
DELETE FROM social_post_incident_links;
DELETE FROM social_media_posts;
DELETE FROM social_media_sources;
DELETE FROM watched_crime_patterns;

INSERT ALL
  INTO social_media_sources VALUES('SRC-CITY-CENTRE','City Centre Updates','Microblog','public_account','Public observations about the central city and entertainment precincts.',1)
  INTO social_media_sources VALUES('SRC-NEIGHBOURHOOD','Neighbourhood Reports','Community Forum','community_feed','Public neighbourhood observations grouped at suburb level.',1)
  INTO social_media_sources VALUES('SRC-COMMUTER','Metro Commuter Reports','Public Transport Feed','public_account','Public observations around stations, interchanges and passenger areas.',1)
  INTO social_media_sources VALUES('SRC-RETAIL','Retail Precinct Updates','Community Forum','precinct_feed','Public posts about activity around shopping and retail precincts.',1)
  INTO social_media_sources VALUES('SRC-ARTS','Arts District Notices','Microblog','public_account','Public arts, gallery and theatre precinct observations.',1)
  INTO social_media_sources VALUES('SRC-EVENT','Adelaide Event Updates','Public Event Feed','event_feed','Public event and crowd observations at broad precinct level.',1)
SELECT 1 FROM dual;

INSERT ALL
  INTO watched_crime_patterns VALUES('SERVICE_ACCESS','After-hours service access','Property reports involving rear or side service access, short timing windows and recurring physical observations.','A graph-backed series with partial clues across twelve reports; useful for demonstrating progressive relationship discovery.','case_series','comparative_review','after-hours rear service access property entry','CASE-2026-0317',1,'#7B5B45',1)
  INTO watched_crime_patterns VALUES('ART_MARKET_PAYMENTS','Art-market payment discrepancies','Invoice, provenance, grant and consignment references appearing across separate payment reports.','A graph-backed financial series where document codes and public-setting context become meaningful only after comparison.','case_series','comparative_review','art gallery payment invoice provenance charitable foundation','CASE-2026-0421',2,'#5D7A48',1)
  INTO watched_crime_patterns VALUES('NIGHT_PRECINCT_ACTIVITY','Entertainment-precinct night activity','Public discussion of altercations, threatening behaviour and crowd movement around entertainment precincts.','A community-signal watch suited to time, place and source-diversity comparison without treating discussion as a crime report.','community_signal','monitoring','weekend evening assault threats public order entertainment precinct',NULL,3,'#A33A3A',1)
  INTO watched_crime_patterns VALUES('RETAIL_TRANSIT_THEFT','Retail and transport theft activity','Public reports of missing property and distraction theft around retail concourses, stations and waiting areas.','A high-volume category watch where a small reviewed subset can be compared with recorded incidents without assuming every post is related.','community_signal','monitoring','retail transport theft missing property distraction',NULL,4,'#3F7391',1)
SELECT 1 FROM dual;

/* Service-access pattern: six posts, four reviewed incident comparisons. */
INSERT ALL
  INTO social_media_posts VALUES('SMP-ADL-2026-0001','SRC-NEIGHBOURHOOD',TO_TIMESTAMP_TZ('2026-05-04 20:02:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Shop staff are checking a rear service door after fresh marks were noticed near the latch shortly after closing.','SERVICE_ACCESS','After-hours service access','BREAK_INS','Unley Park','CENTRAL',-34.9502,138.6008,'suburb',420,18,7,62,'rising','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0002','SRC-RETAIL',TO_TIMESTAMP_TZ('2026-05-07 23:04:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'A damaged cover beside a retail service area has been reported after the precinct closed. Maintenance staff are attending.','SERVICE_ACCESS','After-hours service access','PROPERTY_DAMAGE','Elizabeth East','NORTH',-34.7188,138.6811,'precinct',610,31,12,68,'elevated','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0003','SRC-NEIGHBOURHOOD',TO_TIMESTAMP_TZ('2026-05-23 19:36:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Several people have mentioned activity near a side service entrance in Ridgehaven. The business appears to be checking the doorway.','SERVICE_ACCESS','After-hours service access','BREAK_INS','Ridgehaven','NORTH',-34.8212,138.7130,'suburb',350,14,9,58,'rising','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0004','SRC-NEIGHBOURHOOD',TO_TIMESTAMP_TZ('2026-06-12 01:39:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'An alarm sounded briefly near the rear of a Lonsdale retail premises before stopping. Staff have arrived to inspect the site.','SERVICE_ACCESS','After-hours service access','BREAK_INS','Lonsdale','SOUTH',-35.0967,138.4970,'precinct',480,22,10,65,'elevated','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0005','SRC-CITY-CENTRE',TO_TIMESTAMP_TZ('2026-06-01 19:58:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'A utility cabinet near an open-space service path has been fenced while damage is assessed. Pedestrian access remains open.','SERVICE_ACCESS','After-hours service access','PROPERTY_DAMAGE','Adelaide','CENTRAL',-34.9288,138.6002,'precinct',790,25,8,54,'rising','multiple_sources',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0006','SRC-NEIGHBOURHOOD',TO_TIMESTAMP_TZ('2026-06-26 20:05:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'A secured street fixture in Glengowrie has visible damage around its access panel. Council reporting details have been shared.','SERVICE_ACCESS','After-hours service access','PROPERTY_DAMAGE','Glengowrie','SOUTH',-34.9879,138.5360,'suburb',220,8,4,49,'normal','unverified',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)

/* Art-market payments: six posts, four reviewed incident comparisons. */
  INTO social_media_posts VALUES('SMP-ADL-2026-0007','SRC-ARTS',TO_TIMESTAMP_TZ('2026-05-02 15:08:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'A local adviser says an art inventory invoice is being checked after the supplier description did not match the payment account.','ART_MARKET_PAYMENTS','Art-market payment discrepancies','FRAUD_SCAMS','West Croydon','CENTRAL',-34.8948,138.5595,'suburb',330,12,6,57,'rising','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0008','SRC-ARTS',TO_TIMESTAMP_TZ('2026-05-13 00:02:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Questions have been raised about a late retail refund recorded against a foundation account in North Adelaide. Documents are being compared.','ART_MARKET_PAYMENTS','Art-market payment discrepancies','FRAUD_SCAMS','North Adelaide','CENTRAL',-34.9064,138.5990,'precinct',520,27,14,66,'elevated','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0009','SRC-ARTS',TO_TIMESTAMP_TZ('2026-06-05 01:52:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'A charitable grant payment is reportedly under review after an amended instruction named a different vendor account.','ART_MARKET_PAYMENTS','Art-market payment discrepancies','FRAUD_SCAMS','North Adelaide','CENTRAL',-34.9071,138.5968,'suburb',680,39,18,72,'elevated','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0010','SRC-ARTS',TO_TIMESTAMP_TZ('2026-06-12 17:03:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Several consultancy invoices connected with an exhibition project are being checked for repeated payment references.','ART_MARKET_PAYMENTS','Art-market payment discrepancies','FRAUD_SCAMS','Prospect','CENTRAL',-34.8846,138.5939,'suburb',440,21,11,64,'rising','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0011','SRC-ARTS',TO_TIMESTAMP_TZ('2026-05-29 13:02:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Gallery contacts are discussing several smaller payments recorded against one catalogue entry. The purchaser record was later amended.','ART_MARKET_PAYMENTS','Art-market payment discrepancies','FRAUD_SCAMS','Adelaide','CENTRAL',-34.9244,138.6040,'precinct',940,45,17,69,'elevated','multiple_sources',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0012','SRC-ARTS',TO_TIMESTAMP_TZ('2026-06-24 01:35:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'An exhibition sponsorship payment sequence has been referred for document checks after incomplete catalogue and shipment references were noted.','ART_MARKET_PAYMENTS','Art-market payment discrepancies','FRAUD_SCAMS','Norwood','CENTRAL',-34.9216,138.6305,'suburb',570,29,13,61,'rising','multiple_sources',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)

/* Recent entertainment-precinct activity: six posts, three reviewed links. */
  INTO social_media_posts VALUES('SMP-ADL-2026-0013','SRC-CITY-CENTRE',TO_TIMESTAMP_TZ('2026-06-30 16:44:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'A brief altercation has been reported near a city venue entrance. People nearby say the group separated before staff arrived.','NIGHT_PRECINCT_ACTIVITY','Entertainment-precinct night activity','VIOLENCE_HARM','Adelaide','CENTRAL',-34.9249,138.5998,'precinct',1250,68,24,74,'elevated','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0014','SRC-COMMUTER',TO_TIMESTAMP_TZ('2026-06-30 19:07:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Commuters are reporting a disagreement near a city station entrance. Passenger movement continued through another entry.','NIGHT_PRECINCT_ACTIVITY','Entertainment-precinct night activity','VIOLENCE_HARM','Adelaide','CENTRAL',-34.9218,138.5965,'precinct',1820,91,35,79,'elevated','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0015','SRC-CITY-CENTRE',TO_TIMESTAMP_TZ('2026-06-30 15:29:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Several public posts mention verbal threats during a disagreement near a North Adelaide street corner. No further context is available.','NIGHT_PRECINCT_ACTIVITY','Entertainment-precinct night activity','PERSONAL_SAFETY','North Adelaide','CENTRAL',-34.9074,138.5961,'suburb',860,34,19,67,'rising','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0016','SRC-EVENT',TO_TIMESTAMP_TZ('2026-06-30 22:20:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Crowd numbers are increasing across the west-end entertainment precinct. Venue queues are extending onto nearby footpaths.','NIGHT_PRECINCT_ACTIVITY','Entertainment-precinct night activity','COMMUNITY_SAFETY','Adelaide','CENTRAL',-34.9232,138.5902,'precinct',3850,210,48,83,'critical','multiple_sources',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0017','SRC-EVENT',TO_TIMESTAMP_TZ('2026-06-30 23:10:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Venue staff in Glenelg are asking patrons to use the eastern exit while a large group clears the main entrance.','NIGHT_PRECINCT_ACTIVITY','Entertainment-precinct night activity','COMMUNITY_SAFETY','Glenelg','SOUTH',-34.9806,138.5135,'precinct',2140,105,31,76,'elevated','multiple_sources',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0018','SRC-CITY-CENTRE',TO_TIMESTAMP_TZ('2026-06-30 23:52:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Public discussion mentions noisy groups moving between two North Adelaide venues. The posts do not describe a specific incident.','NIGHT_PRECINCT_ACTIVITY','Entertainment-precinct night activity','COMMUNITY_SAFETY','North Adelaide','CENTRAL',-34.9090,138.6042,'precinct',970,38,16,59,'rising','unverified',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)

/* Recent retail and transport theft activity: six posts, four reviewed links. */
  INTO social_media_posts VALUES('SMP-ADL-2026-0019','SRC-RETAIL',TO_TIMESTAMP_TZ('2026-06-30 17:41:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'A shopper says an item went missing during a brief distraction in a Marion retail concourse. Centre staff are taking details.','RETAIL_TRANSIT_THEFT','Retail and transport theft activity','THEFT','Marion','SOUTH',-35.0168,138.5447,'precinct',1480,73,26,77,'elevated','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0020','SRC-RETAIL',TO_TIMESTAMP_TZ('2026-06-30 23:58:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Retail staff in Modbury are checking a late report of property taken near a shared exit before the precinct closed.','RETAIL_TRANSIT_THEFT','Retail and transport theft activity','THEFT','Modbury','NORTH',-34.8317,138.6915,'precinct',1020,49,18,73,'elevated','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0021','SRC-COMMUTER',TO_TIMESTAMP_TZ('2026-06-30 11:48:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'A passenger has posted about property missing after it was left near a Glenelg waiting area. Transport staff have been notified.','RETAIL_TRANSIT_THEFT','Retail and transport theft activity','THEFT','Glenelg','SOUTH',-34.9802,138.5128,'precinct',760,28,12,63,'rising','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0022','SRC-RETAIL',TO_TIMESTAMP_TZ('2026-06-30 19:03:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'A Salisbury retailer is responding to a report of property taken near the store exit during the evening trade period.','RETAIL_TRANSIT_THEFT','Retail and transport theft activity','THEFT','Salisbury','NORTH',-34.7621,138.6447,'precinct',690,25,10,61,'rising','incident_link_reviewed',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0023','SRC-CITY-CENTRE',TO_TIMESTAMP_TZ('2026-06-30 23:50:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Several posts mention property missing after a late-night distraction near a city parking area. Details vary between sources.','RETAIL_TRANSIT_THEFT','Retail and transport theft activity','THEFT','Adelaide','CENTRAL',-34.9258,138.5968,'precinct',2210,126,43,81,'critical','multiple_sources',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
  INTO social_media_posts VALUES('SMP-ADL-2026-0024','SRC-COMMUTER',TO_TIMESTAMP_TZ('2026-06-30 11:59:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM'),'Commuters are sharing a reminder to secure vehicles after a missing-vehicle report near a city transport interchange.','RETAIL_TRANSIT_THEFT','Retail and transport theft activity','THEFT','Adelaide','CENTRAL',-34.9280,138.5987,'precinct',1740,88,21,70,'elevated','multiple_sources',JSON('{"synthetic_record":true,"collection_mode":"simulated_public_stream"}'),SYSTIMESTAMP)
SELECT 1 FROM dual;

/* Every post belongs to one watched pattern. */
INSERT INTO watched_pattern_posts(pattern_code,post_ref,relationship_label)
SELECT topic_code,post_ref,'Public-post topic assigned by the locality profile'
FROM social_media_posts;

/* Case-backed watched-pattern membership. */
INSERT INTO watched_pattern_incidents(pattern_code,incident_ref,relationship_label)
SELECT 'SERVICE_ACCESS',i.incident_ref,'Linked through CASE-2026-0317'
FROM case_files c JOIN case_incident_links l ON l.case_id=c.case_id
JOIN crime_incidents i ON i.incident_id=l.incident_id
WHERE c.case_ref='CASE-2026-0317';

INSERT INTO watched_pattern_incidents(pattern_code,incident_ref,relationship_label)
SELECT 'ART_MARKET_PAYMENTS',i.incident_ref,'Linked through CASE-2026-0421'
FROM case_files c JOIN case_incident_links l ON l.case_id=c.case_id
JOIN crime_incidents i ON i.incident_id=l.incident_id
WHERE c.case_ref='CASE-2026-0421';

INSERT INTO watched_pattern_incidents(pattern_code,incident_ref,relationship_label)
SELECT 'NIGHT_PRECINCT_ACTIVITY',incident_ref,'Time-and-place comparison set'
FROM crime_incidents
WHERE incident_ref IN ('ACI-2026-00530','ACI-2026-01231','ACI-2026-03187',
                       'ACI-2026-03720','ACI-2026-20937','ACI-2026-21398');

INSERT INTO watched_pattern_incidents(pattern_code,incident_ref,relationship_label)
SELECT 'RETAIL_TRANSIT_THEFT',incident_ref,'Retail-and-transport comparison set'
FROM crime_incidents
WHERE incident_ref IN ('ACI-2026-15874','ACI-2026-11660','ACI-2026-15731',
                       'ACI-2026-09044','ACI-2026-11291','ACI-2026-12014');

/* Fifteen conservative, reviewed post-to-incident comparisons. */
INSERT INTO social_post_incident_links(
  post_ref,incident_ref,link_type,link_confidence,link_summary,
  review_status,reviewed_by,reviewed_at)
SELECT x.post_ref,x.incident_ref,x.link_type,x.confidence,
       'Reviewed comparison based on compatible public time and broad place context. The post does not establish that it describes the incident.',
       'reviewed','statewide_admin',SYSTIMESTAMP
FROM (
  SELECT 'SMP-ADL-2026-0001' post_ref,'ACI-2026-07569' incident_ref,'time_place_context' link_type,66 confidence FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0002','ACI-2026-17922','time_place_context',69 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0003','ACI-2026-07468','time_place_context',61 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0004','ACI-2026-07772','time_place_context',68 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0007','ACI-2026-16312','public_reference',59 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0008','ACI-2026-16321','public_reference',64 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0009','ACI-2026-16316','public_reference',67 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0010','ACI-2026-16323','public_reference',63 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0013','ACI-2026-01231','time_place_context',62 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0014','ACI-2026-00530','time_place_context',71 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0015','ACI-2026-03187','time_place_context',58 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0019','ACI-2026-15874','time_place_context',72 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0020','ACI-2026-11660','time_place_context',70 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0021','ACI-2026-15731','time_place_context',60 FROM dual UNION ALL
  SELECT 'SMP-ADL-2026-0022','ACI-2026-12014','time_place_context',57 FROM dual
) x;

DECLARE
  v_incidents NUMBER;
  v_sources NUMBER;
  v_posts NUMBER;
  v_patterns NUMBER;
  v_post_links NUMBER;
  v_linked_incidents NUMBER;
  v_pattern_incidents NUMBER;
  v_pattern_posts NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_incidents FROM crime_incidents;
  SELECT COUNT(*) INTO v_sources FROM social_media_sources;
  SELECT COUNT(*) INTO v_posts FROM social_media_posts;
  SELECT COUNT(*) INTO v_patterns FROM watched_crime_patterns WHERE active=1;
  SELECT COUNT(*) INTO v_post_links FROM social_post_incident_links WHERE review_status='reviewed';
  SELECT COUNT(DISTINCT incident_ref) INTO v_linked_incidents FROM social_post_incident_links WHERE review_status='reviewed';
  SELECT COUNT(*) INTO v_pattern_incidents FROM watched_pattern_incidents;
  SELECT COUNT(*) INTO v_pattern_posts FROM watched_pattern_posts;
  IF v_incidents<>21513 OR v_sources<>6 OR v_posts<>24 OR v_patterns<>4
     OR v_post_links<>15 OR v_linked_incidents<>15
     OR v_pattern_incidents<>32 OR v_pattern_posts<>24 THEN
    RAISE_APPLICATION_ERROR(-20072,'Social signal and watched-pattern validation failed.');
  END IF;
END;
/

SET DEFINE ON
PROMPT Social signal apply mode: &&apply_mode
BEGIN
  IF UPPER('&&apply_mode')='APPLY' THEN COMMIT; ELSE ROLLBACK; END IF;
END;
/
