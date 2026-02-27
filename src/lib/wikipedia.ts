export interface WikiArticle {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
  dist?: number;
  description?: string;
  thumbnail?: string;
  extract?: string;
  url?: string;
}

interface WikiGeoSearchResult {
  pageid: number;
  ns: number;
  title: string;
  lat: number;
  lon: number;
  dist: number;
  primary: string;
}

interface WikiPageInfo {
  pageid: number;
  title: string;
  extract?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  description?: string;
  fullurl?: string;
  coordinates?: { lat: number; lon: number }[];
}

const WIKI_API = "https://nl.wikipedia.org/w/api.php";
const WIKI_EN_API = "https://en.wikipedia.org/w/api.php";

export async function fetchNearbyArticles(
  lat: number,
  lon: number,
  radius: number = 10000,
  limit: number = 50,
  language: string = "nl"
): Promise<WikiArticle[]> {
  const apiBase = language === "nl" ? WIKI_API : WIKI_EN_API;

  const params = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${lat}|${lon}`,
    gsradius: String(Math.min(radius, 10000)),
    gslimit: String(Math.min(limit, 500)),
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${apiBase}?${params}`);
  const data = await res.json();

  if (!data.query?.geosearch) return [];

  const articles: WikiGeoSearchResult[] = data.query.geosearch;
  if (articles.length === 0) return [];

  const pageIds = articles.map((a) => a.pageid).join("|");

  // Fetch additional details (extracts, thumbnails)
  const detailParams = new URLSearchParams({
    action: "query",
    pageids: pageIds,
    prop: "extracts|pageimages|description|info|coordinates",
    exintro: "true",
    explaintext: "true",
    exsentences: "3",
    piprop: "thumbnail",
    pithumbsize: "300",
    inprop: "url",
    format: "json",
    origin: "*",
  });

  const detailRes = await fetch(`${apiBase}?${detailParams}`);
  const detailData = await detailRes.json();

  const pages: Record<string, WikiPageInfo> = detailData.query?.pages || {};

  return articles.map((article) => {
    const page = pages[String(article.pageid)];
    return {
      pageid: article.pageid,
      title: article.title,
      lat: article.lat,
      lon: article.lon,
      dist: article.dist,
      description: page?.description,
      thumbnail: page?.thumbnail?.source,
      extract: page?.extract,
      url: page?.fullurl,
    };
  });
}

/**
 * Light geosearch — returns articles with coordinates only (no extracts/thumbnails).
 * Used for grid-based loading to minimize API calls.
 */
async function fetchGeoSearchLight(
  lat: number,
  lon: number,
  radius: number,
  limit: number,
  language: string
): Promise<WikiArticle[]> {
  const apiBase = language === "nl" ? WIKI_API : WIKI_EN_API;

  const params = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${lat}|${lon}`,
    gsradius: String(Math.min(radius, 10000)),
    gslimit: String(Math.min(limit, 500)),
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${apiBase}?${params}`);
  const data = await res.json();

  if (!data.query?.geosearch) return [];

  return (data.query.geosearch as WikiGeoSearchResult[]).map((a) => ({
    pageid: a.pageid,
    title: a.title,
    lat: a.lat,
    lon: a.lon,
    dist: a.dist,
  }));
}

/**
 * Fetch articles across a map viewport using a grid of sample points.
 * At lower zoom levels, more grid points are used to cover the visible area.
 */
export async function fetchArticlesInBounds(
  centerLat: number,
  centerLon: number,
  zoom: number,
  language: string = "nl"
): Promise<WikiArticle[]> {
  // Determine grid size and radius based on zoom
  let gridSize: number;
  let radius: number;
  let limitPerPoint: number;

  if (zoom >= 14) {
    // Close zoom: single point, full details
    return fetchNearbyArticles(centerLat, centerLon, 10000, 100, language);
  } else if (zoom >= 12) {
    gridSize = 2;
    radius = 10000;
    limitPerPoint = 50;
  } else if (zoom >= 10) {
    gridSize = 3;
    radius = 10000;
    limitPerPoint = 40;
  } else if (zoom >= 8) {
    gridSize = 4;
    radius = 10000;
    limitPerPoint = 30;
  } else if (zoom >= 6) {
    gridSize = 5;
    radius = 10000;
    limitPerPoint = 20;
  } else {
    // Very zoomed out — 6x6 grid
    gridSize = 6;
    radius = 10000;
    limitPerPoint = 15;
  }

  // Calculate the approximate viewport size in degrees
  // At equator: ~360 / 2^zoom degrees per tile (256px), viewport ≈ a few tiles
  const latSpan = 180 / Math.pow(2, zoom) * 3; // ~3 tiles high
  const lonSpan = 360 / Math.pow(2, zoom) * 4 / Math.cos(centerLat * Math.PI / 180); // ~4 tiles wide

  // Generate grid points
  const points: { lat: number; lon: number }[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const lat = centerLat + latSpan * ((row / (gridSize - 1 || 1)) - 0.5);
      const lon = centerLon + lonSpan * ((col / (gridSize - 1 || 1)) - 0.5);
      points.push({ lat, lon });
    }
  }

  // Fetch all points in parallel (light version — no extracts)
  const results = await Promise.all(
    points.map((p) => fetchGeoSearchLight(p.lat, p.lon, radius, limitPerPoint, language))
  );

  // Deduplicate by pageid
  const seen = new Set<number>();
  const allArticles: WikiArticle[] = [];
  for (const batch of results) {
    for (const article of batch) {
      if (!seen.has(article.pageid)) {
        seen.add(article.pageid);
        allArticles.push(article);
      }
    }
  }

  return allArticles;
}

export async function fetchArticleDetail(
  pageid: number,
  language: string = "nl"
): Promise<WikiArticle | null> {
  const apiBase = language === "nl" ? WIKI_API : WIKI_EN_API;

  const params = new URLSearchParams({
    action: "query",
    pageids: String(pageid),
    prop: "extracts|pageimages|description|info|coordinates",
    exintro: "true",
    explaintext: "true",
    piprop: "thumbnail",
    pithumbsize: "600",
    inprop: "url",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${apiBase}?${params}`);
  const data = await res.json();

  const page: WikiPageInfo | undefined =
    data.query?.pages?.[String(pageid)];
  if (!page) return null;

  const coords = page.coordinates?.[0];
  return {
    pageid: page.pageid,
    title: page.title,
    lat: coords?.lat || 0,
    lon: coords?.lon || 0,
    description: page.description,
    thumbnail: page.thumbnail?.source,
    extract: page.extract,
    url: page.fullurl,
  };
}

export async function searchArticles(
  query: string,
  language: string = "nl"
): Promise<WikiArticle[]> {
  const apiBase = language === "nl" ? WIKI_API : WIKI_EN_API;

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "20",
    prop: "coordinates|extracts|pageimages|description|info",
    exintro: "true",
    explaintext: "true",
    exsentences: "2",
    piprop: "thumbnail",
    pithumbsize: "300",
    inprop: "url",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${apiBase}?${params}`);
  const data = await res.json();

  const pages: Record<string, WikiPageInfo> = data.query?.pages || {};

  return Object.values(pages)
    .filter((page) => page.coordinates && page.coordinates.length > 0)
    .map((page) => ({
      pageid: page.pageid,
      title: page.title,
      lat: page.coordinates![0].lat,
      lon: page.coordinates![0].lon,
      description: page.description,
      thumbnail: page.thumbnail?.source,
      extract: page.extract,
      url: page.fullurl,
    }));
}
