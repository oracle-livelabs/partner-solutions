#!/usr/bin/env python3
"""Build the repeatable Brisbane May--June 2026 synthetic-data SQL loader.

The loader deliberately uses approximate suburb-centre teaching anchors, bounded
grid jitter, and no street or person data.  It is deterministic (seed 20260821).
"""
from pathlib import Path

OUTPUT = Path('/tmp/load_brisbane_may_jun_2026.sql')

# QPS/QGSO Crime Report divisions and sub-categories.  Totals are a designed
# teaching allocation, not a statement about real Brisbane incident counts.
CATEGORIES = [
 ('MURDER','Homicide (Murder)','high',12,'person'),('OTHER_HOMICIDE','Other homicide','high',28,'person'),
 ('GRIEVOUS_ASSAULT','Assault (Grievous assault)','high',240,'person'),('SERIOUS_ASSAULT','Assault (Serious assault)','high',560,'person'),('SERIOUS_ASSAULT_NO_INJURY','Assault (Serious assault - no injury)','high',450,'person'),('COMMON_ASSAULT','Assault (Common assault)','high',2200,'person'),
 ('RAPE_ATTEMPTED_RAPE','Sexual offences (Rape and attempted rape)','high',120,'person'),('OTHER_SEXUAL_OFFENCES','Sexual offences (Other sexual offences)','high',580,'person'),
 ('ARMED_ROBBERY','Robbery (Armed robbery)','high',180,'person'),('UNARMED_ROBBERY','Robbery (Unarmed robbery)','high',620,'person'),
 ('KIDNAPPING_ABDUCTION','Other person offences (Kidnapping/abduction)','high',90,'person'),('EXTORTION','Other person offences (Extortion)','high',35,'person'),('STALKING','Other person offences (Stalking)','high',170,'person'),('LIFE_ENDANGERING_ACTS','Other person offences (Life endangering acts)','high',310,'person'),('COERCIVE_CONTROL','Other person offences (Coercive control)','high',105,'person'),
 ('UNLAWFUL_ENTRY_DWELLING','Unlawful entry (Dwelling)','high',1100,'property'),('UNLAWFUL_ENTRY_SHOP','Unlawful entry (Shop)','high',450,'property'),('UNLAWFUL_ENTRY_OTHER','Unlawful entry (Other)','medium',800,'property'),('ARSON','Arson','high',80,'property'),('OTHER_PROPERTY_DAMAGE','Other property damage','medium',4100,'property'),('UNLAWFUL_USE_MOTOR_VEHICLE','Unlawful use of a motor vehicle','high',2100,'property'),('OTHER_THEFT','Other theft (excl. unlawful entry)','medium',7000,'property'),('FRAUD','Fraud','medium',2100,'property'),('HANDLING_STOLEN_GOODS','Handling stolen goods','medium',470,'property'),
 ('DRUG_TRAFFICKING','Drug offences (Trafficking)','high',180,'other'),('DRUG_POSSESS','Drug offences (Possess)','medium',3400,'other'),('DRUG_PRODUCE','Drug offences (Produce)','high',280,'other'),('DRUG_SELL_SUPPLY','Drug offences (Sell/supply)','high',700,'other'),('OTHER_DRUG_OFFENCES','Drug offences (Other)','medium',2040,'other'),('BREACH_DVO','Breach of Domestic Violence Order','high',2800,'other'),('TRESPASSING_VAGRANCY','Trespassing and vagrancy','low',1450,'other'),('WEAPONS_ACT','Weapons Act offences','high',450,'other'),('GOOD_ORDER','Good order offences','medium',3800,'other'),('TRAFFIC_RELATED','Traffic and related offences','medium',2250,'other'),('LIQUOR_OFFENCES','Liquor offences (excl. drunkenness)','low',480,'other'),('MISCELLANEOUS','Miscellaneous offences','low',587,'other'),
]

