#!/usr/bin/env python3
"""Populate street-name and locality fields for synthetic CRIME_INCIDENTS rows.

It reverse-geocodes synthetic latitude/longitude to obtain a real nearby street
number, street name, and locality. It never stores a premise, display address,
or postcode. The coordinates and incidents remain synthetic; this address is
context only and does not assert an actual incident location.

By default it only reports proposed changes.  Pass --apply to write them.

Required environment variables:
  ORACLE_USER, APP_SCHEMA_PASSWORD, ORACLE_CONNECTION_STRING

Example:
  python3 scripts/enrich_crime_incident_localities.py \
    --email data-owner@example.com \
    --user-agent 'IncidentDataLiveStack/1.0 (data-owner@example.com)' \
    --limit 50

  # After review, write missing locality fields:
  python3 scripts/enrich_crime_incident_localities.py \
    --email data-owner@example.com \
    --user-agent 'IncidentDataLiveStack/1.0 (data-owner@example.com)' \
    --limit 50 --apply
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import oracledb


NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
LOCALITY_KEYS = ("suburb", "city_district", "town", "city", "village", "municipality")


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Populate street-name and suburb-level address fields.")
    parser.add_argument("--limit", type=int, default=50, help="Rows to process; maximum 50 on public Nominatim.")
    parser.add_argument("--apply", action="store_true", help="Write changes. The default is a dry run.")
    parser.add_argument("--overwrite", action="store_true", help="Include existing address/locality values; writes still require --apply.")
    parser.add_argument("--email", required=True, help="Contact email sent to the geocoder.")
    parser.add_argument("--user-agent", required=True, help="Identifying User-Agent with contact details.")
    parser.add_argument("--cache", type=Path, default=Path(".cache/crime-incident-localities.json"))
    return parser.parse_args()


def database_settings() -> dict[str, str]:
    names = ("ORACLE_USER", "APP_SCHEMA_PASSWORD", "ORACLE_CONNECTION_STRING")
    missing = [name for name in names if not os.getenv(name)]
    if missing:
        sys.exit("Missing environment variable(s): " + ", ".join(missing))
    return {
        "user": os.environ["ORACLE_USER"],
        "password": os.environ["APP_SCHEMA_PASSWORD"],
        "dsn": os.environ["ORACLE_CONNECTION_STRING"],
    }


def load_cache(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError) as error:
        sys.exit(f"Cannot read cache {path}: {error}")


def save_cache(path: Path, cache: dict[str, dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def address_for(latitude: float, longitude: float, cache: dict[str, dict], email: str, user_agent: str) -> dict:
    """Return a street number/name and locality, deliberately excluding premises."""
    key = f"{latitude:.6f},{longitude:.6f}"
    if key not in cache:
        query = urlencode({
            "format": "jsonv2", "lat": f"{latitude:.6f}", "lon": f"{longitude:.6f}",
            "zoom": "18",  # obtain a nearby road/number; never use premise fields
            "layer": "address", "addressdetails": "1", "accept-language": "en-AU,en", "email": email,
        })
        request = Request(f"{NOMINATIM_REVERSE_URL}?{query}", headers={"User-Agent": user_agent})
        try:
            with urlopen(request, timeout=30) as response:
                cache[key] = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Geocoding failed for {key}: {error}") from error

    address = cache[key].get("address", {})
    if not isinstance(address, dict) or str(address.get("country_code", "")).upper() != "AU":
        raise ValueError("No Australian locality was returned")
    locality = next((str(address[name]).strip() for name in LOCALITY_KEYS if address.get(name)), "")
    if not locality:
        raise ValueError("No suburb/locality was returned")
    street_name = str(address.get("road", "")).strip()
    if not street_name:
        raise ValueError("No nearby street name was returned")
    house_number = str(address.get("house_number", "")).strip()
    address_line_1 = f"{house_number} {street_name}".strip()
    state = str(address.get("state", "Western Australia")).strip()
    return {
        "address_line_1": address_line_1,
        "address_locality": locality,
        "address_region": f"Greater Perth, {state}",
        "address_postcode": None,
        "address_country_code": "AU",
        "address_precision": "masked_vicinity",
        "suburb": locality,
    }


def select_incidents(connection: oracledb.Connection, limit: int, overwrite: bool) -> list[dict]:
    incomplete = "" if overwrite else """
      AND (address_line_1 IS NULL OR address_locality IS NULL OR address_region IS NULL
           OR address_country_code IS NULL OR address_precision IS NULL)
    """
    with connection.cursor() as cursor:
        cursor.execute(f"""
            SELECT * FROM (
              SELECT incident_id, incident_ref, latitude, longitude
              FROM crime_incidents
              WHERE latitude IS NOT NULL AND longitude IS NOT NULL {incomplete}
              ORDER BY incident_id
            ) WHERE ROWNUM <= :limit
        """, limit=limit)
        names = [column[0].lower() for column in cursor.description]
        return [dict(zip(names, row)) for row in cursor]


def apply_updates(connection: oracledb.Connection, updates: list[dict]) -> None:
    with connection.cursor() as cursor:
        cursor.executemany("""
            UPDATE crime_incidents
            SET address_line_1 = :address_line_1,
                address_locality = :address_locality,
                address_region = :address_region,
                address_postcode = :address_postcode,
                address_country_code = :address_country_code,
                address_precision = :address_precision,
                suburb = :suburb
            WHERE incident_id = :incident_id
        """, updates)
    connection.commit()


def main() -> int:
    args = arguments()
    if not 1 <= args.limit <= 50:
        sys.exit("--limit must be between 1 and 50 when using public Nominatim.")
    cache = load_cache(args.cache)
    updates: list[dict] = []
    failures = 0
    with oracledb.connect(**database_settings()) as connection:
        incidents = select_incidents(connection, args.limit, args.overwrite)
        for position, incident in enumerate(incidents, start=1):
            try:
                # Public Nominatim permits at most one request per second.
                if f"{float(incident['latitude']):.6f},{float(incident['longitude']):.6f}" not in cache and position > 1:
                    time.sleep(1.1)
                update = address_for(float(incident["latitude"]), float(incident["longitude"]), cache, args.email, args.user_agent)
                updates.append({"incident_id": incident["incident_id"], **update})
                save_cache(args.cache, cache)
                print(f"{incident['incident_ref']}: {update['suburb']}")
            except (RuntimeError, ValueError) as error:
                failures += 1
                print(f"{incident['incident_ref']}: skipped ({error})", file=sys.stderr)

        if args.apply and updates:
            apply_updates(connection, updates)

    action = "Updated" if args.apply else "Dry run; would update"
    print(f"{action} {len(updates)} row(s); {failures} skipped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
