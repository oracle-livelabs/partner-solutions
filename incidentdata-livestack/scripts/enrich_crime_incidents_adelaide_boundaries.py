#!/usr/bin/env python3
"""Add privacy-preserving street labels and official postcodes to Adelaide data.

Suburb and postcode are resolved from the local SA Government boundary extract.
The street line is a deterministic synthetic label generated independently of
the coordinate; it is not a reverse-geocoded or real incident address.

The default is a read-only dry run. ``--apply`` writes all selected rows in one
transaction and rolls back unless every selected coordinate has an exact
boundary match and all post-update checks pass.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import math
import os
from pathlib import Path
import sys
from typing import Iterator

import oracledb


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PREP_DATA_DIRECTORY = PROJECT_ROOT / "prep_data"
sys.path.insert(0, str(PREP_DATA_DIRECTORY))

from lookup_adelaide_suburb_postcode import (  # noqa: E402
    DEFAULT_CSV,
    load_boundaries,
    lookup,
)


ACTIVE_PROFILE_CODE = "ADELAIDE_DATA"
INCIDENT_PROFILE_CODE = "adelaide-may-june-2026-v5"
EXPECTED_INCIDENT_COUNT = 21_513
ENRICHMENT_SOURCE = "ADELAIDE_BOUNDARY_SYNTH_STREET"
ADDRESS_PRECISION = "masked_vicinity"
ADDRESS_REGION = "South Australia"
ADDRESS_SEED = "adelaide-address-v1-20260825"

# Constructed labels for demonstration data, not a road gazetteer.
SYNTHETIC_STREET_ROOTS = (
    "Ambermere", "Banksiabrook", "Bellstone", "Bluegum Vale",
    "Brackenmere", "Cedarhaven", "Clayridge", "Cloverbank",
    "Copperleaf", "Coralfern", "Dapplewood", "Echovale",
    "Emberbrook", "Fairgum", "Fernbridge", "Finchmere",
    "Flaxwood", "Glenmallee", "Goldenwattle", "Greybox",
    "Gumstone", "Hazelbank", "Honeyfern", "Ironbark Vale",
    "Jacaranda View", "Juniperbank", "Kestrelwood", "Larkmere",
    "Lemonmyrtle", "Lorikeet Vale", "Mallee Ridge", "Marblefern",
    "Meadowgum", "Moonbank", "Nectarwood", "Olivebrook",
    "Orchidmere", "Paperbark View", "Pebblegum", "Pepperleaf",
    "Quailstone", "Redgum Vale", "Reedbank", "Riverfern",
    "Rosellawood", "Sagebrook", "Saltbush Vale", "Sandstone View",
    "Silvermallee", "Skylark Vale", "Sparrowmere", "Stringybark View",
    "Sunfern", "Tallowmere", "Thistlebank", "Wattlebrook",
    "Wattlefern", "Whispergum", "Wildflower Vale", "Willowmallee",
    "Windermere Gum", "Woodlark Vale", "Yellowgum", "Zephyrbank",
)
SYNTHETIC_STREET_TYPES = (
    "Avenue", "Circuit", "Close", "Court", "Crescent", "Drive",
    "Grove", "Lane", "Parade", "Place", "Terrace", "Way",
)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int,
        help="Optional dry-run cap. A limited run cannot be applied.",
    )
    parser.add_argument(
        "--batch-size", type=int, default=1000,
        help="Oracle executemany batch size (default: 1,000).",
    )
    parser.add_argument(
        "--sample-size", type=int, default=20,
        help="Number of proposed rows printed to the terminal (default: 20).",
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Persist the complete enrichment; the default is a dry run.",
    )
    parser.add_argument(
        "--overwrite", action="store_true",
        help="Rebuild rows previously marked by this Adelaide enrichment.",
    )
    parser.add_argument(
        "--repair-unmatched-land-points", action="store_true",
        help=(
            "For synthetic points just outside all locality polygons, move the "
            "coordinate to the nearest boundary-covered point within 2 km."
        ),
    )
    parser.add_argument(
        "--csv", type=Path, default=DEFAULT_CSV,
        help="Greater Adelaide suburb/postcode boundary CSV.",
    )
    parser.add_argument(
        "--review-csv", type=Path,
        help="Optional path for the complete proposed-row review CSV.",
    )
    parser.add_argument(
        "--prior-review-csv", type=Path,
        help=(
            "Optional earlier review CSV supplying the pre-enrichment suburb "
            "when reconciling report locality text after an existing apply."
        ),
    )
    return parser.parse_args()


def database_settings() -> dict[str, str]:
    return {
        "user": os.getenv("ORACLE_USER", "ADELAIDE_CRIME"),
        "password": os.getenv("APP_SCHEMA_PASSWORD", "crime-demo-only"),
        "dsn": os.getenv("ORACLE_CONNECTION_STRING", "localhost:1533/FREEPDB1"),
    }


def normalise_suburb(value: str) -> str:
    """Convert the official uppercase boundary label to display case."""
    display = value.strip().title()
    replacements = {
        "Mclaren": "McLaren",
        "Mcdonald": "McDonald",
        "O'halloran": "O'Halloran",
        "O'sullivan": "O'Sullivan",
    }
    for source, target in replacements.items():
        display = display.replace(source, target)
    return display


def synthetic_street_label(incident_ref: str) -> str:
    """Return a stable synthetic label unrelated to the supplied coordinate."""
    digest = hashlib.sha256(
        f"{ADDRESS_SEED}|{incident_ref}".encode("utf-8")
    ).digest()
    street_number = 1 + int.from_bytes(digest[0:2], "big") % 260
    root = SYNTHETIC_STREET_ROOTS[
        int.from_bytes(digest[2:4], "big") % len(SYNTHETIC_STREET_ROOTS)
    ]
    street_type = SYNTHETIC_STREET_TYPES[
        int.from_bytes(digest[4:6], "big") % len(SYNTHETIC_STREET_TYPES)
    ]
    return f"{street_number} {root} {street_type}"


def active_profile(connection: oracledb.Connection) -> dict[str, str]:
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT p.profile_code, p.city_label, NVL(p.profile_notes, '')
            FROM z_base_active_dataset_profile a
            JOIN z_base_dataset_profiles p
              ON p.dataset_profile_id = a.dataset_profile_id
            WHERE a.control_id = 1
        """)
        row = cursor.fetchone()
    if row is None:
        raise RuntimeError("No active Z_BASE dataset profile is registered.")
    return {"profile_code": row[0], "city_label": row[1], "profile_notes": row[2]}


