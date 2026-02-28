"use client";

import { WikiArticle } from "@/lib/wikipedia";
import { haversineDistance, formatDistance } from "@/lib/geo";
import { MapPin, ChevronRight, X, List } from "lucide-react";
import { useState, useMemo } from "react";

interface NearbyListProps {
  articles: WikiArticle[];
  userLocation: { lat: number; lon: number } | null;
  onSelectArticle: (article: WikiArticle) => void;
}

export function NearbyList({
  articles,
  userLocation,
  onSelectArticle,
}: NearbyListProps) {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(() => {
    if (!userLocation) return articles.slice(0, 30);
    return [...articles]
      .map((a) => ({
        ...a,
        _dist: haversineDistance(
          userLocation.lat,
          userLocation.lon,
          a.lat,
          a.lon
        ),
      }))
      .sort((a, b) => a._dist - b._dist)
      .slice(0, 30);
  }, [articles, userLocation]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg px-2.5 py-2 sm:px-3 sm:py-2.5 text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 sm:hover:bg-gray-50 dark:sm:hover:bg-gray-700 transition-colors"
        title="Dichtbij mij"
      >
        <List className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
      <div className="relative bg-white dark:bg-gray-900 w-full sm:w-96 sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[70dvh] flex flex-col overflow-hidden safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Dichtbij mij</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              Geen artikelen in de buurt gevonden
            </div>
          ) : (
            sorted.map((article) => {
              const dist =
                userLocation
                  ? haversineDistance(
                      userLocation.lat,
                      userLocation.lon,
                      article.lat,
                      article.lon
                    )
                  : null;
              return (
                <button
                  key={article.pageid}
                  onClick={() => {
                    onSelectArticle(article);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800 sm:hover:bg-gray-50 dark:sm:hover:bg-gray-800 transition-colors text-left border-b border-gray-50 dark:border-gray-800 last:border-0"
                >
                  {article.thumbnail ? (
                    <img
                      src={article.thumbnail}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {article.title}
                    </p>
                    {article.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {article.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {dist !== null && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDistance(dist)}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
