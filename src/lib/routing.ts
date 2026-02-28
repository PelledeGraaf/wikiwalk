/**
 * Pedestrian routing via the OSRM public demo API.
 * Returns a GeoJSON LineString geometry for the walking route.
 */

export interface RouteResult {
  /** GeoJSON coordinates [[lon, lat], ...] */
  coordinates: [number, number][];
  /** Total distance in meters */
  distance: number;
  /** Estimated duration in seconds */
  duration: number;
}

export async function fetchWalkingRoute(
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number
): Promise<RouteResult | null> {
  // Try OSRM foot profile first
  const osrmResult = await fetchOSRM(fromLon, fromLat, toLon, toLat);
  if (osrmResult) return osrmResult;

  // Fallback: straight line
  return {
    coordinates: [
      [fromLon, fromLat],
      [toLon, toLat],
    ],
    distance: haversine(fromLat, fromLon, toLat, toLon),
    duration: haversine(fromLat, fromLon, toLat, toLon) / 1.4, // ~5 km/h walk
  };
}

function haversine(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchOSRM(
  fromLon: number,
  fromLat: number,
  toLon: number,
  toLat: number
): Promise<RouteResult | null> {
  try {
    // Use the OSRM foot profile via the public demo server.
    // Note: the demo only has car routing; use routing.openstreetmap.de
    // which exposes foot/bicycle profiles.
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;

    const route = data.routes[0];
    return {
      coordinates: route.geometry.coordinates,
      distance: route.distance,
      duration: route.duration,
    };
  } catch {
    return null;
  }
}

/** Format meters to human-readable distance */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Format seconds to human-readable duration */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} u ${m} min` : `${h} u`;
}
