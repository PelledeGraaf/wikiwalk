import type { WikiArticle } from "./wikipedia";

/**
 * Tile-based article cache with IndexedDB persistence.
 *
 * The world is divided into fixed-size tiles (~5km at the equator).
 * Each tile is fetched once via the Wikipedia geosearch API and cached
 * both in memory and in IndexedDB. On page reload, the IndexedDB cache
 * is restored so previously visited areas load instantly.
 *
 * Pre-loading: after loading visible tiles, surrounding tiles (1 ring
 * around the viewport) are fetched in the background so panning feels
 * instant.
 */

// Tile size in degrees (≈5.5 km at equator, smaller at higher latitudes)
const TILE_SIZE_DEG = 0.05;

// Limit per geosearch call (API max = 500; use max to avoid missing articles at tile edges)
const LIMIT_PER_TILE = 500;

// Max concurrent fetches
const MAX_CONCURRENT = 8;

// Cache expiry: tiles older than 24h are re-fetched
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Wikipedia API bases
const WIKI_API: Record<string, string> = {
  nl: "https://nl.wikipedia.org/w/api.php",
  en: "https://en.wikipedia.org/w/api.php",
};

// ─── IndexedDB Persistence ──────────────────────────────────────────────

const DB_NAME = "wikiwalk-cache";
const DB_VERSION = 1;
const TILE_STORE = "tiles";
const ARTICLE_STORE = "articles";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TILE_STORE)) {
        db.createObjectStore(TILE_STORE);
      }
      if (!db.objectStoreNames.contains(ARTICLE_STORE)) {
        db.createObjectStore(ARTICLE_STORE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // If the connection is unexpectedly closed (Safari does this),
      // reset so the next call re-opens
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => {
      // Reset so subsequent calls can retry
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

interface PersistedTile {
  articles: WikiArticle[];
  timestamp: number;
}

async function persistTile(key: string, articles: WikiArticle[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(TILE_STORE, "readwrite");
    const store = tx.objectStore(TILE_STORE);
    const data: PersistedTile = { articles, timestamp: Date.now() };
    store.put(data, key);
    // Wait for the transaction to actually commit
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // Reset DB promise on write failure (connection may be stale)
    dbPromise = null;
  }
}

async function loadPersistedTile(key: string): Promise<WikiArticle[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(TILE_STORE, "readonly");
    const store = tx.objectStore(TILE_STORE);
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => {
        const data = req.result as PersistedTile | undefined;
        if (!data) { resolve(null); return; }
        // Check expiry
        if (Date.now() - data.timestamp > CACHE_MAX_AGE_MS) {
          resolve(null);
          return;
        }
        resolve(data.articles);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    // Reset DB on read failure (connection may be stale)
    dbPromise = null;
    return null;
  }
}

async function persistEnrichedArticle(key: string, article: WikiArticle): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(ARTICLE_STORE, "readwrite");
    const store = tx.objectStore(ARTICLE_STORE);
    store.put({ ...article, _ts: Date.now() }, key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    dbPromise = null;
  }
}

async function loadPersistedArticle(key: string): Promise<WikiArticle | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(ARTICLE_STORE, "readonly");
    const store = tx.objectStore(ARTICLE_STORE);
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => {
        const data = req.result as (WikiArticle & { _ts?: number }) | undefined;
        if (!data) { resolve(null); return; }
        if (data._ts && Date.now() - data._ts > CACHE_MAX_AGE_MS) {
          resolve(null);
          return;
        }
        resolve(data);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    dbPromise = null;
    return null;
  }
}

async function clearPersistedLanguage(lang: string): Promise<void> {
  try {
    const db = await openDB();
    const prefix = `${lang}:`;
    for (const storeName of [TILE_STORE, ARTICLE_STORE]) {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    }
  } catch {}
}

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

/** Whether the warm-up has completed */
let cacheWarmedUp = false;

function articleKey(pageid: number, lang: string): string {
  return `${lang}:${pageid}`;
}

/**
 * Warm the in-memory cache from IndexedDB in a SINGLE transaction.
 *
 * Safari is extremely slow when opening many individual transactions.
 * This loads ALL persisted tiles at once (~1 transaction) so subsequent
 * tile lookups hit the fast in-memory Map. Call once at startup.
 */
export async function warmCacheFromDB(): Promise<number> {
  if (cacheWarmedUp) return tileCache.size;
  try {
    const db = await openDB();
    const tx = db.transaction(TILE_STORE, "readonly");
    const store = tx.objectStore(TILE_STORE);

    return new Promise((resolve) => {
      let loaded = 0;
      const now = Date.now();
      const req = store.openCursor();

      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          // Done iterating
          cacheWarmedUp = true;
          resolve(loaded);
          return;
        }

        const key = cursor.key as string;
        const data = cursor.value as PersistedTile;

        // Skip expired tiles
        if (data && now - data.timestamp <= CACHE_MAX_AGE_MS) {
          tileCache.set(key, data.articles);
          // Extract lang from key "lang:row:col"
          const lang = key.split(":")[0];
          for (const article of data.articles) {
            articleStore.set(articleKey(article.pageid, lang), article);
          }
          loaded++;
        }

        cursor.continue();
      };

      req.onerror = () => {
        cacheWarmedUp = true;
        resolve(loaded);
      };
    });
  } catch {
    cacheWarmedUp = true;
    return 0;
  }
}

