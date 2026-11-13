SET PAGES 500 LINES 240 FEEDBACK ON HEADING ON LONG 1000 LONGCHUNKSIZE 1000

PROMPT === Core counts ===
SELECT (SELECT COUNT(*) FROM crime_incidents) incidents,
       (SELECT COUNT(*) FROM incident_reports) reports,
       (SELECT COUNT(*) FROM evidence_items) evidence,
       (SELECT COUNT(*) FROM incident_categories) categories
FROM dual;

PROMPT === Profile provenance ===
SELECT JSON_VALUE(incident_attributes, '$.synthetic_profile_code') profile,
       JSON_VALUE(incident_attributes, '$.generator_version') generator,
       COUNT(*) records
FROM crime_incidents
GROUP BY JSON_VALUE(incident_attributes, '$.synthetic_profile_code'),
         JSON_VALUE(incident_attributes, '$.generator_version');

PROMPT === Time and suburb coverage ===
SELECT TO_CHAR(MIN(occurred_at),'YYYY-MM-DD HH24:MI:SS TZH:TZM') min_time,
       TO_CHAR(MAX(occurred_at),'YYYY-MM-DD HH24:MI:SS TZH:TZM') max_time,
       COUNT(DISTINCT TRUNC(occurred_at)) days,
       COUNT(DISTINCT suburb) suburbs
FROM crime_incidents;

PROMPT === Executive groups ===
SELECT c.executive_group_label, COUNT(*) records,
       ROUND(COUNT(*)*100/21513,2) pct
FROM crime_incidents i
JOIN incident_categories c ON c.category_id=i.category_id
GROUP BY c.executive_group_label,c.display_order
ORDER BY c.display_order;

PROMPT === Months ===
SELECT TO_CHAR(occurred_at,'YYYY-MM') month,COUNT(*) records
FROM crime_incidents
GROUP BY TO_CHAR(occurred_at,'YYYY-MM')
ORDER BY month;

PROMPT === Regions ===
SELECT p.area_code,COUNT(*) records,COUNT(DISTINCT i.suburb) suburbs
FROM crime_incidents i
JOIN patrol_areas p ON p.patrol_area_id=i.patrol_area_id
GROUP BY p.area_code ORDER BY p.area_code;

PROMPT === Settings ===
SELECT location_type,COUNT(*) records
FROM crime_incidents
GROUP BY location_type ORDER BY records DESC;

PROMPT === Family and domestic abuse classification ===
SELECT SUM(CASE WHEN JSON_VALUE(incident_attributes,
       '$.family_domestic_abuse_related' RETURNING VARCHAR2)='true'
       THEN 1 ELSE 0 END) fda_records
FROM crime_incidents;

PROMPT === Narrative quality ===
SELECT COUNT(DISTINCT report_summary) unique_titles,
       COUNT(DISTINCT DBMS_LOB.SUBSTR(report_text,4000,1)) unique_narratives,
       MIN(LENGTH(report_summary)) min_title,
       MAX(LENGTH(report_summary)) max_title,
       MIN(LENGTH(report_text)) min_text,
       MAX(LENGTH(report_text)) max_text
FROM incident_reports;

SELECT COUNT(*) bad_visible_text
FROM incident_reports
WHERE REGEXP_LIKE(report_summary||' '||DBMS_LOB.SUBSTR(report_text,4000,1),
      'synthetic|demonstration|non-identifying|available for search and comparison|ACI-2026|RPT-2026','i')
   OR INSTR(report_summary,UNISTR('\FFFD'))>0
   OR INSTR(report_text,UNISTR('\FFFD'))>0;

PROMPT === Spatial quality ===
SELECT 1-COUNT(DISTINCT TO_CHAR(latitude,'FM9990.000000')||','||
       TO_CHAR(longitude,'FM9990.000000'))/COUNT(*) duplicate_rate
FROM crime_incidents;

SELECT MAX(cell_count) max_cell_count
FROM (
  SELECT FLOOR((latitude+90)/0.004),FLOOR((longitude+180)/0.004),COUNT(*) cell_count
  FROM crime_incidents
  GROUP BY FLOOR((latitude+90)/0.004),FLOOR((longitude+180)/0.004)
);

PROMPT === Referential integrity ===
SELECT (SELECT COUNT(*) FROM incident_reports r LEFT JOIN crime_incidents i
        ON i.incident_id=r.incident_id WHERE i.incident_id IS NULL) orphan_reports,
       (SELECT COUNT(*) FROM evidence_items e LEFT JOIN crime_incidents i
        ON i.incident_id=e.incident_id WHERE i.incident_id IS NULL) orphan_evidence
FROM dual;

PROMPT === Recoverable Adelaide snapshot ===
SELECT p.profile_code,p.profile_status,
       TO_CHAR(p.captured_at,'YYYY-MM-DD HH24:MI:SS') captured_at,
       COUNT(i.incident_id) snapshot_incidents
FROM z_base_dataset_profiles p
LEFT JOIN z_base_crime_incidents i ON i.dataset_profile_id=p.dataset_profile_id
WHERE p.profile_code='ADELAIDE_DATA'
GROUP BY p.profile_code,p.profile_status,p.captured_at;

EXIT
