"use client";

import { WikiArticle } from "@/lib/wikipedia";
import {
  totalRouteDistance,
  estimateWalkingTime,
  formatDistance,
  generateWalkingRoute,
} from "@/lib/geo";
import {
  Footprints,
  X,
  Trash2,
  Navigation,
  Clock,
  Route,
  GripVertical,
  Play,
  Square,
  Locate,
} from "lucide-react";

interface WalkingModeProps {
  articles: WikiArticle[];
  userLocation: { lat: number; lon: number } | null;
  navigating: boolean;
  onStartNavigation: () => void;
  onStopNavigation: () => void;
  onRemoveArticle: (pageid: number) => void;
  onClear: () => void;
  onFlyTo: (lat: number, lon: number, zoom?: number) => void;
}

export function WalkingMode({
  articles,
  userLocation,
  navigating,
  onStartNavigation,
  onStopNavigation,
  onRemoveArticle,
  onClear,
  onFlyTo,
}: WalkingModeProps) {
  const distance = totalRouteDistance(articles);
  const walkTime = estimateWalkingTime(distance);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 sm:bottom-auto sm:top-20 sm:left-4 sm:right-auto sm:w-80 bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[50dvh] sm:max-h-[calc(100vh-120px)] flex flex-col safe-bottom">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Footprints className="w-5 h-5" />
            <h3 className="font-bold text-sm">Walking Mode</h3>
          </div>
          {articles.length > 0 && (
            <button
              onClick={onClear}
              className="text-white/80 hover:text-white text-xs flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Wis alles
            </button>
          )}
        </div>
        {articles.length >= 2 && (
          <div className="flex items-center gap-4 mt-2 text-sm text-white/90">
            <span className="flex items-center gap-1">
              <Route className="w-3.5 h-3.5" />
              {formatDistance(distance)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              ~{walkTime} min
            </span>
            <span className="flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5" />
              {articles.length} stops
            </span>
          </div>
        )}
      </div>

      {/* Route list */}
      <div className="flex-1 overflow-y-auto">
        {articles.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            <Footprints className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="font-medium text-gray-700 mb-1">Plan je route</p>
            <p>
              Klik op markers op de kaart en voeg ze toe aan je wandelroute.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {articles.map((article, index) => (
              <div
                key={article.pageid}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => onFlyTo(article.lat, article.lon)}
                >
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {article.title}
                  </p>
                  {article.description && (
                    <p className="text-xs text-gray-500 truncate">
                      {article.description}
                    </p>
                  )}
                </button>
                <button
                  onClick={() => onRemoveArticle(article.pageid)}
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-gray-400 hover:text-red-500 active:text-red-500 transition-all p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation controls */}
      {articles.length >= 1 && (
        <div className="border-t p-3 space-y-2">
          {navigating ? (
            <button
              onClick={onStopNavigation}
              className="w-full flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-2.5 rounded-xl hover:bg-red-600 transition-colors font-medium text-sm"
            >
              <Square className="w-4 h-4" />
              Stop navigatie
            </button>
          ) : (
            <button
              onClick={onStartNavigation}
              className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2.5 rounded-xl hover:bg-blue-600 transition-colors font-medium text-sm"
            >
              <Navigation className="w-4 h-4" />
              Start navigatie
            </button>
          )}
          {articles.length >= 3 && !navigating && (
            <button
              onClick={() => {
                // Placeholder for route optimization
              }}
              className="w-full text-xs bg-orange-50 text-orange-700 px-3 py-2 rounded-lg hover:bg-orange-100 transition-colors font-medium"
            >
              🔀 Optimaliseer route
            </button>
          )}
        </div>
      )}
    </div>
  );
}
