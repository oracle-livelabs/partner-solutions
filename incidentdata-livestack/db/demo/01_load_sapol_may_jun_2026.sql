/*
  IncidentData LiveStack — May/June 2026 teaching profile

  Purpose
    Populate the existing schema with clearly fictional, non-identifying data
    for a database technology demonstration.  The high-level monthly category
    totals are calibrated to the supplied SAPOL rolling-statistics release:
      May 2026: 10,412 offences against person/property
      Jun 2026:  9,690 offences against person/property

  Important
    - No row represents a real incident, person, address, or police record.
    - Coordinates are deliberately approximate suburb-level teaching points.
    - This script requires the operational incident data to be empty.
    - It does not alter tables, security views, or the Property Graph model.
*/
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
  v_existing NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_existing FROM crime_incidents;
  IF v_existing > 0 THEN
    RAISE_APPLICATION_ERROR(-20001,
      'The May/June 2026 profile requires an empty operational incident dataset. Use the app backup/clear workflow first.');
  END IF;
END;
/

/* Keep the existing DDS users and patrol areas, while making the script safe
   for a schema whose reference rows were also cleared. */
MERGE INTO security_users t USING (
  SELECT 'statewide_admin' user_name, 'admin' role_name, 'Statewide Administrator' display_name FROM dual UNION ALL
  SELECT 'central_analyst', 'analyst', 'Central Analyst' FROM dual UNION ALL
  SELECT 'northern_analyst', 'analyst', 'Northern Analyst' FROM dual UNION ALL
  SELECT 'southern_analyst', 'analyst', 'Southern Analyst' FROM dual UNION ALL
  SELECT 'read_only_viewer', 'viewer', 'Limited Viewer' FROM dual
) s ON (t.user_name=s.user_name)
WHEN NOT MATCHED THEN INSERT (user_name,role_name,display_name,is_active) VALUES (s.user_name,s.role_name,s.display_name,1);

MERGE INTO patrol_areas t USING (
  SELECT 'CENTRAL' area_code,'Adelaide Central' area_name,'central' region_group,-34.928500 centre_lat,138.600700 centre_lon FROM dual UNION ALL
  SELECT 'NORTH','Northern & Western Adelaide','north',-34.790000,138.600000 FROM dual UNION ALL
  SELECT 'SOUTH','Southern & Eastern Adelaide','south',-35.020000,138.620000 FROM dual
) s ON (t.area_code=s.area_code)
WHEN MATCHED THEN UPDATE SET t.area_name=s.area_name,t.region_group=s.region_group,t.centre_lat=s.centre_lat,t.centre_lon=s.centre_lon
WHEN NOT MATCHED THEN INSERT (area_code,area_name,region_group,centre_lat,centre_lon) VALUES (s.area_code,s.area_name,s.region_group,s.centre_lat,s.centre_lon);

MERGE INTO security_user_geo_entitlements t USING (
  SELECT 'central_analyst' user_name,'CENTRAL' area_code FROM dual UNION ALL
  SELECT 'northern_analyst','NORTH' FROM dual UNION ALL
  SELECT 'southern_analyst','SOUTH' FROM dual UNION ALL
  SELECT 'read_only_viewer','CENTRAL' FROM dual
) s ON (t.user_name=s.user_name AND t.patrol_area_id=(SELECT patrol_area_id FROM patrol_areas WHERE area_code=s.area_code))
WHEN NOT MATCHED THEN INSERT (user_name,patrol_area_id) VALUES (s.user_name,(SELECT patrol_area_id FROM patrol_areas WHERE area_code=s.area_code));

/* Replace unused legacy demo categories with the SAPOL-aligned top-level
   classifications represented in the May and June supplied figures. */
