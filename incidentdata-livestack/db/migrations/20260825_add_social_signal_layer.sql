/*
  Privacy-limited social signal layer for synthetic metropolitan profiles.

  Posts are simulated public observations. They are not reports, evidence, or
  findings. Only explicit, reviewed link rows may connect a post to an incident.
  Stable string references keep the layer portable across Z_BASE restores.
*/
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name='SOCIAL_MEDIA_SOURCES';
  IF v_count=0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE social_media_sources (
        source_code VARCHAR2(40) PRIMARY KEY,
        source_name VARCHAR2(120) NOT NULL,
        platform_label VARCHAR2(60) NOT NULL,
        source_type VARCHAR2(40) NOT NULL,
        source_description VARCHAR2(500),
        active NUMBER(1) DEFAULT 1 NOT NULL CHECK (active IN (0,1))
      )]';
  END IF;

  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name='SOCIAL_MEDIA_POSTS';
  IF v_count=0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE social_media_posts (
        post_ref VARCHAR2(40) PRIMARY KEY,
        source_code VARCHAR2(40) NOT NULL REFERENCES social_media_sources(source_code),
        posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
        post_text VARCHAR2(2000) NOT NULL,
        topic_code VARCHAR2(40) NOT NULL,
        topic_label VARCHAR2(100) NOT NULL,
        executive_group_code VARCHAR2(40),
        suburb VARCHAR2(100),
        patrol_area_code VARCHAR2(30) NOT NULL REFERENCES patrol_areas(area_code),
        latitude NUMBER(9,6),
        longitude NUMBER(9,6),
        geo_precision VARCHAR2(30) DEFAULT 'suburb' NOT NULL
          CHECK (geo_precision IN ('suburb','precinct','unknown')),
        reach_count NUMBER DEFAULT 0 NOT NULL,
        reshare_count NUMBER DEFAULT 0 NOT NULL,
        reply_count NUMBER DEFAULT 0 NOT NULL,
        signal_score NUMBER(5,2) NOT NULL CHECK (signal_score BETWEEN 0 AND 100),
        momentum_flag VARCHAR2(20) NOT NULL
          CHECK (momentum_flag IN ('normal','rising','elevated','critical')),
        verification_status VARCHAR2(30) DEFAULT 'unverified' NOT NULL
          CHECK (verification_status IN ('unverified','multiple_sources','incident_link_reviewed','closed')),
        post_attributes JSON,
        created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
      )]';
    EXECUTE IMMEDIATE 'CREATE INDEX ix_social_posts_time ON social_media_posts(posted_at DESC)';
    EXECUTE IMMEDIATE 'CREATE INDEX ix_social_posts_topic ON social_media_posts(topic_code,momentum_flag)';
    EXECUTE IMMEDIATE 'CREATE INDEX ix_social_posts_area ON social_media_posts(patrol_area_code)';
  END IF;

  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name='WATCHED_CRIME_PATTERNS';
  IF v_count=0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE watched_crime_patterns (
        pattern_code VARCHAR2(40) PRIMARY KEY,
        pattern_name VARCHAR2(120) NOT NULL,
        pattern_summary VARCHAR2(500) NOT NULL,
        why_watch VARCHAR2(500) NOT NULL,
        pattern_kind VARCHAR2(30) NOT NULL
          CHECK (pattern_kind IN ('case_series','community_signal')),
        pattern_status VARCHAR2(30) NOT NULL
          CHECK (pattern_status IN ('monitoring','comparative_review','reviewed')),
        search_query VARCHAR2(500) NOT NULL,
        case_ref VARCHAR2(24),
        display_order NUMBER NOT NULL,
        display_color VARCHAR2(7) DEFAULT '#437C94' NOT NULL,
        activate_ui VARCHAR2(1) DEFAULT NULL CHECK (activate_ui IN ('Y')),
        active NUMBER(1) DEFAULT 1 NOT NULL CHECK (active IN (0,1))
      )]';
  END IF;

  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name='SOCIAL_POST_INCIDENT_LINKS';
  IF v_count=0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE social_post_incident_links (
        post_ref VARCHAR2(40) REFERENCES social_media_posts(post_ref),
        incident_ref VARCHAR2(24) REFERENCES crime_incidents(incident_ref),
        link_type VARCHAR2(30) NOT NULL
          CHECK (link_type IN ('time_place_context','public_reference','analyst_comparison')),
        link_confidence NUMBER(5,2) NOT NULL CHECK (link_confidence BETWEEN 0 AND 100),
        link_summary VARCHAR2(500) NOT NULL,
        review_status VARCHAR2(20) DEFAULT 'reviewed' NOT NULL
          CHECK (review_status IN ('candidate','reviewed','rejected')),
        reviewed_by VARCHAR2(80),
        reviewed_at TIMESTAMP,
        PRIMARY KEY(post_ref,incident_ref)
      )]';
    EXECUTE IMMEDIATE 'CREATE INDEX ix_social_incident_ref ON social_post_incident_links(incident_ref)';
  END IF;

  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name='WATCHED_PATTERN_INCIDENTS';
  IF v_count=0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE watched_pattern_incidents (
        pattern_code VARCHAR2(40) REFERENCES watched_crime_patterns(pattern_code),
        incident_ref VARCHAR2(24) REFERENCES crime_incidents(incident_ref),
        relationship_label VARCHAR2(120) NOT NULL,
        PRIMARY KEY(pattern_code,incident_ref)
      )]';
  END IF;

  SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name='WATCHED_PATTERN_POSTS';
  IF v_count=0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE watched_pattern_posts (
        pattern_code VARCHAR2(40) REFERENCES watched_crime_patterns(pattern_code),
        post_ref VARCHAR2(40) REFERENCES social_media_posts(post_ref),
        relationship_label VARCHAR2(120) NOT NULL,
        PRIMARY KEY(pattern_code,post_ref)
      )]';
  END IF;
