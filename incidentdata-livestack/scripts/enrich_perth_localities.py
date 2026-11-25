#!/usr/bin/env python3
"""Enrich Perth demonstration incidents with coarse locality context.

The program reverse-geocodes only at Nominatim zoom level 13 (suburb/locality
resolution). It intentionally discards roads, house numbers, and premises.
The existing incident coordinates are synthetic, so this script must never be
used to create a real address for an incident record.

By default the script is a dry run. It is capped at 50 records when using the
public Nominatim endpoint and caches every response. This complies with the
public endpoint's single-threaded, maximum-one-request-per-second policy.

Required environment variables:
  ORACLE_USER
  APP_SCHEMA_PASSWORD
  ORACLE_CONNECTION_STRING  (for example: localhost:1533/FREEPDB1)

Examples:
  # Review a deterministic 50-record pilot; no database changes.
  python3 scripts/enrich_perth_localities.py \
    --email data-owner@example.com \
    --user-agent 'IncidentDataLiveStack/1.0 (data-owner@example.com)' \
    --review-csv /tmp/perth-locality-review.csv

  # Apply reviewed locality values to the same pilot.
  python3 scripts/enrich_perth_localities.py \
    --email data-owner@example.com \
    --user-agent 'IncidentDataLiveStack/1.0 (data-owner@example.com)' \
    --review-csv /tmp/perth-locality-review.csv \
    --apply --overwrite
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

try:
    import oracledb
except ImportError:  # The help text must remain available before installation.
    oracledb = None


PUBLIC_NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse"
PUBLIC_MIN_INTERVAL_SECONDS = 1.1
DEFAULT_CACHE = Path(".cache/perth-locality-geocode.json")
LOCALITY_KEYS = (
    "suburb",
    "city_district",
    "town",
    "city",
    "village",
    "municipality",
    "county",
)


@dataclass(frozen=True)
class CoarseAddress:
    """The only locality fields the program is allowed to persist."""

    address_line_1: str
    address_locality: str
    address_region: str
    address_postcode: None
    address_country_code: str
    address_precision: str
    suburb: str


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Populate coarse Perth locality context for synthetic incidents."
    )
    parser.add_argument("--limit", type=int, default=50, help="Records to process (max 50).")
    parser.add_argument(
        "--seed",
        type=int,
        default=20260818,
        help="Deterministic Oracle sampling seed.",
    )
    parser.add_argument("--apply", action="store_true", help="Persist values. Defaults to dry run.")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace existing address/locality values. Required to re-enrich current rows.",
    )
    parser.add_argument(
        "--review-csv",
        type=Path,
        help="Optional CSV containing current and proposed values for review.",
    )
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE, help="JSON response cache path.")
    parser.add_argument(
        "--endpoint",
        default=PUBLIC_NOMINATIM_ENDPOINT,
        help="Reverse-geocoding endpoint. Use a licensed or self-hosted service for larger jobs.",
    )
    parser.add_argument(
        "--email",
        required=True,
        help="Contact email sent to the geocoding service.",
    )
    parser.add_argument(
        "--user-agent",
        required=True,
        help="Identifying HTTP User-Agent, including a contact method.",
    )
    parser.add_argument(
        "--min-interval-seconds",
        type=float,
        default=PUBLIC_MIN_INTERVAL_SECONDS,
        help="Minimum delay between uncached requests; must be at least 1.0 for public Nominatim.",
    )
    return parser.parse_args()


def require_database_settings() -> dict[str, str]:
    required = ("ORACLE_USER", "APP_SCHEMA_PASSWORD", "ORACLE_CONNECTION_STRING")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        sys.exit("Missing required environment variable(s): " + ", ".join(missing))
    return {
        "user": os.environ["ORACLE_USER"],
        "password": os.environ["APP_SCHEMA_PASSWORD"],
        "dsn": os.environ["ORACLE_CONNECTION_STRING"],
    }


def require_oracle_driver() -> None:
    if oracledb is None:
        sys.exit(
            "Missing dependency: install python-oracledb with\n"
            "  python3 -m pip install -r scripts/requirements-locality-enrichment.txt"
        )


def load_cache(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
        return loaded if isinstance(loaded, dict) else {}
    except (OSError, json.JSONDecodeError) as error:
        sys.exit(f"Cannot read cache {path}: {error}")


def save_cache(path: Path, cache: dict[str, dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def cache_key(latitude: float, longitude: float) -> str:
    # Six decimal places retains the generated point while allowing repeatable caching.
    return f"{latitude:.6f},{longitude:.6f}"


def reverse_geocode(
    latitude: float,
    longitude: float,
    *,
    endpoint: str,
    email: str,
    user_agent: str,
    cache: dict[str, dict[str, Any]],
    min_interval_seconds: float,
    last_request_at: list[float],
) -> dict[str, Any]:
    key = cache_key(latitude, longitude)
    if key in cache:
        return cache[key]

    wait_for = min_interval_seconds - (time.monotonic() - last_request_at[0])
    if wait_for > 0:
        time.sleep(wait_for)

    parameters = urlencode(
        {
            "format": "jsonv2",
            "lat": f"{latitude:.6f}",
            "lon": f"{longitude:.6f}",
            "zoom": "13",  # Suburb/locality level; never request roads or buildings.
            "layer": "address",
            "addressdetails": "1",
            "accept-language": "en-AU,en",
            "email": email,
        }
    )
    request = Request(
        f"{endpoint}?{parameters}",
        headers={"User-Agent": user_agent, "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Reverse geocoding failed for {key}: {error}") from error

    last_request_at[0] = time.monotonic()
    if not isinstance(payload, dict):
        raise RuntimeError(f"Unexpected reverse-geocoding response for {key}")
    cache[key] = payload
    return payload


def coarse_address(payload: dict[str, Any]) -> CoarseAddress:
    source = payload.get("address")
    if not isinstance(source, dict):
        raise ValueError("Response does not contain an address breakdown")

    country = str(source.get("country_code", "")).upper()
    state = str(source.get("state", "")).strip()
    locality = next((str(source[key]).strip() for key in LOCALITY_KEYS if source.get(key)), "")
    if country != "AU":
        raise ValueError(f"Expected an Australian locality, received country code {country or 'none'}")
    if not locality:
        raise ValueError("No suburb/locality was returned at coarse resolution")

    # Do not read payload['address']['road'], house_number, amenity, or display_name.
    # The UI remains explicit that the incident is synthetic and locality-only.
    region = "Greater Perth" if not state else f"Greater Perth, {state}"
    return CoarseAddress(
        address_line_1=f"Synthetic locality context — {locality}",
        address_locality=locality,
        address_region=region,
        address_postcode=None,
        address_country_code="AU",
        address_precision="locality_only",
        suburb=locality,
    )


def select_rows(connection: oracledb.Connection, limit: int, seed: int, overwrite: bool) -> list[dict[str, Any]]:
    where = "" if overwrite else """
      AND (i.address_line_1 IS NULL OR i.address_locality IS NULL
           OR i.address_region IS NULL OR i.address_country_code IS NULL
           OR i.address_precision IS NULL OR i.suburb IS NULL)
    """
    statement = f"""
        SELECT * FROM (
          SELECT i.incident_id, i.incident_ref, i.latitude, i.longitude,
                 i.address_line_1, i.address_locality, i.address_region,
                 i.address_postcode, i.address_country_code, i.address_precision, i.suburb
          FROM crime_incidents i
          WHERE i.incident_ref LIKE 'PCI-%'
            AND i.latitude IS NOT NULL
            AND i.longitude IS NOT NULL
            {where}
          ORDER BY ORA_HASH(i.incident_ref, 4294967295, :seed)
        ) WHERE ROWNUM <= :limit
    """
    cursor = connection.cursor()
    cursor.execute(statement, seed=seed, limit=limit)
    columns = [column[0].lower() for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor]


def write_review(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "incident_ref",
        "latitude",
        "longitude",
        "current_address_line_1",
        "current_address_locality",
        "current_address_region",
        "current_address_postcode",
        "current_address_country_code",
        "current_address_precision",
        "current_suburb",
        "proposed_address_line_1",
        "proposed_address_locality",
        "proposed_address_region",
        "proposed_address_postcode",
        "proposed_address_country_code",
        "proposed_address_precision",
        "proposed_suburb",
        "status",
        "note",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def apply_updates(connection: oracledb.Connection, updates: list[dict[str, Any]]) -> None:
    if not updates:
        return
    cursor = connection.cursor()
    cursor.executemany(
        """
        UPDATE crime_incidents
        SET address_line_1 = :address_line_1,
            address_locality = :address_locality,
            address_region = :address_region,
            address_postcode = :address_postcode,
            address_country_code = :address_country_code,
            address_precision = :address_precision,
            suburb = :suburb
        WHERE incident_id = :incident_id
        """,
        updates,
    )
    connection.commit()


def main() -> int:
    args = arguments()
    if not 1 <= args.limit <= 50:
        sys.exit("--limit must be between 1 and 50 when using this public-endpoint pilot.")
    if args.min_interval_seconds < 1.0:
        sys.exit("--min-interval-seconds must be at least 1.0 for public Nominatim.")
    if args.apply and not args.overwrite:
        sys.exit("--apply requires --overwrite because existing Perth address fields are populated.")

    require_oracle_driver()
    settings = require_database_settings()
    cache = load_cache(args.cache)
    last_request_at = [0.0]
    review_rows: list[dict[str, Any]] = []
    updates: list[dict[str, Any]] = []

    with oracledb.connect(**settings) as connection:
        # A review must compare proposals against populated rows. Only an actual
        # database write needs the explicit --overwrite confirmation.
        incidents = select_rows(
            connection,
            args.limit,
            args.seed,
            overwrite=args.overwrite or not args.apply,
        )
        if not incidents:
            print("No eligible Perth incidents found.")
            return 0

        for incident in incidents:
            review = {
                "incident_ref": incident["incident_ref"],
                "latitude": incident["latitude"],
                "longitude": incident["longitude"],
                **{f"current_{key}": incident[key] for key in (
                    "address_line_1", "address_locality", "address_region", "address_postcode",
                    "address_country_code", "address_precision", "suburb",
                )},
                "status": "skipped",
                "note": "",
            }
            try:
                payload = reverse_geocode(
                    float(incident["latitude"]),
                    float(incident["longitude"]),
                    endpoint=args.endpoint,
                    email=args.email,
                    user_agent=args.user_agent,
                    cache=cache,
                    min_interval_seconds=args.min_interval_seconds,
                    last_request_at=last_request_at,
                )
                proposed = coarse_address(payload)
                review.update({f"proposed_{key}": getattr(proposed, key) for key in proposed.__dataclass_fields__})
                review["status"] = "ready"
                updates.append({"incident_id": incident["incident_id"], **proposed.__dict__})
            except (RuntimeError, ValueError) as error:
                review["note"] = str(error)
            review_rows.append(review)
            save_cache(args.cache, cache)

        if args.apply:
            apply_updates(connection, updates)

    if args.review_csv:
        write_review(args.review_csv, review_rows)

    ready = len(updates)
    skipped = len(review_rows) - ready
    mode = "Applied" if args.apply else "Dry run prepared"
    print(f"{mode}: {ready} locality updates ready, {skipped} skipped; {len(cache)} cached responses.")
    if args.review_csv:
        print(f"Review CSV: {args.review_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
