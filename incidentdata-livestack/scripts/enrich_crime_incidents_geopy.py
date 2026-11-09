#!/usr/bin/env python3
"""Geopy/Nominatim address enrichment for local IncidentDataLiveStack rows.

This follows the WA generator's approach: geopy.Nominatim.reverse() resolves
each latitude/longitude.  The incident and coordinates remain synthetic; the
stored number/street/locality are demonstration context only.

The script defaults to the local Podman Compose database settings and performs
a dry run unless --apply is supplied.
"""

from __future__ import annotations

import argparse
import os
import random
import sys

import oracledb
from geopy.extra.rate_limiter import RateLimiter
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderServiceError


LOCALITY_KEYS = ("suburb", "city_district", "town", "city", "village", "municipality")
FAKE_STREET_NAMES = (
    "Kings Way",
    "Fredstone St",
    "Hurst Ave",
    "Ward St",
    "Potts Ave",
    "Proton Drive",
    "Ebert Rd",
    "Brewer Lane",
    "Cahill Court",
    "Coggins Way",
    "Glenhuntley Rd",
    "Montrose St",
    "Cedar Ave",
    "Connor Ave",
    "Athlone St",
    "Ledger Rd",
    "Beverley St",
    "Addison Rd",
    "Sprinter St",
    "Fraser St",
    "Esk St",
    "Angley Ave",
    "Jenkins St",
    "Swan St",
    "Brown St",
)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Populate address fields using Geopy reverse geocoding.")
    parser.add_argument("--limit", type=int, default=1, help="Number of rows to process (maximum 250).")
    parser.add_argument("--apply", action="store_true", help="Persist changes; default is dry run.")
    parser.add_argument("--overwrite", action="store_true", help="Include rows already processed by this script.")
    parser.add_argument(
        "--user-agent",
        default="IncidentDataLiveStack-geocoder/1.0 (local demonstration)",
        help="Identifying User-Agent passed to Nominatim.",
    )
    return parser.parse_args()


def database_settings() -> dict[str, str]:
    """Use Compose defaults, allowing a local .env/export to override them."""
    return {
        "user": os.getenv("ORACLE_USER", "ADELAIDE_CRIME"),
        "password": os.getenv("APP_SCHEMA_PASSWORD", "crime-demo-only"),
        "dsn": os.getenv("ORACLE_CONNECTION_STRING", "localhost:1533/FREEPDB1"),
    }


def select_rows(connection: oracledb.Connection, limit: int, overwrite: bool) -> list[dict]:
    unprocessed_only = "" if overwrite else "AND i.address_enrichment_source IS NULL"
    with connection.cursor() as cursor:
        cursor.execute(f"""
            SELECT * FROM (
              SELECT i.incident_id, i.incident_ref, i.latitude, i.longitude,
                     i.suburb AS current_suburb,
                     COALESCE(NULLIF(TRIM(b.suburb), ''), i.suburb) AS backup_suburb
              FROM crime_incidents i
              LEFT JOIN perth_bak_crime_incidents b ON b.incident_id = i.incident_id
              WHERE i.latitude IS NOT NULL AND i.longitude IS NOT NULL {unprocessed_only}
              ORDER BY i.incident_id
            ) WHERE ROWNUM <= :limit
        """, limit=limit)
        columns = [item[0].lower() for item in cursor.description]
        return [dict(zip(columns, row)) for row in cursor]


def fallback_address(suburb: str, rng: random.Random) -> dict[str, str | None]:
    """Build a clearly synthetic address when geocoding supplies no street."""
    return {
        "address_line_1": f"{rng.randint(1, 200)} {rng.choice(FAKE_STREET_NAMES)}",
        "address_locality": suburb,
        "address_region": "Greater Perth, Western Australia",
        "address_postcode": None,
        "address_country_code": "AU",
        "address_precision": "masked_vicinity",
        "suburb": suburb,
    }


def locality_at_suburb_resolution(reverse, latitude: float, longitude: float) -> str:
    """Ask Nominatim for a locality when its street-level response omits one."""
    location = reverse((latitude, longitude), exactly_one=True, zoom=13, language="en-AU")
    if location is None or not isinstance(location.raw.get("address"), dict):
        return ""
    source = location.raw["address"]
    return next((str(source[key]).strip() for key in LOCALITY_KEYS if source.get(key)), "")


def reverse_address(
    reverse, latitude: float, longitude: float, current_suburb: str, rng: random.Random
) -> tuple[dict[str, str | None], bool]:
    location = reverse((latitude, longitude), exactly_one=True, zoom=18, language="en-AU")
    if location is None or not isinstance(location.raw.get("address"), dict):
        return fallback_address(current_suburb, rng), True

    source = location.raw["address"]
    country = str(source.get("country_code", "")).upper()
    locality = next((str(source[key]).strip() for key in LOCALITY_KEYS if source.get(key)), "")
    street = str(source.get("road", "")).strip()
    number = str(source.get("house_number", "")).strip()
    if country and country != "AU":
        raise ValueError(f"Expected Australia; received {country or 'no country'}")
    if not locality:
        locality = locality_at_suburb_resolution(reverse, latitude, longitude)
    locality = locality or current_suburb
    if not street:
        return fallback_address(locality, rng), True
    if not number:
        number = str(rng.randint(1, 200))

    state = str(source.get("state", "Western Australia")).strip()
    return {
        "address_line_1": f"{number} {street}".strip(),
        "address_locality": locality,
        "address_region": f"Greater Perth, {state}",
        "address_postcode": None,
        "address_country_code": "AU",
        "address_precision": "masked_vicinity",
        "suburb": locality,
    }, False


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
    if not 1 <= args.limit <= 250:
        sys.exit("--limit must be between 1 and 250.")

    geolocator = Nominatim(user_agent=args.user_agent, timeout=30)
    reverse = RateLimiter(geolocator.reverse, min_delay_seconds=1.1, max_retries=0, swallow_exceptions=False)
    updates: list[dict] = []

    with oracledb.connect(**database_settings()) as connection:
        for incident in select_rows(connection, args.limit, args.overwrite):
            rng = random.Random(int(incident["incident_id"]))
            try:
                address, used_synthetic_fallback = reverse_address(
                    reverse,
                    float(incident["latitude"]),
                    float(incident["longitude"]),
                    str(incident["backup_suburb"]),
                    rng,
                )
            except GeocoderServiceError as error:
                address = fallback_address(str(incident["backup_suburb"]), rng)
                used_synthetic_fallback = True
                print(f"{incident['incident_ref']}: geocoder failed; using synthetic fallback ({error})", file=sys.stderr)
            except ValueError as error:
                print(f"{incident['incident_ref']}: skipped ({error})", file=sys.stderr)
                continue

            enrichment_source = "SYNTHETIC_FALLBACK" if used_synthetic_fallback else "GEOPY_NOMINATIM"
            updates.append({
                "incident_id": incident["incident_id"],
                "address_enrichment_source": enrichment_source,
                **address,
            })
            print(f"{incident['incident_ref']}: {address['address_line_1']}, {address['suburb']}")

        if args.apply and updates:
            write_rows(connection, updates)

    action = "Updated" if args.apply else "Dry run; would update"
    print(f"{action} {len(updates)} row(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
