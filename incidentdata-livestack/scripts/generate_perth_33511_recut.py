#!/usr/bin/env python3
"""Create the Perth May--June 2026 synthetic teaching-data re-cut.

This creates a reviewable JSON export only.  It deliberately has no database
credentials and never calls a geocoding service: all places are coarse,
fictionalised suburb anchors and all coordinates are privacy-grid points.
"""
import argparse, json, random
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

TOTAL = 33511
SEED = 20260501
AWST = timezone(timedelta(hours=8))
PROFILE = "perth-metro-may-jun-2026-recut"

# Approximate, city-owned teaching anchors.  They are not addresses or event locations.
ANCHORS = [
 ("PERTH_CENTRAL","Perth CBD",-31.953,115.861,18,"entertainment precinct"),("PERTH_CENTRAL","Northbridge",-31.947,115.857,16,"entertainment precinct"),("PERTH_CENTRAL","East Perth",-31.958,115.878,6,"transport precinct"),("PERTH_CENTRAL","West Perth",-31.948,115.843,5,"commercial precinct"),("PERTH_CENTRAL","Leederville",-31.936,115.841,6,"mixed-use precinct"),("PERTH_CENTRAL","Subiaco",-31.948,115.823,5,"retail precinct"),("PERTH_CENTRAL","Mount Lawley",-31.934,115.872,5,"mixed-use precinct"),("PERTH_CENTRAL","Victoria Park",-31.976,115.902,5,"retail precinct"),("PERTH_CENTRAL","South Perth",-31.982,115.854,4,"residential precinct"),("PERTH_CENTRAL","Bayswater",-31.920,115.915,4,"transport precinct"),("PERTH_CENTRAL","Maylands",-31.930,115.894,4,"residential precinct"),("PERTH_CENTRAL","Belmont",-31.956,115.944,6,"transport precinct"),("PERTH_CENTRAL","Cannington",-32.016,115.934,9,"retail precinct"),("PERTH_CENTRAL","Morley",-31.897,115.907,7,"retail precinct"),("PERTH_CENTRAL","Midland",-31.889,116.011,7,"transport precinct"),("PERTH_CENTRAL","Fremantle",-32.056,115.765,9,"entertainment precinct"),("PERTH_CENTRAL","Scarborough",-31.895,115.775,7,"entertainment precinct"),("PERTH_CENTRAL","Cockburn Central",-32.121,115.847,6,"transport precinct"),
 ("PERTH_NORTH","Joondalup",-31.744,115.766,8,"retail precinct"),("PERTH_NORTH","Hillarys",-31.807,115.758,5,"coastal activity precinct"),("PERTH_NORTH","Whitfords",-31.798,115.770,4,"retail precinct"),("PERTH_NORTH","Wanneroo",-31.750,115.805,4,"residential precinct"),("PERTH_NORTH","Ellenbrook",-31.781,115.971,5,"growth-area precinct"),("PERTH_NORTH","Mirrabooka",-31.860,115.862,5,"retail precinct"),("PERTH_NORTH","Balga",-31.855,115.838,4,"residential precinct"),("PERTH_NORTH","Karrinyup",-31.875,115.795,4,"retail precinct"),("PERTH_NORTH","Innaloo",-31.890,115.795,4,"retail precinct"),("PERTH_NORTH","Bassendean",-31.905,115.950,3,"residential precinct"),
 ("PERTH_SOUTH","Armadale",-32.153,116.016,7,"transport precinct"),("PERTH_SOUTH","Rockingham",-32.276,115.750,7,"retail precinct"),("PERTH_SOUTH","Byford",-32.221,116.009,4,"growth-area precinct"),("PERTH_SOUTH","Mandurah",-32.536,115.760,4,"coastal activity precinct"),("PERTH_SOUTH","Canning Vale",-32.057,115.922,5,"residential precinct"),("PERTH_SOUTH","Willetton",-32.052,115.888,4,"residential precinct"),("PERTH_SOUTH","Kwinana",-32.241,115.813,4,"industrial precinct"),("PERTH_SOUTH","Gosnells",-32.082,116.001,5,"retail precinct"),("PERTH_SOUTH","Thornlie",-32.060,115.956,4,"residential precinct"),("PERTH_SOUTH","Kalamunda",-31.974,116.058,3,"residential precinct")]

# Exact totals: person 22.2%, property 67.1%, other 10.7%.
CATEGORIES = [
 ("HOMICIDE_RELATED","Homicide and related offences","person",70,"high"),("SERIOUS_ASSAULT","Serious assault","person",850,"high"),("COMMON_ASSAULT","Common assault","person",3629,"high"),("ASSAULT_OFFICER","Assault of prescribed officer","person",180,"high"),("SEXUAL_OFFENCES","Sexual offences","person",900,"high"),("HARASSMENT_THREATS","Harassment and threatening behaviour","person",1150,"medium"),("ABDUCTION_LIBERTY","Abduction and deprivation of liberty","person",120,"high"),("ROBBERY_EXTORTION","Robbery and related offences","person",480,"high"),
 ("BURGLARY_RESIDENTIAL","Burglary residence","property",3800,"medium"),("BURGLARY_COMMERCIAL","Burglary non-residence","property",2400,"medium"),("MOTOR_VEHICLE_THEFT","Motor vehicle theft","property",1800,"medium"),("THEFT_PERSON","Theft from person","property",1200,"medium"),("THEFT_RETAIL","Theft from retail premises","property",4800,"medium"),("OTHER_THEFT","Other theft","property",4200,"medium"),("FRAUD_DECEPTION","Fraud and deception","property",1500,"medium"),("PROPERTY_DAMAGE","Damage or destroy property","property",2500,"medium"),("ARSON_FIRE_DAMAGE","Arson and fire damage","property",110,"high"),("GRAFFITI","Graffiti","property",180,"low"),
 ("ILLICIT_DRUGS","Illicit drug offences","other",1900,"medium"),("WEAPONS_EXPLOSIVES","Weapons and explosives offences","other",260,"high"),("PUBLIC_ORDER","Public order offences","other",972,"medium"),("VRO_BREACH","Breach of violence restraint order","other",510,"high")]
