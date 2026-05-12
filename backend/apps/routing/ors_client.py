"""OpenRouteService HTTP client. Includes a fixture-backed offline impl."""

from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from django.conf import settings
from django.core.cache import cache

log = logging.getLogger(__name__)

ORS_BASE = "https://api.openrouteservice.org"
FIXTURE_DIR = Path(__file__).parent / "fixtures"


@dataclass
class GeocodeResult:
    label: str
    lat: float
    lng: float


@dataclass
class RouteResult:
    coordinates: list[tuple[float, float]]  # [(lng, lat), ...]
    total_miles: float
    duration_hours: float


# --------------------------------------------------------------------------


def _hash(s: str) -> str:
    return hashlib.sha1(s.encode()).hexdigest()[:16]


class ORSClient:
    """Wraps geocoding + directions. Caches via Django cache."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.ORS_API_KEY

    def geocode(self, text: str) -> GeocodeResult:
        ckey = f"ors:geocode:{_hash(text.lower().strip())}"
        if (cached := cache.get(ckey)) is not None:
            return GeocodeResult(**cached)
        if not self.api_key:
            raise RuntimeError("ORS_API_KEY not set; cannot geocode live.")
        r = requests.get(
            f"{ORS_BASE}/geocode/search",
            params={"api_key": self.api_key, "text": text, "size": 1, "boundary.country": "US"},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        feats = data.get("features", [])
        if not feats:
            raise ValueError(f"no geocode result for {text!r}")
        coord = feats[0]["geometry"]["coordinates"]  # [lng, lat]
        label = feats[0]["properties"].get("label", text)
        result = GeocodeResult(label=label, lat=coord[1], lng=coord[0])
        cache.set(ckey, result.__dict__, timeout=60 * 60 * 24 * 30)
        return result

    def directions(self, coords: list[tuple[float, float]], profile: str = "driving-hgv") -> RouteResult:
        key_src = json.dumps([profile, coords], separators=(",", ":"))
        ckey = f"ors:dir:{_hash(key_src)}"
        if (cached := cache.get(ckey)) is not None:
            return RouteResult(**cached)
        if not self.api_key:
            raise RuntimeError("ORS_API_KEY not set; cannot fetch directions live.")
        r = requests.post(
            f"{ORS_BASE}/v2/directions/{profile}/geojson",
            headers={
                "Authorization": self.api_key,
                "Content-Type": "application/json",
                "Accept": "application/geo+json",
            },
            json={
                "coordinates": [list(c) for c in coords],
                "instructions": False,
                "elevation": False,
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        feature = data["features"][0]
        geom = feature["geometry"]["coordinates"]
        summary = feature["properties"]["summary"]
        meters = summary["distance"]
        seconds = summary["duration"]
        result = RouteResult(
            coordinates=[(lng, lat) for lng, lat in geom],
            total_miles=meters / 1609.344,
            duration_hours=seconds / 3600.0,
        )
        cache.set(ckey, result.__dict__, timeout=60 * 60 * 24 * 7)
        return result


class FixtureORSClient:
    """Returns canned ORS responses from JSON files. No network."""

    def geocode(self, text: str) -> GeocodeResult:
        data = self._load("geocode.json")
        key = text.lower().strip()
        for label, v in data.items():
            if key in label.lower() or label.lower() in key:
                return GeocodeResult(label=label, lat=v["lat"], lng=v["lng"])
        # fall back to a plausible default — Times Square — so dev doesn't crash
        return GeocodeResult(label=text, lat=40.7580, lng=-73.9855)

    def directions(self, coords: list[tuple[float, float]], profile: str = "driving-hgv") -> RouteResult:
        # Use a deterministic mock: distance computed by haversine over straight
        # great-circle segments between the input waypoints, with a 1.18x road
        # detour factor. Polyline is densified linearly between waypoints.
        from .geometry import haversine_miles

        if len(coords) < 2:
            raise ValueError("need >=2 coords")
        detour = 1.18
        densified: list[tuple[float, float]] = []
        total = 0.0
        for (lng1, lat1), (lng2, lat2) in zip(coords, coords[1:]):
            seg_miles = haversine_miles(lat1, lng1, lat2, lng2) * detour
            total += seg_miles
            steps = max(40, int(seg_miles / 5))
            for i in range(steps):
                t = i / steps
                densified.append((lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t))
        densified.append(coords[-1])
        return RouteResult(coordinates=densified, total_miles=total, duration_hours=total / 55.0)

    def _load(self, name: str) -> dict[str, Any]:
        p = FIXTURE_DIR / name
        if not p.exists():
            return {}
        with p.open() as f:
            return json.load(f)


def get_client():
    """Factory honouring settings.ROUTING_USE_FIXTURES."""
    if settings.ROUTING_USE_FIXTURES or not settings.ORS_API_KEY:
        return FixtureORSClient()
    return ORSClient()