def validate_profile(connection: oracledb.Connection) -> int:
    profile = active_profile(connection)
    if (
        profile["profile_code"] != ACTIVE_PROFILE_CODE
        or profile["city_label"].lower() != "adelaide"
    ):
        raise RuntimeError(
            "Refusing to enrich a non-Adelaide profile: "
            f"{profile['profile_code']} ({profile['city_label']})."
        )

    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM crime_incidents")
        total = int(cursor.fetchone()[0])
        cursor.execute("""
            SELECT COUNT(*)
            FROM crime_incidents
            WHERE JSON_VALUE(
                incident_attributes,
                '$.synthetic_profile_code' RETURNING VARCHAR2(80)
            ) = :profile_code
        """, profile_code=INCIDENT_PROFILE_CODE)
        matching_profile = int(cursor.fetchone()[0])

    if total != EXPECTED_INCIDENT_COUNT or matching_profile != total:
        raise RuntimeError(
            "Expected exactly "
            f"{EXPECTED_INCIDENT_COUNT:,} {INCIDENT_PROFILE_CODE} incidents; "
            f"found {total:,} total and {matching_profile:,} matching rows."
        )
    return total


def select_rows(
    connection: oracledb.Connection,
    limit: int | None,
    overwrite: bool,
) -> Iterator[dict]:
    source_filter = (
        "AND (address_enrichment_source IS NULL "
        "OR address_enrichment_source = :enrichment_source)"
        if overwrite
        else "AND address_enrichment_source IS NULL"
    )
    limit_clause = "" if limit is None else "WHERE ROWNUM <= :row_limit"
    binds: dict[str, object] = {"profile_code": INCIDENT_PROFILE_CODE}
    if overwrite:
        binds["enrichment_source"] = ENRICHMENT_SOURCE
    if limit is not None:
        binds["row_limit"] = limit

    cursor = connection.cursor()
    cursor.arraysize = 1000
    cursor.execute(f"""
        SELECT * FROM (
          SELECT incident_id, incident_ref, latitude, longitude,
                 suburb AS current_suburb,
                 address_postcode AS current_postcode
          FROM crime_incidents
          WHERE latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND JSON_VALUE(
                incident_attributes,
                '$.synthetic_profile_code' RETURNING VARCHAR2(80)
            ) = :profile_code
            {source_filter}
          ORDER BY incident_ref
        ) {limit_clause}
    """, binds)
    try:
        columns = [column[0].lower() for column in cursor.description]
        for row in cursor:
            yield dict(zip(columns, row))
    finally:
        cursor.close()


