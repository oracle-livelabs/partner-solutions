-- Independent authored teaching overlay; no core incident/report/evidence rows are replaced.
CREATE TABLE agent_demo_sources (
  profile_code VARCHAR2(60) NOT NULL,
  pattern_code VARCHAR2(80) NOT NULL,
  case_code VARCHAR2(80) NOT NULL,
  case_title VARCHAR2(160) NOT NULL,
  teaching_question VARCHAR2(1000) NOT NULL,
  anchor_incident_ref VARCHAR2(24) NOT NULL,
  source_ref VARCHAR2(40) NOT NULL,
  source_order NUMBER NOT NULL,
  document_role VARCHAR2(60) NOT NULL,
  title VARCHAR2(240) NOT NULL,
  source_text CLOB NOT NULL,
  source_sha256 VARCHAR2(64) NOT NULL,
  source_basis VARCHAR2(80) NOT NULL,
  fixture_version NUMBER NOT NULL,
  synthetic_record NUMBER DEFAULT 1 NOT NULL CHECK (synthetic_record=1),
  enabled NUMBER DEFAULT 1 NOT NULL CHECK (enabled IN (0,1)),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT agent_demo_sources_pk PRIMARY KEY(profile_code,case_code,source_ref)
);

CREATE OR REPLACE VIEW secure_agent_demo_sources_v AS
SELECT d.*
FROM agent_demo_sources d
JOIN z_base_dataset_profiles p ON p.profile_code=d.profile_code
JOIN z_base_active_dataset_profile a
  ON a.dataset_profile_id=p.dataset_profile_id AND a.control_id=1
JOIN secure_crime_incidents_v i ON i.incident_ref=d.anchor_incident_ref
JOIN secure_watched_pattern_incidents_v w
  ON w.incident_ref=i.incident_ref AND w.pattern_code=d.pattern_code
WHERE d.enabled=1;

CREATE OR REPLACE FUNCTION crimedata_agent_supporting_records (
  p_pattern_code IN VARCHAR2
) RETURN CLOB AUTHID DEFINER
IS
  result CLOB;
BEGIN
  SELECT JSON_OBJECT(
    'requested_code' VALUE UPPER(TRIM(p_pattern_code)),
    'pattern_code' VALUE COALESCE(MIN(d.pattern_code),UPPER(TRIM(p_pattern_code))),
    'source_count' VALUE COUNT(*),
    'source_basis' VALUE 'authored_synthetic_teaching_supplement',
    'scope_notice' VALUE 'Teaching documents are separate from original incident records. Use only their supplied content and cite source_ref. They do not establish facts about the underlying anchor incident.',
    'sources' VALUE COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
      'case_code' VALUE d.case_code,
      'pattern_code' VALUE d.pattern_code,
      'case_title' VALUE d.case_title,
      'teaching_question' VALUE d.teaching_question,
      'source_ref' VALUE d.source_ref,
      'title' VALUE d.title,
      'document_role' VALUE d.document_role,
      'source_text' VALUE d.source_text,
      'source_sha256' VALUE d.source_sha256
      RETURNING CLOB
    ) ORDER BY d.source_order RETURNING CLOB),TO_CLOB('[]')) FORMAT JSON
    RETURNING CLOB
  ) INTO result
  FROM secure_agent_demo_sources_v d
  WHERE d.pattern_code=UPPER(TRIM(p_pattern_code))
     OR d.case_code=UPPER(TRIM(p_pattern_code));
  RETURN result;
END;
/
