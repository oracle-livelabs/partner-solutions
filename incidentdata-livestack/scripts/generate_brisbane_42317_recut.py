#!/usr/bin/env python3
"""Generate the reviewable Brisbane May--June 2026 synthetic data re-cut.

The export is deterministic, contains no real incident or address data, and is
intended for validation before the separate, explicitly destructive loader is run.
"""
import argparse
import json
import random
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

TOTAL, SEED = 42317, 20260901
AEST = timezone(timedelta(hours=10))
PROFILE = "brisbane-metro-may-jun-2026-recut"

# Exact allocation: person 22.7%, property 68.1%, other 9.3%. These are
# synthetic teaching allocations calibrated only at aggregate-category level.
CATEGORIES = [
    ("HOMICIDE_RELATED", "Homicide and related offences", "person", 70, "high"),
    ("SERIOUS_ASSAULT", "Serious assault", "person", 950, "high"),
    ("COMMON_ASSAULT", "Common assault", "person", 4200, "high"),
    ("ASSAULT_OFFICER", "Assault of a prescribed officer", "person", 180, "high"),
    ("SEXUAL_OFFENCES", "Sexual offences", "person", 1100, "high"),
    ("HARASSMENT_THREATS", "Harassment and threatening behaviour", "person", 1300, "medium"),
    ("ABDUCTION_LIBERTY", "Abduction and deprivation of liberty", "person", 120, "high"),
    ("ROBBERY_EXTORTION", "Robbery and related offences", "person", 680, "high"),
    ("COERCIVE_CONTROL", "Coercive control context", "person", 1000, "high"),
    ("BURGLARY_RESIDENTIAL", "Unlawful entry — residence", "property", 3800, "medium"),
    ("BURGLARY_COMMERCIAL", "Unlawful entry — non-residence", "property", 2200, "medium"),
    ("MOTOR_VEHICLE_THEFT", "Unlawful use of a motor vehicle", "property", 2600, "medium"),
    ("THEFT_PERSON", "Theft from a person", "property", 1200, "medium"),
    ("THEFT_RETAIL", "Theft from retail premises", "property", 5600, "medium"),
    ("OTHER_THEFT", "Other theft", "property", 5600, "medium"),
    ("FRAUD_DECEPTION", "Fraud and deception", "property", 2800, "medium"),
    ("PROPERTY_DAMAGE", "Other property damage", "property", 4800, "medium"),
    ("ARSON_FIRE_DAMAGE", "Arson and fire damage", "property", 120, "high"),
    ("GRAFFITI", "Graffiti", "property", 80, "low"),
    ("ILLICIT_DRUGS", "Illicit drug offences", "other", 1950, "medium"),
    ("WEAPONS_EXPLOSIVES", "Weapons and explosives offences", "other", 180, "high"),
    ("PUBLIC_ORDER", "Public order offences", "other", 1100, "medium"),
    ("BREACH_DVO", "Breach of domestic violence order", "other", 450, "high"),
    ("TRESPASSING_VAGRANCY", "Trespassing and vagrancy", "other", 237, "low"),
]
assert sum(row[3] for row in CATEGORIES) == TOTAL

