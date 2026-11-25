#!/usr/bin/env python3
"""Create the Oracle SQL loader for the generated Adelaide synthetic CSVs."""
import csv
import json
from pathlib import Path

ROOT = Path("/home/opc")
SOURCE = ROOT / "synthetic_adelaide_crime_may_jun_2026_v5"
DEST = Path(__file__).resolve().parents[1] / "db/demo/15_load_adelaide_synthetic_21513_v5.sql"

REGION = {
    "Adelaide":"CENTRAL","North Adelaide":"CENTRAL","Hindmarsh":"CENTRAL","Thebarton":"CENTRAL","Kent Town":"CENTRAL","Norwood":"CENTRAL","Unley":"CENTRAL","Goodwood":"CENTRAL","Prospect":"CENTRAL","Walkerville":"CENTRAL",
    "Salisbury":"NORTH","Elizabeth":"NORTH","Tea Tree Gully":"NORTH","Modbury":"NORTH","Golden Grove":"NORTH","Mawson Lakes":"NORTH","Para Hills":"NORTH","Port Adelaide":"NORTH","Semaphore":"NORTH","West Lakes":"NORTH",
    "Burnside":"SOUTH","Glenelg":"SOUTH","Marion":"SOUTH","Oaklands Park":"SOUTH","Morphett Vale":"SOUTH","Noarlunga Centre":"SOUTH","Hallett Cove":"SOUTH","Campbelltown":"SOUTH","Newton":"SOUTH","Blackwood":"SOUTH",
    "Kilburn":"NORTH","Enfield":"NORTH","Pooraka":"NORTH","Findon":"CENTRAL","Seaton":"CENTRAL","Plympton":"SOUTH","Edwardstown":"SOUTH","Seacombe Gardens":"SOUTH","Reynella":"SOUTH","Lonsdale":"SOUTH","Paradise":"SOUTH","Modbury North":"NORTH",
}

def q(value):
    return "'" + str(value).replace("'", "''") + "'"

def severity(row):
    if row["offence_category_broad"] == "Person" or "Trespass" in row["offence_level_1"]:
        return "high"
    return "medium" if row["offence_category_broad"] == "Property" else "low"

