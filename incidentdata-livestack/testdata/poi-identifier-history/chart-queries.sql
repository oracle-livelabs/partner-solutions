-- Authored capture history: 30 June 2025 through 29 June 2026, Adelaide time.
-- Use the application's usual authenticated, scoped database session.
-- SECURE_POI_IDENTIFIERS_V restricts results to the active profile and user.
-- This avoids counting the same identifier's saved city copies as new events.
-- Reviewer metadata records administrative review; REVIEW_STATUS is unchanged.

-- 1. Monthly captures: stacked column chart by recorder.
SELECT TO_CHAR(created_at AT TIME ZONE 'Australia/Adelaide', 'YYYY-MM') AS capture_month,
       recorded_by,
       COUNT(*) AS identifier_count
FROM secure_poi_identifiers_v
GROUP BY TO_CHAR(created_at AT TIME ZONE 'Australia/Adelaide', 'YYYY-MM'), recorded_by
ORDER BY capture_month, recorded_by;

-- 2. Timeline: capture, review and expiry are distinct event types.
SELECT identifier_id, person_ref, identifier_type, identifier_value,
       'Capture' AS event_type, recorded_by AS actor, created_at AS event_at
FROM secure_poi_identifiers_v
UNION ALL
SELECT identifier_id, person_ref, identifier_type, identifier_value,
       'Administrative review', reviewed_by, reviewed_at
FROM secure_poi_identifiers_v
WHERE reviewed_at IS NOT NULL
UNION ALL
SELECT identifier_id, person_ref, identifier_type, identifier_value,
       'Validity ended', CAST(NULL AS VARCHAR2(120)), valid_to
FROM secure_poi_identifiers_v
WHERE valid_to IS NOT NULL
ORDER BY event_at, identifier_id, event_type;

-- 3. Gantt bars: cap open intervals at the display boundary only.
-- A NULL VALID_TO remains open-ended in the table.
SELECT identifier_id, person_ref, identifier_type, identifier_value,
       valid_from AS bar_start,
       NVL(valid_to, TO_TIMESTAMP_TZ('2026-06-30T00:00:00+09:30',
           'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM')) AS bar_end,
       CASE WHEN valid_to IS NULL THEN 'Open-ended' ELSE 'Ended' END AS interval_state,
       recorded_by, reviewed_by, review_status
FROM secure_poi_identifiers_v
ORDER BY person_ref, valid_from;

-- 4. Network edge list: actors point to the POIs whose records they handled.
-- Prefix IDs to avoid collisions between an actor code and a person reference.
SELECT identifier_id || ':capture' AS edge_id,
       'actor:' || recorded_by AS source_id,
       'person:' || person_ref AS target_id,
       'Captured identifier' AS relationship,
       created_at AS event_at,
       identifier_type, identifier_value
FROM secure_poi_identifiers_v
UNION ALL
SELECT identifier_id || ':review', 'actor:' || reviewed_by,
       'person:' || person_ref, 'Reviewed register association', reviewed_at,
       identifier_type, identifier_value
FROM secure_poi_identifiers_v
WHERE reviewed_by IS NOT NULL
ORDER BY event_at, edge_id;
