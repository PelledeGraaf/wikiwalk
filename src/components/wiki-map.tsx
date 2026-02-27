"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Marker,
  Popup,
  NavigationControl,
  GeolocateControl,
  Source,
  Layer,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type maplibregl from "maplibre-gl";
import { useQuery } from "@tanstack/react-query";
import { fetchNearbyArticles, type WikiArticle } from "@/lib/wikipedia";
import { MapViewState, DEFAULT_VIEW } from "@/lib/constants";
import { ArticleCard } from "./article-card";
import { SearchBar } from "./search-bar";
import { WalkingMode } from "./walking-mode";
import { FilterBar } from "./filter-bar";
import { ArticlePanel } from "./article-panel";
import {
  MapPin,
  Footprints,
  Layers,
  X,
  Navigation,
  Compass,
} from "lucide-react";
import { useNavigation } from "@/hooks/use-navigation";
import { UserLocationMarker } from "./user-location-marker";

const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export function WikiMap() {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_VIEW);
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(
    null
  );
  const [hoveredArticle, setHoveredArticle] = useState<WikiArticle | null>(
    null
  );
  const [walkingMode, setWalkingMode] = useState(false);
  const [walkingArticles, setWalkingArticles] = useState<WikiArticle[]>([]);
  const [language, setLanguage] = useState<"nl" | "en">("nl");
  const [panelArticle, setPanelArticle] = useState<WikiArticle | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const navigationState = useNavigation(navigating);
  const lastCameraUpdateRef = useRef<number>(0);

  // Ask for user location on mount and fly to it
  useEffect(() => {
    if (locationRequested) return;
    setLocationRequested(true);

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lon: longitude });
        setViewState({ latitude, longitude, zoom: 14 });
        mapRef.current?.flyTo({
          center: [longitude, latitude],
          zoom: 14,
          duration: 1500,
        });
      },
      () => {
        // Permission denied or error — stay on default view (Amsterdam)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [locationRequested]);

  // Navigation mode: follow user position and rotate map to heading
  useEffect(() => {
    if (!navigating || !navigationState || !mapRef.current) return;

    // Update user location for other components
    setUserLocation({
      lat: navigationState.latitude,
      lon: navigationState.longitude,
    });

    // Throttle camera updates to avoid jitter (max every 500ms)
    const now = Date.now();
    if (now - lastCameraUpdateRef.current < 500) return;
    lastCameraUpdateRef.current = now;

    const map = mapRef.current.getMap();
    const options: Record<string, unknown> = {
      center: [navigationState.longitude, navigationState.latitude],
      zoom: 17,
      duration: 800,
      essential: true,
    };

    if (navigationState.heading !== null) {
      options.bearing = navigationState.heading;
      options.pitch = 50;
    }

    map.easeTo(options as maplibregl.EaseToOptions);
  }, [navigating, navigationState]);

  // When starting navigation, also enable walking mode
  const startNavigation = useCallback(() => {
    if (!walkingMode) setWalkingMode(true);
    setNavigating(true);
  }, [walkingMode]);

  const stopNavigation = useCallback(() => {
    setNavigating(false);
    // Reset pitch and bearing
    mapRef.current?.getMap().easeTo({
      pitch: 0,
      bearing: 0,
      duration: 500,
    });
  }, []);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: [
      "nearby",
      viewState.latitude.toFixed(3),
      viewState.longitude.toFixed(3),
      viewState.zoom.toFixed(0),
      language,
    ],
    queryFn: () => {
      const radius = Math.min(
        10000,
        Math.max(500, Math.round(40000 / Math.pow(2, viewState.zoom - 10)))
      );
      return fetchNearbyArticles(
        viewState.latitude,
        viewState.longitude,
        radius,
        50,
        language
      );
    },
    enabled: viewState.zoom >= 10,
  });

  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    setViewState({
      latitude: e.viewState.latitude,
      longitude: e.viewState.longitude,
      zoom: e.viewState.zoom,
    });
  }, []);

  const handleArticleClick = useCallback((article: WikiArticle) => {
    setSelectedArticle(null);
    setPanelArticle(article);
  }, []);

  const handleMarkerClick = useCallback(
    (article: WikiArticle) => {
      setSelectedArticle(article);
      mapRef.current?.flyTo({
        center: [article.lon, article.lat],
        zoom: Math.max(viewState.zoom, 15),
        duration: 800,
      });
    },
    [viewState.zoom]
  );

  const flyToLocation = useCallback((lat: number, lon: number, zoom = 15) => {
    mapRef.current?.flyTo({
      center: [lon, lat],
      zoom,
      duration: 1000,
    });
  }, []);

  const toggleWalkingArticle = useCallback(
    (article: WikiArticle) => {
      setWalkingArticles((prev) => {
        const exists = prev.find((a) => a.pageid === article.pageid);
        if (exists) return prev.filter((a) => a.pageid !== article.pageid);
        return [...prev, article];
      });
    },
    []
  );

  // Walking route line
  const routeGeoJson = walkingMode &&
    walkingArticles.length >= 2 && {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: walkingArticles.map((a) => [a.lon, a.lat]),
      },
    };

  return (
    <div className="relative w-full h-screen">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="flex items-start gap-3 p-4">
          {/* Logo */}
          <div className="pointer-events-auto bg-white rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-lg tracking-tight text-gray-900">
              Wiki<span className="text-emerald-600">Walk</span>
            </span>
          </div>

          {/* Search */}
          <div className="pointer-events-auto flex-1 max-w-lg">
            <SearchBar
              language={language}
              onSelectResult={(article) => {
                flyToLocation(article.lat, article.lon);
                setPanelArticle(article);
              }}
            />
          </div>

          {/* Controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Language toggle */}
            <button
              onClick={() => setLanguage(language === "nl" ? "en" : "nl")}
              className="bg-white rounded-xl shadow-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {language === "nl" ? "🇳🇱 NL" : "🇬🇧 EN"}
            </button>

            {/* Walking mode toggle */}
            <button
              onClick={() => {
                setWalkingMode(!walkingMode);
                if (walkingMode) setWalkingArticles([]);
              }}
              className={`rounded-xl shadow-lg px-3 py-2.5 flex items-center gap-2 text-sm font-medium transition-colors ${
                walkingMode
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Footprints className="w-4 h-4" />
              <span className="hidden sm:inline">Walking Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Walking mode panel */}
      {walkingMode && (
        <WalkingMode
          articles={walkingArticles}
          userLocation={userLocation}
          navigating={navigating}
          onStartNavigation={startNavigation}
          onStopNavigation={stopNavigation}
          onRemoveArticle={(pageid) =>
            setWalkingArticles((prev) =>
              prev.filter((a) => a.pageid !== pageid)
            )
          }
          onClear={() => {
            setWalkingArticles([]);
            if (navigating) stopNavigation();
          }}
          onFlyTo={flyToLocation}
        />
      )}

      {/* Article detail panel */}
      {panelArticle && (
        <ArticlePanel
          article={panelArticle}
          language={language}
          walkingMode={walkingMode}
          isInRoute={walkingArticles.some(
            (a) => a.pageid === panelArticle.pageid
          )}
          onClose={() => setPanelArticle(null)}
          onToggleRoute={() => toggleWalkingArticle(panelArticle)}
        />
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur rounded-full px-4 py-2 shadow-lg text-sm text-gray-600 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          Artikelen laden...
        </div>
      )}

      {/* Zoom hint */}
      {viewState.zoom < 10 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur rounded-full px-4 py-2 shadow-lg text-sm text-gray-600">
          Zoom in om Wikipedia artikelen te zien
        </div>
      )}

      {/* Map */}
      <Map
        ref={mapRef}
        initialViewState={DEFAULT_VIEW}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        onMoveEnd={handleMoveEnd}
        maxZoom={19}
        minZoom={3}
      >
        <NavigationControl position="bottom-right" />
        {!navigating && (
          <GeolocateControl
            position="bottom-right"
            trackUserLocation
            onGeolocate={(e) =>
              setUserLocation({
                lat: e.coords.latitude,
                lon: e.coords.longitude,
              })
            }
          />
        )}

        {/* User location marker during navigation */}
        {navigating && navigationState && (
          <Marker
            latitude={navigationState.latitude}
            longitude={navigationState.longitude}
            anchor="center"
          >
            <UserLocationMarker
              heading={navigationState.heading}
              accuracy={navigationState.accuracy}
            />
          </Marker>
        )}

        {/* Article markers */}
        {articles.map((article) => {
          const isSelected = selectedArticle?.pageid === article.pageid;
          const isInRoute = walkingArticles.some(
            (a) => a.pageid === article.pageid
          );
          const isHovered = hoveredArticle?.pageid === article.pageid;

          return (
            <Marker
              key={article.pageid}
              latitude={article.lat}
              longitude={article.lon}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleMarkerClick(article);
              }}
            >
              <div
                className={`transition-all duration-200 cursor-pointer ${
                  isHovered || isSelected ? "scale-125" : "scale-100"
                }`}
                onMouseEnter={() => setHoveredArticle(article)}
                onMouseLeave={() => setHoveredArticle(null)}
              >
                <div
                  className={`w-3 h-3 rounded-full border-2 shadow-md ${
                    isInRoute
                      ? "bg-orange-500 border-orange-300 w-4 h-4"
                      : isSelected
                      ? "bg-emerald-600 border-emerald-300 w-4 h-4"
                      : "bg-emerald-500 border-white"
                  }`}
                />
              </div>
            </Marker>
          );
        })}

        {/* Walking route line */}
        {routeGeoJson && (
          <Source
            id="route"
            type="geojson"
            data={routeGeoJson as GeoJSON.Feature}
          >
            <Layer
              id="route-line"
              type="line"
              paint={{
                "line-color": "#f97316",
                "line-width": 3,
                "line-dasharray": [2, 1],
              }}
            />
          </Source>
        )}

        {/* Walking route markers with numbers */}
        {walkingMode &&
          walkingArticles.map((article, index) => (
            <Marker
              key={`walk-${article.pageid}`}
              latitude={article.lat}
              longitude={article.lon}
              anchor="center"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold border-2 border-white shadow-lg">
                {index + 1}
              </div>
            </Marker>
          ))}

        {/* Popup on click */}
        {selectedArticle && (
          <Popup
            latitude={selectedArticle.lat}
            longitude={selectedArticle.lon}
            anchor="bottom"
            offset={12}
            closeOnClick={false}
            onClose={() => setSelectedArticle(null)}
            className="wiki-popup"
          >
            <ArticleCard
              article={selectedArticle}
              walkingMode={walkingMode}
              isInRoute={walkingArticles.some(
                (a) => a.pageid === selectedArticle.pageid
              )}
              onReadMore={() => handleArticleClick(selectedArticle)}
              onToggleRoute={() => toggleWalkingArticle(selectedArticle)}
            />
          </Popup>
        )}
      </Map>
    </div>
  );
}