def main():
    categories = list(csv.DictReader((SOURCE / "INCIDENT_CATEGORIES.csv").open(encoding="utf-8")))
    incidents = list(csv.DictReader((SOURCE / "CRIME_INCIDENTS.csv").open(encoding="utf-8")))
    reports = list(csv.DictReader((SOURCE / "INCIDENT_REPORTS.csv").open(encoding="utf-8")))
    evidence = list(csv.DictReader((SOURCE / "EVIDENCE_ITEMS.csv").open(encoding="utf-8")))
    assert len(incidents) == len(reports) == 21513
    lines = [
        "/* Generated loader: Adelaide synthetic profile v5, exactly 21,513 incidents. */",
        "SET DEFINE OFF", "SET FEEDBACK OFF", "SET HEADING OFF", "WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK", "",
        "DECLARE v_count NUMBER; v_active VARCHAR2(40); BEGIN",
        " SELECT p.profile_code INTO v_active FROM z_base_active_dataset_profile a JOIN z_base_dataset_profiles p ON p.dataset_profile_id=a.dataset_profile_id WHERE a.control_id=1;",
        " IF v_active <> 'ADELAIDE_DATA' THEN RAISE_APPLICATION_ERROR(-20030,'The active profile is not Adelaide; load cancelled.'); END IF;",
        " SELECT COUNT(*) INTO v_count FROM patrol_areas WHERE area_code IN ('CENTRAL','NORTH','SOUTH');",
        " IF v_count <> 3 THEN RAISE_APPLICATION_ERROR(-20033,'Required CENTRAL, NORTH and SOUTH patrol areas are missing.'); END IF;",
        "END;", "/",
        "DELETE FROM semantic_matches;",
        "DELETE FROM evidence_items;",
        "DELETE FROM case_incident_links;",
        "DELETE FROM person_incident_links;",
        "DELETE FROM incident_report_embeddings;",
        "DELETE FROM person_profile_embeddings;",
        "DELETE FROM incident_reports;",
        "DELETE FROM case_files;",
        "DELETE FROM persons_of_interest;",
        "DELETE FROM crime_incidents;",
        "DELETE FROM analyst_actions;",
        "DELETE FROM incident_categories;",
    ]
    for c in categories:
        code = c["category_code"]
        name = c["category_name"]
        lines.append(
            "INSERT INTO incident_categories(category_code,category_name,category_description,severity_band,locality_code,executive_group_code,executive_group_label,person_property_class,synthetic_profile_code,display_order,display_color,active) "
            f"VALUES ({q(code)},{q(name)},{q(c['category_description'])},{q(c['severity_band'])},{q(c['locality_code'])},{q(c['executive_group_code'])},{q(c['executive_group_label'])},{q(c['person_property_class'])},{q(c['synthetic_profile_code'])},{c['display_order']},{q(c['display_color'])},1);"
        )
    for r in incidents:
        code = "ADL" + r["category_id"].split("-")[1]
        area = REGION[r["suburb_or_locality"]]
        attributes = (f"JSON_OBJECT('synthetic_record' VALUE true,'synthetic_profile_code' VALUE {q(r['city_profile'])},"
                      f"'generator_version' VALUE {q(r['generator_version'])},'generator_seed' VALUE {r['generator_seed']},"
                      f"'offence_category_broad' VALUE {q(r['offence_category_broad'])},'offence_level_1' VALUE {q(r['offence_level_1'])},"
                      f"'offence_level_2' VALUE {q(r['offence_level_2'])},'executive_group_code' VALUE {q(r['executive_group_code'])},"
                      f"'executive_group_label' VALUE {q(r['executive_group_label'])},'family_domestic_abuse_related' VALUE {r['family_domestic_abuse_related']},"
                      "'spatial_precision' VALUE 'approximate suburb-level synthetic point')")
        lines.append(
            "INSERT INTO crime_incidents(incident_ref,category_id,patrol_area_id,incident_status,occurred_at,location_type,suburb,latitude,longitude,address_locality,address_region,address_postcode,address_precision,modus_operandi,property_category,incident_attributes) "
            f"SELECT {q(r['incident_id'])},c.category_id,p.patrol_area_id,{q(r['incident_status'])},TO_TIMESTAMP_TZ({q(r['datetime'])},'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'),{q(r['location_type'])},{q(r['suburb_or_locality'])},{r['latitude']},{r['longitude']},{q(r['suburb_or_locality'])},'South Australia',{q(r['postcode'])},'approximate_suburb',{q(r['modus_operandi'])},{q(r['location_type'])},{attributes} FROM incident_categories c CROSS JOIN patrol_areas p WHERE c.category_code={q(code)} AND p.area_code={q(area)};"
        )
    for r in reports:
        context = json.loads(r["report_context_json"])
        enrichments = (
            f"JSON_OBJECT('synthetic_record' VALUE true,'locality_code' VALUE {q(context['locality_code'])},"
            f"'report_month' VALUE {q(context['report_month'])},'sapol_category' VALUE {q(context['sapol_category'])},"
            f"'detailed_category' VALUE {q(context['detailed_category'])},'executive_group_code' VALUE {q(context['executive_group_code'])},"
            f"'executive_group_label' VALUE {q(context['executive_group_label'])},'location_context' VALUE {q(context['location_context'])},"
            f"'property_context' VALUE {q(context['property_context'])},'modus_operandi' VALUE {q(context['modus_operandi'])},'narrative_variant' VALUE {context['narrative_variant']},"
            f"'family_domestic_abuse_related' VALUE {str(context['family_domestic_abuse_related']).lower()},"
            f"'spatial_precision' VALUE {q(context['spatial_precision'])})"
        )
        lines.append(f"INSERT INTO incident_reports(incident_id,report_summary,report_text,embedding_text,enrichments) SELECT incident_id,{q(r['report_summary'])},{q(r['report_text'])},{q(r['report_text'])},{enrichments} FROM crime_incidents WHERE incident_ref={q(r['incident_id'])};")
    for r in evidence:
        lines.append(f"INSERT INTO evidence_items(incident_id,evidence_type,evidence_metadata) SELECT incident_id,{q(r['evidence_type'])},JSON_OBJECT('synthetic_record' VALUE true,'synthetic_profile_code' VALUE {q(r['synthetic_profile_code'])},'summary' VALUE {q(r['evidence_summary'])}) FROM crime_incidents WHERE incident_ref={q(r['incident_id'])};")
    lines += [
        "DECLARE v_incidents NUMBER; v_reports NUMBER; v_evidence NUMBER; v_bad NUMBER; v_days NUMBER; BEGIN",
        " SELECT COUNT(*) INTO v_incidents FROM crime_incidents; SELECT COUNT(*) INTO v_reports FROM incident_reports; SELECT COUNT(*) INTO v_evidence FROM evidence_items;",
        " IF v_incidents<>21513 OR v_reports<>21513 OR v_evidence=0 THEN RAISE_APPLICATION_ERROR(-20032,'Adelaide v5 row-count validation failed.'); END IF;",
        " SELECT COUNT(DISTINCT TRUNC(occurred_at)) INTO v_days FROM crime_incidents; IF v_days<>61 THEN RAISE_APPLICATION_ERROR(-20034,'Adelaide v5 date-coverage validation failed.'); END IF;",
        " SELECT COUNT(*) INTO v_bad FROM crime_incidents WHERE occurred_at<TO_TIMESTAMP_TZ('2026-05-01T00:00:00+09:30','YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM') OR occurred_at>TO_TIMESTAMP_TZ('2026-06-30T23:59:59+09:30','YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM') OR latitude NOT BETWEEN -35.1 AND -34.6 OR longitude NOT BETWEEN 138.4 AND 138.8; IF v_bad<>0 THEN RAISE_APPLICATION_ERROR(-20035,'Adelaide v5 time or coordinate validation failed.'); END IF;",
        " SELECT COUNT(*) INTO v_bad FROM incident_reports WHERE LENGTH(report_summary) NOT BETWEEN 45 AND 110 OR LENGTH(report_text) NOT BETWEEN 180 AND 450 OR REGEXP_LIKE(report_summary,'ACI-[0-9]{4}-[0-9]+|RPT-[0-9]{4}-[0-9]+','i') OR REGEXP_LIKE(report_summary||' '||DBMS_LOB.SUBSTR(report_text,4000,1),'synthetic|demonstration|non-identifying|available for search and comparison','i') OR INSTR(report_summary,UNISTR('\\FFFD'))>0 OR INSTR(report_text,UNISTR('\\FFFD'))>0; IF v_bad<>0 THEN RAISE_APPLICATION_ERROR(-20036,'Adelaide v5 narrative validation failed.'); END IF;",
        " SELECT COUNT(*) INTO v_bad FROM (SELECT report_summary FROM incident_reports GROUP BY report_summary HAVING COUNT(*)>1); IF v_bad<>0 THEN RAISE_APPLICATION_ERROR(-20037,'Adelaide v5 duplicate-title validation failed.'); END IF;",
        " SELECT COUNT(*) INTO v_bad FROM incident_categories WHERE locality_code<>'ADL_METRO' OR executive_group_code='UNMAPPED' OR synthetic_profile_code<>'adelaide-may-june-2026-v5'; IF v_bad<>0 THEN RAISE_APPLICATION_ERROR(-20038,'Adelaide v5 taxonomy validation failed.'); END IF;",
        "END;", "/",
        "BEGIN z_base_dataset_admin.capture_active_profile('ADELAIDE_DATA','Adelaide Data Set Profile','Adelaide Metropolitan Area','Adelaide May-June 2026 synthetic profile v5; natural report titles and narratives; generator 5.0.0 seed 20260828.'); END;", "/",
        "COMMIT;", "EXIT"
    ]
    DEST.write_text("\n".join(lines)+"\n", encoding="utf-8")
    print(DEST)

if __name__ == "__main__": main()