DELETE FROM incident_categories;
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('HOMICIDE','Homicide','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('ASSAULT','Assault','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('SEXUAL_OFFENCES','Sexual offences','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('HARM_ENDANGER','Harm or endanger persons','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('ROBBERY_EXTORTION','Robbery, blackmail and extortion','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('SERIOUS_CRIMINAL_TRESPASS','Serious criminal trespass','high');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('THEFT','Theft','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('FRAUD','Fraud and related offences','medium');
INSERT INTO incident_categories(category_code,category_name,severity_band) VALUES ('PROPERTY_DAMAGE','Property damage','medium');

DECLARE
  v_homicide NUMBER; v_assault NUMBER; v_sexual NUMBER; v_harm NUMBER; v_robbery NUMBER;
  v_trespass NUMBER; v_theft NUMBER; v_fraud NUMBER; v_damage NUMBER;
  v_central NUMBER; v_north NUMBER; v_south NUMBER;
  v_category NUMBER; v_position NUMBER; v_local NUMBER; v_month VARCHAR2(8);
  v_category_code VARCHAR2(40); v_category_name VARCHAR2(100); v_subcategory VARCHAR2(120);
  v_area NUMBER; v_area_roll NUMBER; v_suburb VARCHAR2(100); v_lat NUMBER(9,6); v_lon NUMBER(9,6);
  v_occurred TIMESTAMP WITH TIME ZONE; v_location VARCHAR2(60); v_status VARCHAR2(30);
  v_mo VARCHAR2(80); v_property VARCHAR2(80); v_vehicle VARCHAR2(100);
  v_summary VARCHAR2(1000); v_report CLOB; v_incident_id NUMBER;

  FUNCTION subcategory_for(p_code VARCHAR2,p_pos NUMBER,p_month VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    IF p_code='HOMICIDE' THEN RETURN CASE p_pos WHEN 1 THEN 'Attempted murder' ELSE 'Manslaughter or driving causing death' END;
    ELSIF p_code='ASSAULT' THEN
      IF p_pos <= CASE WHEN p_month='May-26' THEN 1328 ELSE 1252 END THEN RETURN 'Serious assault';
      ELSIF p_pos <= CASE WHEN p_month='May-26' THEN 1388 ELSE 1312 END THEN RETURN 'Assault of a police officer';
      ELSIF p_pos <= CASE WHEN p_month='May-26' THEN 1445 ELSE 1364 END THEN RETURN 'Assault of other prescribed officer';
      ELSE RETURN 'Common assault'; END IF;
    ELSIF p_code='SEXUAL_OFFENCES' THEN
      IF p_pos <= CASE WHEN p_month='May-26' THEN 128 ELSE 125 END THEN RETURN 'Aggravated sexual assault';
      ELSIF p_pos <= CASE WHEN p_month='May-26' THEN 163 ELSE 155 END THEN RETURN 'Non-aggravated sexual assault';
      ELSIF p_pos <= CASE WHEN p_month='May-26' THEN 165 ELSE 164 END THEN RETURN 'Child procurement or grooming';
      ELSIF p_pos <= CASE WHEN p_month='May-26' THEN 188 ELSE 175 END THEN RETURN 'Child abuse material offences';
      ELSE RETURN 'Other sexual offences'; END IF;
    ELSIF p_code='HARM_ENDANGER' THEN
      IF p_pos <= CASE WHEN p_month='May-26' THEN 2 ELSE 4 END THEN RETURN 'Abduction and kidnapping';
      ELSIF p_pos <= CASE WHEN p_month='May-26' THEN 202 ELSE 188 END THEN RETURN 'Acts that threaten, harass, or control';
      ELSIF p_pos <= CASE WHEN p_month='May-26' THEN 210 ELSE 192 END THEN RETURN 'Driving causing serious injury';
      ELSE RETURN 'Other acts that harm or endanger persons'; END IF;
    ELSIF p_code='ROBBERY_EXTORTION' THEN
      IF p_pos <= CASE WHEN p_month='May-26' THEN 28 ELSE 14 END THEN RETURN 'Blackmail or other extortion'; ELSE RETURN 'Robbery'; END IF;
    ELSIF p_code='SERIOUS_CRIMINAL_TRESPASS' THEN
      IF p_pos <= CASE WHEN p_month='May-26' THEN 550 ELSE 525 END THEN RETURN 'SCT - residence';
      ELSIF p_pos <= CASE WHEN p_month='May-26' THEN 836 ELSE 831 END THEN RETURN 'SCT - non-residence';
      ELSE RETURN 'Other unlawful entry with intent'; END IF;
    ELSIF p_code='THEFT' THEN
      IF p_pos <= CASE WHEN p_month='May-26' THEN 1045 ELSE 922 END THEN RETURN 'Motor vehicle theft and related offences';
      ELSIF p_pos <= CASE WHEN p_month='May-26' THEN 2174 ELSE 2030 END THEN RETURN 'Theft from a person';
      ELSIF p_pos <= CASE WHEN p_month='May-26' THEN 4192 ELSE 3839 END THEN RETURN 'Theft from retail premises';
      ELSIF p_pos <= CASE WHEN p_month='May-26' THEN 4488 ELSE 4062 END THEN RETURN 'Receive or handle proceeds of crime';
      ELSE RETURN 'Other theft'; END IF;
    ELSIF p_code='FRAUD' THEN
      IF p_pos <= CASE WHEN p_month='May-26' THEN 270 ELSE 248 END THEN RETURN 'Obtain benefit by deception'; ELSE RETURN 'Other fraud and related offences'; END IF;
    ELSIF p_code='PROPERTY_DAMAGE' THEN
      IF p_pos <= CASE WHEN p_month='May-26' THEN 76 ELSE 71 END THEN RETURN 'Arson'; ELSE RETURN 'Damage or destroy property'; END IF;
    END IF;
    RETURN 'Unclassified';
  END;

  PROCEDURE choose_suburb(p_area NUMBER,p_seed NUMBER,p_suburb OUT VARCHAR2,p_lat OUT NUMBER,p_lon OUT NUMBER) IS
    v_slot NUMBER := MOD(p_seed,12);
  BEGIN
    IF p_area=v_central THEN
      CASE v_slot WHEN 0 THEN p_suburb:='Adelaide'; p_lat:=-34.9285; p_lon:=138.6007;
        WHEN 1 THEN p_suburb:='North Adelaide'; p_lat:=-34.9070; p_lon:=138.5950;
        WHEN 2 THEN p_suburb:='Norwood'; p_lat:=-34.9210; p_lon:=138.6280;
        WHEN 3 THEN p_suburb:='Unley'; p_lat:=-34.9500; p_lon:=138.6070;
        WHEN 4 THEN p_suburb:='Prospect'; p_lat:=-34.8840; p_lon:=138.5940;
        WHEN 5 THEN p_suburb:='Goodwood'; p_lat:=-34.9520; p_lon:=138.5890;
        WHEN 6 THEN p_suburb:='Mile End'; p_lat:=-34.9250; p_lon:=138.5700;
        WHEN 7 THEN p_suburb:='Bowden'; p_lat:=-34.8990; p_lon:=138.5800;
        WHEN 8 THEN p_suburb:='Kensington'; p_lat:=-34.9220; p_lon:=138.6450;
        WHEN 9 THEN p_suburb:='Parkside'; p_lat:=-34.9450; p_lon:=138.6150;
        WHEN 10 THEN p_suburb:='Kent Town'; p_lat:=-34.9270; p_lon:=138.6210;
        ELSE p_suburb:='Thebarton'; p_lat:=-34.9140; p_lon:=138.5650; END CASE;
    ELSIF p_area=v_north THEN
      CASE v_slot WHEN 0 THEN p_suburb:='Salisbury'; p_lat:=-34.7660; p_lon:=138.6080;
        WHEN 1 THEN p_suburb:='Elizabeth'; p_lat:=-34.7170; p_lon:=138.6690;
        WHEN 2 THEN p_suburb:='Port Adelaide'; p_lat:=-34.8470; p_lon:=138.5050;
        WHEN 3 THEN p_suburb:='Tea Tree Gully'; p_lat:=-34.8270; p_lon:=138.7220;
        WHEN 4 THEN p_suburb:='Modbury'; p_lat:=-34.8310; p_lon:=138.6890;
        WHEN 5 THEN p_suburb:='Mawson Lakes'; p_lat:=-34.8110; p_lon:=138.6100;
        WHEN 6 THEN p_suburb:='Semaphore'; p_lat:=-34.8380; p_lon:=138.4860;
        WHEN 7 THEN p_suburb:='Gawler'; p_lat:=-34.6020; p_lon:=138.7490;
        WHEN 8 THEN p_suburb:='Para Hills'; p_lat:=-34.8120; p_lon:=138.6530;
        WHEN 9 THEN p_suburb:='Golden Grove'; p_lat:=-34.7840; p_lon:=138.7060;
        WHEN 10 THEN p_suburb:='Woodville'; p_lat:=-34.8740; p_lon:=138.5400;
        ELSE p_suburb:='Kilburn'; p_lat:=-34.8590; p_lon:=138.5900; END CASE;
    ELSE
      CASE v_slot WHEN 0 THEN p_suburb:='Glenelg'; p_lat:=-34.9810; p_lon:=138.5140;
        WHEN 1 THEN p_suburb:='Marion'; p_lat:=-35.0120; p_lon:=138.5500;
        WHEN 2 THEN p_suburb:='Mitcham'; p_lat:=-34.9780; p_lon:=138.6150;
        WHEN 3 THEN p_suburb:='Burnside'; p_lat:=-34.9400; p_lon:=138.6600;
        WHEN 4 THEN p_suburb:='Blackwood'; p_lat:=-35.0190; p_lon:=138.6200;
        WHEN 5 THEN p_suburb:='Brighton'; p_lat:=-35.0180; p_lon:=138.5230;
        WHEN 6 THEN p_suburb:='Hallett Cove'; p_lat:=-35.0760; p_lon:=138.5140;
        WHEN 7 THEN p_suburb:='Seacliff'; p_lat:=-35.0340; p_lon:=138.5260;
        WHEN 8 THEN p_suburb:='Morphett Vale'; p_lat:=-35.1190; p_lon:=138.5220;
        WHEN 9 THEN p_suburb:='Edwardstown'; p_lat:=-34.9790; p_lon:=138.5700;
        WHEN 10 THEN p_suburb:='Athelstone'; p_lat:=-34.8700; p_lon:=138.7000;
        ELSE p_suburb:='Stirling'; p_lat:=-35.0070; p_lon:=138.7200; END CASE;
    END IF;
  END;
BEGIN
  SELECT category_id INTO v_homicide FROM incident_categories WHERE category_code='HOMICIDE';
  SELECT category_id INTO v_assault FROM incident_categories WHERE category_code='ASSAULT';
  SELECT category_id INTO v_sexual FROM incident_categories WHERE category_code='SEXUAL_OFFENCES';
  SELECT category_id INTO v_harm FROM incident_categories WHERE category_code='HARM_ENDANGER';
  SELECT category_id INTO v_robbery FROM incident_categories WHERE category_code='ROBBERY_EXTORTION';
  SELECT category_id INTO v_trespass FROM incident_categories WHERE category_code='SERIOUS_CRIMINAL_TRESPASS';
  SELECT category_id INTO v_theft FROM incident_categories WHERE category_code='THEFT';
  SELECT category_id INTO v_fraud FROM incident_categories WHERE category_code='FRAUD';
  SELECT category_id INTO v_damage FROM incident_categories WHERE category_code='PROPERTY_DAMAGE';
  SELECT patrol_area_id INTO v_central FROM patrol_areas WHERE area_code='CENTRAL';
  SELECT patrol_area_id INTO v_north FROM patrol_areas WHERE area_code='NORTH';
  SELECT patrol_area_id INTO v_south FROM patrol_areas WHERE area_code='SOUTH';

  FOR n IN 1..20102 LOOP
    IF n <= 10412 THEN
      v_local:=n; v_month:='May-26';
      IF v_local<=3 THEN v_category:=v_homicide;v_category_code:='HOMICIDE';v_category_name:='Homicide';v_position:=v_local;
      ELSIF v_local<=1991 THEN v_category:=v_assault;v_category_code:='ASSAULT';v_category_name:='Assault';v_position:=v_local-3;
      ELSIF v_local<=2222 THEN v_category:=v_sexual;v_category_code:='SEXUAL_OFFENCES';v_category_name:='Sexual offences';v_position:=v_local-1991;
      ELSIF v_local<=2505 THEN v_category:=v_harm;v_category_code:='HARM_ENDANGER';v_category_name:='Harm or endanger persons';v_position:=v_local-2222;
      ELSIF v_local<=2573 THEN v_category:=v_robbery;v_category_code:='ROBBERY_EXTORTION';v_category_name:='Robbery, blackmail and extortion';v_position:=v_local-2505;
      ELSIF v_local<=3767 THEN v_category:=v_trespass;v_category_code:='SERIOUS_CRIMINAL_TRESPASS';v_category_name:='Serious criminal trespass';v_position:=v_local-2573;
      ELSIF v_local<=8276 THEN v_category:=v_theft;v_category_code:='THEFT';v_category_name:='Theft';v_position:=v_local-3767;
      ELSIF v_local<=8566 THEN v_category:=v_fraud;v_category_code:='FRAUD';v_category_name:='Fraud and related offences';v_position:=v_local-8276;
      ELSE v_category:=v_damage;v_category_code:='PROPERTY_DAMAGE';v_category_name:='Property damage';v_position:=v_local-8566; END IF;
      v_occurred:=TO_TIMESTAMP_TZ('2026-05-01 00:00:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM')+NUMTODSINTERVAL(MOD(n*13,31),'DAY')+NUMTODSINTERVAL(MOD(n*47,1440),'MINUTE');
    ELSE
      v_local:=n-10412; v_month:='Jun-26';
      IF v_local<=1919 THEN v_category:=v_assault;v_category_code:='ASSAULT';v_category_name:='Assault';v_position:=v_local;
      ELSIF v_local<=2131 THEN v_category:=v_sexual;v_category_code:='SEXUAL_OFFENCES';v_category_name:='Sexual offences';v_position:=v_local-1919;
      ELSIF v_local<=2384 THEN v_category:=v_harm;v_category_code:='HARM_ENDANGER';v_category_name:='Harm or endanger persons';v_position:=v_local-2131;
      ELSIF v_local<=2434 THEN v_category:=v_robbery;v_category_code:='ROBBERY_EXTORTION';v_category_name:='Robbery, blackmail and extortion';v_position:=v_local-2384;
      ELSIF v_local<=3542 THEN v_category:=v_trespass;v_category_code:='SERIOUS_CRIMINAL_TRESPASS';v_category_name:='Serious criminal trespass';v_position:=v_local-2434;
      ELSIF v_local<=7617 THEN v_category:=v_theft;v_category_code:='THEFT';v_category_name:='Theft';v_position:=v_local-3542;
      ELSIF v_local<=7882 THEN v_category:=v_fraud;v_category_code:='FRAUD';v_category_name:='Fraud and related offences';v_position:=v_local-7617;
      ELSE v_category:=v_damage;v_category_code:='PROPERTY_DAMAGE';v_category_name:='Property damage';v_position:=v_local-7882; END IF;
      v_occurred:=TO_TIMESTAMP_TZ('2026-06-01 00:00:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM')+NUMTODSINTERVAL(MOD(n*13,30),'DAY')+NUMTODSINTERVAL(MOD(n*47,1440),'MINUTE');
    END IF;

    v_subcategory:=subcategory_for(v_category_code,v_position,v_month);
    v_area_roll:=MOD(n*17+v_category,100);
    IF v_category_code='SERIOUS_CRIMINAL_TRESPASS' THEN v_area:=CASE WHEN v_area_roll<22 THEN v_central WHEN v_area_roll<64 THEN v_north ELSE v_south END;
    ELSIF v_category_code IN ('PROPERTY_DAMAGE','HARM_ENDANGER') THEN v_area:=CASE WHEN v_area_roll<31 THEN v_central WHEN v_area_roll<67 THEN v_north ELSE v_south END;
    ELSIF v_category_code='THEFT' THEN v_area:=CASE WHEN v_area_roll<45 THEN v_central WHEN v_area_roll<77 THEN v_north ELSE v_south END;
    ELSE v_area:=CASE WHEN v_area_roll<42 THEN v_central WHEN v_area_roll<73 THEN v_north ELSE v_south END; END IF;
    choose_suburb(v_area,n*29+v_position,v_suburb,v_lat,v_lon);
    v_lat:=v_lat+((MOD(n*n*97+n*7919,1000003)/1000003)-0.5)*0.018;
    v_lon:=v_lon+((MOD(n*n*41+n*104729,1000003)/1000003)-0.5)*0.024;
    v_location:=CASE v_category_code WHEN 'THEFT' THEN CASE MOD(n,4) WHEN 0 THEN 'retail premises' WHEN 1 THEN 'parking area' WHEN 2 THEN 'public setting' ELSE 'residential property' END
      WHEN 'SERIOUS_CRIMINAL_TRESPASS' THEN CASE WHEN v_subcategory='SCT - residence' THEN 'residential property' ELSE 'commercial premises' END
      WHEN 'FRAUD' THEN 'online service or financial channel'
      WHEN 'PROPERTY_DAMAGE' THEN 'public place or private property'
      ELSE 'reported location' END;
    v_status:=CASE MOD(n*7,10) WHEN 0 THEN 'reported' WHEN 1 THEN 'under_review' WHEN 2 THEN 'assigned' WHEN 3 THEN 'assigned' WHEN 4 THEN 'under_review' WHEN 5 THEN 'resolved' WHEN 6 THEN 'resolved' ELSE 'closed_no_further_action' END;
    v_mo:=CASE v_category_code WHEN 'SERIOUS_CRIMINAL_TRESPASS' THEN 'after-hours-entry-report' WHEN 'THEFT' THEN 'property-removal-report' WHEN 'FRAUD' THEN 'transaction-deception-report' WHEN 'PROPERTY_DAMAGE' THEN 'damage-observation-report' WHEN 'ASSAULT' THEN 'reported-assault-context' WHEN 'HARM_ENDANGER' THEN 'reported-harm-context' ELSE 'reported-incident-context' END;
    v_property:=CASE WHEN v_subcategory LIKE '%vehicle%' THEN 'vehicle' WHEN v_subcategory LIKE '%retail%' THEN 'retail goods' WHEN v_category_code='FRAUD' THEN 'financial or digital account' WHEN v_category_code='PROPERTY_DAMAGE' THEN 'property or public asset' ELSE 'general property' END;
    v_vehicle:=CASE WHEN v_subcategory LIKE '%vehicle%' THEN CASE MOD(n,4) WHEN 0 THEN 'blue hatchback' WHEN 1 THEN 'silver utility' WHEN 2 THEN 'white sedan' ELSE 'dark wagon' END END;
    v_summary:=v_subcategory||' reported in '||v_suburb;
    v_report:='A report was recorded in relation to '||LOWER(v_subcategory)||' at an approximate location in '||v_suburb||'. The record includes a short descriptive account, a time context, and non-identifying property or location information for training analysis.';

    INSERT INTO crime_incidents(incident_ref,category_id,patrol_area_id,incident_status,occurred_at,location_type,suburb,latitude,longitude,address_line_1,address_locality,address_region,address_country_code,address_precision,modus_operandi,property_category,vehicle_descriptor,incident_attributes)
    VALUES ('ACI-2026-'||LPAD(n,6,'0'),v_category,v_area,v_status,v_occurred,v_location,v_suburb,v_lat,v_lon,'Synthetic vicinity — '||v_suburb,v_suburb,'Greater Adelaide','AU','approximate_suburb',v_mo,v_property,v_vehicle,
      JSON_OBJECT('synthetic_record' VALUE true,'profile' VALUE 'sapol_may_jun_2026_demonstration','statistics_source' VALUE 'SAPOL public rolling statistics, June 2026 release','report_month' VALUE v_month,'sapol_category' VALUE v_category_name,'sapol_subcategory' VALUE v_subcategory,'spatial_precision' VALUE 'approximate suburb-level demonstration point'))
    RETURNING incident_id INTO v_incident_id;
    INSERT INTO incident_reports(incident_id,report_summary,report_text,embedding_text,enrichments)
    VALUES (v_incident_id,v_summary,v_report,v_subcategory||' '||v_suburb||' '||v_mo,
      JSON_OBJECT('synthetic_record' VALUE true,'language' VALUE 'en-AU','record_style' VALUE 'illustrative demonstration narrative','category_source' VALUE 'SAPOL-aligned'));
  END LOOP;
END;
/

/* A deliberately cross-area fictional series.  It is not a claim about a real
   pattern; it exists so Vector, JSON, relational, Graph and DDS demonstrations
   have a coherent investigation walkthrough. */
UPDATE crime_incidents
SET modus_operandi='after-hours-consignment-link', incident_status='under_review', property_category='small commercial stock',
    incident_attributes=JSON_OBJECT('synthetic_record' VALUE true,'profile' VALUE 'sapol_may_jun_2026_demonstration','investigation_series' VALUE 'CROSS_AREA_0147','link_token' VALUE 'Kestrel-S27','spatial_precision' VALUE 'approximate suburb-level demonstration point')
WHERE incident_ref IN ('ACI-2026-002704','ACI-2026-002853','ACI-2026-003062','ACI-2026-004107','ACI-2026-005164','ACI-2026-006972','ACI-2026-008765','ACI-2026-009234','ACI-2026-009991','ACI-2026-013102','ACI-2026-014360','ACI-2026-015642','ACI-2026-017110','ACI-2026-018346','ACI-2026-019182');

UPDATE incident_reports r
SET (report_summary,report_text,embedding_text,enrichments)=(
  SELECT 'After-hours stock movement report - '||i.suburb,
         'A report describes an after-hours event involving small commercial stock at an approximate '||i.suburb||' location. The reporting narrative notes an unverified dispatch-style reference, a short stock-list notation, and a recurring marker recorded as Kestrel-S27. These details are retained as a bounded demonstration clue.',
         'after-hours stock movement dispatch reference Kestrel-S27 consignment link',
         JSON_OBJECT('synthetic_record' VALUE true,'series' VALUE 'CROSS_AREA_0147','shared_marker' VALUE 'Kestrel-S27','language' VALUE 'en-AU')
  FROM crime_incidents i WHERE i.incident_id=r.incident_id)
WHERE r.incident_id IN (SELECT incident_id FROM crime_incidents WHERE modus_operandi='after-hours-consignment-link');

INSERT INTO persons_of_interest(person_ref,display_name,alias_name,person_status,portrait_variant,portrait_alt_text,narrative_summary)
SELECT 'POI-2026-'||LPAD(LEVEL,4,'0'),
       'Profile '||CASE MOD(LEVEL-1,8) WHEN 0 THEN 'Kestrel' WHEN 1 THEN 'Harbour' WHEN 2 THEN 'Cedar' WHEN 3 THEN 'Quartz' WHEN 4 THEN 'Juniper' WHEN 5 THEN 'Mallee' WHEN 6 THEN 'Orchid' ELSE 'Rivergum' END,
       CASE MOD(LEVEL-1,8) WHEN 0 THEN 'Kestrel' WHEN 1 THEN 'Harbour' WHEN 2 THEN 'Cedar' WHEN 3 THEN 'Quartz' WHEN 4 THEN 'Juniper' WHEN 5 THEN 'Mallee' WHEN 6 THEN 'Orchid' ELSE 'Rivergum' END,
       CASE MOD(LEVEL,3) WHEN 0 THEN 'suspect' WHEN 1 THEN 'person_of_interest' ELSE 'associate' END,
       'synthetic-avatar-'||(MOD(LEVEL-1,6)+1),
       'Generated profile for demonstration use only; not a photograph of a real person.',
       'Profile used to demonstrate governed relationship, graph, and vector queries. It has no real-world referent.'
FROM dual CONNECT BY LEVEL<=48;

INSERT INTO case_files(case_ref,case_status,pattern_label,patrol_area_id)
SELECT 'CASE-2026-0147','under_review','Cross-area after-hours consignment linkage',patrol_area_id FROM patrol_areas WHERE area_code='CENTRAL';

INSERT INTO case_incident_links(case_id,incident_id)
SELECT c.case_id,i.incident_id FROM case_files c CROSS JOIN crime_incidents i
WHERE c.case_ref='CASE-2026-0147' AND i.modus_operandi='after-hours-consignment-link';

INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata)
SELECT i.incident_id,
       CASE MOD(i.incident_id,3) WHEN 0 THEN 'dispatch-note-fragment' WHEN 1 THEN 'stock-list-notation' ELSE 'packaging-label-observation' END,
       JSON_OBJECT('synthetic_record' VALUE true,'series' VALUE 'CROSS_AREA_0147','shared_marker' VALUE 'Kestrel-S27','description' VALUE 'Non-identifying demonstration artefact')
FROM crime_incidents i WHERE i.modus_operandi='after-hours-consignment-link';

/* The first three fictional profiles link different portions of the series.
   The overlap becomes apparent in the graph, not from any identity claim. */
INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary)
SELECT p.person_id,i.incident_id,'person_of_interest','Demonstration relationship: recurring fabricated reference appears in the linked record.'
FROM persons_of_interest p JOIN crime_incidents i ON 1=1
WHERE p.person_ref='POI-2026-0001' AND i.incident_ref IN ('ACI-2026-002704','ACI-2026-004107','ACI-2026-006972','ACI-2026-013102','ACI-2026-015642');
INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary)
SELECT p.person_id,i.incident_id,'associate','Demonstration relationship: a fabricated dispatch-style notation appears in the linked record.'
FROM persons_of_interest p JOIN crime_incidents i ON 1=1
WHERE p.person_ref='POI-2026-0002' AND i.incident_ref IN ('ACI-2026-002853','ACI-2026-005164','ACI-2026-009234','ACI-2026-014360','ACI-2026-017110');
INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary)
SELECT p.person_id,i.incident_id,'suspect','Demonstration relationship: a shared fabricated stock-list marker appears in the linked record.'
FROM persons_of_interest p JOIN crime_incidents i ON 1=1
WHERE p.person_ref='POI-2026-0003' AND i.incident_ref IN ('ACI-2026-003062','ACI-2026-008765','ACI-2026-009991','ACI-2026-018346','ACI-2026-019182');