assert sum(x[3] for x in CATEGORIES) == TOTAL

SETTINGS = {"person":["residential setting","public setting","transport setting"],"property":["residential setting","retail setting","commercial setting","vehicle-related setting"],"other":["public setting","transport setting","open-space setting"]}
OPENERS = ["A synthetic report was received concerning", "A synthetic record was created for", "A synthetic observation was logged in relation to", "A synthetic report noted"]
DETAILS = ["A non-identifying account was retained for teaching-data review.", "The record contains only broad contextual detail and no personal identifiers.", "The entry was marked for routine synthetic-data handling.", "The reported circumstances are fictional and retained for demonstration queries."]

def weighted(items, rng): return rng.choices(items, weights=[x[4] for x in items], k=1)[0]
def timestamp(category, number, rng):
    start = datetime(2026,5,1,tzinfo=AWST); day = start + timedelta(days=rng.randrange(61))
    weekend = day.weekday() >= 4
    night = category in {"COMMON_ASSAULT","SERIOUS_ASSAULT","THEFT_PERSON","THEFT_RETAIL","PUBLIC_ORDER","ILLICIT_DRUGS","ROBBERY_EXTORTION"}
    hour = int(max(0,min(23, rng.gauss(21 if night and weekend else 18 if night else 13, 3.2))))
    return day.replace(hour=hour, minute=rng.randrange(60), second=rng.randrange(60))
def point(anchor, serial, rng):
    # Compact 0.0015-degree privacy grid, 16x16 cells per inland anchor.
    cell = serial % 256; row, col = divmod(cell,16)
    return round(anchor[2]+(row-7.5)*.0015+rng.uniform(-.00055,.00055),6), round(anchor[3]+(col-7.5)*.0015+rng.uniform(-.00055,.00055),6)
def narrative(cat, suburb, setting, occurred, variant, fdv):
    time_band = "evening" if occurred.hour >= 18 or occurred.hour < 5 else "daytime"
    fdv_phrase = " The synthetic record carries a family-and-domestic-violence context flag for scoped teaching use." if fdv else ""
    title = f"{cat[1]} — {setting} context in {suburb} (record {variant:05d})"
    text = f"{OPENERS[variant%len(OPENERS)]} a {cat[1].lower()} matter in a broad {setting} in {suburb} during the {time_band} of {occurred.strftime('%d %B %Y')}. {DETAILS[(variant//len(OPENERS))%len(DETAILS)]}{fdv_phrase}"
    return title, text
def main():
    p=argparse.ArgumentParser(); p.add_argument("--output", default="generated/perth_33511_may_jun_2026_recut.json"); args=p.parse_args()
    rng=random.Random(SEED); rows=[]; anchor_serial=Counter()
    for code,name,group,count,severity in CATEGORIES:
        cat=(code,name,group,count,severity)
        candidates=[a for a in ANCHORS if (group != "person" or a[0] != "PERTH_NORTH" or rng.random()>.08)]
        for n in range(count):
            anchor=weighted(candidates,rng); anchor_serial[anchor[1]]+=1; lat,lon=point(anchor,anchor_serial[anchor[1]],rng)
            occurred=timestamp(code,n,rng); fdv=group=="person" and code not in {"HOMICIDE_RELATED","ASSAULT_OFFICER"} and rng.random()<.34
            setting=rng.choice(SETTINGS[group]); variant=len(rows)+1; title,text=narrative(cat,anchor[1],setting,occurred,variant,fdv)
            rows.append({"incident_ref":f"PCI-2026-{len(rows)+1:06d}","category_code":code,"crime_category":name,"offence_group":group,"severity_band":severity,"patrol_area_code":anchor[0],"suburb":anchor[1],"latitude":lat,"longitude":lon,"occurred_at":occurred.isoformat(),"location_type":setting,"address_line_1":f"Synthetic vicinity — {anchor[1]}","address_locality":anchor[1],"address_region":"Greater Perth, Western Australia","address_precision":"approximate suburb-level training point","report_summary":title,"report_text":text,"incident_attributes":{"synthetic_record":True,"city_profile":PROFILE,"report_month":occurred.strftime("%Y-%m"),"wapol_aligned_category":code,"location_context":setting,"property_context":setting,"family_domestic_violence_related":fdv,"narrative_variant":variant,"spatial_precision":"approximate suburb-level training point","grid_cell_degrees":0.0015}})
    rng.shuffle(rows)
    # Preserve stable references after random allocation while keeping generated distribution.
    for i,row in enumerate(rows,1): row["incident_ref"]=f"PCI-2026-{i:06d}"
    out=Path(args.output); out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(rows,ensure_ascii=False),encoding="utf-8")
    print(json.dumps({"output":str(out),"records":len(rows),"categories":dict(Counter(r["category_code"] for r in rows)),"seed":SEED},indent=2))
if __name__ == "__main__": main()
