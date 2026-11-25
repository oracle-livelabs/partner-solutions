/*
  Idempotent reference-data prerequisite for the Adelaide 21,513-record
  synthetic profile. It deliberately restores no incidents, reports, people,
  cases, or evidence.
*/
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

MERGE INTO patrol_areas p
USING (
  SELECT 'CENTRAL' area_code, 'Adelaide Central' area_name, 'central' region_group,
         -34.928500 centre_lat, 138.600700 centre_lon FROM dual
  UNION ALL SELECT 'NORTH', 'Northern & Western Adelaide', 'north', -34.790000, 138.600000 FROM dual
  UNION ALL SELECT 'SOUTH', 'Southern & Eastern Adelaide', 'south', -35.020000, 138.620000 FROM dual
) s ON (p.area_code = s.area_code)
WHEN MATCHED THEN UPDATE SET p.area_name=s.area_name, p.region_group=s.region_group,
                             p.centre_lat=s.centre_lat, p.centre_lon=s.centre_lon
WHEN NOT MATCHED THEN INSERT (area_code,area_name,region_group,centre_lat,centre_lon)
  VALUES (s.area_code,s.area_name,s.region_group,s.centre_lat,s.centre_lon);

MERGE INTO security_users u
USING (
  SELECT 'statewide_admin' user_name, 'admin' role_name, 'Statewide Administrator' display_name FROM dual
  UNION ALL SELECT 'central_analyst', 'analyst', 'Central Analyst' FROM dual
  UNION ALL SELECT 'northern_analyst', 'analyst', 'Northern Analyst' FROM dual
  UNION ALL SELECT 'southern_analyst', 'analyst', 'Southern Analyst' FROM dual
  UNION ALL SELECT 'read_only_viewer', 'viewer', 'Limited Viewer' FROM dual
) s ON (u.user_name=s.user_name)
WHEN MATCHED THEN UPDATE SET u.role_name=s.role_name, u.display_name=s.display_name, u.is_active=1
WHEN NOT MATCHED THEN INSERT (user_name,role_name,display_name,is_active)
  VALUES (s.user_name,s.role_name,s.display_name,1);

MERGE INTO security_user_geo_entitlements e
USING (
  SELECT 'central_analyst' user_name, 'CENTRAL' area_code FROM dual
  UNION ALL SELECT 'northern_analyst', 'NORTH' FROM dual
  UNION ALL SELECT 'southern_analyst', 'SOUTH' FROM dual
  UNION ALL SELECT 'read_only_viewer', 'CENTRAL' FROM dual
) s ON (e.user_name=s.user_name AND e.patrol_area_id=(SELECT patrol_area_id FROM patrol_areas WHERE area_code=s.area_code))
WHEN NOT MATCHED THEN INSERT (user_name,patrol_area_id)
  VALUES (s.user_name,(SELECT patrol_area_id FROM patrol_areas WHERE area_code=s.area_code));

COMMIT;
EXIT SUCCESS;