/* A handful of smaller cases give the graph and analytics pages varied context. */
INSERT INTO case_files(case_ref,case_status,pattern_label,patrol_area_id)
SELECT 'CASE-2026-02'||LPAD(LEVEL,2,'0'),CASE WHEN MOD(LEVEL,3)=0 THEN 'assigned' ELSE 'under_review' END,
       CASE MOD(LEVEL,4) WHEN 0 THEN 'Retail property sequence' WHEN 1 THEN 'Residential entry context' WHEN 2 THEN 'Transaction wording review' ELSE 'Damage observation cluster' END,
       MOD(LEVEL-1,3)+1
FROM dual CONNECT BY LEVEL<=12;

INSERT INTO case_incident_links(case_id,incident_id)
SELECT c.case_id,i.incident_id
FROM case_files c JOIN crime_incidents i ON MOD(TO_NUMBER(SUBSTR(i.incident_ref,-6)),12)=TO_NUMBER(SUBSTR(c.case_ref,-2))-1
WHERE c.case_ref LIKE 'CASE-2026-02%' AND TO_NUMBER(SUBSTR(i.incident_ref,-6))<=60;

INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata)
SELECT i.incident_id,'recorded-observation',JSON_OBJECT('synthetic_record' VALUE true,'source' VALUE 'demonstration profile','description' VALUE 'Non-identifying observation')
FROM crime_incidents i WHERE MOD(i.incident_id,37)=0;

