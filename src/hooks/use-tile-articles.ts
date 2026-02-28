"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import {
  getArticlesForBounds,
  preloadSurroundingTiles,
  enrichArticle,
  clearCacheForLanguage,
  getCacheStats,
  warmCacheFromDB,
  type Bounds,
} from "@/lib/article-tile-cache";
import type { WikiArticle } from "@/lib/wikipedia";

/**
 * Hook that manages tile-based article loading.
 *
 * - Fetches articles for the current viewport (real map bounds)
 * - Caches tiles in memory — moving back to a seen area is instant
 * - Pre-loads surrounding tiles for smooth panning
 * - Enriches articles on demand (when user clicks one)
 */
export function useTileArticles(
  mapRef: React.RefObject<MapRef | null>,
  language: string,
  zoom: number
) {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({ tiles: 0, articles: 0, inflight: 0 });
  const lastBoundsRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevLanguageRef = useRef(language);

  // Clear cache when language changes
  useEffect(() => {
    if (prevLanguageRef.current !== language) {
      clearCacheForLanguage(prevLanguageRef.current);
      prevLanguageRef.current = language;
      // Force reload
      lastBoundsRef.current = "";
      loadArticles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const getBounds = useCallback((): Bounds | null => {
    const map = mapRef.current?.getMap();
    if (!map) return null;
    const b = map.getBounds();
    if (!b) return null;
    return {
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    };
  }, [mapRef]);

  const loadArticles = useCallback(async () => {
    const bounds = getBounds();
    if (!bounds) return;

    // Skip if zoom too low
    if (zoom < 3) return;

    // Quantize bounds to avoid refetching on tiny movements
    const quantize = (v: number, step: number) =>
      Math.round(v / step) * step;
    const step = zoom >= 12 ? 0.01 : zoom >= 8 ? 0.05 : 0.1;
    const qKey = [
      quantize(bounds.north, step),
      quantize(bounds.south, step),
      quantize(bounds.east, step),
      quantize(bounds.west, step),
      language,
    ].join(",");

    if (qKey === lastBoundsRef.current) return;
    lastBoundsRef.current = qKey;

    setIsLoading(true);

    try {
      const result = await getArticlesForBounds(bounds, language);
      setArticles(result);
      setStats(getCacheStats());

      // Pre-load surrounding tiles in background
      preloadSurroundingTiles(bounds, language);
    } catch {
      // Don't clear existing articles on error
    } finally {
      setIsLoading(false);
    }
  }, [getBounds, language, zoom]);

  // Debounced load on map move
  const onMapMove = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadArticles, 150);
  }, [loadArticles]);

  // Warm IndexedDB cache on mount, then load articles
  const cacheWarmed = useRef(false);
  useEffect(() => {
    if (!cacheWarmed.current) {
      cacheWarmed.current = true;
      warmCacheFromDB().then(() => loadArticles());
    } else {
      loadArticles();
    }
  }, [loadArticles]);

  // Enrich a single article (fetch details)
  const enrich = useCallback(
    async (article: WikiArticle): Promise<WikiArticle> => {
      const enriched = await enrichArticle(article.pageid, language);
      return enriched || article;
    },
    [language]
  );

  return {
    articles,
    isLoading,
    stats,
    onMapMove,
    enrichArticle: enrich,
    reload: loadArticles,
  };
}
