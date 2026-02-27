"use client";

import { WikiArticle } from "@/lib/wikipedia";
import { X, ExternalLink, Plus, Check, MapPin, Navigation, Clock, Tag } from "lucide-react";
import { formatDistance, haversineDistance } from "@/lib/geo";
import { useRef, useState, useCallback, useEffect } from "react";

interface ArticlePanelProps {
  article: WikiArticle;
  language: string;
  walkingMode: boolean;
  isInRoute: boolean;
  userLocation: { lat: number; lon: number } | null;
  onClose: () => void;
  onToggleRoute: () => void;
  onNavigate: (lat: number, lon: number) => void;
}

export function ArticlePanel({
  article,
  language,
  walkingMode,
  isInRoute,
  userLocation,
  onClose,
  onToggleRoute,
  onNavigate,
}: ArticlePanelProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<string[]>([]);

  // Fetch categories for this article
  useEffect(() => {
    setCategories([]);
    const apiBase = language === "nl"
      ? "https://nl.wikipedia.org/w/api.php"
      : "https://en.wikipedia.org/w/api.php";

    const params = new URLSearchParams({
      action: "query",
      pageids: String(article.pageid),
      prop: "categories",
      cllimit: "10",
      clshow: "!hidden",
      format: "json",
      origin: "*",
    });

    fetch(`${apiBase}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const page = data.query?.pages?.[String(article.pageid)];
        if (page?.categories) {
          const cats = page.categories
            .map((c: { title: string }) => c.title.replace(/^Categorie:|^Category:/, ""))
            .slice(0, 5);
          setCategories(cats);
        }
      })
      .catch(() => {});
  }, [article.pageid, language]);

  // Calculate distance from user
  const distanceText = userLocation
    ? formatDistance(
        haversineDistance(userLocation.lat, userLocation.lon, article.lat, article.lon)
      )
    : null;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only enable drag from the handle area (top 40px)
    const touch = e.touches[0];
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect && touch.clientY - rect.top < 40) {
      dragStartRef.current = touch.clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartRef.current === null) return;
    const delta = e.touches[0].clientY - dragStartRef.current;
    if (delta > 0) {
      setDragOffset(delta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragOffset > 100) {
      onClose();
    }
    setDragOffset(0);
    dragStartRef.current = null;
  }, [dragOffset, onClose]);

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 bg-black/30 z-20 sm:hidden"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-2xl overflow-hidden max-h-[85dvh] flex flex-col safe-bottom
                   sm:absolute sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto sm:w-96 sm:rounded-none sm:max-h-none"
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: dragOffset === 0 ? "transform 0.2s ease-out" : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center py-2 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Header image */}
          {article.thumbnail && (
            <div className="relative w-full h-44 sm:h-48">
              <img
                src={article.thumbnail}
                alt={article.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <button
                onClick={onClose}
                className="absolute top-3 right-3 w-9 h-9 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center active:bg-black/60 sm:hover:bg-black/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-3 left-4 right-4">
                <h2 className="text-xl font-bold text-white leading-tight">
                  {article.title}
                </h2>
              </div>
            </div>
          )}

          {!article.thumbnail && (
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 pr-2">{article.title}</h2>
              <button
                onClick={onClose}
                className="w-9 h-9 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center flex-shrink-0 active:bg-gray-200 sm:hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Description */}
            {article.description && (
              <p className="text-sm text-emerald-700 font-medium bg-emerald-50 px-3 py-2 rounded-lg">
                {article.description}
              </p>
            )}

            {/* Distance + Coordinates row */}
            <div className="flex items-center gap-4 text-xs text-gray-400">
              {distanceText && (
                <div className="flex items-center gap-1.5 text-blue-600 font-medium bg-blue-50 px-2.5 py-1.5 rounded-lg">
                  <Navigation className="w-3 h-3" />
                  <span>{distanceText}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                <span>
                  {article.lat.toFixed(5)}, {article.lon.toFixed(5)}
                </span>
              </div>
            </div>

            {/* Extract */}
            {article.extract && (
              <p className="text-sm text-gray-700 leading-relaxed">
                {article.extract}
              </p>
            )}

            {/* Categories */}
            {categories.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Tag className="w-3 h-3" />
                  <span>Categorieën</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <span
                      key={cat}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2 pb-4">
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-3 sm:py-2.5 rounded-xl active:bg-emerald-700 sm:hover:bg-emerald-700 transition-colors font-medium text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Lees op Wikipedia
                </a>
              )}

              {/* Navigation buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => onNavigate(article.lat, article.lon)}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 sm:py-2.5 rounded-xl active:bg-blue-700 sm:hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                  <Navigation className="w-4 h-4" />
                  Navigeer
                </button>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${article.lat},${article.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-blue-50 text-blue-700 px-3 py-3 sm:py-2.5 rounded-xl active:bg-blue-100 sm:hover:bg-blue-100 transition-colors text-sm"
                  title="Open in Google Maps"
                >
                  <ExternalLink className="w-4 h-4" />
                  Maps
                </a>
              </div>

              {walkingMode && (
                <button
                  onClick={onToggleRoute}
                  className={`flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl font-medium text-sm transition-colors ${
                    isInRoute
                      ? "bg-orange-100 text-orange-700 active:bg-orange-200"
                      : "bg-gray-100 text-gray-700 active:bg-gray-200"
                  }`}
                >
                  {isInRoute ? (
                    <>
                      <Check className="w-4 h-4" />
                      Verwijder uit route
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Voeg toe aan route
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