INSERT INTO person_incident_links(person_id,incident_id,connection_type,link_summary)
SELECT p.person_id,i.incident_id,CASE MOD(i.incident_id,3) WHEN 0 THEN 'suspect' WHEN 1 THEN 'person_of_interest' ELSE 'associate' END,
       'Demonstration relationship for bounded graph exploration only.'
FROM crime_incidents i
JOIN (SELECT person_id,ROW_NUMBER() OVER (ORDER BY person_ref) person_position FROM persons_of_interest) p
  ON p.person_position=MOD(i.incident_id-1,45)+4
WHERE MOD(i.incident_id,211)=0;

INSERT INTO semantic_matches(source_incident_id,matched_incident_id,similarity_score,match_reason)
SELECT a.incident_id,b.incident_id,0.9400,'Linked series: shared Kestrel-S27 record marker'
FROM crime_incidents a JOIN crime_incidents b ON a.incident_id<b.incident_id
WHERE a.modus_operandi='after-hours-consignment-link' AND b.modus_operandi='after-hours-consignment-link';

INSERT INTO incident_report_embeddings(incident_id,embedding_model,embedding)
SELECT incident_id,'adelaide_pattern_demo_v1',TO_VECTOR(CASE
  WHEN modus_operandi='after-hours-consignment-link' THEN '[1,0,0,1,0,0,0,0]'
  WHEN category_id=(SELECT category_id FROM incident_categories WHERE category_code='SERIOUS_CRIMINAL_TRESPASS') THEN '[1,0,0,0,0,0,0,0]'
  WHEN JSON_VALUE(incident_attributes,'$.sapol_subcategory') LIKE 'Motor vehicle%' THEN '[0,1,0,0,0,0,0,0]'
  WHEN category_id=(SELECT category_id FROM incident_categories WHERE category_code='FRAUD') THEN '[0,0,1,0,0,0,0,0]'
  WHEN category_id=(SELECT category_id FROM incident_categories WHERE category_code='PROPERTY_DAMAGE') THEN '[0,0,0,1,0,0,0,0]'
  ELSE '[0,0,0,0,1,0,0,0]' END)