# Approximate locality anchors only.  They are deliberately not addresses or
# observed incident points.  Higher weights support a dense inner-city teaching
# view without making any actual-crime claim about a suburb.
ANCHORS = [
 ('BRIS_CENTRAL','Brisbane CBD',-27.4698,153.0251,22),('BRIS_CENTRAL','Fortitude Valley',-27.4571,153.0340,18),('BRIS_CENTRAL','South Brisbane',-27.4774,153.0185,15),('BRIS_CENTRAL','West End',-27.4807,153.0097,12),('BRIS_CENTRAL','Kangaroo Point',-27.4755,153.0327,9),('BRIS_CENTRAL','Newstead',-27.4522,153.0440,8),('BRIS_CENTRAL','Milton',-27.4707,153.0024,7),('BRIS_CENTRAL','Woolloongabba',-27.4887,153.0362,8),
 ('BRIS_NORTH','Chermside',-27.3847,153.0313,10),('BRIS_NORTH','Nundah',-27.4026,153.0580,6),('BRIS_NORTH','Sandgate',-27.3227,153.0698,4),('BRIS_NORTH','Caboolture',-27.0842,152.9516,7),('BRIS_NORTH','North Lakes',-27.2412,153.0201,6),('BRIS_NORTH','Redcliffe',-27.2305,153.1084,5),('BRIS_NORTH','Strathpine',-27.3047,152.9896,5),('BRIS_NORTH','Aspley',-27.3678,153.0178,5),
 ('BRIS_SOUTH','Upper Mount Gravatt',-27.5628,153.0827,10),('BRIS_SOUTH','Mount Gravatt',-27.5392,153.0743,6),('BRIS_SOUTH','Sunnybank',-27.5784,153.0625,7),('BRIS_SOUTH','Logan Central',-27.6439,153.1076,8),('BRIS_SOUTH','Woodridge',-27.6344,153.1113,7),('BRIS_SOUTH','Beenleigh',-27.7171,153.2025,6),('BRIS_SOUTH','Springwood',-27.6117,153.1282,6),('BRIS_SOUTH','Rochedale',-27.5966,153.1446,4),
 ('BRIS_WEST','Indooroopilly',-27.4975,152.9747,8),('BRIS_WEST','Toowong',-27.4851,152.9900,6),('BRIS_WEST','Ipswich',-27.6150,152.7600,8),('BRIS_WEST','Goodna',-27.6104,152.8995,7),('BRIS_WEST','Inala',-27.5955,152.9742,7),('BRIS_WEST','Oxley',-27.5485,152.9824,5),('BRIS_WEST','Kenmore',-27.5070,152.9404,4),('BRIS_WEST','Springfield',-27.6566,152.9132,5),
 ('BRIS_OUTER','Wynnum',-27.4457,153.1588,4),('BRIS_OUTER','Manly',-27.4548,153.1856,3),('BRIS_OUTER','Cleveland',-27.5266,153.2642,4),('BRIS_OUTER','Capalaba',-27.5238,153.2011,4),('BRIS_OUTER','Samford Valley',-27.3727,152.8860,2),('BRIS_OUTER','Dayboro',-27.1950,152.8240,2),('BRIS_OUTER','Jimboomba',-27.8310,153.0270,2),('BRIS_OUTER','Redland Bay',-27.6100,153.3020,2),
]

assert sum(row[3] for row in CATEGORIES) == 42317
assert sum(row[3] for row in CATEGORIES if row[4] == 'person') == 5700
assert sum(row[3] for row in CATEGORIES if row[4] == 'property') == 18200
assert sum(row[3] for row in CATEGORIES if row[4] == 'other') == 18417

def esc(value): return value.replace("'", "''")

