"""Polyline interpolation utilities. Pure Python, no I/O."""

from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

EARTH_MILES = 3958.7613


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    lat1r, lat2r = radians(lat1), radians(lat2)
    dlat = lat2r - lat1r
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(lat1r) * cos(lat2r) * sin(dlng / 2) ** 2
    return 2 * EARTH_MILES * asin(min(1.0, sqrt(a)))


def cumulative_distances(coords: list[tuple[float, float]]) -> list[float]:
    """coords are [lng, lat] pairs in GeoJSON order. Returns running miles."""
    if not coords:
        return []
    out = [0.0]
    for (lng1, lat1), (lng2, lat2) in zip(coords, coords[1:]):
        out.append(out[-1] + haversine_miles(lat1, lng1, lat2, lng2))
    return out


def point_at_mile(
    coords: list[tuple[float, float]],
    cum: list[float],
    target_mile: float,
) -> tuple[float, float]:
    """Linear interpolate the [lng, lat] point at the requested cumulative mile."""
    if not coords:
        raise ValueError("empty coords")
    target_mile = max(0.0, min(cum[-1], target_mile))
    # Binary search the first index whose cum >= target_mile.
    lo, hi = 0, len(cum) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if cum[mid] < target_mile:
            lo = mid + 1
        else:
            hi = mid
    if lo == 0:
        return coords[0]
    prev_cum = cum[lo - 1]
    next_cum = cum[lo]
    span = next_cum - prev_cum
    frac = 0.0 if span <= 1e-9 else (target_mile - prev_cum) / span
    lng1, lat1 = coords[lo - 1]
    lng2, lat2 = coords[lo]
    return (lng1 + (lng2 - lng1) * frac, lat1 + (lat2 - lat1) * frac)
