import type { WikiArticle } from "./wikipedia";

/**
 * Tile-based article cache.
 *
 * The world is divided into fixed-size tiles (~5km at the equator).
 * Each tile is fetched once via the Wikipedia geosearch API and cached
 * in memory. When the viewport changes, only new (unseen) tiles are
 * fetched. Previously loaded tiles are served from cache instantly.
 *
 * Pre-loading: after loading visible tiles, surrounding tiles (1 ring
 * around the viewport) are fetched in the background so panning feels
 * instant.
 */

// Tile size in degrees (≈5.5 km at equator, smaller at higher latitudes)
const TILE_SIZE_DEG = 0.05;

// Limit per geosearch call
const LIMIT_PER_TILE = 50;

// Max concurrent fetches
const MAX_CONCURRENT = 8;

// Wikipedia API bases
const WIKI_API: Record<string, string> = {
  nl: "https://nl.wikipedia.org/w/api.php",
  en: "https://en.wikipedia.org/w/api.php",
};

/** Simple tile key: "lang:row:col" */
function tileKey(row: number, col: number, lang: string): string {
  return `${lang}:${row}:${col}`;
}

/** Convert lat/lon to tile row/col */
function toTile(lat: number, lon: number): { row: number; col: number } {
  return {
    row: Math.floor(lat / TILE_SIZE_DEG),
    col: Math.floor(lon / TILE_SIZE_DEG),
  };
}

/** Get the centre of a tile */
function tileCentre(row: number, col: number): { lat: number; lon: number } {
  return {
    lat: (row + 0.5) * TILE_SIZE_DEG,
    lon: (col + 0.5) * TILE_SIZE_DEG,
  };
}

/** Radius that covers a tile (diagonal / 2, in metres) */
function tileRadius(): number {
  // ~5.5 km side ⇒ diagonal ≈ 7.8 km ⇒ radius ≈ 3.9 km → use 5 km for margin
  return 5000;
}

// ─── Tile Cache ──────────────────────────────────────────────────────────

/** Cached articles per tile */
const tileCache = new Map<string, WikiArticle[]>();

/** Tiles currently being fetched (prevents duplicate requests) */
const inflight = new Map<string, Promise<WikiArticle[]>>();

/** Global article store — dedup by pageid+lang */
const articleStore = new Map<string, WikiArticle>();

function articleKey(pageid: number, lang: string): string {
  return `${lang}:${pageid}`;
}