/** Fetch a single tile's articles from Wikipedia */
async function fetchTile(
  row: number,
  col: number,
  lang: string
): Promise<WikiArticle[]> {
  const key = tileKey(row, col, lang);

  // Already in memory cache
  if (tileCache.has(key)) return tileCache.get(key)!;

  // Already in-flight
  if (inflight.has(key)) return inflight.get(key)!;

  const promise = (async () => {
    // Try IndexedDB first
    const persisted = await loadPersistedTile(key);
    if (persisted) {
      tileCache.set(key, persisted);
      for (const article of persisted) {
        articleStore.set(articleKey(article.pageid, lang), article);
      }
      return persisted;
    }

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
        persistTile(key, []);
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

      // Store in memory
      tileCache.set(key, articles);

      // Store in global article store
      for (const article of articles) {
        articleStore.set(articleKey(article.pageid, lang), article);
      }

      // Persist to IndexedDB (fire and forget)
      persistTile(key, articles);

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
 *
 * Always includes 1 ring of surrounding tiles so markers don't
 * vanish when the user zooms in close.
 */
export async function getArticlesForBounds(
  bounds: Bounds,
  lang: string
): Promise<WikiArticle[]> {
  const innerTiles = getTilesForBounds(bounds);

  // Expand by 1 tile ring so markers stay visible when zoomed in
  let minRow = Infinity, maxRow = -Infinity;
  let minCol = Infinity, maxCol = -Infinity;
  for (const t of innerTiles) {
    minRow = Math.min(minRow, t.row);
    maxRow = Math.max(maxRow, t.row);
    minCol = Math.min(minCol, t.col);
    maxCol = Math.max(maxCol, t.col);
  }

  const allTiles: { row: number; col: number }[] = [];
  for (let r = minRow - 1; r <= maxRow + 1; r++) {
    for (let c = minCol - 1; c <= maxCol + 1; c++) {
      allTiles.push({ row: r, col: c });
    }
  }

  // Separate cached from uncached
  const uncached = allTiles.filter(
    (t) => !tileCache.has(tileKey(t.row, t.col, lang))
  );

  // Fetch uncached tiles
  if (uncached.length > 0) {
    await fetchTilesParallel(uncached, lang);
  }

  // Collect all articles from tiles, dedup by pageid
  const seen = new Set<number>();
  const result: WikiArticle[] = [];

  for (const t of allTiles) {
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
 * Pre-load tiles surrounding the viewport (2 tile ring around the edges).
 * This runs in the background and doesn't block the UI.
 * Since getArticlesForBounds already fetches 1 ring, this adds an extra buffer.
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

  // Expand by 2 tiles in each direction (1 ring is already fetched by getArticlesForBounds)
  const expandedTiles: { row: number; col: number }[] = [];
  for (let r = minRow - 2; r <= maxRow + 2; r++) {
    for (let c = minCol - 2; c <= maxCol + 2; c++) {
      if (!tileCache.has(tileKey(r, c, lang))) {
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

  // If we already have extract + url in memory, return cached
  if (existing?.extract && existing?.url) {
    return existing;
  }

  // Check IndexedDB for enriched version
  const persisted = await loadPersistedArticle(key);
  if (persisted?.extract && persisted?.url) {
    articleStore.set(key, persisted);
    return persisted;
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

  // Persist enriched article to IndexedDB
  persistEnrichedArticle(key, enriched);

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
  // Also clear IndexedDB for this language
  clearPersistedLanguage(lang);
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
