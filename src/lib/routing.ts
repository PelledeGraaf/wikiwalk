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
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
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