def main():
    total_weight = sum(a[4] for a in ANCHORS)
    category_values = '\n  UNION ALL '.join("SELECT '%s' code, '%s' name, '%s' severity, %d total, '%s' grp FROM dual" % (esc(c),esc(n),s,t,g) for c,n,s,t,g in CATEGORIES)
    anchor_values = '\n  UNION ALL '.join("SELECT %d anchor_id, '%s' area_code, '%s' suburb, %s lat, %s lon, %d weight FROM dual" % (i+1,esc(a),esc(s),lat,lon,w) for i,(a,s,lat,lon,w) in enumerate(ANCHORS))
    cumulative = []
    running = 0
    for i, a in enumerate(ANCHORS, 1):
        running += a[4]
        cumulative.append("SELECT %d anchor_id, %d cumulative_weight FROM dual" % (i, running))
    cum_values = '\n  UNION ALL '.join(cumulative)
    sql = f"""/*
  Brisbane Metropolitan Area synthetic teaching profile, 1 May--30 June 2026.
  Exactly 42,317 non-identifying records. QPS/QGSO category labels are used
  solely as a teaching taxonomy. All locations are bounded approximate
  suburb-level grid points; no source describes real incidents or addresses.
  Seed: 20260821. Grid: 0.004 degrees, 13 x 13 cells per anchor, max intended
  congestion below 120 records per cell.
*/
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE v_count NUMBER; BEGIN
  SELECT COUNT(*) INTO v_count FROM crime_incidents;
  IF v_count <> 0 THEN RAISE_APPLICATION_ERROR(-20021,'Operational crime tables must be empty before Brisbane load.'); END IF;
END;
/
DELETE FROM security_user_geo_entitlements;
DELETE FROM patrol_areas;
DELETE FROM incident_categories;

MERGE INTO security_users t USING (
  SELECT 'statewide_admin' user_name,'admin' role_name,'Statewide Administrator' display_name FROM dual UNION ALL
  SELECT 'central_analyst','analyst','Brisbane Central Analyst' FROM dual UNION ALL
  SELECT 'northern_analyst','analyst','Brisbane North Analyst' FROM dual UNION ALL
  SELECT 'southern_analyst','analyst','Brisbane South Analyst' FROM dual UNION ALL
  SELECT 'read_only_viewer','viewer','Limited Viewer' FROM dual
) s ON (t.user_name=s.user_name)
WHEN MATCHED THEN UPDATE SET t.role_name=s.role_name,t.display_name=s.display_name,t.is_active=1
WHEN NOT MATCHED THEN INSERT (user_name,role_name,display_name,is_active) VALUES (s.user_name,s.role_name,s.display_name,1);

INSERT INTO patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) VALUES ('BRIS_CENTRAL','Brisbane Inner Metro','central',-27.4698,153.0251);
INSERT INTO patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) VALUES ('BRIS_NORTH','Brisbane and Moreton North Metro','north',-27.3300,153.0250);
INSERT INTO patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) VALUES ('BRIS_SOUTH','Logan and South Brisbane Metro','south',-27.6000,153.1100);
INSERT INTO patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) VALUES ('BRIS_WEST','Ipswich and Western Brisbane Metro','west',-27.5800,152.9000);
INSERT INTO patrol_areas(area_code,area_name,region_group,centre_lat,centre_lon) VALUES ('BRIS_OUTER','Bayside and Outer Metro','outer',-27.4500,153.2100);
INSERT INTO security_user_geo_entitlements SELECT 'central_analyst',patrol_area_id FROM patrol_areas WHERE area_code='BRIS_CENTRAL';
INSERT INTO security_user_geo_entitlements SELECT 'northern_analyst',patrol_area_id FROM patrol_areas WHERE area_code='BRIS_NORTH';
INSERT INTO security_user_geo_entitlements SELECT 'southern_analyst',patrol_area_id FROM patrol_areas WHERE area_code='BRIS_SOUTH';
INSERT INTO security_user_geo_entitlements SELECT 'read_only_viewer',patrol_area_id FROM patrol_areas WHERE area_code='BRIS_CENTRAL';

INSERT INTO incident_categories(category_code,category_name,severity_band)
WITH categories AS (
  {category_values}
) SELECT code,name,severity FROM categories;

INSERT INTO crime_incidents(incident_ref,category_id,patrol_area_id,incident_status,occurred_at,location_type,suburb,latitude,longitude,address_line_1,address_locality,address_region,address_postcode,address_country_code,address_precision,address_enrichment_source,modus_operandi,property_category,vehicle_descriptor,incident_attributes)
WITH targets AS (
  {category_values}
), nums(n) AS (SELECT LEVEL FROM dual CONNECT BY LEVEL <= 7000), expanded AS (
  SELECT t.code,t.name,t.grp,n.n FROM targets t CROSS JOIN nums n WHERE n.n<=t.total
), numbered AS (
  SELECT e.*,ROW_NUMBER() OVER (ORDER BY code,n) rec_no FROM expanded e
), anchors AS (
  {anchor_values}
), anchor_cutoffs AS (
  {cum_values}
), selected AS (
  SELECT r.*,a.area_code,a.suburb,a.lat,a.lon
  FROM numbered r JOIN anchors a ON a.anchor_id=(SELECT MIN(c.anchor_id) FROM anchor_cutoffs c WHERE c.cumulative_weight >= MOD(r.rec_no*7919,{total_weight})+1)
)
SELECT
  'BCI-2026-'||LPAD(rec_no,6,'0'), c.category_id, p.patrol_area_id,
  CASE MOD(rec_no,10) WHEN 0 THEN 'reported' WHEN 1 THEN 'under_review' WHEN 2 THEN 'assigned' WHEN 3 THEN 'assigned' WHEN 4 THEN 'under_review' WHEN 5 THEN 'resolved' WHEN 6 THEN 'resolved' ELSE 'closed_no_further_action' END,
  FROM_TZ(CAST((CASE WHEN (grp='other' OR code LIKE '%ASSAULT%' OR code IN ('OTHER_THEFT','ARMED_ROBBERY','UNARMED_ROBBERY','DRUG_POSSESS','DRUG_SELL_SUPPLY','GOOD_ORDER')) AND MOD(rec_no,10)<6
    THEN DATE '2026-05-02' + 7*MOD(rec_no*17,9) + MOD(rec_no,2) + NUMTODSINTERVAL(64800+MOD(rec_no*104729,32400),'SECOND')
    ELSE DATE '2026-05-01' + MOD(rec_no*37,61) + NUMTODSINTERVAL(MOD(rec_no*104729,86400),'SECOND') END) AS TIMESTAMP),'Australia/Brisbane'),
  CASE WHEN grp='property' THEN CASE MOD(rec_no,5) WHEN 0 THEN 'approximate residential setting' WHEN 1 THEN 'approximate retail setting' WHEN 2 THEN 'approximate street setting' WHEN 3 THEN 'approximate transport setting' ELSE 'approximate public setting' END
       WHEN grp='person' THEN CASE MOD(rec_no,4) WHEN 0 THEN 'approximate public setting' WHEN 1 THEN 'approximate nightlife setting' WHEN 2 THEN 'approximate residential setting' ELSE 'approximate transport setting' END
       ELSE CASE MOD(rec_no,4) WHEN 0 THEN 'approximate public setting' WHEN 1 THEN 'approximate street setting' WHEN 2 THEN 'approximate transport setting' ELSE 'approximate park or reserve setting' END END,
  suburb,
  lat + (MOD(rec_no*97,13)-6)*.004 + (MOD(rec_no*104729,1000)-500)/1000000,
  lon + (MOD(TRUNC(rec_no*104729/17),13)-6)*.004 + (MOD(rec_no*130363,1000)-500)/1000000,
  'Synthetic vicinity - '||suburb,suburb,'Brisbane Metropolitan Area',NULL,'AU','approximate_suburb','seeded_brisbane_grid_v1',
  LOWER(REPLACE(code,'_','-'))||'-context',CASE WHEN grp='property' THEN 'demonstration property context' WHEN grp='person' THEN 'demonstration person-offence context' ELSE 'demonstration public-order context' END,NULL,
  JSON_OBJECT('synthetic_record' VALUE true,'city_profile' VALUE 'brisbane_metro_may_jun_2026_demonstration','qgso_division' VALUE CASE grp WHEN 'person' THEN 'Offences against the person' WHEN 'property' THEN 'Offences against property' ELSE 'Other offences' END,'qgso_category' VALUE name,'reporting_window' VALUE '2026-05-01 to 2026-06-30 AEST','spatial_precision' VALUE 'approximate suburb-level training point','grid_cell_degrees' VALUE 0.004,'seed' VALUE 20260821)
FROM selected s JOIN incident_categories c ON c.category_code=s.code JOIN patrol_areas p ON p.area_code=s.area_code;

INSERT INTO incident_reports(incident_id,report_summary,report_text,embedding_text,enrichments)
SELECT i.incident_id,
  'Recorded '||c.category_name||' context - '||i.suburb||' - '||i.incident_ref,
  CASE MOD(i.incident_id,6) WHEN 0 THEN 'A generated record was created for a ' WHEN 1 THEN 'A non-identifying demonstration report notes a ' WHEN 2 THEN 'A synthetic report was received about a ' WHEN 3 THEN 'A training-data entry records a ' WHEN 4 THEN 'A generated observation was logged for a ' ELSE 'A demonstration record describes a ' END||LOWER(c.category_name)||' context in an approximate '||i.suburb||' setting. '||
  CASE MOD(i.incident_id,5) WHEN 0 THEN 'The entry uses an approximate suburb-level point and a broad time band only.' WHEN 1 THEN 'No person, address, or real-world incident detail is represented in this record.' WHEN 2 THEN 'The recorded context is retained solely for relational, search, and mapping demonstrations.' WHEN 3 THEN 'This non-operational profile preserves category and setting context without identifying information.' ELSE 'The report is synthetic and supports controlled teaching exploration only.' END||' Synthetic record context '||i.incident_ref||' is unique to this generated training entry and has no real-world referent.',
  c.category_name||' '||i.suburb||' '||i.modus_operandi||' Brisbane demonstration',
  JSON_OBJECT('synthetic_record' VALUE true,'city_profile' VALUE 'brisbane_metro_may_jun_2026_demonstration','report_month' VALUE TO_CHAR(i.occurred_at,'Mon-YY'),'qgso_category' VALUE c.category_name,'location_context' VALUE i.location_type,'property_context' VALUE i.property_category,'narrative_variant' VALUE MOD(i.incident_id,30),'spatial_precision' VALUE 'approximate suburb-level training point')
FROM crime_incidents i JOIN incident_categories c ON c.category_id=i.category_id;

INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata)
SELECT incident_id,CASE MOD(incident_id,4) WHEN 0 THEN 'synthetic_observation' WHEN 1 THEN 'synthetic_document_reference' WHEN 2 THEN 'synthetic_scene_note' ELSE 'synthetic_digital_reference' END,
  JSON_OBJECT('synthetic_record' VALUE true,'city_profile' VALUE 'brisbane_metro_may_jun_2026_demonstration','description' VALUE 'Non-identifying demonstration artefact')
FROM crime_incidents WHERE MOD(incident_id,23)=0;

DECLARE v_total NUMBER; v_may NUMBER; v_jun NUMBER; v_person NUMBER; v_property NUMBER; v_other NUMBER; BEGIN
  SELECT COUNT(*) INTO v_total FROM crime_incidents;
  SELECT COUNT(*) INTO v_may FROM crime_incidents WHERE occurred_at>=TO_TIMESTAMP_TZ('2026-05-01 00:00:00 +10:00','YYYY-MM-DD HH24:MI:SS TZH:TZM') AND occurred_at<TO_TIMESTAMP_TZ('2026-06-01 00:00:00 +10:00','YYYY-MM-DD HH24:MI:SS TZH:TZM');
  SELECT COUNT(*) INTO v_jun FROM crime_incidents WHERE occurred_at>=TO_TIMESTAMP_TZ('2026-06-01 00:00:00 +10:00','YYYY-MM-DD HH24:MI:SS TZH:TZM') AND occurred_at<TO_TIMESTAMP_TZ('2026-07-01 00:00:00 +10:00','YYYY-MM-DD HH24:MI:SS TZH:TZM');
  SELECT COUNT(*) INTO v_person FROM crime_incidents i JOIN incident_categories c ON c.category_id=i.category_id WHERE c.category_code IN ('MURDER','OTHER_HOMICIDE','GRIEVOUS_ASSAULT','SERIOUS_ASSAULT','SERIOUS_ASSAULT_NO_INJURY','COMMON_ASSAULT','RAPE_ATTEMPTED_RAPE','OTHER_SEXUAL_OFFENCES','ARMED_ROBBERY','UNARMED_ROBBERY','KIDNAPPING_ABDUCTION','EXTORTION','STALKING','LIFE_ENDANGERING_ACTS','COERCIVE_CONTROL');
  SELECT COUNT(*) INTO v_property FROM crime_incidents i JOIN incident_categories c ON c.category_id=i.category_id WHERE c.category_code IN ('UNLAWFUL_ENTRY_DWELLING','UNLAWFUL_ENTRY_SHOP','UNLAWFUL_ENTRY_OTHER','ARSON','OTHER_PROPERTY_DAMAGE','UNLAWFUL_USE_MOTOR_VEHICLE','OTHER_THEFT','FRAUD','HANDLING_STOLEN_GOODS');
  SELECT COUNT(*) INTO v_other FROM crime_incidents WHERE incident_id NOT IN (SELECT i.incident_id FROM crime_incidents i JOIN incident_categories c ON c.category_id=i.category_id WHERE c.category_code IN ('MURDER','OTHER_HOMICIDE','GRIEVOUS_ASSAULT','SERIOUS_ASSAULT','SERIOUS_ASSAULT_NO_INJURY','COMMON_ASSAULT','RAPE_ATTEMPTED_RAPE','OTHER_SEXUAL_OFFENCES','ARMED_ROBBERY','UNARMED_ROBBERY','KIDNAPPING_ABDUCTION','EXTORTION','STALKING','LIFE_ENDANGERING_ACTS','COERCIVE_CONTROL','UNLAWFUL_ENTRY_DWELLING','UNLAWFUL_ENTRY_SHOP','UNLAWFUL_ENTRY_OTHER','ARSON','OTHER_PROPERTY_DAMAGE','UNLAWFUL_USE_MOTOR_VEHICLE','OTHER_THEFT','FRAUD','HANDLING_STOLEN_GOODS'));
  IF v_total<>42317 OR v_may+v_jun<>42317 OR v_person<>5700 OR v_property<>18200 OR v_other<>18417 THEN RAISE_APPLICATION_ERROR(-20022,'Brisbane profile validation failed.'); END IF;
END;
/
COMMIT;
"""
    OUTPUT.write_text(sql)
    print(OUTPUT)

if __name__ == '__main__': main()