/** Fetch a single tile's articles from Wikipedia */
async function fetchTile(
  row: number,
  col: number,
  lang: string
): Promise<WikiArticle[]> {
  const key = tileKey(row, col, lang);

  // Already cached
  if (tileCache.has(key)) return tileCache.get(key)!;

  // Already in-flight
  if (inflight.has(key)) return inflight.get(key)!;

  const promise = (async () => {
    const { lat, lon } = tileCentre(row, col);
    const apiBase = WIKI_API[lang] || WIKI_API.nl;

    const params = new URLSearchParams({
      action: "query",
      list: "geosearch",
      gscoord: `${lat}|${lon}`,
      gsradius: String(tileRadius()),
      gslimit: String(LIMIT_PER_TILE),
      format: "json",
      origin: "*",
    });

    try {
      const res = await fetch(`${apiBase}?${params}`);
      const data = await res.json();

      if (!data.query?.geosearch) {
        tileCache.set(key, []);
        return [];
      }

      const articles: WikiArticle[] = data.query.geosearch.map(
        (a: { pageid: number; title: string; lat: number; lon: number; dist: number }) => ({
          pageid: a.pageid,
          title: a.title,
          lat: a.lat,
          lon: a.lon,
          dist: a.dist,
        })
      );

      // Store in tile cache
      tileCache.set(key, articles);

      // Store in global article store
      for (const article of articles) {
        articleStore.set(articleKey(article.pageid, lang), article);
      }

      return articles;
    } catch {
      // On error, cache empty to avoid retrying immediately
      tileCache.set(key, []);
      return [];
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

// ─── Batched parallel fetch with concurrency limit ──────────────────────

async function fetchTilesParallel(
  tiles: { row: number; col: number }[],
  lang: string
): Promise<void> {
  // Split into chunks of MAX_CONCURRENT
  for (let i = 0; i < tiles.length; i += MAX_CONCURRENT) {
    const chunk = tiles.slice(i, i + MAX_CONCURRENT);
    await Promise.all(chunk.map((t) => fetchTile(t.row, t.col, lang)));
  }
}

// ─── Public API ─────────────────────────────────────────────────────────

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Get all visible articles for the given map bounds.
 * Fetches any tiles not yet in cache, then returns the combined
 * deduplicated article list.
 */
export async function getArticlesForBounds(
  bounds: Bounds,
  lang: string
): Promise<WikiArticle[]> {
  const tiles = getTilesForBounds(bounds);

  // Separate cached from uncached
  const uncached = tiles.filter(
    (t) => !tileCache.has(tileKey(t.row, t.col, lang))
  );

  // Fetch uncached tiles
  if (uncached.length > 0) {
    await fetchTilesParallel(uncached, lang);
  }

  // Collect all articles from visible tiles, dedup by pageid
  const seen = new Set<number>();
  const result: WikiArticle[] = [];

  for (const t of tiles) {
    const cached = tileCache.get(tileKey(t.row, t.col, lang));
    if (!cached) continue;
    for (const article of cached) {
      if (!seen.has(article.pageid)) {
        seen.add(article.pageid);
        // Return the richest version we have (from articleStore)
        const stored = articleStore.get(articleKey(article.pageid, lang));
        result.push(stored || article);
      }
    }
  }

  return result;
}

/**
 * Pre-load tiles surrounding the viewport (1 tile ring around the edges).
 * This runs in the background and doesn't block the UI.
 */
export function preloadSurroundingTiles(bounds: Bounds, lang: string): void {
  const innerTiles = getTilesForBounds(bounds);
  if (innerTiles.length === 0) return;

  // Find the bounding tile range
  let minRow = Infinity, maxRow = -Infinity;
  let minCol = Infinity, maxCol = -Infinity;
  for (const t of innerTiles) {
    minRow = Math.min(minRow, t.row);
    maxRow = Math.max(maxRow, t.row);
    minCol = Math.min(minCol, t.col);
    maxCol = Math.max(maxCol, t.col);
  }

  // Expand by 1 tile in each direction
  const expandedTiles: { row: number; col: number }[] = [];
  for (let r = minRow - 1; r <= maxRow + 1; r++) {
    for (let c = minCol - 1; c <= maxCol + 1; c++) {
      // Skip tiles that are already in the inner set
      const isInner = r >= minRow && r <= maxRow && c >= minCol && c <= maxCol;
      if (!isInner && !tileCache.has(tileKey(r, c, lang))) {
        expandedTiles.push({ row: r, col: c });
      }
    }
  }

  if (expandedTiles.length > 0) {
    // Fire and forget — don't block UI
    fetchTilesParallel(expandedTiles, lang).catch(() => {});
  }
}

/**
 * Enrich an article with full details (extract, thumbnail, url).
 * Uses the article store as cache.
 */
export async function enrichArticle(
  pageid: number,
  lang: string
): Promise<WikiArticle | null> {
  const key = articleKey(pageid, lang);
  const existing = articleStore.get(key);

  // If we already have extract + url, return cached
  if (existing?.extract && existing?.url) {
    return existing;
  }

  const apiBase = WIKI_API[lang] || WIKI_API.nl;

  const params = new URLSearchParams({
    action: "query",
    pageids: String(pageid),
    prop: "extracts|pageimages|description|info|coordinates",
    exintro: "true",
    explaintext: "true",
    exsentences: "3",
    piprop: "thumbnail",
    pithumbsize: "600",
    inprop: "url",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${apiBase}?${params}`);
  const data = await res.json();

  const page = data.query?.pages?.[String(pageid)];
  if (!page) return null;

  const coords = page.coordinates?.[0];
  const enriched: WikiArticle = {
    pageid: page.pageid,
    title: page.title,
    lat: coords?.lat || existing?.lat || 0,
    lon: coords?.lon || existing?.lon || 0,
    description: page.description,
    thumbnail: page.thumbnail?.source,
    extract: page.extract,
    url: page.fullurl,
  };

  articleStore.set(key, enriched);
  return enriched;
}

/**
 * Clear the cache for a specific language (e.g. when switching languages).
 */
export function clearCacheForLanguage(lang: string): void {
  for (const key of Array.from(tileCache.keys())) {
    if (key.startsWith(`${lang}:`)) {
      tileCache.delete(key);
    }
  }
  for (const key of Array.from(articleStore.keys())) {
    if (key.startsWith(`${lang}:`)) {
      articleStore.delete(key);
    }
  }
}

/**
 * Get cache stats for debugging.
 */
export function getCacheStats(): {
  tiles: number;
  articles: number;
  inflight: number;
} {
  return {
    tiles: tileCache.size,
    articles: articleStore.size,
    inflight: inflight.size,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getTilesForBounds(
  bounds: Bounds
): { row: number; col: number }[] {
  const sw = toTile(bounds.south, bounds.west);
  const ne = toTile(bounds.north, bounds.east);

  const tiles: { row: number; col: number }[] = [];
  for (let r = sw.row; r <= ne.row; r++) {
    for (let c = sw.col; c <= ne.col; c++) {
      tiles.push({ row: r, col: c });
    }
  }

  // Safety cap: don't load more than 100 tiles at once (very zoomed out)
  if (tiles.length > 100) {
    // Sample evenly
    const step = Math.ceil(tiles.length / 80);
    return tiles.filter((_, i) => i % step === 0);
  }

  return tiles;
}
