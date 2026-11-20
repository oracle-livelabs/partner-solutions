/*
  Refresh the May/June 2026 demonstration profile's approximate spatial coverage.
  This changes only suburb labels, approximate coordinates, and suburb references
  in report text. It preserves categories, dates, security areas, cases, vectors,
  evidence, people, and source-calibrated totals.
*/
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
  v_suburb VARCHAR2(100); v_lat NUMBER(9,6); v_lon NUMBER(9,6); v_slot NUMBER;
  PROCEDURE anchor_for(p_area VARCHAR2,p_seed NUMBER,p_suburb OUT VARCHAR2,p_lat OUT NUMBER,p_lon OUT NUMBER) IS
    v_slot NUMBER:=MOD(p_seed,12);
  BEGIN
    IF p_area='CENTRAL' THEN CASE v_slot
      WHEN 0 THEN p_suburb:='Adelaide';p_lat:=-34.9285;p_lon:=138.6007; WHEN 1 THEN p_suburb:='North Adelaide';p_lat:=-34.9070;p_lon:=138.5950;
      WHEN 2 THEN p_suburb:='Norwood';p_lat:=-34.9210;p_lon:=138.6280; WHEN 3 THEN p_suburb:='Unley';p_lat:=-34.9500;p_lon:=138.6070;
      WHEN 4 THEN p_suburb:='Prospect';p_lat:=-34.8840;p_lon:=138.5940; WHEN 5 THEN p_suburb:='Goodwood';p_lat:=-34.9520;p_lon:=138.5890;
      WHEN 6 THEN p_suburb:='Mile End';p_lat:=-34.9250;p_lon:=138.5700; WHEN 7 THEN p_suburb:='Bowden';p_lat:=-34.8990;p_lon:=138.5800;
      WHEN 8 THEN p_suburb:='Kensington';p_lat:=-34.9220;p_lon:=138.6450; WHEN 9 THEN p_suburb:='Parkside';p_lat:=-34.9450;p_lon:=138.6150;
      WHEN 10 THEN p_suburb:='Kent Town';p_lat:=-34.9270;p_lon:=138.6210; ELSE p_suburb:='Thebarton';p_lat:=-34.9140;p_lon:=138.5650; END CASE;
    ELSIF p_area='NORTH' THEN CASE v_slot
      WHEN 0 THEN p_suburb:='Salisbury';p_lat:=-34.7660;p_lon:=138.6080; WHEN 1 THEN p_suburb:='Elizabeth';p_lat:=-34.7170;p_lon:=138.6690;
      WHEN 2 THEN p_suburb:='Port Adelaide';p_lat:=-34.8470;p_lon:=138.5050; WHEN 3 THEN p_suburb:='Tea Tree Gully';p_lat:=-34.8270;p_lon:=138.7220;
      WHEN 4 THEN p_suburb:='Modbury';p_lat:=-34.8310;p_lon:=138.6890; WHEN 5 THEN p_suburb:='Mawson Lakes';p_lat:=-34.8110;p_lon:=138.6100;
      WHEN 6 THEN p_suburb:='Semaphore';p_lat:=-34.8380;p_lon:=138.4860; WHEN 7 THEN p_suburb:='Gawler';p_lat:=-34.6020;p_lon:=138.7490;
      WHEN 8 THEN p_suburb:='Para Hills';p_lat:=-34.8120;p_lon:=138.6530; WHEN 9 THEN p_suburb:='Golden Grove';p_lat:=-34.7840;p_lon:=138.7060;
      WHEN 10 THEN p_suburb:='Woodville';p_lat:=-34.8740;p_lon:=138.5400; ELSE p_suburb:='Kilburn';p_lat:=-34.8590;p_lon:=138.5900; END CASE;
    ELSE CASE v_slot
      WHEN 0 THEN p_suburb:='Glenelg';p_lat:=-34.9810;p_lon:=138.5140; WHEN 1 THEN p_suburb:='Marion';p_lat:=-35.0120;p_lon:=138.5500;
      WHEN 2 THEN p_suburb:='Mitcham';p_lat:=-34.9780;p_lon:=138.6150; WHEN 3 THEN p_suburb:='Burnside';p_lat:=-34.9400;p_lon:=138.6600;
      WHEN 4 THEN p_suburb:='Blackwood';p_lat:=-35.0190;p_lon:=138.6200; WHEN 5 THEN p_suburb:='Brighton';p_lat:=-35.0180;p_lon:=138.5230;
      WHEN 6 THEN p_suburb:='Hallett Cove';p_lat:=-35.0760;p_lon:=138.5140; WHEN 7 THEN p_suburb:='Seacliff';p_lat:=-35.0340;p_lon:=138.5260;
      WHEN 8 THEN p_suburb:='Morphett Vale';p_lat:=-35.1190;p_lon:=138.5220; WHEN 9 THEN p_suburb:='Edwardstown';p_lat:=-34.9790;p_lon:=138.5700;
      WHEN 10 THEN p_suburb:='Athelstone';p_lat:=-34.8700;p_lon:=138.7000; ELSE p_suburb:='Stirling';p_lat:=-35.0070;p_lon:=138.7200; END CASE;
    END IF;
  END;
BEGIN
  FOR r IN (SELECT i.incident_id,i.incident_ref,p.area_code FROM crime_incidents i JOIN patrol_areas p ON p.patrol_area_id=i.patrol_area_id) LOOP
    v_slot:=TO_NUMBER(SUBSTR(r.incident_ref,-6));
    anchor_for(r.area_code,v_slot*29+MOD(v_slot,97),v_suburb,v_lat,v_lon);
    UPDATE crime_incidents
    SET suburb=v_suburb,
        address_line_1='Synthetic vicinity — '||v_suburb,
        address_locality=v_suburb,
        address_region='Greater Adelaide',
        address_country_code='AU',
        address_precision='approximate_suburb',
        latitude=v_lat+((MOD(v_slot*v_slot*97+v_slot*7919,1000003)/1000003)-0.5)*0.018,
        longitude=v_lon+((MOD(v_slot*v_slot*41+v_slot*104729,1000003)/1000003)-0.5)*0.024
    WHERE incident_id=r.incident_id;
  END LOOP;
END;
/

UPDATE incident_reports r
SET (report_summary,report_text,embedding_text)=(
  SELECT CASE WHEN i.modus_operandi='after-hours-consignment-link' THEN 'After-hours stock movement report - '||i.suburb
              ELSE JSON_VALUE(i.incident_attributes,'$.sapol_subcategory')||' reported in '||i.suburb END,
         CASE WHEN i.modus_operandi='after-hours-consignment-link' THEN 'A report describes an after-hours event involving small commercial stock at an approximate '||i.suburb||' location. The reporting narrative notes an unverified dispatch-style reference, a short stock-list notation, and a recurring marker recorded as Kestrel-S27. These details are retained as a bounded demonstration clue.'
              ELSE 'A report was recorded in relation to '||LOWER(JSON_VALUE(i.incident_attributes,'$.sapol_subcategory'))||' at an approximate location in '||i.suburb||'. The record includes a short descriptive account, a time context, and non-identifying property or location information for training analysis.' END,
         CASE WHEN i.modus_operandi='after-hours-consignment-link' THEN 'after-hours stock movement dispatch reference Kestrel-S27 consignment link'
              ELSE JSON_VALUE(i.incident_attributes,'$.sapol_subcategory')||' '||i.suburb||' '||i.modus_operandi END
  FROM crime_incidents i WHERE i.incident_id=r.incident_id);

COMMIT;
