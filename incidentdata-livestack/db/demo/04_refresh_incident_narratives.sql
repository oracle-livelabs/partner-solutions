/*
  Refresh report titles and narratives for the May/June 2026 demonstration profile.
  All generated text remains non-identifying and non-operational.
  Categories, timestamps, geographic scope, evidence, cases, vectors, and
  source-calibrated totals are preserved.
*/
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
  v_subcategory VARCHAR2(160); v_title VARCHAR2(1000); v_text CLOB;
  v_embedding VARCHAR2(1000); v_variant NUMBER; v_index NUMBER;
  v_time_band VARCHAR2(40); v_status_text VARCHAR2(180); v_detail VARCHAR2(400);
  v_date_label VARCHAR2(40); v_time_label VARCHAR2(10);
BEGIN
  FOR r IN (
    SELECT i.incident_id,i.incident_ref,i.incident_status,i.occurred_at,i.location_type,
           i.suburb,i.modus_operandi,i.property_category,i.incident_attributes,cat.category_name
    FROM crime_incidents i JOIN incident_categories cat ON cat.category_id=i.category_id
    ORDER BY i.incident_id
  ) LOOP
    v_index:=TO_NUMBER(SUBSTR(r.incident_ref,-6));
    v_subcategory:=NVL(JSON_VALUE(r.incident_attributes,'$.sapol_subcategory'),r.category_name);
    v_variant:=MOD(v_index*19+LENGTH(v_subcategory),12)+1;
    v_date_label:=TO_CHAR(r.occurred_at,'DD Mon YYYY','NLS_DATE_LANGUAGE=English');
    v_time_label:=TO_CHAR(r.occurred_at,'HH24:MI');
    v_time_band:=CASE WHEN TO_NUMBER(TO_CHAR(r.occurred_at,'HH24'))<6 THEN 'overnight'
                      WHEN TO_NUMBER(TO_CHAR(r.occurred_at,'HH24'))<12 THEN 'morning'
                      WHEN TO_NUMBER(TO_CHAR(r.occurred_at,'HH24'))<17 THEN 'afternoon'
                      WHEN TO_NUMBER(TO_CHAR(r.occurred_at,'HH24'))<21 THEN 'evening' ELSE 'late-evening' END;
    v_status_text:=CASE r.incident_status WHEN 'reported' THEN 'The record remains at the initial report stage.'
                      WHEN 'under_review' THEN 'The record is retained for review.'
                      WHEN 'assigned' THEN 'The record is noted as assigned.'
                      WHEN 'resolved' THEN 'The record is retained as resolved historical context.'
                      ELSE 'The record is recorded as closed with no further action.' END;
    v_detail:=CASE MOD(v_variant,6) WHEN 0 THEN 'a broad property description and a recorded time context'
                  WHEN 1 THEN 'a general setting description and a non-identifying report channel reference'
                  WHEN 2 THEN 'a property context, an approximate location marker, and the stated time period'
                  WHEN 3 THEN 'a general description of the reported circumstances and an item-category note'
                  WHEN 4 THEN 'a time context, a broad setting classification, and a report reference'
                  ELSE 'a non-identifying location context and a recorded property classification' END;

    IF r.modus_operandi='after-hours-consignment-link' THEN
      v_title:='After-hours stock movement report - '||r.suburb||' - '||v_date_label||' '||v_time_label;
      v_text:='A report describes an after-hours event involving small commercial stock at an approximate '||r.suburb||' location during the '||v_time_band||' period on '||v_date_label||'. The report records an unverified dispatch-style reference, a short stock-list notation, and the recurring Kestrel-S27 marker. '||v_status_text;
      v_embedding:='after-hours stock movement dispatch reference Kestrel-S27 consignment link '||r.suburb||' '||v_time_band;
      UPDATE incident_reports
      SET report_summary=v_title,report_text=v_text,embedding_text=v_embedding,
          enrichments=JSON_OBJECT('synthetic_record' VALUE true,'language' VALUE 'en-AU','record_style' VALUE 'city profile narrative','narrative_variant' VALUE v_variant,'report_month' VALUE TO_CHAR(r.occurred_at,'YYYY-MM'),'location_context' VALUE r.location_type,'property_context' VALUE r.property_category,'series' VALUE 'CROSS_AREA_0147','shared_marker' VALUE 'Kestrel-S27')
      WHERE incident_id=r.incident_id;
    ELSE
      v_title:=CASE MOD(v_variant,4) WHEN 0 THEN v_subcategory||' report - '||r.suburb||' - '||v_date_label||' '||v_time_label
                 WHEN 1 THEN v_subcategory||' record in '||r.suburb||' - '||v_date_label||' '||v_time_label
                 WHEN 2 THEN r.suburb||' '||v_subcategory||' report - '||v_date_label||' '||v_time_label
                 ELSE v_time_band||' '||v_subcategory||' report - '||r.suburb||' - '||v_date_label END;
      v_text:=CASE MOD(v_variant,3)
                WHEN 0 THEN 'A report was received in relation to '||LOWER(v_subcategory)||' at a '||r.location_type||' in '||r.suburb||' during the '||v_time_band||' period on '||v_date_label||'. The entry records '||v_detail||' relating to '||NVL(r.property_category,'general property')||'. '||v_status_text
                WHEN 1 THEN 'An incident record was created for '||LOWER(v_subcategory)||' in the '||r.suburb||' area at approximately '||v_time_label||' on '||v_date_label||'. Available information includes '||v_detail||' for '||NVL(r.property_category,'the recorded context')||'. '||v_status_text
                ELSE 'A '||v_time_band||' report concerning '||LOWER(v_subcategory)||' was logged at a '||r.location_type||' in '||r.suburb||' on '||v_date_label||'. The entry notes '||v_detail||' associated with '||NVL(r.property_category,'the reported context')||'. '||v_status_text END;
      v_embedding:=v_subcategory||' '||r.suburb||' '||r.location_type||' '||NVL(r.property_category,'general property')||' '||v_time_band||' '||r.modus_operandi;
      UPDATE incident_reports
      SET report_summary=v_title,report_text=v_text,embedding_text=v_embedding,
          enrichments=JSON_OBJECT('synthetic_record' VALUE true,'language' VALUE 'en-AU','record_style' VALUE 'city profile narrative','narrative_variant' VALUE v_variant,'report_month' VALUE TO_CHAR(r.occurred_at,'YYYY-MM'),'location_context' VALUE r.location_type,'property_context' VALUE r.property_category,'category_context' VALUE r.category_name)
      WHERE incident_id=r.incident_id;
    END IF;
  END LOOP;
END;
/

COMMIT;