FROM crime_incidents;

INSERT INTO person_profile_embeddings(person_id,embedding_model,embedding)
SELECT person_id,'adelaide_profile_demo_v1',TO_VECTOR(CASE MOD(person_id-1,6)
  WHEN 0 THEN '[1,0,0,0,1,0,0,0]' WHEN 1 THEN '[0,1,0,0,0,1,0,0]'
  WHEN 2 THEN '[0,0,1,0,0,0,1,0]' WHEN 3 THEN '[0,0,0,1,1,0,0,0]'
  WHEN 4 THEN '[1,0,0,0,0,1,0,0]' ELSE '[0,1,0,0,0,0,1,0]' END)
FROM persons_of_interest;

DECLARE
  v_may NUMBER; v_jun NUMBER; v_total NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_may FROM crime_incidents WHERE occurred_at>=TO_TIMESTAMP_TZ('2026-05-01 00:00:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM') AND occurred_at<TO_TIMESTAMP_TZ('2026-06-01 00:00:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM');
  SELECT COUNT(*) INTO v_jun FROM crime_incidents WHERE occurred_at>=TO_TIMESTAMP_TZ('2026-06-01 00:00:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM') AND occurred_at<TO_TIMESTAMP_TZ('2026-07-01 00:00:00 +09:30','YYYY-MM-DD HH24:MI:SS TZH:TZM');
  SELECT COUNT(*) INTO v_total FROM crime_incidents;
  IF v_may<>10412 OR v_jun<>9690 OR v_total<>20102 THEN
    RAISE_APPLICATION_ERROR(-20002,'Profile validation failed: expected May=10412, Jun=9690, Total=20102; received '||v_may||','||v_jun||','||v_total);
  END IF;
END;
/

COMMIT;
@@04_refresh_incident_narratives.sql
