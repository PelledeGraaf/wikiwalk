import { WikiArticle } from "./wikipedia";

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Sort articles by distance from a point
 */
export function sortByDistance(
  articles: WikiArticle[],
  lat: number,
  lon: number
): WikiArticle[] {
  return [...articles].sort((a, b) => {
    const distA = haversineDistance(lat, lon, a.lat, a.lon);
    const distB = haversineDistance(lat, lon, b.lat, b.lon);
    return distA - distB;
  });
}

/**
 * Generate a simple walking route between points (ordered by nearest neighbor)
 */
export function generateWalkingRoute(
  articles: WikiArticle[],
  startLat: number,
  startLon: number
): WikiArticle[] {
  if (articles.length === 0) return [];

  const route: WikiArticle[] = [];
  const remaining = [...articles];
  let currentLat = startLat;
  let currentLon = startLon;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(
        currentLat,
        currentLon,
        remaining[i].lat,
        remaining[i].lon
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const nearest = remaining.splice(nearestIdx, 1)[0];
    route.push(nearest);
    currentLat = nearest.lat;
    currentLon = nearest.lon;
  }

  return route;
}

/**
 * Calculate total walking distance for a route
 */
export function totalRouteDistance(route: WikiArticle[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += haversineDistance(
      route[i - 1].lat,
      route[i - 1].lon,
      route[i].lat,
      route[i].lon
    );
  }
  return total;
}

/**
 * Estimate walking time in minutes (average 5km/h)
 */
export function estimateWalkingTime(distanceMeters: number): number {
  return Math.round(distanceMeters / (5000 / 60));
}