# Coarse, inland teaching anchors. They are not addresses, venues, or incident points.
ANCHORS = [
    ("BRIS_CENTRAL", "Brisbane CBD", -27.4698, 153.0251, 22, "inner-city mixed-use setting"),
    ("BRIS_CENTRAL", "Fortitude Valley", -27.4571, 153.0340, 18, "entertainment precinct"),
    ("BRIS_CENTRAL", "South Brisbane", -27.4774, 153.0185, 15, "inner-city mixed-use setting"),
    ("BRIS_CENTRAL", "West End", -27.4807, 153.0097, 12, "mixed residential setting"),
    ("BRIS_CENTRAL", "Spring Hill", -27.4614, 153.0242, 8, "mixed-use setting"),
    ("BRIS_CENTRAL", "New Farm", -27.4674, 153.0461, 8, "residential setting"),
    ("BRIS_CENTRAL", "Woolloongabba", -27.4887, 153.0362, 8, "transport-adjacent setting"),
    ("BRIS_CENTRAL", "Kangaroo Point", -27.4755, 153.0327, 7, "mixed-use setting"),
    ("BRIS_NORTH", "Chermside", -27.3847, 153.0313, 10, "retail precinct"),
    ("BRIS_NORTH", "Nundah", -27.4026, 153.0580, 6, "transport-adjacent setting"),
    ("BRIS_NORTH", "Caboolture", -27.0842, 152.9516, 7, "outer-centre setting"),
    ("BRIS_NORTH", "North Lakes", -27.2412, 153.0201, 6, "retail precinct"),
    ("BRIS_NORTH", "Aspley", -27.3678, 153.0178, 5, "residential setting"),
    ("BRIS_NORTH", "Strathpine", -27.3047, 152.9896, 5, "transport-adjacent setting"),
    ("BRIS_SOUTH", "Upper Mount Gravatt", -27.5628, 153.0827, 10, "retail precinct"),
    ("BRIS_SOUTH", "Mount Gravatt", -27.5392, 153.0743, 6, "mixed residential setting"),
    ("BRIS_SOUTH", "Sunnybank", -27.5784, 153.0625, 7, "retail precinct"),
    ("BRIS_SOUTH", "Logan Central", -27.6439, 153.1076, 8, "transport-adjacent setting"),
    ("BRIS_SOUTH", "Woodridge", -27.6344, 153.1113, 7, "mixed residential setting"),
    ("BRIS_SOUTH", "Beenleigh", -27.7171, 153.2025, 6, "outer-centre setting"),
    ("BRIS_SOUTH", "Springwood", -27.6117, 153.1282, 6, "mixed-use setting"),
    ("BRIS_WEST", "Indooroopilly", -27.4975, 152.9747, 8, "retail precinct"),
    ("BRIS_WEST", "Toowong", -27.4851, 152.9900, 6, "mixed-use setting"),
    ("BRIS_WEST", "Ipswich", -27.6150, 152.7600, 8, "outer-centre setting"),
    ("BRIS_WEST", "Goodna", -27.6104, 152.8995, 7, "mixed residential setting"),
    ("BRIS_WEST", "Inala", -27.5955, 152.9742, 7, "residential setting"),
    ("BRIS_WEST", "Oxley", -27.5485, 152.9824, 5, "residential setting"),
    ("BRIS_OUTER", "Capalaba", -27.5238, 153.2011, 4, "outer-centre setting"),
    ("BRIS_OUTER", "Cleveland", -27.5266, 153.2642, 3, "outer-centre setting"),
    ("BRIS_OUTER", "Redland Bay", -27.6100, 153.3020, 2, "residential setting"),
    ("BRIS_OUTER", "Samford Valley", -27.3727, 152.8860, 2, "outer residential setting"),
    ("BRIS_OUTER", "Jimboomba", -27.8310, 153.0270, 2, "growth-area setting"),
]

SETTINGS = {
    "person": ["residential setting", "public setting", "transport-adjacent setting", "entertainment setting"],
    "property": ["residential setting", "retail setting", "commercial setting", "vehicle-related setting", "street setting"],
    "other": ["public setting", "transport-adjacent setting", "open-space setting", "street setting"],
}
OPENERS = ["A synthetic report was received concerning", "A non-identifying record was created for", "A generated observation was logged in relation to", "A training-data entry noted", "A fictional demonstration report described"]
DETAILS = ["A broad, non-identifying observation was retained for controlled search and mapping demonstrations.", "The entry records only category, approximate setting, and time-band context for teaching use.", "No real address, person, or event detail is represented in this synthetic record.", "The fictional circumstances are retained as a governed data-quality and relationship example.", "This record is suitable for descriptive exploration only and does not support an operational conclusion."]

def choose(items, rng): return rng.choices(items, weights=[item[4] for item in items], k=1)[0]

