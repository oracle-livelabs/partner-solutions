SET DEFINE OFF
INSERT INTO patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) VALUES ('CENTRAL','Adelaide Central','central',-34.9285,138.6007);
INSERT INTO patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) VALUES ('NORTH','Northern & Western Adelaide','north',-34.7900,138.6000);
INSERT INTO patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) VALUES ('SOUTH','Southern & Eastern Adelaide','south',-35.0200,138.6200);
INSERT INTO security_users VALUES ('statewide_admin','admin','Statewide Administrator',1);
INSERT INTO security_users VALUES ('central_analyst','analyst','Central Analyst',1);
INSERT INTO security_users VALUES ('northern_analyst','analyst','Northern Analyst',1);
INSERT INTO security_users VALUES ('southern_analyst','analyst','Southern Analyst',1);
INSERT INTO security_users VALUES ('read_only_viewer','viewer','Limited Viewer',1);
INSERT INTO security_user_geo_entitlements SELECT 'central_analyst',patrol_area_id FROM patrol_areas WHERE area_code='CENTRAL';
INSERT INTO security_user_geo_entitlements SELECT 'northern_analyst',patrol_area_id FROM patrol_areas WHERE area_code='NORTH';
INSERT INTO security_user_geo_entitlements SELECT 'southern_analyst',patrol_area_id FROM patrol_areas WHERE area_code='SOUTH';
INSERT INTO security_user_geo_entitlements SELECT 'read_only_viewer',patrol_area_id FROM patrol_areas WHERE area_code='CENTRAL';
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES('THEFT','Theft','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES('UNLAWFUL_ENTRY','Unlawful entry / burglary','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES('VEHICLE_THEFT','Motor-vehicle theft','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES('FRAUD','Fraud and scams','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES('PROPERTY_DAMAGE','Property damage','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES('PUBLIC_ORDER','Public-order offence','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES('ASSAULT','Assault','high');
DECLARE
  v_category NUMBER; v_area NUMBER; v_suburb VARCHAR2(100); v_mo VARCHAR2(80); v_text VARCHAR2(1000);
BEGIN
  FOR n IN 1..8000 LOOP
    v_category := MOD(n-1,7)+1; v_area := MOD(n-1,3)+1;
    v_suburb := CASE v_area WHEN 1 THEN CASE MOD(n,5) WHEN 0 THEN 'Adelaide' WHEN 1 THEN 'North Adelaide' WHEN 2 THEN 'Norwood' WHEN 3 THEN 'Unley' ELSE 'Prospect' END WHEN 2 THEN CASE MOD(n,4) WHEN 0 THEN 'Salisbury' WHEN 1 THEN 'Port Adelaide' WHEN 2 THEN 'Charles Sturt' ELSE 'Tea Tree Gully' END ELSE CASE MOD(n,4) WHEN 0 THEN 'Glenelg' WHEN 1 THEN 'Marion' WHEN 2 THEN 'Mitcham' ELSE 'Burnside' END END;
    v_mo := CASE WHEN MOD(n,97)=0 THEN 'rear-access-forced-window' WHEN MOD(n,83)=0 THEN 'vehicle-recovery-cloned-plate' WHEN MOD(n,71)=0 THEN 'payment-diversion-phishing' WHEN MOD(n,59)=0 THEN 'overnight-property-damage' ELSE 'background-control' END;
    INSERT INTO crime_incidents(incident_ref,category_id,patrol_area_id,incident_status,occurred_at,location_type,suburb,latitude,longitude,modus_operandi,property_category,vehicle_descriptor,incident_attributes)
    VALUES('ACI-'||TO_CHAR(20240000+n),v_category,v_area,CASE MOD(n,5) WHEN 0 THEN 'reported' WHEN 1 THEN 'under_review' WHEN 2 THEN 'assigned' WHEN 3 THEN 'resolved' ELSE 'closed_no_further_action' END,SYSTIMESTAMP-NUMTODSINTERVAL(MOD(n,730),'DAY'),'synthetic public location',v_suburb,-34.93+(v_area*.05)+MOD(n,100)/10000,138.60+(v_area*.03)+MOD(n,90)/10000,v_mo,CASE WHEN v_mo LIKE '%window%' THEN 'electronics' WHEN v_mo LIKE '%vehicle%' THEN 'vehicle' WHEN v_mo LIKE '%phishing%' THEN 'digital account' ELSE 'general property' END,CASE WHEN v_mo LIKE '%vehicle%' THEN 'synthetic silver hatchback' END,JSON_OBJECT('synthetic' VALUE true,'seed' VALUE 26032026,'scenario' VALUE v_mo));
    SELECT incident_id INTO v_category FROM crime_incidents WHERE incident_ref='ACI-'||TO_CHAR(20240000+n);
    v_text := CASE WHEN v_mo='rear-access-forced-window' THEN 'Synthetic report: overnight rear access was gained through a forced window; tool marks and missing electronics were recorded.' WHEN v_mo='vehicle-recovery-cloned-plate' THEN 'Synthetic report: a vehicle with a cloned plate descriptor was reported missing and later recovered in a separate patrol area.' WHEN v_mo='payment-diversion-phishing' THEN 'Synthetic report: payment diversion message and credential request were reported through a fictional online marketplace.' WHEN v_mo='overnight-property-damage' THEN 'Synthetic report: recurring overnight property damage method was observed at a fictional public location.' ELSE 'Synthetic background incident report used as a control record for descriptive analytics.' END;
    INSERT INTO incident_reports(incident_id,report_summary,report_text,embedding_text,enrichments) VALUES(v_category,SUBSTR(v_text,1,300),v_text,v_text,JSON_OBJECT('synthetic' VALUE true,'language' VALUE 'en-AU'));
    IF MOD(n,31)=0 THEN INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata) VALUES(v_category,'synthetic_observation',JSON_OBJECT('synthetic' VALUE true,'source' VALUE 'demo')); END IF;
  END LOOP;
END;
/
INSERT INTO persons_of_interest(person_ref,display_name,alias_name,person_status,portrait_variant,portrait_alt_text,narrative_summary)
SELECT 'POI-'||LPAD(LEVEL,4,'0'),
       'Synthetic Subject '||LPAD(LEVEL,2,'0'),
       'Alias Echo-'||LPAD(LEVEL,2,'0'),
       CASE MOD(LEVEL,3) WHEN 0 THEN 'suspect' WHEN 1 THEN 'person_of_interest' ELSE 'associate' END,
       'synthetic-avatar-'||(MOD(LEVEL-1,6)+1),
       'Generated fictional portrait profile for teaching only; not a photograph of a real person.',
       'Fictional teaching entity used only to demonstrate case, incident, and evidence relationships.'
FROM dual CONNECT BY LEVEL <= 60;
INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary)
SELECT MOD(i.incident_id-1,60)+1,
       i.incident_id,
       CASE MOD(i.incident_id,3) WHEN 0 THEN 'suspect' WHEN 1 THEN 'person_of_interest' ELSE 'associate' END,
       'Synthetic relationship for graph and teaching demonstrations only.'
FROM crime_incidents i
WHERE MOD(i.incident_id,4) <> 0;
INSERT INTO case_files(case_ref,case_status,pattern_label,patrol_area_id) SELECT 'CASE-'||LPAD(LEVEL,4,'0'),'under_review',CASE MOD(LEVEL,4) WHEN 0 THEN 'Repeated unlawful entry' WHEN 1 THEN 'Vehicle recovery pattern' WHEN 2 THEN 'Fraud wording cluster' ELSE 'Property damage series' END,MOD(LEVEL-1,3)+1 FROM dual CONNECT BY LEVEL <= 40;
INSERT INTO case_incident_links SELECT MOD(i.incident_id,40)+1,i.incident_id FROM crime_incidents i WHERE MOD(i.incident_id,97)=0 OR MOD(i.incident_id,83)=0 OR MOD(i.incident_id,71)=0;
INSERT INTO semantic_matches(source_incident_id,matched_incident_id,similarity_score,match_reason)
SELECT a.incident_id,b.incident_id,0.93,'Shared synthetic pattern scenario' FROM crime_incidents a JOIN crime_incidents b ON a.modus_operandi=b.modus_operandi AND a.incident_id<b.incident_id WHERE a.modus_operandi <> 'background-control' FETCH FIRST 1000 ROWS ONLY;
COMMIT;