END;
/

CREATE OR REPLACE VIEW secure_social_media_posts_v AS
SELECT s.*
FROM social_media_posts s
JOIN patrol_areas p ON p.area_code=s.patrol_area_code
WHERE SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')='statewide_admin'
   OR EXISTS (
        SELECT 1 FROM security_user_geo_entitlements e
        WHERE e.user_name=SYS_CONTEXT('USERENV','CLIENT_IDENTIFIER')
          AND e.patrol_area_id=p.patrol_area_id
      );

COMMENT ON TABLE social_media_posts IS
  'Simulated public social-media observations for trend and workflow demonstrations. A post is not an incident report or evidence.';
COMMENT ON TABLE social_post_incident_links IS
  'Explicit analyst-reviewed comparison links between simulated posts and a very small subset of synthetic incidents.';
COMMENT ON TABLE watched_crime_patterns IS
  'Locality-configurable watched scenarios rendered by the application without hard-coded pattern choices.';
COMMENT ON COLUMN social_media_posts.signal_score IS
  'Descriptive 0-100 momentum score based on simulated volume, recency, and source diversity; not a crime-risk score.';

DECLARE
  PROCEDURE create_from_active(p_name VARCHAR2, p_source VARCHAR2) IS
    v_count NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_count FROM user_tables WHERE table_name=UPPER(p_name);
    IF v_count=0 THEN
      EXECUTE IMMEDIATE 'CREATE TABLE '||p_name||' AS SELECT CAST(NULL AS NUMBER) dataset_profile_id,s.* FROM '||p_source||' s WHERE 1=0';
      EXECUTE IMMEDIATE 'CREATE INDEX ix_'||LOWER(SUBSTR(p_name,8,18))||'_p ON '||p_name||'(dataset_profile_id)';
    END IF;
  END;
BEGIN
  create_from_active('z_base_social_media_sources','social_media_sources');
  create_from_active('z_base_social_media_posts','social_media_posts');
  create_from_active('z_base_watched_crime_patterns','watched_crime_patterns');
  create_from_active('z_base_social_post_incident_links','social_post_incident_links');
  create_from_active('z_base_watched_pattern_incidents','watched_pattern_incidents');
  create_from_active('z_base_watched_pattern_posts','watched_pattern_posts');
END;
/

@@20260820_fix_z_base_profile_restore.sql
