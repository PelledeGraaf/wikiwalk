"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { searchArticles, type WikiArticle } from "@/lib/wikipedia";

interface SearchBarProps {
  language: string;
  onSelectResult: (article: WikiArticle) => void;
}

export function SearchBar({ language, onSelectResult }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WikiArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  const handleSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const data = await searchArticles(q, language);
        setResults(data);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [language]
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => handleSearch(value), 300);
    },
    [handleSearch]
  );

  const handleSelect = useCallback(
    (article: WikiArticle) => {
      setQuery("");
      setResults([]);
      setShowResults(false);
      onSelectResult(article);
    },
    [onSelectResult]
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center bg-white rounded-xl shadow-lg overflow-hidden">
        <Search className="w-4 h-4 text-gray-400 ml-3" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Zoek een plek, monument, gebouw..."
          className="flex-1 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
        />
        {isSearching && (
          <Loader2 className="w-4 h-4 text-gray-400 mr-2 animate-spin" />
        )}
        {query && !isSearching && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setShowResults(false);
              inputRef.current?.focus();
            }}
            className="mr-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-80 overflow-y-auto z-50">
          {results.map((article) => (
            <button
              key={article.pageid}
              onClick={() => handleSelect(article)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
            >
              {article.thumbnail ? (
                <img
                  src={article.thumbnail}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Search className="w-4 h-4 text-emerald-600" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {article.title}
                </p>
                {article.description && (
                  <p className="text-xs text-gray-500 truncate">
                    {article.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && query.length >= 2 && results.length === 0 && !isSearching && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50">
          <p className="text-sm text-gray-500 text-center">
            Geen resultaten met coördinaten gevonden
          </p>
        </div>
      )}
    </div>
  );
}
