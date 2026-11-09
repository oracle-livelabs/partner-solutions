/* Idempotent completion step for a profile loaded before the small-case link
   correction. Safe to run only after 01_load_sapol_may_jun_2026.sql. */
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DELETE FROM case_incident_links l
WHERE l.case_id IN (SELECT case_id FROM case_files WHERE case_ref LIKE 'CASE-2026-02%')
  AND l.incident_id IN (SELECT incident_id FROM crime_incidents WHERE TO_NUMBER(SUBSTR(incident_ref,-6))<=360);

INSERT INTO case_incident_links(case_id,incident_id)
SELECT c.case_id,i.incident_id
FROM case_files c JOIN crime_incidents i ON MOD(TO_NUMBER(SUBSTR(i.incident_ref,-6)),12)=TO_NUMBER(SUBSTR(c.case_ref,-2))-1
WHERE c.case_ref LIKE 'CASE-2026-02%'
  AND TO_NUMBER(SUBSTR(i.incident_ref,-6))<=60
  AND NOT EXISTS (SELECT 1 FROM case_incident_links l WHERE l.case_id=c.case_id AND l.incident_id=i.incident_id);

COMMIT;
