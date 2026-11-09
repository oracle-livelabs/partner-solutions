'use strict';

// Aggregate each scope independently so an empty public-post set still produces
// one complete JSON summary with the correct authorised incident count.
const SUMMARY_SQL = `SELECT signals.*, incidents.authorised_incident_count
FROM (
  SELECT COUNT(DISTINCT s.post_ref) post_count_72h,
    COUNT(DISTINCT s.source_code) source_count_72h,
    COUNT(DISTINCT CASE WHEN s.momentum_flag='rising' THEN s.post_ref END) rising_count_72h,
    COUNT(DISTINCT CASE WHEN s.momentum_flag IN ('elevated','critical') THEN s.post_ref END) elevated_count_72h,
    COUNT(DISTINCT CASE WHEN i.incident_ref IS NOT NULL AND l.review_status='reviewed' THEN s.post_ref END) linked_post_count,
    COUNT(DISTINCT CASE WHEN i.incident_ref IS NOT NULL AND l.review_status='reviewed' THEN i.incident_ref END) linked_incident_count
  FROM secure_social_media_posts_v s
  LEFT JOIN social_post_incident_links l ON l.post_ref=s.post_ref
  LEFT JOIN secure_crime_incidents_v i ON i.incident_ref=l.incident_ref
  WHERE s.posted_at >= (SELECT MAX(posted_at) FROM secure_social_media_posts_v)-INTERVAL '72' HOUR
) signals
CROSS JOIN (SELECT COUNT(*) authorised_incident_count FROM secure_crime_incidents_v) incidents`;

async function communitySignalSummary(connection) {
  const result = await connection.execute(SUMMARY_SQL);
  if (result.rows.length !== 1) throw new Error('Expected one scoped community-signal summary.');
  return result.rows[0];
}

module.exports = { SUMMARY_SQL, communitySignalSummary };
