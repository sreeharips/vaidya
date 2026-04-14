"""Pure-Python Haversine distance calculation. No PostGIS needed."""
import math
from typing import Any

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return great-circle distance in km between two lat/lng points."""
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def filter_by_radius(
    items: list[Any],
    clinic_lat: float,
    clinic_lng: float,
    radius_km: float = 50.0,
    lat_attr: str = "lat",
    lng_attr: str = "lng",
) -> list[tuple[Any, float]]:
    """Return (item, distance_km) pairs for items within radius_km of the clinic.
    Sorted ascending by distance.
    """
    result = []
    for item in items:
        lat = getattr(item, lat_attr, None)
        lng = getattr(item, lng_attr, None)
        if lat is not None and lng is not None:
            dist = haversine_km(clinic_lat, clinic_lng, lat, lng)
            if dist <= radius_km:
                result.append((item, round(dist, 1)))
    result.sort(key=lambda x: x[1])
    return result
