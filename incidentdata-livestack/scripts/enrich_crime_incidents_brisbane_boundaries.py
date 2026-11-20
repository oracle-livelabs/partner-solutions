#!/usr/bin/env python3
"""Enrich synthetic Brisbane CRIME_INCIDENTS from local boundary polygons.

For each synthetic point, the script independently resolves its Queensland
locality and postcode boundary, then writes a deterministic *synthetic* street
label. It never calls an external geocoder or stores a real premise address.
The default is a dry run; use --apply only after reviewing the proposed rows.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import random
import sys

import oracledb

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PREP_DATA_DIRECTORY = PROJECT_ROOT / "prep_data"
sys.path.insert(0, str(PREP_DATA_DIRECTORY))

from lookup_brisbane_suburb_postcode import DEFAULT_CSV, load_boundaries, lookup  # noqa: E402


FAKE_STREET_NAMES = (
    "Kings Way", "Fredstone St", "Hurst Ave", "Ward St", "Potts Ave",
    "Proton Drive", "Ebert Rd", "Brewer Lane", "Cahill Court", "Coggins Way",
    "Glenhuntley Rd", "Montrose St", "Cedar Ave", "Connor Ave", "Athlone St",
    "Ledger Rd", "Beverley St", "Addison Rd", "Sprinter St", "Fraser St",
    "Esk St", "Angley Ave", "Jenkins St", "Swan St", "Brown St",
    "Bellridge Way", "Marlowe Street", "Wattleford Avenue", "Dunlea Road",
    "Kestrel Grove", "Rivermere Drive", "Oakvale Close", "Larkspur Lane",
    "Harbourview Terrace", "Whitcombe Street", "Pemberton Road", "Crestwood Circuit",
    "Merefield Avenue", "Briarstone Way", "Redgum Place", "Willowbank Road",
    "Ashbourne Crescent", "Kingfisher Drive", "Tallowwood Court", "Fairhaven Street",
    "Banksia Rise", "Coralwood Lane", "Driftwood Avenue", "Emberton Road",
    "Fernwick Close", "Greystone Parade", "Heathfield Way", "Ironbark Street",
    "Juniper Mews", "Limestone Drive", "Moonstone Place", "Northridge Circuit",
    "Orchard Bend", "Paperbark Terrace", "Quarry View", "Rosella Road",
    "Seabreeze Grove", "Tindale Avenue", "Umber Court", "Vale Street",
    "Warrin Way", "Xanthic Lane", "Yarrafield Road", "Zephyr Close",
    "Acacia Circuit", "Bracken Street", "Cypress Rise", "Daintree Place",
    "Eucalypt Drive", "Flinders Mews", "Gumleaf Parade", "Horizon Terrace",
    "Islington Road", "Jindalee Grove", "Karri Court", "Lorikeet Avenue",
)
ENRICHMENT_SOURCE = "BRISBANE_BOUNDARY_LOOKUP"


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Populate synthetic Brisbane street, locality, and postcode fields from local boundaries.")
    parser.add_argument("--limit", type=int, help="Optional cap for a review run; omit to process every eligible row.")
    parser.add_argument("--batch-size", type=int, default=1000, help="Oracle update batch size (default: 1,000).")
    parser.add_argument("--apply", action="store_true", help="Persist changes; default is a dry run.")
    parser.add_argument("--overwrite", action="store_true", help="Include rows already marked by an address enrichment source.")
    parser.add_argument("--nearest-fallback", action="store_true", help="For synthetic points outside or on ambiguous polygons, use the nearest locality and postcode boundary; records this source explicitly.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV, help="Greater Brisbane locality/postcode boundary CSV.")
    return parser.parse_args()


def database_settings() -> dict[str, str]:
    return {
        "user": os.getenv("ORACLE_USER", "ADELAIDE_CRIME"),
        "password": os.getenv("APP_SCHEMA_PASSWORD", "crime-demo-only"),
        "dsn": os.getenv("ORACLE_CONNECTION_STRING", "localhost:1533/FREEPDB1"),
    }


def select_rows(connection: oracledb.Connection, limit: int | None, overwrite: bool):
    unprocessed_only = "" if overwrite else "AND address_enrichment_source IS NULL"
    limit_clause = "" if limit is None else "WHERE ROWNUM <= :limit"
    cursor = connection.cursor()
    cursor.arraysize = 1000
    cursor.execute(f"""
        SELECT * FROM (
          SELECT incident_id, incident_ref, latitude, longitude
          FROM crime_incidents
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL {unprocessed_only}
          ORDER BY incident_id
        ) {limit_clause}
    """, {} if limit is None else {"limit": limit})
    try:
        columns = [column[0].lower() for column in cursor.description]
        for row in cursor:
            yield dict(zip(columns, row))
    finally:
        cursor.close()


def bbox_distance_squared(latitude: float, longitude: float, boundary: dict) -> float:
    """Squared degree distance from a point to a boundary's bounding rectangle."""
    dx = max(boundary["min_lon"] - longitude, 0.0, longitude - boundary["max_lon"])
    dy = max(boundary["min_lat"] - latitude, 0.0, latitude - boundary["max_lat"])
    return dx * dx + dy * dy