def distance_metres(
    latitude: float,
    longitude: float,
    candidate_latitude: float,
    candidate_longitude: float,
) -> float:
    """Return a sufficient local-distance estimate for the repair audit."""
    mean_latitude = math.radians((latitude + candidate_latitude) / 2)
    north = (candidate_latitude - latitude) * 111_320
    east = (candidate_longitude - longitude) * 111_320 * math.cos(mean_latitude)
    return math.hypot(north, east)


def nearest_boundary_point(
    latitude: float,
    longitude: float,
    boundaries: list[dict],
    step_degrees: float = 0.00025,
    maximum_distance_metres: float = 2000,
) -> tuple[float, float, list[dict], float] | None:
    """Find the nearest grid point covered by a locality boundary.

    This deterministic search is reserved for synthetic points that landed in
    a boundary gap or water. It never uses a road or premise-address source.
    """
    maximum_steps = math.ceil(maximum_distance_metres / (step_degrees * 90_000))
    for ring in range(1, maximum_steps + 1):
        candidates = []
        for latitude_step in range(-ring, ring + 1):
            for longitude_step in range(-ring, ring + 1):
                if max(abs(latitude_step), abs(longitude_step)) != ring:
                    continue
                candidate_latitude = round(
                    latitude + latitude_step * step_degrees, 6
                )
                candidate_longitude = round(
                    longitude + longitude_step * step_degrees, 6
                )
                distance = distance_metres(
                    latitude,
                    longitude,
                    candidate_latitude,
                    candidate_longitude,
                )
                if distance > maximum_distance_metres:
                    continue
                matches = lookup(
                    candidate_latitude, candidate_longitude, boundaries
                )
                if matches:
                    candidates.append((
                        distance,
                        candidate_latitude,
                        candidate_longitude,
                        matches,
                    ))
        if candidates:
            distance, candidate_latitude, candidate_longitude, matches = min(
                candidates,
                key=lambda item: (item[0], item[1], item[2]),
            )
            return (
                candidate_latitude,
                candidate_longitude,
                matches,
                distance,
            )
    return None


def make_update(
    incident: dict,
    boundaries: list[dict],
    repair_unmatched_land_points: bool = False,
) -> dict | None:
    original_latitude = float(incident["latitude"])
    original_longitude = float(incident["longitude"])
    target_latitude = original_latitude
    target_longitude = original_longitude
    matches = lookup(target_latitude, target_longitude, boundaries)
    adjustment_metres = 0.0
    if not matches and repair_unmatched_land_points:
        repaired = nearest_boundary_point(
            original_latitude, original_longitude, boundaries
        )
        if repaired:
            target_latitude, target_longitude, matches, adjustment_metres = repaired
    if not matches:
        return None

    match = sorted(
        matches,
        key=lambda item: (
            item["on_boundary"] == "true",
            item["suburb"],
            item["postcode"],
        ),
    )[0]
    suburb = normalise_suburb(match["suburb"])
    return {
        "incident_id": incident["incident_id"],
        "incident_ref": incident["incident_ref"],
        "original_latitude": incident["latitude"],
        "original_longitude": incident["longitude"],
        "latitude": target_latitude,
        "longitude": target_longitude,
        "coordinate_adjusted": "yes" if adjustment_metres else "no",
        "adjustment_metres": round(adjustment_metres, 1),
        "current_suburb": incident["current_suburb"],
        "current_postcode": incident["current_postcode"],
        "address_line_1": synthetic_street_label(incident["incident_ref"]),
        "address_locality": suburb,
        "address_region": ADDRESS_REGION,
        "address_postcode": str(match["postcode"]).zfill(4),
        "address_country_code": "AU",
        "address_precision": ADDRESS_PRECISION,
        "address_enrichment_source": ENRICHMENT_SOURCE,
        "suburb": suburb,
    }