def occurred_at(code, rng):
    start = datetime(2026, 5, 1, tzinfo=AEST)
    # Weekend/evening weighting is deliberately category-level, not predictive.
    night_weighted = code in {"COMMON_ASSAULT", "SERIOUS_ASSAULT", "THEFT_PERSON", "THEFT_RETAIL", "PUBLIC_ORDER", "ILLICIT_DRUGS", "ROBBERY_EXTORTION"}
    while True:
        day = start + timedelta(days=rng.randrange(61))
        if not night_weighted or rng.random() < (0.64 if day.weekday() >= 4 else 0.44): break
    hour = int(max(0, min(23, rng.gauss(21 if night_weighted else 13, 3.1))))
    return day.replace(hour=hour, minute=rng.randrange(60), second=rng.randrange(60))

def point(anchor, serial, rng):
    # 18x18 privacy grid, 0.0015 degrees per cell; each anchor remains below
    # the 120-record per-cell validation threshold at this profile volume.
    row, col = divmod(serial % 324, 18)
    return (round(anchor[2] + (row - 8.5) * .0015 + rng.uniform(-.00045, .00045), 6),
            round(anchor[3] + (col - 8.5) * .0015 + rng.uniform(-.00045, .00045), 6))

def narrative(category, anchor, setting, occurred, variant, fdv):
    code, name, _, _, _ = category
    time_band = "late evening" if occurred.hour >= 21 or occurred.hour < 5 else "evening" if occurred.hour >= 17 else "daytime"
    title_parts = [name, setting.replace(" setting", ""), anchor[1], occurred.strftime("%d %b")]
    title = " · ".join(title_parts) + f" · record {variant:05d}"
    fdv_note = " A family-and-domestic-violence context flag is present for controlled, synthetic teaching use." if fdv else ""
    text = (f"{OPENERS[variant % len(OPENERS)]} {name.lower()} context in a broad {setting} in {anchor[1]} during the {time_band} of {occurred.strftime('%A %d %B %Y')}. "
            f"{DETAILS[(variant // len(OPENERS) + len(code)) % len(DETAILS)]}{fdv_note}")
    return title, text

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="generated/brisbane_42317_may_jun_2026_recut.json")
    args = parser.parse_args()
    rng, rows, anchor_serial = random.Random(SEED), [], Counter()
    for category in CATEGORIES:
        code, name, group, count, severity = category
        for _ in range(count):
            anchor = choose(ANCHORS, rng)
            anchor_serial[anchor[1]] += 1
            lat, lon = point(anchor, anchor_serial[anchor[1]], rng)
            occurred = occurred_at(code, rng)
            fdv = group == "person" and code not in {"HOMICIDE_RELATED", "ASSAULT_OFFICER"} and rng.random() < .28
            setting = rng.choice(SETTINGS[group])
            variant = len(rows) + 1
            title, text = narrative(category, anchor, setting, occurred, variant, fdv)
            rows.append({"incident_ref": f"BCI-2026-{variant:06d}", "category_code": code, "crime_category": name, "offence_group": group, "severity_band": severity, "patrol_area_code": anchor[0], "suburb": anchor[1], "latitude": lat, "longitude": lon, "occurred_at": occurred.isoformat(), "location_type": setting, "address_line_1": f"Synthetic vicinity — {anchor[1]}", "address_locality": anchor[1], "address_region": "Greater Brisbane, Queensland", "address_precision": "approximate suburb-level training point", "report_summary": title, "report_text": text, "incident_attributes": {"synthetic_record": True, "city_profile": PROFILE, "report_month": occurred.strftime("%Y-%m"), "qps_aligned_category": code, "location_context": setting, "property_context": setting, "family_domestic_violence_related": fdv, "narrative_variant": variant, "spatial_precision": "approximate suburb-level training point", "grid_cell_degrees": .0015, "seed": SEED}})
    rng.shuffle(rows)
    for index, row in enumerate(rows, 1): row["incident_ref"] = f"BCI-2026-{index:06d}"
    output = Path(args.output); output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"output": str(output), "records": len(rows), "offenceGroups": dict(Counter(row["offence_group"] for row in rows)), "seed": SEED}, indent=2))

if __name__ == "__main__": main()