def nearest_boundary_match(latitude: float, longitude: float, boundaries: list[dict]) -> dict[str, str] | None:
    """Return nearest separate locality/postcode polygons for a coarse synthetic fallback."""
    localities = [row for row in boundaries if row["feature_type"] == "locality" and row["suburb"]]
    postcodes = [row for row in boundaries if row["feature_type"] == "postcode" and row["postcode"]]
    if not localities or not postcodes:
        return None
    locality = min(localities, key=lambda row: bbox_distance_squared(latitude, longitude, row))
    postcode = min(postcodes, key=lambda row: bbox_distance_squared(latitude, longitude, row))
    return {"suburb": locality["suburb"], "postcode": postcode["postcode"]}


def make_update(incident: dict, boundaries: list[dict], nearest_fallback: bool) -> dict | None:
    match = lookup(float(incident["latitude"]), float(incident["longitude"]), boundaries)
    # Queensland locality and postcode layers are separate. Do not overwrite a
    # row unless each has a single clear boundary match.
    exact = bool(match["suburb"] and match["postcode"] and ";" not in match["suburb"] and ";" not in match["postcode"])
    if not exact:
        if not nearest_fallback:
            return None
        match = nearest_boundary_match(float(incident["latitude"]), float(incident["longitude"]), boundaries)
        if match is None:
            return None
    rng = random.Random(int(incident["incident_id"]))
    return {
        "incident_id": incident["incident_id"],
        "address_line_1": f"{rng.randint(1, 200)} {rng.choice(FAKE_STREET_NAMES)}",
        "address_locality": match["suburb"],
        "address_region": "Brisbane Metropolitan Area, Queensland",
        "address_postcode": match["postcode"],
        "address_country_code": "AU",
        "address_precision": "masked_vicinity",
        "address_enrichment_source": ENRICHMENT_SOURCE if exact else ENRICHMENT_SOURCE + "_NEAREST",
        "suburb": match["suburb"],
    }


def write_rows(connection: oracledb.Connection, updates: list[dict]) -> None:
    with connection.cursor() as cursor:
        cursor.executemany("""
            UPDATE crime_incidents
            SET address_line_1 = :address_line_1,
                address_locality = :address_locality,
                address_region = :address_region,
                address_postcode = :address_postcode,
                address_country_code = :address_country_code,
                address_precision = :address_precision,
                address_enrichment_source = :address_enrichment_source,
                suburb = :suburb
            WHERE incident_id = :incident_id
        """, updates)
    connection.commit()


def main() -> int:
    args = arguments()
    if args.limit is not None and args.limit < 1:
        sys.exit("--limit must be a positive integer.")
    if args.batch_size < 1:
        sys.exit("--batch-size must be a positive integer.")
    if not args.csv.is_file():
        sys.exit(f"Boundary CSV not found: {args.csv}")

    boundaries = load_boundaries(args.csv)
    pending_updates: list[dict] = []
    matched = unmatched = 0
    with oracledb.connect(**database_settings()) as connection:
        for incident in select_rows(connection, args.limit, args.overwrite):
            update = make_update(incident, boundaries, args.nearest_fallback)
            if update is None:
                unmatched += 1
                print(f"{incident['incident_ref']}: no unambiguous Brisbane locality/postcode match", file=sys.stderr)
                continue
            matched += 1
            print(f"{incident['incident_ref']}: {update['address_line_1']}, {update['suburb']} {update['address_postcode']}")
            if args.apply:
                pending_updates.append(update)
                if len(pending_updates) >= args.batch_size:
                    write_rows(connection, pending_updates)
                    pending_updates.clear()
        if args.apply and pending_updates:
            write_rows(connection, pending_updates)

    print(f"{'Updated' if args.apply else 'Dry run; would update'} {matched} row(s); {unmatched} had no unambiguous Brisbane boundary match.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