def write_review_csv(path: Path, updates: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = (
        "incident_ref", "original_latitude", "original_longitude", "latitude",
        "longitude", "coordinate_adjusted", "adjustment_metres",
        "current_suburb", "current_postcode", "address_line_1", "address_locality",
        "address_region", "address_postcode", "address_precision",
        "address_enrichment_source", "report_locality_before",
    )
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(updates)


def load_prior_report_localities(path: Path | None) -> dict[str, str]:
    if path is None:
        return {}
    if not path.is_file():
        raise RuntimeError(f"Prior review CSV not found: {path}")
    with path.open(encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    localities = {
        row["incident_ref"]: row["current_suburb"]
        for row in rows
        if row.get("incident_ref") and row.get("current_suburb")
    }
    if len(localities) != EXPECTED_INCIDENT_COUNT:
        raise RuntimeError(
            f"Prior review must contain {EXPECTED_INCIDENT_COUNT:,} unique "
            f"incident references; found {len(localities):,}."
        )
    return localities


def apply_updates(
    connection: oracledb.Connection,
    updates: list[dict],
    batch_size: int,
    expected_total: int,
) -> None:
    write_fields = (
        "incident_id", "latitude", "longitude", "address_line_1",
        "address_locality", "address_region", "address_postcode",
        "address_country_code", "address_precision",
        "address_enrichment_source", "suburb",
    )
    update_sql = """
        UPDATE crime_incidents
        SET latitude = :latitude,
            longitude = :longitude,
            address_line_1 = :address_line_1,
            address_locality = :address_locality,
            address_region = :address_region,
            address_postcode = :address_postcode,
            address_country_code = :address_country_code,
            address_precision = :address_precision,
            address_enrichment_source = :address_enrichment_source,
            suburb = :suburb
        WHERE incident_id = :incident_id
    """
    written = 0
    report_updates = [
        {
            "incident_id": update["incident_id"],
            "old_locality": update["report_locality_before"],
            "new_locality": update["suburb"],
        }
        for update in updates
        if update["report_locality_before"] != update["suburb"]
    ]
    reports_written = 0
    try:
        with connection.cursor() as cursor:
            for start in range(0, len(updates), batch_size):
                batch = updates[start:start + batch_size]
                write_batch = [
                    {field: update[field] for field in write_fields}
                    for update in batch
                ]
                cursor.executemany(update_sql, write_batch)
                written += cursor.rowcount

            if report_updates:
                cursor.executemany("""
                    UPDATE incident_reports
                    SET report_summary = REPLACE(
                            report_summary, :old_locality, :new_locality
                        ),
                        report_text = REPLACE(
                            report_text, :old_locality, :new_locality
                        ),
                        embedding_text = REPLACE(
                            embedding_text, :old_locality, :new_locality
                        )
                    WHERE incident_id = :incident_id
                """, report_updates)
                reports_written = cursor.rowcount

            cursor.execute("""
                SELECT COUNT(*) AS enriched_rows,
                       SUM(CASE WHEN address_line_1 IS NULL THEN 1 ELSE 0 END) AS missing_street,
                       SUM(CASE WHEN address_postcode IS NULL OR NOT REGEXP_LIKE(address_postcode, '^5[0-9]{3}$') THEN 1 ELSE 0 END) AS bad_postcode,
                       SUM(CASE WHEN address_precision <> :address_precision THEN 1 ELSE 0 END) AS bad_precision
                FROM crime_incidents
                WHERE address_enrichment_source = :enrichment_source
            """, address_precision=ADDRESS_PRECISION, enrichment_source=ENRICHMENT_SOURCE)
            enriched, missing_street, bad_postcode, bad_precision = map(
                int, cursor.fetchone()
            )
            cursor.execute("SELECT COUNT(*) FROM crime_incidents")
            post_update_total = int(cursor.fetchone()[0])
            cursor.execute("SELECT COUNT(*) FROM incident_reports")
            post_update_reports = int(cursor.fetchone()[0])

        failures = []
        if written != len(updates):
            failures.append(
                f"Oracle updated {written:,} of {len(updates):,} selected rows"
            )
        if enriched != expected_total:
            failures.append(
                f"only {enriched:,} of {expected_total:,} rows carry Adelaide provenance"
            )
        if missing_street:
            failures.append(f"{missing_street:,} enriched rows have no street label")
        if bad_postcode:
            failures.append(
                f"{bad_postcode:,} enriched rows have an invalid SA postcode"
            )
        if bad_precision:
            failures.append(
                f"{bad_precision:,} enriched rows have the wrong precision"
            )
        if post_update_total != expected_total:
            failures.append(f"incident count changed to {post_update_total:,}")
        if post_update_reports != expected_total:
            failures.append(f"report count changed to {post_update_reports:,}")
        if reports_written != len(report_updates):
            failures.append(
                f"Oracle synchronized {reports_written:,} of "
                f"{len(report_updates):,} changed report localities"
            )
        if failures:
            raise RuntimeError("; ".join(failures))
        connection.commit()
    except Exception:
        connection.rollback()
        raise


def main() -> int:
    args = arguments()
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be a positive integer.")
    if args.batch_size < 1:
        raise SystemExit("--batch-size must be a positive integer.")
    if args.sample_size < 0:
        raise SystemExit("--sample-size cannot be negative.")
    if args.apply and args.limit is not None:
        raise SystemExit("A limited run is review-only; remove --limit before --apply.")
    if not args.csv.is_file():
        raise SystemExit(f"Boundary CSV not found: {args.csv}")

    boundaries = load_boundaries(args.csv)
    prior_report_localities = load_prior_report_localities(args.prior_review_csv)
    updates: list[dict] = []
    unmatched: list[str] = []

    with oracledb.connect(**database_settings()) as connection:
        total = validate_profile(connection)
        selected = list(select_rows(connection, args.limit, args.overwrite))
        for incident in selected:
            update = make_update(
                incident,
                boundaries,
                args.repair_unmatched_land_points,
            )
            if update is None:
                unmatched.append(incident["incident_ref"])
            else:
                update["report_locality_before"] = prior_report_localities.get(
                    incident["incident_ref"],
                    incident["current_suburb"],
                )
                updates.append(update)

        if args.review_csv:
            write_review_csv(args.review_csv, updates)

        for update in updates[:args.sample_size]:
            print(
                f"{update['incident_ref']}: {update['address_line_1']}, "
                f"{update['address_locality']} SA {update['address_postcode']}"
            )

        print(
            f"Profile check: {ACTIVE_PROFILE_CODE} / {INCIDENT_PROFILE_CODE}; "
            f"{total:,} incidents."
        )
        print(
            f"Boundary result: {len(updates):,} matched; "
            f"{len(unmatched):,} unmatched."
        )
        adjusted = sum(
            update["coordinate_adjusted"] == "yes" for update in updates
        )
        if adjusted:
            maximum_adjustment = max(
                update["adjustment_metres"] for update in updates
            )
            print(
                f"Land-point repair: {adjusted:,} synthetic coordinates adjusted; "
                f"maximum movement {maximum_adjustment:,.1f} m."
            )
        if args.review_csv:
            print(f"Review CSV: {args.review_csv}")

        if unmatched:
            preview = ", ".join(unmatched[:10])
            raise RuntimeError(
                "No changes applied because every selected incident must match "
                f"an Adelaide boundary. First unmatched references: {preview}"
            )

        if args.apply:
            if len(updates) != total:
                raise RuntimeError(
                    "A full apply requires every active incident to be selected; "
                    f"selected {len(updates):,} of {total:,}. Use --overwrite to "
                    "rebuild an already enriched Adelaide profile."
                )
            apply_updates(connection, updates, args.batch_size, total)
            print(
                f"Committed {len(updates):,} enriched Adelaide incidents atomically."
            )
        else:
            print(f"Dry run only; would update {len(updates):,} rows.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
