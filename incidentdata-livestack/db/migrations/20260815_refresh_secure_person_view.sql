/* Refresh p.* after adding portrait columns to an existing demo database. */
CREATE OR REPLACE VIEW secure_persons_of_interest_v AS
SELECT DISTINCT p.*
FROM persons_of_interest p
JOIN person_incident_links l ON l.person_id = p.person_id
JOIN secure_crime_incidents_v i ON i.incident_id = l.incident_id;
COMMIT;
