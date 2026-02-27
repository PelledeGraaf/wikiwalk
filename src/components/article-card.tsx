"use client";

import { WikiArticle } from "@/lib/wikipedia";
import { MapPin, Plus, Check, ExternalLink } from "lucide-react";

interface ArticleCardProps {
  article: WikiArticle;
  walkingMode: boolean;
  isInRoute: boolean;
  onReadMore: () => void;
  onToggleRoute: () => void;
}

export function ArticleCard({
  article,
  walkingMode,
  isInRoute,
  onReadMore,
  onToggleRoute,
}: ArticleCardProps) {
  return (
    <div className="w-64 p-0">
      {article.thumbnail && (
        <div className="w-full h-32 overflow-hidden rounded-t-lg -mt-[15px] -mx-[10px] mb-2" style={{ width: "calc(100% + 20px)" }}>
          <img
            src={article.thumbnail}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">
          {article.title}
        </h3>
        {article.description && (
          <p className="text-xs text-gray-500 italic">{article.description}</p>
        )}
        {article.extract && (
          <p className="text-xs text-gray-600 line-clamp-3">
            {article.extract}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onReadMore}
            className="flex-1 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            Lees meer
          </button>
          {walkingMode && (
            <button
              onClick={onToggleRoute}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors ${
                isInRoute
                  ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isInRoute ? (
                <>
                  <Check className="w-3 h-3" /> Route
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" /> Route
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
